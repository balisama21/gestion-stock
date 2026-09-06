/*
 * Génère les icônes de Tantana Suite à partir de `public/logo.svg`.
 *
 * Le logo est la seule source : le script lit ses chemins, les aplatit en
 * polygones puis les remplit lui-même par balayage de lignes, avec la
 * règle « non nulle » pour que les contre-formes des lettres restent
 * creuses. Le PNG d'origine fourni ne faisait que 250 px de large — le
 * redimensionner aurait donné une icône 512 floue ; partir du vectoriel
 * donne un tracé net à toutes les tailles.
 *
 * Aucune dépendance : l'encodeur PNG tient en quelques lignes (en-tête,
 * IHDR, IDAT compressé par zlib, IEND) et le fichier .ico encapsule
 * simplement un PNG, ce que tous les navigateurs actuels acceptent.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

// ---------------------------------------------------------------- PNG

let TABLE_CRC = null;
function crc32(buf) {
  if (!TABLE_CRC) {
    TABLE_CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE_CRC[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(data.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const somme = Buffer.alloc(4);
  somme.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, somme]);
}

function encoderPng(largeur, hauteur, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 6; // RGBA
  const brut = Buffer.alloc(hauteur * (1 + largeur * 4));
  for (let y = 0; y < hauteur; y++) {
    const dep = y * (1 + largeur * 4);
    brut[dep] = 0; // filtre « None »
    rgba.copy(brut, dep + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(brut, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------- Lecture du SVG

/** Découpe une chaîne de chemin SVG en commandes et nombres. */
function jetons(d) {
  return d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
}

/**
 * Aplatit un chemin en polygones. Seules les commandes que nous
 * produisons sont gérées : M, L, C, Z, en coordonnées absolues.
 */
function aplatir(d, parSegment) {
  const t = jetons(d);
  const polys = [];
  let poly = null;
  let x = 0,
    y = 0,
    i = 0;
  const nombre = () => parseFloat(t[i++]);
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === "M") {
      if (poly && poly.length > 2) polys.push(poly);
      x = nombre();
      y = nombre();
      poly = [[x, y]];
    } else if (cmd === "L") {
      x = nombre();
      y = nombre();
      poly.push([x, y]);
    } else if (cmd === "C") {
      const x1 = nombre(),
        y1 = nombre(),
        x2 = nombre(),
        y2 = nombre();
      const x3 = nombre(),
        y3 = nombre();
      // Le nombre de segments suit la longueur du polygone de contrôle :
      // une petite courbe n'a pas besoin d'autant de points qu'une grande.
      const l =
        Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
      const n = Math.max(2, Math.min(24, Math.ceil(l * parSegment)));
      for (let k = 1; k <= n; k++) {
        const u = k / n,
          v = 1 - u;
        poly.push([
          v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
          v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3,
        ]);
      }
      x = x3;
      y = y3;
    } else if (cmd === "Z" || cmd === "z") {
      if (poly && poly.length > 2) polys.push(poly);
      poly = null;
    } else {
      i++; // commande inconnue : on saute
    }
  }
  if (poly && poly.length > 2) polys.push(poly);
  return polys;
}

function lireLogo(fichier) {
  const svg = fs.readFileSync(fichier, "utf8");
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  if (!vb) throw new Error("viewBox introuvable dans " + fichier);
  const chemins = [];
  const re = /<path\s+fill="(#[0-9a-fA-F]{6})"\s+d="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg))) {
    chemins.push({
      couleur: [1, 3, 5].map((k) => parseInt(m[1].substr(k, 2), 16)),
      d: m[2],
    });
  }
  if (!chemins.length) throw new Error("aucun chemin dans " + fichier);
  return { boite: vb.slice(1, 5).map(Number), chemins };
}

// ------------------------------------------------------------- Remplissage

/**
 * Remplit des polygones dans une carte de couverture, règle « non nulle ».
 *
 * Le balayage se fait sur `SS` sous-lignes par pixel — la précision
 * verticale — tandis que la couverture horizontale est calculée
 * exactement, par recouvrement d'intervalle. Les contre-formes (le creux
 * du « a », par exemple) sortent du traçage avec le sens inverse : la
 * règle non nulle les laisse donc vides sans traitement particulier.
 */
function remplir(polys, taille, SS) {
  const couverture = new Float32Array(taille * taille);
  const aretes = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      if (a[1] === b[1]) continue;
      aretes.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], sens: b[1] > a[1] ? 1 : -1 });
    }
  }
  // Rangement par ligne de pixel, pour ne pas tester toutes les arêtes
  // à chaque sous-ligne.
  const seaux = Array.from({ length: taille }, () => []);
  for (const a of aretes) {
    const yh = Math.max(0, Math.floor(Math.min(a.y0, a.y1)));
    const yb = Math.min(taille - 1, Math.ceil(Math.max(a.y0, a.y1)));
    for (let y = yh; y <= yb; y++) seaux[y].push(a);
  }
  const croisements = [];
  for (let y = 0; y < taille; y++) {
    const seau = seaux[y];
    if (!seau.length) continue;
    for (let s = 0; s < SS; s++) {
      const ys = y + (s + 0.5) / SS;
      croisements.length = 0;
      for (const a of seau) {
        const yh = Math.min(a.y0, a.y1),
          yb = Math.max(a.y0, a.y1);
        if (ys < yh || ys >= yb) continue;
        croisements.push({
          x: a.x0 + ((ys - a.y0) * (a.x1 - a.x0)) / (a.y1 - a.y0),
          sens: a.sens,
        });
      }
      if (croisements.length < 2) continue;
      croisements.sort((p, q) => p.x - q.x);
      let enroulement = 0;
      for (let k = 0; k < croisements.length - 1; k++) {
        enroulement += croisements[k].sens;
        if (enroulement === 0) continue;
        const xa = Math.max(0, croisements[k].x);
        const xb = Math.min(taille, croisements[k + 1].x);
        if (xb <= xa) continue;
        const pa = Math.floor(xa),
          pb = Math.ceil(xb);
        for (let px = pa; px < pb; px++) {
          const g = Math.min(xb, px + 1) - Math.max(xa, px);
          if (g > 0) couverture[y * taille + px] += g / SS;
        }
      }
    }
  }
  for (let i = 0; i < couverture.length; i++) couverture[i] = Math.min(1, couverture[i]);
  return couverture;
}

