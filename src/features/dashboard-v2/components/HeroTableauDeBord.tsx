import { ChevronRight } from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { dateCourte, dateLongue, heure, montant, nombre } from "../lib/format";
import type { ChiffresDuJour, ChiffresStock } from "../lib/chiffres";
import type { EvenementJournal } from "../lib/journal";
import type { CleTuile } from "../registry";
import { HERO_PHOTOS, PLANTES, indexDuJour, inspirationFond } from "../assets/images";

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

const u = (n: number) => `calc(${n} * var(--u))`;

const CHEVRON = <ChevronRight className="kch-svg" aria-hidden="true" />;

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

  const pu = taille.h / 234;
  const W = taille.w / pu;
  const H = 234;
  const base = 186;
  const plein = 103;
  const max = Math.max(...points.map((p) => p.montant), 0);
  const pas = pasRond(Math.max(max, 1));
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
  // Sept libellés au plus, moins sur un écran étroit : au-delà, ils se
  // chevaucheraient. Ils partent du dernier jour, toujours affiché.
  const place = Math.max(2, Math.min(7, Math.floor((x1 - x0) / 62) + 1));
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
          <line x1="71" x2={W - 20} y1={Y(g)} y2={Y(g)} className="grille" />
          {montantsVisibles && (
            <text x="51" y={Y(g) + 4} textAnchor="end" className="axe fort">
              {graduation(g)}
            </text>
          )}
        </g>
      ))}
      {P.map(([x, y], i) => (
        <line key={`v${i}`} x1={x} x2={x} y1={y} y2={base} className="tige" />
      ))}
      {P.length > 1 && (
        <path
          d={`${chemin} L${P[P.length - 1][0]},${base} L${P[0][0]},${base} Z`}
          fill="url(#tn-ga)"
        />
      )}
      <path d={chemin} className="courbe" />
      {P.map(([x, y], i) => (
        <circle key={`p${i}`} cx={x} cy={y} r={survol === i ? 5.5 : 4.3} className="point" />
      ))}
      {points.map((p, i) =>
        i % pasLibelle === ancre ? (
          <text key={`l${i}`} x={X(i)} y="213" textAnchor="middle" className="axe">
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

export interface HeroProps {
  /** « Bonjour, Mamy » : le prénom, ou rien. */
  prenom: string;
  /** Le thème sombre de l'application passe aussi le ciel en nuit. */
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
  sombre = false,
  chargeA,
  onRafraichir,
  boutonRafraichir,
  vue,
  alertes,
  tuiles,
  jour,
  stock,
  journal,
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

  const h = maintenant?.getHours() ?? 12;
  const nuit = sombre || h < 6 || h >= 18;
  const idx = indexDuJour(maintenant ?? new Date(2026, 0, 5));
  const photo = HERO_PHOTOS[idx];
  const plantes = PLANTES[idx];
  const salutation = h >= 18 || h < 4 ? "Bonsoir" : "Bonjour";

  const bientotEnRupture = stock.aRecommander.length + stock.enRupture.length;
  const comparaisonVentes = ecart(jour.ventes, jour.ventesHier);

  const lien = (onglet: string, texte: string, couleur: string) => (
    <button
      type="button"
      className="kl"
      style={{ color: couleur, top: u(233) }}
      onClick={() => onNaviguer?.(onglet)}
    >
      {texte}
    </button>
  );
  const chevron = (cle: CleTuile, libelle: string) => (
    <button type="button" className="kch" onClick={() => onOuvrir(cle)} aria-label={libelle}>
      {CHEVRON}
    </button>
  );
  const icone = (nom: NomIcone, ton: string, top = 11) => (
    <span
      className={`pastille ${ton}`}
      style={{ left: u(16), top: u(top + 4), width: u(50), height: u(50) }}
    >
      <Icone nom={nom} />
    </span>
  );
  const petite = (nom: NomIcone, ton: string, left: number, top: number, taille: number) => (
    <Icone
      nom={nom}
      className={`kpetite ${ton}`}
      style={{ left: u(left), top: u(top), width: u(taille), height: u(taille) }}
    />
  );

  const cartes: Record<CleTuile, React.ReactNode> = {
    ventes: (
      <>
        {icone("cart", "vert", 9)}
        <div className="kt" style={{ left: u(83), top: u(37) }}>
          Ventes du jour
        </div>
        {chevron("ventes", "Détail des ventes du jour")}
        <div className="kv" style={{ left: u(20), top: u(90) }}>
          {montantsVentesVisibles ? montant(jour.ventes) : "•••"}
        </div>
        <div className="kd" style={{ left: u(20), top: u(111.5) }}>
          {jour.tickets === 0
            ? "Aucune vente enregistrée\npour l'instant."
            : `${nombre(jour.tickets)} ticket${jour.tickets > 1 ? "s" : ""}\naujourd'hui.`}
        </div>
        {petite("trend", "vert", 25, 176, 22)}
        <div className="kx" style={{ left: u(63), top: u(187) }}>
          {montantsVentesVisibles && comparaisonVentes ? comparaisonVentes : "–"}
        </div>
        {lien("ventes", "Voir les ventes", "var(--k-vert)")}
      </>
    ),
    entrees: (
      <>
        {icone("download", "bleu")}
        <div className="kt" style={{ left: u(84), top: u(40) }}>
          Entrées d&apos;argent
        </div>
        {chevron("entrees", "Détail des encaissements")}
        <div className="kv" style={{ left: u(20), top: u(90) }}>
          +{montant(jour.encaisse)}
        </div>
        <div className="kd" style={{ left: u(20), top: u(111.5) }}>
          {jour.encaisse === 0 ? "Aucun encaissement\naujourd'hui." : "Encaissements\ndu jour."}
        </div>
        {petite("trend", "bleu", 25, 176, 22)}
        <div className="kx" style={{ left: u(63), top: u(187) }}>
          {jour.encaisseDuMois > 0 ? `Ce mois ${montant(jour.encaisseDuMois)}` : "–"}
        </div>
        <button
          type="button"
          className="kl"
          style={{ color: "var(--k-bleu)", top: u(233) }}
          onClick={() => onOuvrir("entrees")}
        >
          Voir le détail
        </button>
      </>
    ),
    sorties: (
      <>
        {icone("arrowup", "rouge")}
        <div className="kt" style={{ left: u(84), top: u(40) }}>
          Sorties d&apos;argent
        </div>
        {chevron("sorties", "Détail des sorties")}
        <div className="kv" style={{ left: u(20), top: u(90) }}>
          {jour.sorties > 0 ? "−" : ""}
          {montant(jour.sorties)}
        </div>
        <div className="kd" style={{ left: u(20), top: u(111.5) }}>
          {jour.sorties === 0
            ? "Aucune dépense ni achat\naujourd'hui."
            : "Dépenses et achats\ndu jour."}
        </div>
        <div className="kx" style={{ left: u(20), top: u(172) }}>
          Achats du mois
        </div>
        <div className="kb" style={{ left: u(20), top: u(192) }}>
          {montantsAchatVisibles ? montant(jour.achatsDuMois) : "•••"}
        </div>
        <div className="kdiv" style={{ left: u(140), top: u(164), height: u(42) }} />
        <div className="kx" style={{ left: u(155), top: u(172) }}>
          Dépenses du mois
        </div>
        <div className="kb" style={{ left: u(155), top: u(192) }}>
          {montant(jour.depensesDuMois)}
        </div>
        {lien("depenses", "Voir les dépenses", "var(--k-rouge)")}
      </>
    ),
    stock: (
      <>
        {icone("box", "vert")}
        <div className="kt" style={{ left: u(86), top: u(40) }}>
          Stock du jour
        </div>
        {chevron("stock", "Produits bientôt en rupture")}
        <div className="kx" style={{ left: u(22), top: u(86) }}>
          Entrées
        </div>
        <div className="kv moyen pos" style={{ left: u(22), top: u(110) }}>
          +{nombre(jour.entreesStock)} u.
        </div>
        <div className="kdiv" style={{ left: u(139), top: u(80), height: u(44) }} />
        <div className="kx" style={{ left: u(161), top: u(86) }}>
          Sorties
        </div>
        <div className="kv moyen" style={{ left: u(161), top: u(110) }}>
          −{nombre(jour.sortiesStock)} u.
        </div>
        {bientotEnRupture > 0 ? (
          <button type="button" className="pill4" onClick={() => onOuvrir("stock")}>
            {petite("alert", "orange", 13, 5, 18)}
            <span className="pt">Produit{bientotEnRupture > 1 ? "s" : ""} bientôt en rupture</span>
            <span className="pb">{bientotEnRupture}</span>
          </button>
        ) : (
          <div className="pill4 ok">
            <span className="pt">Aucun produit sous le seuil</span>
          </div>
        )}
        {valeurStockVisible && (
          <>
            <div className="kx" style={{ left: u(22), top: u(192) }}>
              Valeur du stock
            </div>
            <div className="kb" style={{ left: u(22), top: u(212) }}>
              {montant(stock.valeur)}
            </div>
          </>
        )}
        {lien("produits", "Voir le stock", "var(--k-vert)")}
      </>
    ),
    activite: (
      <>
        {icone("pulse", "violet", 9)}
        <div className="kt" style={{ left: u(84), top: u(37) }}>
          Activité aujourd&apos;hui
        </div>
        {chevron("activite", "Voir l'activité du jour dans l'historique")}
        {erreurJournal ? (
          <div className="kx centre" style={{ top: u(120) }}>
            Lecture impossible.
            {onReessayerJournal && (
              <button type="button" className="kre" onClick={onReessayerJournal}>
                Réessayer
              </button>
            )}
          </div>
        ) : journal.length === 0 ? (
          <>
            <span
              className="pastille neutre"
              style={{ left: `calc(50% - ${u(28)})`, top: u(72), width: u(56), height: u(56) }}
            >
              <Icone nom="clipboard" />
            </span>
            <div className="kx centre" style={{ top: u(156) }}>
              {"Rien d'enregistré\naujourd'hui pour l'instant."}
            </div>
          </>
        ) : (
          <ol className="kjournal" style={{ left: u(20), right: u(20), top: u(78) }}>
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
        {petite("calendar", "violet", 20, 194, 20)}
        <div className="kx" style={{ left: u(50), top: u(204) }}>
          {`${journal.length} événement${journal.length > 1 ? "s" : ""}\u2002·\u2002${jour.tickets} vente${jour.tickets > 1 ? "s" : ""}`}
        </div>
        {lien("agenda", "Voir l'agenda", "var(--k-violet)")}
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
              {prenom ? `, ${prenom}` : ""}
            </h1>
            <p>Voici un aperçu de l&apos;activité de votre boutique aujourd&apos;hui.</p>
            {alertes && <div className="tb-attn">{alertes}</div>}
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
                <span
                  className="pastille vert carre"
                  style={{ left: u(18), top: u(14), width: u(46), height: u(46) }}
                >
                  <Icone nom="chart" />
                </span>
                <button type="button" className="ctitle" onClick={graphique.onDetails}>
                  Aperçu des ventes
                </button>
                <div className="csub">{graphique.sousTitre}</div>
                <div className="csel">{graphique.selecteur}</div>
                <GraphiqueVentes
                  points={graphique.points}
                  montantsVisibles={montantsVentesVisibles}
                />
              </article>
            )}

            <article
              className="tc ic"
              id="tcInsp"
              style={{ backgroundImage: `url(${inspirationFond})` }}
            >
              {petite("leaf", "vert", 24, 40, 24)}
              <div className="ititle">Inspiration du moment</div>
              <div className="isub">Découvrez nos sélections du jour</div>
              <button type="button" className="ibtn" onClick={() => onNaviguer?.("produits")}>
                Voir plus
              </button>
              <div className="pf" id="pf1">
                <img alt="" src={plantes[0]} />
              </div>
              <div className="pf" id="pf3">
                <img alt="" src={plantes[2]} />
              </div>
              <div className="pf" id="pf2">
                <img alt="" src={plantes[1]} />
              </div>
              <div className="pdots" aria-hidden="true">
                <i className="on" />
                <i />
                <i />
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
};
