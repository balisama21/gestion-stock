import React, { useEffect, useRef, useState } from "react";
import { Icone } from "../../../components/shared/Icone";
import { Modal } from "../../../components/shared/Modal";
import { PHOTOS_PLANTES, inspirationFond, plantesDuJour } from "../assets/images";

/**
 * INSPIRATION DU MOMENT — trois photos de plantes, trois autres demain.
 *
 * Les photos tournent d'elles-mêmes toutes les cinq secondes ; on peut
 * aussi les faire défiler au doigt, par les points ou par les flèches du
 * clavier. Le survol arrête la rotation, et elle ne démarre pas du tout
 * quand le système demande de réduire les animations.
 *
 * « Voir plus » ouvre la galerie de toutes les photos du dossier.
 */

const DELAI = 5000;
const ALT = "Plante d'intérieur en pot";

/** La place de chaque photo autour de celle du centre. */
const PLACES = ["centre", "droite", "gauche"] as const;

export const InspirationDuMoment: React.FC<{ maintenant: Date | null }> = ({ maintenant }) => {
  const trio = plantesDuJour(maintenant ?? new Date(2026, 0, 5));
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

  return (
    <article
      className="tc ic"
      id="tcInsp"
      style={{ backgroundImage: `url(${inspirationFond})` }}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
    >
      <div className="ic-texte">
        <div className="ititle">
          <Icone nom="leaf" className="kpetite vert" />
          Inspiration du moment
        </div>
        <div className="isub">Découvrez nos sélections du jour</div>
        <button type="button" className="ibtn" onClick={() => setGalerie(true)}>
          Voir plus
        </button>
      </div>

      <div
        className="pf-zone"
        role="group"
        aria-roledescription="carrousel"
        aria-label="Photos du jour"
        tabIndex={0}
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
            className={`pf ${PLACES[(i - centre + 3) % 3]}`}
            onClick={() => setCentre(i)}
            aria-label={`Photo ${i + 1} sur 3`}
            aria-current={i === centre}
            tabIndex={-1}
          >
            <img alt={ALT} src={photo} draggable={false} />
          </button>
        ))}
      </div>

      <div className="pdots">
        {trio.map((_, i) => (
          <button
            type="button"
            key={i}
            className={i === centre ? "on" : undefined}
            onClick={() => setCentre(i)}
            aria-label={`Afficher la photo ${i + 1}`}
            aria-pressed={i === centre}
          />
        ))}
      </div>

      {galerie && <Galerie duJour={trio} onFermer={() => setGalerie(false)} />}
    </article>
  );
};

/** Toutes les photos du dossier, celles du jour mises en avant. */
const Galerie: React.FC<{ duJour: string[]; onFermer: () => void }> = ({ duJour, onFermer }) => {
  const photos = PHOTOS_PLANTES;
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
