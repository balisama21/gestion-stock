import React from "react";
import { Ban, Pipette } from "lucide-react";
import { COULEURS_DOCUMENT } from "./choixDocuments";

const NEUTRES = [
  { valeur: "#16181A", nom: "Noir" },
  { valeur: "#6B7671", nom: "Gris" },
  { valeur: "#E6EBE8", nom: "Gris clair" },
  { valeur: "#FFFFFF", nom: "Blanc" },
];

interface Props {
  nom: string;
  valeur: string | undefined;
  onChange: (v: string | undefined) => void;
  /** Libellé du choix « rien » ; absent, la couleur est obligatoire. */
  aucun?: string;
}

const pastille = "h-[30px] w-[30px] shrink-0 rounded-full border";
// La hauteur tactile minimale des boutons ferait des pastilles ovales.
const rond = { minHeight: 0 } as const;

/** Nuancier du document, neutres et couleur libre. */
export const ChoixCouleur: React.FC<Props> = ({ nom, valeur, onChange, aucun }) => {
  const v = valeur?.toUpperCase();
  const libre = v && ![...COULEURS_DOCUMENT, ...NEUTRES].some((c) => c.valeur === v);
  return (
    <div role="group" aria-label={nom} className="flex flex-wrap items-center gap-1.5">
      {aucun && (
        <button
          type="button"
          aria-pressed={!v}
          aria-label={aucun}
          title={aucun}
          onClick={() => onChange(undefined)}
          style={rond}
          className={`${pastille} inline-flex items-center justify-center text-muted-foreground ${
            !v ? "border-foreground" : "border-border"
          }`}
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
      {[...COULEURS_DOCUMENT, ...NEUTRES].map((c) => (
        <button
          key={c.valeur}
          type="button"
          aria-pressed={v === c.valeur}
          aria-label={c.nom}
          title={c.nom}
          onClick={() => onChange(c.valeur)}
          style={{ ...rond, background: c.valeur }}
          className={`${pastille} ${
            v === c.valeur ? "border-foreground ring-2 ring-foreground/20" : "border-border"
          }`}
        />
      ))}
      <label
        title="Autre couleur"
        className={`${pastille} relative inline-flex cursor-pointer items-center justify-center text-muted-foreground ${
          libre ? "border-foreground ring-2 ring-foreground/20" : "border-border"
        }`}
        style={libre ? { ...rond, background: v } : rond}
      >
        {!libre && <Pipette className="h-3.5 w-3.5" />}
        <input
          type="color"
          aria-label={`${nom} : autre couleur`}
          value={v ?? "#16181A"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
};
