import React, { useEffect, useRef, useState } from "react";
import { Icone } from "../../../components/shared/Icone";
import { Modal } from "../../../components/shared/Modal";
import { plantesDuJour } from "../assets/images";
import { usePhotosInspiration } from "../lib/photosInspiration";

/**
 * INSPIRATION DU MOMENT — trois photos de plantes, trois autres demain.
 *
 * Une section à part entière, posée sur la page comme les autres : le
 * même en-tête (surtitre, titre souligné de vert, phrase), et à droite
 * les trois photos en tirages, posés en éventail sur la feuille, sans
 * carte autour. Celle du centre est au premier plan.
 *
 * Les photos tournent d'elles-mêmes toutes les minutes ; on peut aussi
 * les faire défiler au doigt, d'un clic sur un tirage ou par les flèches
 * du clavier. Le survol arrête la rotation, et elle ne démarre pas du
 * tout quand le système demande de réduire les animations.
 *
 * « Voir toutes les photos » ouvre la galerie.
 *
 * Les photos sont celles importées par l'administrateur de la plateforme
 * (Paramètres → Inspiration du moment), sinon celles livrées avec
 * l'application. Une fois la liste parcourue, elle recommence au début.
 */

const DELAI = 60_000;
const ALT = "Plante d'intérieur en pot";

/** La place de chaque photo autour de celle du centre. */
const PLACES = ["centre", "droite", "gauche"] as const;

export const InspirationDuMoment: React.FC<{ maintenant: Date | null }> = ({ maintenant }) => {
  const photos = usePhotosInspiration();
  const trio = plantesDuJour(maintenant ?? new Date(2026, 0, 5), photos);
  const [centre, setCentre] = useState(0);
  const [pause, setPause] = useState(false);
  const [galerie, setGalerie] = useState(false);
  const depart = useRef<number | null>(null);

  const aller = (pas: number) => setCentre((c) => (c + pas + 3) % 3);

  useEffect(() => {
    if (pause || galerie || trio.length === 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => aller(1), DELAI);
    return () => window.clearInterval(id);
  }, [pause, galerie, trio.length]);

  // Un nouveau jour, un nouveau trio : on repart de la première photo.
  const cleJour = trio.join("|");
  useEffect(() => setCentre(0), [cleJour]);

  if (trio.length === 0) return null;

  return (
    <section className="blk insp" id="inspiration" aria-labelledby="inspiration-titre">
      <div className="insp-tete">
        <div className="blk-h">
          <span className="blk-sur" aria-hidden="true">
            <Icone nom="leaf" />
            Un peu de vert
          </span>
          <h2 id="inspiration-titre">Inspiration du moment</h2>
          <p>Trois plantes choisies pour aujourd&apos;hui, trois autres demain.</p>
          <button type="button" className="insp-lien" onClick={() => setGalerie(true)}>
            Voir toutes les photos
            <Icone nom="chevright" />
          </button>
        </div>

        <div
          className="insp-tirages"
          role="group"
          aria-roledescription="carrousel"
          aria-label="Photos du jour"
          tabIndex={0}
          onMouseEnter={() => setPause(true)}
          onMouseLeave={() => setPause(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") aller(1);
            if (e.key === "ArrowLeft") aller(-1);
          }}
          onPointerDown={(e) => {
            depart.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (depart.current === null) return;
            const dx = e.clientX - depart.current;
            depart.current = null;
            if (Math.abs(dx) > 30) aller(dx < 0 ? 1 : -1);
          }}
        >
          {trio.map((photo, i) => (
            <button
              type="button"
              key={`${photo}-${i}`}
              className={`tirage ${PLACES[(i - centre + 3) % 3]}`}
              onClick={() => setCentre(i)}
              aria-label={`Photo ${i + 1} sur 3`}
              aria-current={i === centre}
              tabIndex={-1}
            >
              <img alt={ALT} src={photo} draggable={false} />
            </button>
          ))}
        </div>
      </div>

      {galerie && <Galerie photos={photos} duJour={trio} onFermer={() => setGalerie(false)} />}
    </section>
  );
};

/** Toutes les photos, celles du jour mises en avant. */
const Galerie: React.FC<{ photos: string[]; duJour: string[]; onFermer: () => void }> = ({
  photos,
  duJour,
  onFermer,
}) => {
  return (
    <Modal
      open
      onClose={onFermer}
      title="Inspiration du moment"
      description={`${photos.length} photo${photos.length > 1 ? "s" : ""} · trois nouvelles chaque jour`}
      size="lg"
    >
      <ul className="insp-grille">
        {photos.map((p, k) => (
          <li key={`${p}-${k}`} className={duJour.includes(p) ? "du-jour" : undefined}>
            <img src={p} alt={ALT} />
            {duJour.includes(p) && <span>Aujourd&apos;hui</span>}
          </li>
        ))}
      </ul>
    </Modal>
  );
};
