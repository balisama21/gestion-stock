import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  dateLocale,
  heure,
  jourEtMois,
  jourMoisChiffres,
  montant,
  montantEnDeux,
  nombre,
} from "../lib/format";
import type { ChiffresDuJour, ChiffresStock } from "../lib/chiffres";
import type { EvenementJournal } from "../lib/journal";
import type { CleTuile } from "../registry";

/**
 * LE BANDEAU « AUJOURD'HUI »
 *
 * Cinq tuiles qui répondent à la première question du commerçant qui
 * ouvre son écran : qu'est-ce que la journée a donné ?
 *
 * IL NE SUIT PAS LE SÉLECTEUR DE PÉRIODE. Son titre dit
 * « aujourd'hui » ; s'il changeait quand on regarde le mois dernier, il
 * mentirait. Les chiffres viennent de `chiffresDuJour`, qui travaille
 * sur le jour et le mois en cours quoi qu'affiche le reste de l'écran.
 *
 * C'EST LE SEUL ENDROIT DE LA PAGE QUI DÉFILE HORIZONTALEMENT, et
 * seulement sur téléphone. Ailleurs c'est proscrit ; ici c'est voulu :
 * une tuile est un objet qu'on feuillette, pas un tableau qu'on lit de
 * gauche à droite. La tuile suivante reste visible à seize pour cent,
 * pour qu'on sache qu'il y en a une.
 *
 * DEUX ÉLÉMENTS DE LA MAQUETTE SONT ABSENTS, faute de donnée : la barre
 * d'objectif du jour (aucun objectif n'existe en base) et la réception
 * fournisseur annoncée (aucune table ne porte de date de réception).
 * Voir `docs/dashboard-v2/audit.md`, § 7. La place laissée par la
 * seconde est reprise par la valeur du stock, qui, elle, se calcule.
 */

const FLECHE = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const ICONES: Record<CleTuile, React.ReactNode> = {
  ventes: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  entrees: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  sorties: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  ),
  activite: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </svg>
  ),
};

const TITRES: Record<CleTuile, string> = {
  ventes: "Ventes du jour",
  entrees: "Entrées d'argent",
  sorties: "Sorties d'argent",
  stock: "Stock du jour",
  activite: "Activité aujourd'hui",
};

/**
 * Un montant en gros, l'unité en petit à côté.
 *
 * `formatCurrency` rend « 344 800 Ar » d'un seul tenant ; la maquette
 * veut le nombre en trente pixels et « Ar » en quatorze. `montantEnDeux`
 * sait où couper — et ce n'est pas là où l'on croit : voir son
 * commentaire, dans `lib/format.ts`.
 */
const GrosMontant: React.FC<{ valeur: number; signe?: "plus" | "moins" }> = ({ valeur, signe }) => {
  const { chiffres, unite } = montantEnDeux(valeur);
  const prefixe = signe === "plus" ? "+" : signe === "moins" ? "−" : "";
  return (
    <div className={`tile-valeur num${signe === "plus" && valeur > 0 ? " pos" : ""}`}>
      {prefixe}
      {chiffres}
      {unite && <small>{unite}</small>}
    </div>
  );
};

export interface BandeauProps {
  /** Les tuiles autorisées, déjà dans l'ordre de la vue. */
  tuiles: CleTuile[];
  jour: ChiffresDuJour;
  stock: ChiffresStock;
  /** Les lignes du journal d'aujourd'hui. */
  journal: EvenementJournal[];
  /**
   * Le message que la lecture du journal a renvoyé, s'il y en a un.
   *
   * C'est la carte « Journal d'activité » qui le portait ; elle a
   * quitté le tableau de bord, et cette tuile est le dernier endroit
   * qui montre ces données. Sans ce message, une lecture refusée
   * afficherait simplement « Rien d'enregistré aujourd'hui », ce qui
   * est faux et ne se remarque pas.
   */
  erreurJournal?: string | null;
  onReessayerJournal?: () => void;
  /** Faux quand la personne n'a pas le droit de voir la valeur du stock. */
  valeurStockVisible: boolean;
  /** Faux quand elle n'a pas le droit de voir les montants d'achat. */
  montantsAchatVisibles: boolean;
  /** La flèche d'une tuile : ouvre son détail. */
  onOuvrir: (cle: CleTuile) => void;
  /** « + Vendre ». Absent quand la personne n'a pas le droit de vendre. */
  onVendre?: () => void;
}

