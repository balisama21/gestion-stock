import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icone } from "../../../components/shared/Icone";
import "./operations.css";

/**
 * LA SECTION « OPÉRATIONS »
 *
 * Les cartes de la section (agenda, à faire, commandes, livraisons),
 * chacune avec son illustration. Elle n'a plus de bannière : c'est
 * « Inspiration du moment », posée juste au-dessus, qui ouvre la fin de
 * la page.
 *
 * Les cartes sont les pages d'un bloc-notes à spirale, ouvert, deux par
 * deux : agenda | à faire, puis commandes | livraisons (voir
 * `operations.css`). Sur ordinateur et tablette, le double entier se voit ;
 * sur téléphone, une page à la fois.
 *
 * On tourne la page comme sur un vrai bloc : par son coin. Le coin bas de
 * la page, un peu relevé, porte une flèche et se soulève de temps en
 * temps pour le rappeler ; on peut aussi glisser du doigt ou à la souris.
 * - sur ordinateur, on passe d'un double à l'autre ;
 * - sur téléphone, d'une page à l'autre : la vue glisse dans un même
 *   double, et la page tourne pour passer au double suivant.
 * La page tournée se soulève autour de la spirale, passe de l'autre côté
 * et se rabat, et la page suivante apparaît dessous.
 *
 * Le titre reste dans le document pour les lecteurs d'écran et pour
 * `aria-labelledby`.
 */

export interface FeuilleOperation {
  cle: string;
  /** Le nom de la page : « Agenda », « À faire »… */
  nom: string;
  carte: React.ReactNode;
}

/** La durée d'une page tournée : elle se soulève, puis se rabat. */
export const DUREE_TOUR = 1000;

/** Le glissement du doigt, en pixels, qui tourne la page. */
const SEUIL = 40;

/** Sur téléphone, une page à la fois (comme `operations.css`). */
const TELEPHONE = "(max-width: 640px)";
const suivreTelephone = (rappel: () => void) => {
  const m = window.matchMedia?.(TELEPHONE);
  m?.addEventListener?.("change", rappel);
  return () => m?.removeEventListener?.("change", rappel);
};
const estTelephone = () => window.matchMedia?.(TELEPHONE).matches ?? false;

export const SectionOperations: React.FC<{ feuilles: FeuilleOperation[] }> = ({ feuilles }) => {
  const [choisie, setVue] = useState(0);
  // Une carte retirée (droits changés) ne laisse pas la vue dans le vide.
  const vue = Math.min(choisie, Math.max(0, feuilles.length - 1));
  const [tour, setTour] = useState<"avant" | "arriere" | null>(null);
  const telephone = useSyncExternalStore(suivreTelephone, estTelephone, () => false);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const fin = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(fin.current), []);

  const aller = (i: number) => {
    if (tour || i < 0 || i >= feuilles.length || i === vue) return;
    const de = Math.floor(vue / 2);
    const vers = Math.floor(i / 2);
    setVue(i);
    if (de === vers) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setTour(vers > de ? "avant" : "arriere");
    fin.current = window.setTimeout(() => setTour(null), DUREE_TOUR);
  };

  // Où mène chaque coin : la page voisine sur téléphone, le double voisin
  // ailleurs (on l'ouvre sur sa page de gauche).
  const double = Math.floor(vue / 2);
  const suivant = telephone ? vue + 1 : 2 * (double + 1);
  const precedent = telephone ? vue - 1 : 2 * (double - 1);
  const versSuivant = suivant < feuilles.length ? suivant : null;
  const versPrecedent = precedent >= 0 ? precedent : null;
  const libelle = (i: number) =>
    telephone
      ? feuilles[i].nom
      : feuilles
          .slice(i, i + 2)
          .map((f) => f.nom)
          .join(" et ");

  return (
    <section className="blk op-section" id="operations" aria-labelledby="operations-titre">
      <h2 id="operations-titre" className="sr-only">
        Opérations
      </h2>
      <div className="blk-corps">
        <div
          className="op-cadre"
          onPointerDown={(e) => {
            depart.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const d = depart.current;
            depart.current = null;
            if (!d) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > SEUIL && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
              const cible = dx < 0 ? versSuivant : versPrecedent;
              if (cible !== null) aller(cible);
            }
          }}
        >
          <div
            className="op-camera"
            data-cote={vue % 2 === 0 ? "gauche" : "droite"}
            data-tourne={tour ? "" : undefined}
          >
            <div
              className="g2 op-bande"
              data-double={tour ? undefined : double}
              data-sens={tour ?? undefined}
            >
              {feuilles.map((f) => (
                <React.Fragment key={f.cle}>{f.carte}</React.Fragment>
              ))}
            </div>
            <span className="op-spirale" aria-hidden="true" />
            {versPrecedent !== null && (
              <button
                type="button"
                className="op-coin precedent"
                aria-label={`Revenir à la page : ${libelle(versPrecedent)}`}
                title={libelle(versPrecedent)}
                onClick={() => aller(versPrecedent)}
              >
                <Icone nom="chevleft" />
              </button>
            )}
            {versSuivant !== null && (
              <button
                type="button"
                className="op-coin suivant"
                aria-label={`Tourner la page : ${libelle(versSuivant)}`}
                title={libelle(versSuivant)}
                onClick={() => aller(versSuivant)}
              >
                <Icone nom="chevright" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
