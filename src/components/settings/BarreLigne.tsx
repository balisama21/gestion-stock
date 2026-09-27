import React, { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, EyeOff, Lock, Tag, Unlink, Link2, X, Scissors } from "lucide-react";

const bouton =
  "inline-flex h-[34px] min-h-0 w-[34px] shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-40";

interface Props {
  nom: string;
  /** Le champ touché, en pixels dans la scène. */
  cadre: { gauche: number; haut: number; bas: number };
  largeurScene: number;
  accolee: boolean;
  premiere: boolean;
  derniere: boolean;
  obligatoire: boolean;
  onLibelle: () => void;
  onAccoler: (accolee: boolean) => void;
  onDeplacer: (sens: -1 | 1) => void;
  onMasquer: () => void;
  onDetacher: () => void;
  onFermer: () => void;
}

/** La barre d'une seule coordonnée : téléphone, e-mail, adresse… */
export const BarreLigne: React.FC<Props> = ({
  nom,
  cadre,
  largeurScene,
  accolee,
  premiere,
  derniere,
  obligatoire,
  onLibelle,
  onAccoler,
  onDeplacer,
  onMasquer,
  onDetacher,
  onFermer,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ l: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.offsetWidth !== taille.l || el.offsetHeight !== taille.h)) {
      setTaille({ l: el.offsetWidth, h: el.offsetHeight });
    }
  });
  const dessus = cadre.haut - taille.h - 8;
  const top = dessus >= 0 ? dessus : cadre.bas + 8;
  const left = Math.max(0, Math.min(cadre.gauche, largeurScene - taille.l));

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={`Ligne : ${nom}`}
      data-barre-bloc
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex w-max flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card p-1"
      style={{ top, left, maxWidth: largeurScene }}
    >
      <span className="px-1.5 text-xs font-medium text-foreground">{nom}</span>
      <button
        type="button"
        aria-label="Libellé devant"
        title="Écrire un libellé devant (Tél. :, E-mail :…)"
        onClick={onLibelle}
        className={bouton}
      >
        <Tag className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={accolee ? "Mettre sur sa propre ligne" : "Accoler à la ligne précédente"}
        title={accolee ? "Sur sa propre ligne" : "À la suite de la ligne précédente"}
        disabled={premiere && !accolee}
        onClick={() => onAccoler(!accolee)}
        className={bouton}
      >
        {accolee ? <Unlink className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </button>
      <button
        type="button"
        aria-label="Monter"
        title="Monter"
        disabled={premiere}
        onClick={() => onDeplacer(-1)}
        className={bouton}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Descendre"
        title="Descendre"
        disabled={derniere}
        onClick={() => onDeplacer(1)}
        className={bouton}
      >
        <ArrowDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Détacher"
        title="En faire un bloc à part, à poser où l'on veut"
        onClick={onDetacher}
        className={bouton}
      >
        <Scissors className="h-4 w-4" />
      </button>
      {obligatoire ? (
        <span
          className={`${bouton} cursor-help`}
          title="Exigé sur une facture : il ne se masque pas."
          aria-label="Mention obligatoire"
        >
          <Lock className="h-4 w-4" />
        </span>
      ) : (
        <button
          type="button"
          aria-label="Masquer la ligne"
          title="Masquer (Suppr)"
          onClick={onMasquer}
          className={bouton}
        >
          <EyeOff className="h-4 w-4" />
        </button>
      )}
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        aria-label="Revenir au bloc"
        title="Revenir au bloc (Échap)"
        onClick={onFermer}
        className={bouton}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