/** « Mer. 16/09 », comme le pied de la tuile des ventes dans la maquette. */
const jourCourt = (jour: string): string => {
  const d = dateLocale(jour);
  const sem = d.toLocaleDateString("fr-FR", { weekday: "short" });
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)} ${jourMoisChiffres(d)}`;
};

export const BandeauAujourdhui: React.FC<BandeauProps> = ({
  tuiles,
  jour,
  stock,
  journal,
  erreurJournal,
  onReessayerJournal,
  valeurStockVisible,
  montantsAchatVisibles,
  onOuvrir,
  onVendre,
}) => {
  /**
   * L'heure affichée à côté de la date.
   *
   * Posée après le premier rendu, jamais pendant : le serveur et le
   * navigateur n'ont pas la même horloge, et deux heures différentes
   * pour le même écran feraient diverger l'hydratation.
   */
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => setMaintenant(new Date()), []);

  const rail = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(0);

  /**
   * Les points de position, et pourquoi ils se comptent au lieu d'être
   * posés d'avance.
   *
   * Le bandeau ne défile que sur téléphone ; ailleurs il n'y a rien à
   * indiquer. Plutôt que de deviner la largeur de l'écran, on regarde
   * s'il y a quelque chose à faire défiler : `scrollWidth` plus grand
   * que `clientWidth`. Zéro point sur ordinateur, sans média-requête à
   * tenir à jour en double.
   */
  const compter = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const defile = el.scrollWidth - el.clientWidth > 2;
    if (!defile) {
      setPages(0);
      return;
    }
    const items = [...el.children] as HTMLElement[];
    const pas = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : el.clientWidth;
    const n = Math.min(items.length, Math.ceil((el.scrollWidth - el.clientWidth) / pas) + 1);
    setPages(n);
    setPage(Math.min(n - 1, Math.round(el.scrollLeft / Math.max(1, pas))));
  }, []);

  useEffect(() => {
    compter();
    const el = rail.current;
    if (!el) return;
    let img = 0;
    const auDefilement = () => {
      cancelAnimationFrame(img);
      img = requestAnimationFrame(compter);
    };
    el.addEventListener("scroll", auDefilement, { passive: true });
    window.addEventListener("resize", compter);

    /**
     * ON RECOMPTE QUAND LE BANDEAU CHANGE DE TAILLE, pas seulement quand
     * la fenêtre bouge.
     *
     * Au tout premier rendu, la feuille de style peut n'être pas encore
     * appliquée : le bandeau est alors une grille qui tient dans la
     * largeur, `scrollWidth` égale `clientWidth`, et on conclut qu'il n'y
     * a rien à faire défiler. Les points de position ne réapparaissaient
     * plus jamais, faute d'un événement pour les redemander. Constaté sur
     * le banc d'essai, où le style arrive après le premier rendu.
     */
    const observateur = new ResizeObserver(() => compter());
    observateur.observe(el);
    if (el.firstElementChild) observateur.observe(el.firstElementChild);

    return () => {
      cancelAnimationFrame(img);
      observateur.disconnect();
      el.removeEventListener("scroll", auDefilement);
      window.removeEventListener("resize", compter);
    };
  }, [compter, tuiles.length]);

  const allerA = (i: number) => {
    const el = rail.current;
    if (!el) return;
    const items = [...el.children] as HTMLElement[];
    const pas = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : el.clientWidth;
    el.scrollTo({ left: i * pas, behavior: "smooth" });
  };

  if (tuiles.length === 0) return null;

  const aujourdhui = dateLocale(jour.jour);
  const maxBarre = Math.max(...jour.encaisseParJourDuMois.map((b) => b.montant), 1);
  const bientotEnRupture = stock.aRecommander.length + stock.enRupture.length;

  const enTete = (cle: CleTuile, libelleFleche: string) => (
    <div className="tile-head">
      <span className="tile-titre">
        {ICONES[cle]}
        <span>{TITRES[cle]}</span>
      </span>
      <button
        className="tile-go"
        type="button"
        onClick={() => onOuvrir(cle)}
        aria-label={libelleFleche}
      >
        {FLECHE}
      </button>
    </div>
  );

  const contenu: Record<CleTuile, React.ReactNode> = {
    ventes: (
      <>
        {enTete("ventes", "Détail des ventes du jour")}
        <GrosMontant valeur={jour.ventes} />
        <p className="tile-note">
          {jour.ventes === 0
            ? "Aucune vente enregistrée pour l'instant."
            : `${nombre(jour.tickets)} ticket${jour.tickets > 1 ? "s" : ""} aujourd'hui.`}
        </p>
        <div className="tile-pied">
          <small>
            Hier <b className="num">{montant(jour.ventesHier)}</b>
            {/* Le dernier jour vendu ne se redit pas quand c'est hier :
                la ligne porterait deux fois le même chiffre. */}
            {jour.dernierJourVendu && jour.dernierJourVendu.jour !== jour.hier && (
              <>
                {" · "}
                {jourCourt(jour.dernierJourVendu.jour)}{" "}
                <b className="num">{montant(jour.dernierJourVendu.montant)}</b>
              </>
            )}
          </small>
          {onVendre && (
            <button className="btn" type="button" onClick={onVendre}>
              + Vendre
            </button>
          )}
        </div>
      </>
    ),

    entrees: (
      <>
        {enTete("entrees", "Détail des encaissements")}
        <GrosMontant valeur={jour.encaisse} signe="plus" />
        <p className="tile-note">
          {jour.encaisse === 0 ? "Aucun encaissement aujourd'hui." : "Reçu aujourd'hui."}
        </p>
        <div
          className="days"
          style={{ gridTemplateColumns: `repeat(${jour.encaisseParJourDuMois.length}, 1fr)` }}
          aria-label={`Encaissements par jour depuis le 1er ${aujourdhui.toLocaleDateString("fr-FR", { month: "long" })}`}
        >
          {jour.encaisseParJourDuMois.map((b) => {
            const cest = b.jour === jour.jour;
            // Racine carrée plutôt que proportion directe : une journée
            // à trois cent mille écraserait toutes les autres à un pixel,
            // et la barre ne dirait plus rien du rythme du mois.
            const h = cest
              ? 100
              : b.montant > 0
                ? Math.max(6, Math.sqrt(b.montant / maxBarre) * 100)
                : 4;
            return (
              <i
                key={b.jour}
                className={cest ? "aujourdhui" : b.montant > 0 ? "" : "zero"}
                style={{ height: `${h}%` }}
                title={`${jourEtMois(dateLocale(b.jour))} · ${montant(b.montant)}`}
              />
            );
          })}
        </div>
        <div className="tile-pied">
          <small>
            Ce mois <b className="num">{montant(jour.encaisseDuMois)}</b>
          </small>
          <small className="num">1 → {aujourdhui.getDate()}</small>
        </div>
      </>
    ),

    sorties: (
      <>
        {enTete("sorties", "Détail des sorties")}
        <GrosMontant valeur={jour.sorties} signe={jour.sorties > 0 ? "moins" : undefined} />
        <p className="tile-note">
          {jour.sorties === 0 ? "Aucune dépense ni achat aujourd'hui." : "Sorties du jour."}
        </p>
        <div className="duo">
          <div>
            <span>Achats du mois</span>
            <b className="num">{montantsAchatVisibles ? montant(jour.achatsDuMois) : "•••"}</b>
          </div>
          <div>
            <span>Dépenses du mois</span>
            <b className="num">{montant(jour.depensesDuMois)}</b>
          </div>
        </div>
        <div className="tile-pied">
          {jour.prochaineEcheance ? (
            <small>
              Prochaine échéance&nbsp;:{" "}
              <b>
                {jour.prochaineEcheance.nom},{" "}
                {jourMoisChiffres(dateLocale(jour.prochaineEcheance.jour))}
              </b>
            </small>
          ) : (
            <small>Aucune échéance fournisseur ouverte</small>
          )}
          <small className="num">
            {"−"}
            {montant(jour.achatsDuMois + jour.depensesDuMois)} ce mois
          </small>
        </div>
      </>
    ),

    stock: (
      <>
        {enTete("stock", "Produits bientôt en rupture")}
        <div className="duo gros">
          <div>
            <small>Entrées</small>
            <b className="num pos">+{nombre(jour.entreesStock)} u.</b>
          </div>
          <div>
            <small>Sorties</small>
            <b className="num">
              {"−"}
              {nombre(jour.sortiesStock)} u.
            </b>
          </div>
        </div>
        {bientotEnRupture > 0 ? (
          <button className="flag warn" type="button" onClick={() => onOuvrir("stock")}>
            <span className="n num">{bientotEnRupture}</span>
            produit{bientotEnRupture > 1 ? "s" : ""} bientôt en rupture
          </button>
        ) : (
          <p className="tile-note">Aucun produit sous son seuil d&apos;alerte.</p>
        )}
        {valeurStockVisible && (
          <div className="tile-pied">
            <small>
              Valeur du stock <b className="num">{montant(stock.valeur)}</b>
            </small>
          </div>
        )}
      </>
    ),

    activite: (
      <>
        {enTete("activite", "Voir l'activité du jour dans le journal")}
        <ol className="minitl">
          {erreurJournal ? (
            <li className="vide echec">
              Lecture impossible.{" "}
              {onReessayerJournal && (
                <button type="button" className="link" onClick={onReessayerJournal}>
                  Réessayer
                </button>
              )}
            </li>
          ) : journal.length === 0 ? (
            <li className="vide">Rien d&apos;enregistré aujourd&apos;hui pour l&apos;instant.</li>
          ) : (
            journal.slice(0, 3).map((e) => (
              <li key={e.id} className={e.genre}>
                <time>{e.heure}</time>
                {e.texte}
                {e.detail ? ` · ${e.detail}` : ""}
              </li>
            ))
          )}
        </ol>
        <div className="tile-pied">
          <small>
            {erreurJournal
              ? `${nombre(jour.tickets)} vente${jour.tickets > 1 ? "s" : ""}`
              : `${journal.length} événement${journal.length > 1 ? "s" : ""} · ${nombre(jour.tickets)} vente${jour.tickets > 1 ? "s" : ""}`}
          </small>
        </div>
      </>
    ),
  };

  return (
    <section className="today" aria-labelledby="dash2-today">
      <div className="today-head">
        <h2 id="dash2-today">
          Aujourd&apos;hui{" "}
          <span>
            {aujourdhui.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {maintenant && ` \u00b7 ${heure(maintenant)}`}
          </span>
        </h2>
      </div>

      <div
        className="rail"
        ref={rail}
        data-count={tuiles.length}
        style={{ ["--n" as string]: tuiles.length }}
        role="region"
        aria-label="Résumé de la journée"
      >
        {tuiles.map((cle, i) => (
          <article key={cle} className={`tile${i < 3 ? " premier3" : ""}`} data-tile={cle}>
            {contenu[cle]}
          </article>
        ))}
      </div>

      {pages > 1 && (
        <div className="dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-current={i === page}
              onClick={() => allerA(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
};
