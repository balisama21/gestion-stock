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
 * On tourne la page comme sur un vrai bloc : par son coin extérieur. Le
 * coin bas de la page, un peu relevé, porte une flèche et se soulève de
 * temps en temps pour le rappeler ; on peut aussi glisser du doigt ou à
 * la souris. Il mène au double suivant (coin droit) ou précédent (coin
 * gauche).
 *
 * Sur téléphone, une seule page se voit : une flèche sous la page mène à
 * celle d'en face, dans le même double, et la vue glisse jusqu'à elle.
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

  // Où mène chaque coin : au double voisin. Sur ordinateur, on l'ouvre sur
  // sa page de gauche ; sur téléphone, sur la page qui touche le coin, et
  // le coin n'est que sur le bord extérieur de la page montrée.
  const double = Math.floor(vue / 2);
  const aGauche = vue % 2 === 0;
  const suivant = telephone ? (aGauche ? null : vue + 1) : 2 * (double + 1);
  const precedent = telephone ? (aGauche ? vue - 1 : null) : 2 * (double - 1);
  const versSuivant = suivant !== null && suivant < feuilles.length ? suivant : null;
  const versPrecedent = precedent !== null && precedent >= 0 ? precedent : null;
  // Sur téléphone, la page d'en face, dans le même double.
  const enFace = aGauche ? vue + 1 : vue - 1;
  const versEnFace = telephone && enFace < feuilles.length ? enFace : null;
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
              const cible = telephone
                ? vue + (dx < 0 ? 1 : -1)
                : dx < 0
                  ? versSuivant
                  : versPrecedent;
              if (cible !== null) aller(cible);
            }
          }}
        >
          <div
            className="op-camera"
            data-cote={aGauche ? "gauche" : "droite"}
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
          {versEnFace !== null && (
            <button
              type="button"
              className={`op-en-face ${aGauche ? "droite" : "gauche"}`}
              aria-label={`Voir la page : ${feuilles[versEnFace].nom}`}
              title={feuilles[versEnFace].nom}
              onClick={() => aller(versEnFace)}
            >
              <Icone nom="arrowleft" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
