import {
  Activity,
  BanknoteArrowDown,
  BanknoteArrowUp,
  ChartSpline,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  MapPin,
  Moon,
  Package,
  ShoppingCart,
  Sun,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { dateCourte, dateLongue, heure, montant, nombre } from "../lib/format";
import type { ChiffresDuJour, ChiffresStock } from "../lib/chiffres";
import type { EvenementJournal } from "../lib/journal";
import type { CleTuile } from "../registry";
import {
  HERO_PHOTOS,
  estLaNuitDehors,
  indexDuJour,
  paysagesDuMoment,
  sourcePhoto,
  srcsetPhoto,
  type Photo,
} from "../assets/images";
import { usePhotosHautDePage } from "../lib/photosHautDePage";
import { InspirationDuMoment } from "./InspirationDuMoment";
import { MenuOption, MenuPill } from "./Pill";
import { VILLES, useMeteo, type Ciel } from "../lib/meteo";
import { phraseDuMoment } from "../lib/phrases";
import { usePhrasesAjoutees } from "../lib/phrasesTableau";

/**
 * LE HAUT DU TABLEAU DE BORD
 *
 * Reproduction de la maquette `docs/maquette/dashboard-tantana.html` :
 * le bonjour sur sa photo (jour ou nuit, une photo par jour de la
 * semaine), les cinq cartes du jour qui chevauchent le bas de la photo,
 * l'aperçu des ventes et la carte « Inspiration du moment ».
 *
 * Tout est dessiné dans une unité `--u` qui suit la largeur de la zone
 * (1546 unités de large sur ordinateur), pour garder les proportions de
 * la maquette à toutes les tailles. Sur téléphone l'unité est fixe et
 * les cinq cartes défilent au doigt.
 */

const CHEVRON = <ChevronRight className="kch-svg" aria-hidden="true" />;

/**
 * L'icône de chaque carte du jour : nue, sans pastille ni cadre — la
 * couleur de la carte dit le sens. Le chariot des ventes, le billet qui
 * entre, le billet qui sort, le colis du stock, le tracé de l'activité.
 */
const ICONE_TUILE: Record<CleTuile, React.ReactNode> = {
  ventes: <ShoppingCart aria-hidden="true" />,
  entrees: <BanknoteArrowDown aria-hidden="true" />,
  sorties: <BanknoteArrowUp aria-hidden="true" />,
  stock: <Package aria-hidden="true" />,
  activite: <Activity aria-hidden="true" />,
};

/** « 16 % », signé, ou rien quand il n'y a pas de quoi comparer. */
function ecart(valeur: number, reference: number): string | null {
  if (reference <= 0) return null;
  const p = Math.round(((valeur - reference) / reference) * 100);
  return `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)} % vs hier`;
}

/** L'axe des montants : « 1,5 M », « 350 k », ou le nombre entier. */
function graduation(n: number): string {
  if (n >= 1_000_000) return `${String(Math.round(n / 100_000) / 10).replace(".", ",")} M`;
  if (n >= 10_000) return `${nombre(n / 1000)} k`;
  return nombre(n);
}

/** Un pas « rond » pour quatre graduations environ. */
function pasRond(max: number): number {
  const brut = max / 4;
  const p = 10 ** Math.floor(Math.log10(brut));
  const m = brut / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** La courbe monotone de la maquette (pas de faux creux entre deux points). */
function monotone(P: [number, number][]): string {
  const n = P.length;
  if (n === 0) return "";
  if (n === 1) return `M${P[0][0]},${P[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  const t: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = P[i + 1][0] - P[i][0];
    m[i] = (P[i + 1][1] - P[i][1]) / dx[i];
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
    } else {
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const h = a * a + b * b;
      if (h > 9) {
        const k = 3 / Math.sqrt(h);
        t[i] = k * a * m[i];
        t[i + 1] = k * b * m[i];
      }
    }
  }
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = P[i];
    const [x1, y1] = P[i + 1];
    const h2 = dx[i] / 3;
    d += ` C${x0 + h2},${y0 + t[i] * h2} ${x1 - h2},${y1 - t[i + 1] * h2} ${x1},${y1}`;
  }
  return d;
}

export interface PointVentes {
  jour: string;
  libelle: string;
  montant: number;
}

const GraphiqueVentes: React.FC<{ points: PointVentes[]; montantsVisibles: boolean }> = ({
  points,
  montantsVisibles,
}) => {
  const carte = useRef<SVGSVGElement>(null);
  const [taille, setTaille] = useState<{ w: number; h: number } | null>(null);
  const [survol, setSurvol] = useState<number | null>(null);

  useLayoutEffect(() => {
    const svg = carte.current?.parentElement;
    if (!svg) return;
    const mesurer = () => setTaille({ w: svg.clientWidth, h: svg.clientHeight });
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(svg);
    return () => obs.disconnect();
  }, []);

  if (!taille || !taille.h || points.length === 0) return <svg className="chart" ref={carte} />;

  // Le tracé occupe sa propre zone, sous l'en-tête de la carte.
  const pu = taille.h / 150;
  const W = taille.w / pu;
  const H = 150;
  const base = 112;
  const plein = 92;
  const max = Math.max(...points.map((p) => p.montant), 0);
  // Un ariary au moins : sans ventes, l'axe affichait « 0, 0, 1, 1, 1 ».
  const pas = Math.max(1, pasRond(Math.max(max, 1)));
  const axe = Math.max(pas * 4, Math.ceil(max / pas) * pas);
  const x0 = 70;
  const x1 = W - 47;
  const X = (i: number) =>
    points.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (points.length - 1);
  const Y = (v: number) => base - (v / axe) * plein;
  const P = points.map((p, i) => [X(i), Y(p.montant)] as [number, number]);
  const chemin = monotone(P);
  const graduations: number[] = [];
  for (let g = 0; g <= axe + 1e-9; g += pas) graduations.push(g);
  // Les légendes gardent leur taille à l'écran, quelle que soit celle du
  // dessin : on divise par l'échelle. Autant de libellés que la place en
  // laisse, sept au plus ; ils partent du dernier jour, toujours affiché.
  const texte = { fontSize: `calc(var(--fs-micro) / ${pu})` };
  const largeurLibelle = 62 / pu;
  const place = Math.max(2, Math.min(7, Math.floor((x1 - x0) / largeurLibelle) + 1));
  const pasLibelle = Math.ceil(points.length / place);
  const ancre = (points.length - 1) % pasLibelle;

  return (
    <svg
      className="chart"
      ref={carte}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Ventes par jour : ${points
        .map((p) => `${p.libelle} ${montantsVisibles ? montant(p.montant) : ""}`)
        .join(", ")}`}
      onMouseLeave={() => setSurvol(null)}
    >
      <defs>
        <linearGradient id="tn-ga" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--chart-g)" stopOpacity=".22" />
          <stop offset="1" stopColor="var(--chart-g)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {graduations.map((g) => (
        <g key={g}>
          <line x1={x0 + 1} x2={W - 20} y1={Y(g)} y2={Y(g)} className="grille" />
          {montantsVisibles && (
            <text x={x0 - 12} y={Y(g) + 4 / pu} textAnchor="end" className="axe fort" style={texte}>
              {graduation(g)}
            </text>
          )}
        </g>
      ))}
      {P.length > 1 && (
        <path
          d={`${chemin} L${P[P.length - 1][0]},${base} L${P[0][0]},${base} Z`}
          fill="url(#tn-ga)"
        />
      )}
      <path d={chemin} className="courbe" />
      {/* Pas de point sur chaque jour : la ligne seule, et un repère
          sous la souris pour lire le jour survolé. Un point isolé reste
          marqué, sinon il n'y aurait rien à voir. */}
      {survol !== null && P[survol] && (
        <g className="repere">
          <line x1={P[survol][0]} x2={P[survol][0]} y1={20} y2={base} className="guide" />
          <circle cx={P[survol][0]} cy={P[survol][1]} r={4} className="point" />
        </g>
      )}
      {P.length === 1 && survol === null && (
        <circle cx={P[0][0]} cy={P[0][1]} r={3.5} className="point" />
      )}
      {points.map((p, i) =>
        i % pasLibelle === ancre ? (
          <text key={`l${i}`} x={X(i)} y={H - 6} textAnchor="middle" className="axe" style={texte}>
            {p.libelle}
          </text>
        ) : null,
      )}
      {points.map((p, i) => {
        const largeur = points.length > 1 ? (x1 - x0) / (points.length - 1) : x1 - x0;
        return (
          <rect
            key={`z${i}`}
            x={X(i) - largeur / 2}
            y={20}
            width={largeur}
            height={base - 20}
            fill="transparent"
            onMouseEnter={() => setSurvol(i)}
          >
            <title>{`${p.libelle} · ${montantsVisibles ? montant(p.montant) : "•••"}`}</title>
          </rect>
        );
      })}
    </svg>
  );
};

