import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Italic,
  List,
  Lock,
  Minus,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import { ChoixCouleur } from "./ChoixCouleur";
import {
  BORDURES,
  TAILLE_TEXTE,
  type Alignement,
  type BlocPose,
  type GenreElement,
  type Habillage,
  type Police,
} from "../../features/documents/lib/disposition";

const POLICES: { cle: Police | ""; nom: string }[] = [
  { cle: "", nom: "Police du modèle" },
  { cle: "sans", nom: "Onest" },
  { cle: "serif", nom: "Source Serif" },
  { cle: "mono", nom: "JetBrains Mono" },
];

const ALIGNS: { cle: Alignement; nom: string; Icone: typeof AlignLeft }[] = [
  { cle: "gauche", nom: "Aligné à gauche", Icone: AlignLeft },
  { cle: "centre", nom: "Centré", Icone: AlignCenter },
  { cle: "droite", nom: "Aligné à droite", Icone: AlignRight },
];

const TRAITS: { valeur: number | undefined; nom: string }[] = [
  { valeur: undefined, nom: "Aucune" },
  { valeur: BORDURES[0], nom: "Fine" },
  { valeur: BORDURES[1], nom: "Moyenne" },
  { valeur: BORDURES[2], nom: "Épaisse" },
];

const bouton =
  "inline-flex h-[34px] min-h-0 w-[34px] shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-40";
const actif = "text-primary";

interface Props {
  nom: string;
  bloc: BlocPose;
  /** Cachet, trait, cadre, image : ni police ni alignement. */
  genre: GenreElement | "cachet" | null;
  verrouille: boolean;
  /** Le cadre du bloc à l'écran, en pixels, dans la scène. */
  cadre: { gauche: number; haut: number; bas: number };
  largeurScene: number;
  onHabiller: (patch: Partial<Habillage>) => void;
  onAligner: (a: Alignement) => void;
  onDupliquer?: () => void;
  onSupprimer: () => void;
  /** Coordonnées : une par ligne, ou à la suite. Absent : le bloc n'en a pas. */
  uneParLigne?: boolean;
  onUneParLigne?: (separees: boolean) => void;
}