/** Couverture d'un rectangle à coins arrondis, par sur-échantillonnage. */
function couvertureTuile(taille, rayon, SS) {
  const c = new Float32Array(taille * taille);
  const dedans = (x, y) => {
    const cx = Math.min(Math.max(x, rayon), taille - rayon);
    const cy = Math.min(Math.max(y, rayon), taille - rayon);
    if (x >= rayon && x <= taille - rayon) return y >= 0 && y <= taille;
    if (y >= rayon && y <= taille - rayon) return x >= 0 && x <= taille;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rayon * rayon;
  };
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      let n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (dedans(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) n++;
        }
      }
      c[y * taille + x] = n / (SS * SS);
    }
  }
  return c;
}

// --------------------------------------------------------------- Dessin

const FOND = [255, 255, 255];

/**
 * @param taille     côté du carré, en pixels.
 * @param partRayon  rayon des coins, en part du côté (0 = carré plein).
 * @param partMarque largeur de la marque, en part du côté.
 */
function dessiner(logo, taille, partRayon, partMarque) {
  const SS = 8;
  const [bx, by, bw, bh] = logo.boite;
  const echelle = (taille * partMarque) / bw;
  const dx = (taille - bw * echelle) / 2 - bx * echelle;
  const dy = (taille - bh * echelle) / 2 - by * echelle;

  const tuile = partRayon > 0 ? couvertureTuile(taille, taille * partRayon, 4) : null;

  const couches = logo.chemins.map((c) => ({
    couleur: c.couleur,
    couverture: remplir(
      aplatir(c.d, echelle / 3).map((p) => p.map(([x, y]) => [x * echelle + dx, y * echelle + dy])),
      taille,
      SS,
    ),
  }));

  const px = Buffer.alloc(taille * taille * 4);
  for (let i = 0; i < taille * taille; i++) {
    const rgb = [FOND[0], FOND[1], FOND[2]];
    for (const couche of couches) {
      const a = couche.couverture[i];
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) rgb[c] = rgb[c] * (1 - a) + couche.couleur[c] * a;
    }
    const alpha = tuile ? tuile[i] : 1;
    px[i * 4] = Math.round(rgb[0]);
    px[i * 4 + 1] = Math.round(rgb[1]);
    px[i * 4 + 2] = Math.round(rgb[2]);
    px[i * 4 + 3] = Math.round(alpha * 255);
  }
  return encoderPng(taille, taille, px);
}

// --------------------------------------------------------------- .ico

function encoderIco(png, taille) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0);
  entete.writeUInt16LE(1, 2); // type icône
  entete.writeUInt16LE(1, 4); // une seule image
  const entree = Buffer.alloc(16);
  entree[0] = taille === 256 ? 0 : taille;
  entree[1] = taille === 256 ? 0 : taille;
  entree.writeUInt16LE(1, 4);
  entree.writeUInt16LE(32, 6);
  entree.writeUInt32LE(png.length, 8);
  entree.writeUInt32LE(22, 12);
  return Buffer.concat([entete, entree, png]);
}

// -------------------------------------------------------------- Sortie

const dossier = process.argv[2] || "public";
const logo = lireLogo(path.join(dossier, "logo.svg"));
console.log(`  source  logo.svg — boîte ${logo.boite.join(" ")}, ${logo.chemins.length} chemins`);

const fichiers = [
  ["icon-192.png", dessiner(logo, 192, 0.22, 0.76)],
  ["icon-512.png", dessiner(logo, 512, 0.22, 0.76)],
  // Maskable : le système rogne jusqu'à 20 % de chaque bord, donc pas de
  // coins arrondis à nous et une marque nettement plus petite.
  ["icon-maskable-512.png", dessiner(logo, 512, 0, 0.58)],
  // iOS remplit de NOIR toute transparence d'une apple-touch-icon, et
  // applique ensuite son propre masque arrondi : il lui faut donc un
  // carré parfaitement opaque, sans coins arrondis de notre part.
  ["icon-apple-180.png", dessiner(logo, 180, 0, 0.72)],
  ["favicon.ico", encoderIco(dessiner(logo, 48, 0.18, 0.88), 48)],
];
for (const [nom, buf] of fichiers) {
  fs.writeFileSync(path.join(dossier, nom), buf);
  console.log(`  ${nom.padEnd(24)} ${String(buf.length).padStart(6)} octets`);
}