/** L'icône du ciel, de jour ou de nuit. */
/** L'espace insécable du français devant « ! ? : ; ». */
const typo = (s: string) => s.replace(/ ([!?:;])/g, "\u00a0$1");

function iconeCiel(ciel: Ciel, jour: boolean): React.ReactNode {
  const p = { className: "ic-meteo", "aria-hidden": true } as const;
  switch (ciel) {
    case "soleil":
      return jour ? <Sun {...p} /> : <Moon {...p} />;
    case "nuageux":
      return jour ? <CloudSun {...p} /> : <Cloud {...p} />;
    case "couvert":
      return <Cloud {...p} />;
    case "brouillard":
      return <CloudFog {...p} />;
    case "orage":
      return <CloudLightning {...p} />;
    default:
      return <CloudRain {...p} />;
  }
}

/**
 * La police manuscrite de la devise, demandée une seule fois. Le navigateur
 * n'en charge que la partie latine, sans rien retarder ; une devise
 * ajoutée dans les paramètres s'affiche donc dans la même écriture.
 */
function chargerPoliceDevise() {
  if (typeof document === "undefined" || document.getElementById("tn-police-devise")) return;
  const lien = document.createElement("link");
  lien.id = "tn-police-devise";
  lien.rel = "stylesheet";
  lien.href = `https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap`;
  document.head.appendChild(lien);
}