/** La barre posée au-dessus du bloc choisi, comme celle de Canva. */
export const BarreBloc: React.FC<Props> = ({
  nom,
  bloc,
  genre,
  verrouille,
  cadre,
  largeurScene,
  onHabiller,
  onAligner,
  onDupliquer,
  onSupprimer,
  uneParLigne,
  onUneParLigne,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ l: 0, h: 0 });
  const [couleurs, setCouleurs] = useState(false);
  const h = bloc.habillage ?? {};
  const texte = genre === null || genre === "texte";

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.offsetWidth !== taille.l || el.offsetHeight !== taille.h)) {
      setTaille({ l: el.offsetWidth, h: el.offsetHeight });
    }
  });

  // Au-dessus du bloc s'il y a la place, dessous sinon ; jamais hors de la feuille.
  const dessus = cadre.haut - taille.h - 22;
  const top = dessus >= 0 ? dessus : cadre.bas + 8;
  const left = Math.max(0, Math.min(cadre.gauche, largeurScene - taille.l));
  const align = bloc.align ?? "gauche";
  const suivant = ALIGNS[(ALIGNS.findIndex((a) => a.cle === align) + 1) % ALIGNS.length];
  const AlignActuel = ALIGNS.find((a) => a.cle === align)!.Icone;

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={`Outils : ${nom}`}
      data-barre-bloc
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex w-max flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card p-1"
      style={{ top, left, maxWidth: largeurScene }}
    >
      {texte && (
        <>
          <select
            aria-label="Police"
            value={h.police ?? ""}
            onChange={(e) =>
              onHabiller({ police: (e.target.value || undefined) as Police | undefined })
            }
            className="h-[34px] min-h-0 max-w-[8.5rem] rounded border-0 bg-transparent px-1 text-sm text-foreground"
          >
            {POLICES.map((p) => (
              <option key={p.cle} value={p.cle}>
                {p.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Texte plus petit"
            title="Plus petit"
            disabled={(h.taille ?? 100) <= TAILLE_TEXTE.min}
            onClick={() => onHabiller({ taille: (h.taille ?? 100) - TAILLE_TEXTE.pas })}
            className={bouton}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Revenir à la taille du modèle"
            onClick={() => onHabiller({ taille: undefined })}
            className="h-[34px] min-h-0 min-w-[2.75rem] text-center text-xs tabular-nums text-foreground"
          >
            {h.taille ?? 100} %
          </button>
          <button
            type="button"
            aria-label="Texte plus grand"
            title="Plus grand"
            disabled={(h.taille ?? 100) >= TAILLE_TEXTE.max}
            onClick={() => onHabiller({ taille: (h.taille ?? 100) + TAILLE_TEXTE.pas })}
            className={bouton}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Gras"
            title="Gras"
            aria-pressed={h.gras === true}
            onClick={() => onHabiller({ gras: h.gras ? undefined : true })}
            className={`${bouton} ${h.gras ? actif : ""}`}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Italique"
            title="Italique"
            aria-pressed={h.italique === true}
            onClick={() => onHabiller({ italique: h.italique ? undefined : true })}
            className={`${bouton} ${h.italique ? actif : ""}`}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Alignement : ${ALIGNS.find((a) => a.cle === align)!.nom}`}
            title={`Passer à : ${suivant.nom.toLowerCase()}`}
            onClick={() => onAligner(suivant.cle)}
            className={bouton}
          >
            <AlignActuel className="h-4 w-4" />
          </button>
        </>
      )}
      {onUneParLigne && (
        <button
          type="button"
          aria-label={uneParLigne ? "Tout à la suite" : "Une coordonnée par ligne"}
          title={uneParLigne ? "Mettre les coordonnées à la suite" : "Une coordonnée par ligne"}
          aria-pressed={uneParLigne === true}
          onClick={() => onUneParLigne(!uneParLigne)}
          className={`${bouton} ${uneParLigne ? actif : ""}`}
        >
          <List className="h-4 w-4" />
        </button>
      )}
      {genre !== "cachet" && genre !== "image" && (
        <button
          type="button"
          aria-label="Couleurs"
          title="Couleurs"
          aria-expanded={couleurs}
          onClick={() => setCouleurs((v) => !v)}
          className={`${bouton} ${couleurs ? actif : ""}`}
        >
          <Palette className="h-4 w-4" />
        </button>
      )}
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      {onDupliquer && (
        <button
          type="button"
          aria-label="Dupliquer"
          title="Dupliquer"
          onClick={onDupliquer}
          className={bouton}
        >
          <Copy className="h-4 w-4" />
        </button>
      )}
      {verrouille ? (
        <span
          className={`${bouton} cursor-help`}
          title="Mention obligatoire : elle se déplace, mais ne se retire pas."
          aria-label="Mention obligatoire"
        >
          <Lock className="h-4 w-4" />
        </span>
      ) : (
        <button
          type="button"
          aria-label="Supprimer"
          title="Supprimer (Suppr)"
          onClick={onSupprimer}
          className={`${bouton} hover:text-danger`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {couleurs && (
        <div className="basis-full space-y-2 border-t border-border px-1 pb-1 pt-2">
          {genre === "trait" ? (
            <>
              <Epaisseur
                nom="Épaisseur"
                valeur={h.bordure ?? BORDURES[0]}
                sansAucune
                onChange={(v) => onHabiller({ bordure: v ?? BORDURES[0] })}
              />
              <Groupe nom="Couleur du trait">
                <ChoixCouleur
                  nom="Couleur du trait"
                  aucun="Couleur du document"
                  valeur={h.bordureCouleur}
                  onChange={(v) => onHabiller({ bordureCouleur: v })}
                />
              </Groupe>
            </>
          ) : (
            <>
              {texte && (
                <Groupe nom="Couleur du texte">
                  <ChoixCouleur
                    nom="Couleur du texte"
                    aucun="Celle du modèle"
                    valeur={h.encre}
                    onChange={(v) => onHabiller({ encre: v })}
                  />
                </Groupe>
              )}
              <Groupe nom={nom === "Bandeau de couleur" ? "Couleur du bandeau" : "Fond"}>
                <ChoixCouleur
                  nom={nom === "Bandeau de couleur" ? "Couleur du bandeau" : "Fond"}
                  aucun={nom === "Bandeau de couleur" ? "Celle du document" : "Sans fond"}
                  valeur={h.fond}
                  onChange={(v) => onHabiller({ fond: v })}
                />
              </Groupe>
              <Epaisseur
                nom="Bordure"
                valeur={h.bordure}
                onChange={(v) => onHabiller({ bordure: v })}
              />
              {h.bordure && (
                <ChoixCouleur
                  nom="Couleur de la bordure"
                  aucun="Couleur du document"
                  valeur={h.bordureCouleur}
                  onChange={(v) => onHabiller({ bordureCouleur: v })}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Groupe: React.FC<{ nom: string; children: React.ReactNode }> = ({ nom, children }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{nom}</p>
    {children}
  </div>
);

const Epaisseur: React.FC<{
  nom: string;
  valeur: number | undefined;
  sansAucune?: boolean;
  onChange: (v: number | undefined) => void;
}> = ({ nom, valeur, sansAucune, onChange }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{nom}</p>
    <div role="group" aria-label={nom} className="flex flex-wrap gap-1">
      {TRAITS.filter((t) => !sansAucune || t.valeur).map((t) => (
        <button
          key={t.nom}
          type="button"
          aria-pressed={valeur === t.valeur}
          onClick={() => onChange(t.valeur)}
          className={`h-[30px] min-h-0 rounded border px-2 text-xs ${
            valeur === t.valeur
              ? "border-foreground text-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          {t.nom}
        </button>
      ))}
    </div>
  </div>
);
