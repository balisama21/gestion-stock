/**
 * Accorder la barre d'etat du telephone a l'en-tete de l'application.
 *
 * ── Pourquoi en JavaScript, et non en balise ──
 *
 * Deux balises `<meta name="theme-color">` distinguees par une requete
 * media seraient la facon canonique de faire. Elles ne survivent pas
 * ici : le gestionnaire d'en-tete de TanStack dedoublonne les metas par
 * leur `name` et n'en garde qu'une — verifie dans la page rendue, seule
 * la sombre restait, ce qui laissait le mode clair sans couleur du
 * tout, donc noir.
 *
 * Et quand bien meme : `prefers-color-scheme` decrit le reglage du
 * TELEPHONE, pas celui de l'application. Un commercant qui force le
 * mode clair sur un telephone en mode sombre verrait une barre d'etat
 * presque noire au-dessus d'un en-tete blanc. Seul le code sait ce que
 * l'application affiche vraiment.
 *
 * ── Comment la couleur est obtenue ──
 *
 * On lit `--card`, le fond de l'en-tete, plutot que d'ecrire une
 * couleur en dur : le jour ou la palette change, la barre d'etat suit
 * sans qu'on y pense. Le jeton est exprime en `oklch()`, que les
 * anciens navigateurs ne comprennent pas dans `theme-color` ; le canvas
 * sert de traducteur.
 *
 * On PEINT un pixel et on le relit, plutot que de relire `fillStyle` :
 * Chrome rend desormais la chaine telle qu'on la lui a donnee —
 * « oklch(1 0 0) » ressort « oklch(1 0 0) » — et la traduction ne se
 * faisait pas. Le pixel, lui, est toujours en rouge-vert-bleu. S'il
 * n'y arrive pas, on retombe sur le blanc.
 */
const REPLI_CLAIR = "#ffffff";

const deuxChiffres = (n: number): string => n.toString(16).padStart(2, "0");

const enHexadecimal = (couleur: string): string | null => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    // Une valeur refusee laisse `fillStyle` inchange : on part d'une
    // couleur temoin, reconnaissable au pixel, pour deceler ce cas.
    ctx.fillStyle = "#000001";
    ctx.fillStyle = couleur;
    ctx.fillRect(0, 0, 1, 1);
    const [r, v, b] = ctx.getImageData(0, 0, 1, 1).data;
    if (r === 0 && v === 0 && b === 1) return null;
    return `#${deuxChiffres(r)}${deuxChiffres(v)}${deuxChiffres(b)}`;
  } catch {
    return null;
  }
};

/**
 * Pose la couleur et la maintient : au changement de theme dans
 * l'application, et au changement de reglage du telephone.
 *
 * Rend la fonction d'arret, a appeler au demontage.
 */
export function accorderLaBarreDEtat(): () => void {
  if (typeof document === "undefined") return () => {};

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  const balise = meta;

  const accorder = () => {
    const carte = getComputedStyle(document.documentElement).getPropertyValue("--card").trim();
    const couleur = (carte && enHexadecimal(carte)) || REPLI_CLAIR;
    if (balise.content !== couleur) balise.content = couleur;
  };

  accorder();

  // Le theme de l'application se pose en classe sur <html>.
  const observateur = new MutationObserver(accorder);
  observateur.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  });

  const reglageDuTelephone = window.matchMedia("(prefers-color-scheme: dark)");
  reglageDuTelephone.addEventListener("change", accorder);

  return () => {
    observateur.disconnect();
    reglageDuTelephone.removeEventListener("change", accorder);
  };
}