/** Le temps passé sur chaque paysage du haut de page. */
const DELAI_PAYSAGE = 9_000;

/**
 * LES PAYSAGES DU HAUT DE PAGE, en fondu enchaîné.
 *
 * Les photos viennent de la série du moment — jour ou soir — et changent
 * chaque jour (voir `paysagesDuMoment`). Seuls le paysage affiché et
 * le suivant sont demandés au réseau ; les autres arrivent à leur tour.
 * Le défilement s'arrête au survol et au focus, et ne démarre pas quand
 * le système demande de réduire les animations — les flèches restent.
 *
 * Le paysage affiché ne cède sa place qu'une fois le suivant chargé : pas
 * d'écran vide entre deux photos sur une connexion lente. Une photo qui
 * ne charge pas est retirée du lot ; si aucune ne charge, l'illustration
 * locale, posée dessous par le composant parent, reste visible.
 */
const PaysagesDuHaut: React.FC<{ photos: Photo[] }> = ({ photos }) => {
  const [courant, setCourant] = useState(0);
  const [pause, setPause] = useState(false);
  const [vus, setVus] = useState<Set<number>>(() => new Set([0]));
  const [echecs, setEchecs] = useState<Set<number>>(() => new Set());
  const [charges, setCharges] = useState<Set<number>>(() => new Set());
  const [affiche, setAffiche] = useState(0);
  const n = photos.length;

  const aller = (pas: number) => setCourant((c) => (c + pas + n) % n);

  // Le paysage demandé et le suivant, pour qu'il soit prêt à son tour.
  useEffect(() => {
    const suivant = (courant + 1) % n;
    setVus((v) => (v.has(courant) && v.has(suivant) ? v : new Set([...v, courant, suivant])));
  }, [courant, n]);

  useEffect(() => {
    if (charges.has(courant)) setAffiche(courant);
  }, [charges, courant]);

  useEffect(() => {
    if (pause || n < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setCourant((c) => (c + 1) % n), DELAI_PAYSAGE);
    return () => window.clearInterval(id);
  }, [pause, n]);

  if (echecs.size === n) return null;

  return (
    <div
      className="tb-paysages"
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)}
      onBlur={() => setPause(false)}
    >
      {photos.map((p, i) =>
        vus.has(i) && !echecs.has(i) ? (
          <img
            key={p.id}
            className={`tb-paysage${i === affiche && charges.has(i) ? " actif" : ""}`}
            src={sourcePhoto(p, 1800)}
            srcSet={p.url ? undefined : srcsetPhoto(p.id, [900, 1400, 1800, 2400])}
            sizes="100vw"
            alt=""
            decoding="async"
            draggable={false}
            fetchPriority={i === courant ? "high" : "low"}
            style={{ objectPosition: p.cadrage }}
            onLoad={() => setCharges((s) => new Set([...s, i]))}
            onError={() => setEchecs((e) => new Set([...e, i]))}
          />
        ) : null,
      )}
      {n > 1 && (
        <div className="tb-nav" role="group" aria-label="Paysages">
          <button type="button" onClick={() => aller(-1)} aria-label="Paysage précédent">
            <ChevronRight className="tb-nav-g" aria-hidden="true" />
          </button>
          <div className="tb-points" aria-hidden="true">
            {photos.map((p, i) => (
              <span key={p.id} className={i === courant ? "actif" : undefined} />
            ))}
          </div>
          <button type="button" onClick={() => aller(1)} aria-label="Paysage suivant">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export interface HeroProps {
  /** « Bonjour, Mamy » : le prénom, ou rien. */
  prenom: string;
  /**
   * Le thème sombre de l'application. Il ne change plus les photos : elles
   * suivent l'heure réelle — vraies photos de jour le jour, vraies photos
   * du soir le soir, jamais une photo de jour assombrie.
   */
  sombre?: boolean;
  /** Quand les données ont été lues pour la dernière fois. */
  chargeA: Date | null;
  onRafraichir: () => void;
  boutonRafraichir: React.RefObject<HTMLButtonElement | null>;
  /** Le choix de la vue métier, quand il y en a plusieurs. */
  vue?: React.ReactNode;
  /** Les puces de ce qui est urgent, s'il y a quelque chose. */
  alertes?: React.ReactNode;

  tuiles: CleTuile[];
  jour: ChiffresDuJour;
  stock: ChiffresStock;
  journal: EvenementJournal[];
  /**
   * Faux tant que la première lecture du journal n'est pas revenue. Sans
   * lui, la carte annonçait « Rien d'enregistré aujourd'hui · 0 événement »
   * pendant le chargement, puis « 5 événements » une seconde plus tard.
   */
  journalPret?: boolean;
  erreurJournal?: string | null;
  onReessayerJournal?: () => void;
  valeurStockVisible: boolean;
  montantsAchatVisibles: boolean;
  montantsVentesVisibles: boolean;
  /** Le chevron d'une carte : son panneau de détail. */
  onOuvrir: (cle: CleTuile) => void;
  /** Les liens des cartes : l'écran de l'application. */
  onNaviguer?: (onglet: string) => void;

  /** L'aperçu des ventes, s'il est permis. */
  graphique?: {
    points: PointVentes[];
    sousTitre: string;
    selecteur: React.ReactNode;
    onDetails: () => void;
  };
}

export const HeroTableauDeBord: React.FC<HeroProps> = ({
  prenom,
  chargeA,
  onRafraichir,
  boutonRafraichir,
  vue,
  alertes,
  tuiles,
  jour,
  stock,
  journal,
  journalPret = true,
  erreurJournal,
  onReessayerJournal,
  valeurStockVisible,
  montantsAchatVisibles,
  montantsVentesVisibles,
  onOuvrir,
  onNaviguer,
  graphique,
}) => {
  /**
   * L'horloge : posée après le premier rendu, jamais pendant — le serveur
   * et le navigateur n'ont pas la même heure, et l'hydratation
   * divergerait. Elle avance toutes les trente secondes.
   */
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    setMaintenant(new Date());
    const id = window.setInterval(() => setMaintenant(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { ville, choisirVille, meteo } = useMeteo();
  useEffect(chargerPoliceDevise, []);

  const h = maintenant?.getHours() ?? 12;
  // Le soir dehors (18 h – 6 h) : la série des photos du soir.
  const nuit = estLaNuitDehors(maintenant ?? new Date(2026, 0, 5, 12));
  const photosImportees = usePhotosHautDePage();
  const paysages = useMemo(
    () => paysagesDuMoment(maintenant ?? new Date(2026, 0, 5, 12), photosImportees),
    // Recalculé seulement quand le jour ou la série change, pas à chaque
    // battement de l'horloge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nuit, maintenant?.toDateString(), photosImportees],
  );
  const idx = indexDuJour(maintenant ?? new Date(2026, 0, 5));
  const photo = HERO_PHOTOS[idx];
  const salutation = h >= 18 || h < 4 ? "Bonsoir" : "Bonjour";
  // Une phrase pour la journée, une autre le soir, et d'autres demain.
  // Avant l'horloge (rendu serveur), une date fixe : pas d'écart à
  // l'hydratation.
  const { ajoutees, reglages } = usePhrasesAjoutees();
  const phrase = phraseDuMoment(maintenant ?? new Date(2026, 0, 5, 10), ajoutees, reglages);

  // Le même compte que la carte Stock et le bon de commande.
  const aRecommander = stock.aRecommander.length;
  const comparaisonVentes = ecart(jour.ventes, jour.ventesHier);

  const lien = (onglet: string, texte: string, couleur: string) => (
    <button
      type="button"
      className="kl"
      style={{ color: couleur }}
      onClick={() => onNaviguer?.(onglet)}
    >
      {texte}
    </button>
  );
  const tete = (
    cleIcone: CleTuile,
    ton: string,
    titre: React.ReactNode,
    cle: CleTuile,
    aide: string,
  ) => (
    <div className="kc-h">
      <span className={`pastille ${ton}`}>{ICONE_TUILE[cleIcone]}</span>
      <div className="kt">{titre}</div>
      <button type="button" className="kch" onClick={() => onOuvrir(cle)} aria-label={aide}>
        {CHEVRON}
      </button>
    </div>
  );
  const tendance = (nom: NomIcone, ton: string, texte: React.ReactNode) => (
    <div className="kc-ligne">
      <Icone nom={nom} className={`kpetite ${ton}`} />
      <span className="kx">{texte}</span>
    </div>
  );
  const duo = (
    gauche: [React.ReactNode, React.ReactNode],
    droite: [React.ReactNode, React.ReactNode],
    classeValeur: string,
  ) => (
    <div className="kc-duo">
      <div>
        <div className="kx">{gauche[0]}</div>
        <div className={classeValeur}>{gauche[1]}</div>
      </div>
      <div className="kdiv" />
      <div>
        <div className="kx">{droite[0]}</div>
        <div className={classeValeur.replace(" pos", "")}>{droite[1]}</div>
      </div>
    </div>
  );

  const cartes: Record<CleTuile, React.ReactNode> = {
    ventes: (
      <>
        {tete("ventes", "vert", "Ventes du jour", "ventes", "Détail des ventes du jour")}
        <div className="kv">{montantsVentesVisibles ? montant(jour.ventes) : "•••"}</div>
        <div className="kd">
          {jour.tickets === 0
            ? "Aucune vente enregistrée pour l'instant."
            : `${nombre(jour.tickets)} ticket${jour.tickets > 1 ? "s" : ""} aujourd'hui.`}
        </div>
        <div className="kc-pied">
          {tendance(
            "trend",
            "vert",
            montantsVentesVisibles && comparaisonVentes ? comparaisonVentes : "–",
          )}
          {lien("ventes", "Voir les ventes", "var(--k-vert)")}
        </div>
      </>
    ),
    entrees: (
      <>
        {tete("entrees", "menthe", "Entrées d'argent", "entrees", "Détail des encaissements")}
        <div className="kv">+{montant(jour.encaisse)}</div>
        <div className="kd">
          {jour.encaisse === 0 ? "Aucun encaissement aujourd'hui." : "Encaissements du jour."}
        </div>
        <div className="kc-pied">
          {tendance(
            "trend",
            "menthe",
            jour.encaisseDuMois > 0 ? `Ce mois ${montant(jour.encaisseDuMois)}` : "–",
          )}
          <button
            type="button"
            className="kl"
            style={{ color: "var(--k-menthe)" }}
            onClick={() => onOuvrir("entrees")}
          >
            Voir le détail
          </button>
        </div>
      </>
    ),
    sorties: (
      <>
        {tete("sorties", "rouge", "Sorties d'argent", "sorties", "Détail des sorties")}
        <div className="kv">
          {jour.sorties > 0 ? "−" : ""}
          {montant(jour.sorties)}
        </div>
        <div className="kd">
          {jour.sorties === 0
            ? "Aucune dépense ni achat aujourd'hui."
            : "Dépenses et achats du jour."}
        </div>
        <div className="kc-pied">
          {duo(
            ["Achats du mois", montantsAchatVisibles ? montant(jour.achatsDuMois) : "•••"],
            ["Dépenses du mois", montant(jour.depensesDuMois)],
            "kb",
          )}
          {lien("depenses", "Voir les dépenses", "var(--k-rouge)")}
        </div>
      </>
    ),
    stock: (
      <>
        {tete("stock", "turquoise", "Stock du jour", "stock", "Produits à recommander")}
        {duo(
          ["Entrées", `+${nombre(Math.abs(jour.entreesStock))} u.`],
          // La valeur absolue : un « −0 » venu du calcul s'écrivait « −−0 u. ».
          ["Sorties", `−${nombre(Math.abs(jour.sortiesStock))} u.`],
          "kv moyen pos",
        )}
        {aRecommander > 0 ? (
          <button type="button" className="pill4" onClick={() => onOuvrir("stock")}>
            <Icone nom="alert" className="kpetite orange" />
            <span className="pt">À recommander</span>
            <span className="pb">{aRecommander}</span>
          </button>
        ) : (
          <div className="pill4 ok">
            <span className="pt">Aucun produit sous le seuil</span>
          </div>
        )}
        <div className="kc-pied">
          {valeurStockVisible && (
            <div>
              <div className="kx">Valeur du stock</div>
              <div className="kb">{montant(stock.valeur)}</div>
            </div>
          )}
          {lien("produits", "Voir le stock", "var(--k-turquoise)")}
        </div>
      </>
    ),
    activite: (
      <>
        {tete(
          "activite",
          "violet",
          "Activité aujourd'hui",
          "activite",
          "Voir l'activité du jour dans l'historique",
        )}
        {erreurJournal ? (
          <div className="kx centre">
            Lecture impossible.
            {onReessayerJournal && (
              <button type="button" className="kre" onClick={onReessayerJournal}>
                Réessayer
              </button>
            )}
          </div>
        ) : !journalPret ? (
          <div className="kx centre" role="status">
            Chargement de l&apos;activité…
          </div>
        ) : journal.length === 0 ? (
          <div className="kc-vide">
            <span className="pastille neutre">
              <Icone nom="clipboard" />
            </span>
            <div className="kx centre">
              Rien d&apos;enregistré aujourd&apos;hui pour l&apos;instant.
            </div>
          </div>
        ) : (
          <ol className="kjournal">
            {journal.slice(0, 3).map((e) => (
              <li key={e.id}>
                <time>{e.heure}</time>
                <span>
                  {e.texte}
                  {e.detail ? ` · ${e.detail}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="kc-pied">
          {tendance(
            "calendar",
            "violet",
            journalPret
              ? `${journal.length} événement${journal.length > 1 ? "s" : ""}\u2002·\u2002${jour.tickets} vente${jour.tickets > 1 ? "s" : ""}`
              : `${jour.tickets} vente${jour.tickets > 1 ? "s" : ""}`,
          )}
          {/* Ce compte est celui du JOURNAL (créations, corrections,
              suppressions) : le lien mène donc à l'historique, comme le
              chevron de la carte, et non à l'agenda. */}
          {lien("historique", "Voir l'historique", "var(--k-violet)")}
        </div>
      </>
    ),
  };

  // Les colonnes de la maquette ont chacune leur largeur ; avec moins de
  // cinq cartes, elles se partagent la place à parts égales.
  const colonnes =
    tuiles.length === 5 ? "289fr 286fr 290fr 287fr 279fr" : `repeat(${tuiles.length}, 1fr)`;

  const photoDuJour = useMemo(() => (nuit ? photo.nuit : photo.jour), [nuit, photo]);

  return (
    <section className="blk tbsec" id="hero" aria-label="Aujourd'hui">
      <div className="tb">
        <div className="tbi">
          <div className={`tb-hero${nuit ? " night" : ""}`}>
            <div className="tb-hero-bg" style={{ backgroundImage: `url(${photoDuJour})` }} />
            <PaysagesDuHaut key={paysages.map((p) => p.id).join()} photos={paysages} />
            <div className="tb-voile" aria-hidden="true" />
            <div className="tb-texte">
              <div className="tb-when">
                <Icone nom="calendar" className="ic1" />
                <span className="date-longue">{maintenant ? dateLongue(maintenant) : " "}</span>
                <span className="date-courte">{maintenant ? dateCourte(maintenant) : " "}</span>
                {maintenant && (
                  <>
                    <span className="dot">·</span>
                    <span>{heure(maintenant)}</span>
                  </>
                )}
                {meteo && (
                  <>
                    <span className="sep" aria-hidden="true" />
                    <span className="meteo" title={`Météo à ${ville}`}>
                      {iconeCiel(meteo.ciel, meteo.jour)}
                      {meteo.temperature}°C
                    </span>
                  </>
                )}
                <span className="sep" aria-hidden="true" />
                <MenuPill
                  icon={<MapPin className="ic-lieu" aria-hidden="true" />}
                  value={ville}
                  alignLeft
                  className="lieu"
                  ariaLabel={`Ville de la météo : ${ville}`}
                >
                  {(fermer) =>
                    VILLES.map((v) => (
                      <MenuOption
                        key={v.nom}
                        checked={v.nom === ville}
                        onClick={() => {
                          choisirVille(v.nom);
                          fermer();
                        }}
                      >
                        {v.nom}
                      </MenuOption>
                    ))
                  }
                </MenuPill>
                <button
                  ref={boutonRafraichir}
                  type="button"
                  className="ic2"
                  onClick={onRafraichir}
                  aria-label="Actualiser les données"
                  title={chargeA ? `Mis à jour à ${heure(chargeA)}` : "Actualiser"}
                >
                  <Icone nom="refresh" />
                </button>
                {vue}
              </div>
              <h1>
                {salutation}
                {prenom ? (
                  <>
                    , <span className="prenom">{prenom}</span>
                  </>
                ) : (
                  ""
                )}
              </h1>
              <p>
                {typo(phrase.lignes[0])}
                <br />
                {typo(phrase.lignes[1])}
              </p>
              {alertes && <div className="tb-attn">{alertes}</div>}
            </div>
            <div className="tb-devise">
              <span>{typo(phrase.devise[0])}</span>
              <span>{typo(phrase.devise[1])}</span>
              <svg viewBox="0 0 200 14" aria-hidden="true">
                <path d="M4 10 C 60 2, 130 2, 196 7" />
              </svg>
            </div>
          </div>

          {tuiles.length > 0 && (
            <div
              className="tb-kpis"
              role="region"
              aria-label="Résumé de la journée"
              style={{ gridTemplateColumns: colonnes }}
            >
              {tuiles.map((cle) => (
                <article key={cle} className="kc" data-tile={cle}>
                  {cartes[cle]}
                </article>
              ))}
            </div>
          )}

          <div className={`tb-bottom${graphique ? "" : " seule"}`}>
            {graphique && (
              <article className="tc" id="tcChart">
                <div className="tc-h">
                  <span className="pastille vert">
                    <ChartSpline aria-hidden="true" />
                  </span>
                  <div className="tc-t">
                    <button type="button" className="ctitle" onClick={graphique.onDetails}>
                      Aperçu des ventes
                    </button>
                    <div className="csub">{graphique.sousTitre}</div>
                  </div>
                  <div className="csel">{graphique.selecteur}</div>
                </div>
                <div className="tc-graph">
                  <GraphiqueVentes
                    points={graphique.points}
                    montantsVisibles={montantsVentesVisibles}
                  />
                </div>
              </article>
            )}

            <InspirationDuMoment maintenant={maintenant} />
          </div>
        </div>
      </div>
    </section>
  );
};
