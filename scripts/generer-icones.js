/*
 * Génère les icônes de Tantana Suite.
 *
 * Aucune dépendance : l'encodeur PNG tient en quelques lignes (en-tête,
 * IHDR, IDAT compressé par zlib, IEND) et le tracé est fait à la main
 * par sur-échantillonnage. Le fichier .ico encapsule simplement un PNG,
 * ce que tous les navigateurs actuels acceptent.
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

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
  ihdr[8] = 8;   // 8 bits par canal
  ihdr[9] = 6;   // RGBA
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

// --------------------------------------------------------------- Tracé

// Rectangle à coins arrondis : distance signée, pour un rendu net.
function dansRectArrondi(x, y, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  if (x >= x0 + r && x <= x1 - r) return y >= y0 && y <= y1;
  if (y >= y0 + r && y <= y1 - r) return x >= x0 && x <= x1;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

const VERT = [0x00, 0x86, 0x47];
const BLANC = [0xff, 0xff, 0xff];

/**
 * Le monogramme : un T, barre pleine, angles doucement adoucis.
 *
 * Une première version coupait la barre en trois segments pour évoquer
 * les modules réunis. Rendue, elle ne se lisait plus comme une lettre :
 * les trois pastilles se détachaient et celle du milieu fusionnait avec
 * le fût. Une icône d'application se lit à seize pixels ; l'idée ne
 * survivait pas à cette taille et a été abandonnée.
 *
 * Coordonnées centrées sur l'origine, boîte englobante de 1 x 1.
 */
const EPAISSEUR = 0.22;
const RAYON = 0.055;

function dansMonogramme(x, y) {
  const demi = EPAISSEUR / 2;
  const haut = -0.5;
  const bas = -0.5 + EPAISSEUR;
  return (
    dansRectArrondi(x, y, -0.5, haut, 0.5, bas, RAYON) ||
    dansRectArrondi(x, y, -demi, haut, demi, 0.5, RAYON)
  );
}

/**
 * @param taille        côté en pixels
 * @param pleinBord     true pour une icône « maskable » : le vert occupe
 *                      tout le carré, le système applique son propre
 *                      masque et rognerait des coins arrondis.
 * @param partMonogramme part du côté occupée par le T.
 */
function dessiner(taille, pleinBord, partMonogramme) {
  const SS = 4; // sur-échantillonnage
  const px = Buffer.alloc(taille * taille * 4);
  const rayonTuile = pleinBord ? 0 : taille * 0.22;
  const echelle = taille * partMonogramme;
  const centre = taille / 2;

  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      let couvertureTuile = 0;
      let couvertureT = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ex = x + (sx + 0.5) / SS;
          const ey = y + (sy + 0.5) / SS;
          if (dansRectArrondi(ex, ey, 0, 0, taille, taille, rayonTuile)) couvertureTuile++;
          if (dansMonogramme((ex - centre) / echelle, (ey - centre) / echelle)) couvertureT++;
        }
      }
      const n = SS * SS;
      const aTuile = couvertureTuile / n;
      const aT = Math.min(couvertureT / n, aTuile); // le T ne déborde jamais
      const d = (y * taille + x) * 4;
      for (let c = 0; c < 3; c++) {
        px[d + c] = Math.round(VERT[c] * (1 - aT / (aTuile || 1)) + BLANC[c] * (aT / (aTuile || 1)));
      }
      px[d + 3] = Math.round(aTuile * 255);
    }
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

const dossier = process.argv[2];
const fichiers = [
  ["icon-192.png", dessiner(192, false, 0.56)],
  ["icon-512.png", dessiner(512, false, 0.56)],
  ["icon-maskable-512.png", dessiner(512, true, 0.48)],
  ["favicon.ico", encoderIco(dessiner(32, false, 0.60), 32)],
];
for (const [nom, buf] of fichiers) {
  fs.writeFileSync(path.join(dossier, nom), buf);
  console.log(`  ${nom.padEnd(24)} ${String(buf.length).padStart(6)} octets`);
}
