import React, { useId, useMemo } from "react";
import { cleDeListe } from "../../lib/listes";

interface ChampAvecSuggestionsProps {
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  /** Ce qui a déjà été saisi ailleurs. Jamais imposé. */
  suggestions: string[];
  placeholder?: string;
  aide?: React.ReactNode;
  compact?: boolean;
  id?: string;
}

/**
 * Un champ libre qui se souvient. « Confié à » ne doit pas devenir une
 * liste : une course se confie au voisin, et ce n'est pas au logiciel
 * de décider qui mérite une fiche.
 *
 * `datalist` plutôt qu'un menu maison : le navigateur gère le filtrage,
 * les flèches, le tactile et le lecteur d'écran.
 */
export const ChampAvecSuggestions: React.FC<ChampAvecSuggestionsProps> = ({
  label,
  valeur,
  onChange,
  suggestions,
  placeholder,
  aide,
  compact = false,
  id,
}) => {
  const auto = useId();
  const idChamp = id ?? auto;
  const idListe = `${idChamp}-suggestions`;

  /** Dédoublonnées et triées : la liste doit se lire. */
  const propres = useMemo(() => {
    const vus = new Set<string>();
    const sorties: string[] = [];
    for (const s of suggestions) {
      const cle = cleDeListe(s);
      if (!cle || vus.has(cle)) continue;
      vus.add(cle);
      sorties.push(s.trim());
    }
    return sorties.sort((a, b) => a.localeCompare(b, "fr"));
  }, [suggestions]);

  return (
    <div>
      <label htmlFor={idChamp} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={idChamp}
        type="text"
        list={propres.length > 0 ? idListe : undefined}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={compact ? "app-field-sm" : "app-field"}
      />
      {propres.length > 0 && (
        <datalist id={idListe}>
          {propres.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {aide && <p className="mt-1 text-[11px] text-muted-foreground">{aide}</p>}
    </div>
  );
};
