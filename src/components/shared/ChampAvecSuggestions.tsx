import React, { useId, useMemo } from "react";
import { cleDeListe } from "../../lib/listes";

interface ChampAvecSuggestionsProps {
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  /** Ce qui a déjà été saisi ailleurs dans la boutique. Jamais imposé. */
  suggestions: string[];
  placeholder?: string;
  aide?: React.ReactNode;
  compact?: boolean;
  id?: string;
}

/**
 * UN CHAMP LIBRE, QUI SE SOUVIENT.
 *
 * Certains champs ne doivent PAS devenir des listes. « Confié à » en est
 * un : une course se confie au voisin, à un taxi-be, à la cousine qui
 * passait par là. Imposer une liste voudrait dire créer une fiche pour
 * quelqu'un qu'on ne reverra peut-être jamais, et ce n'est pas au
 * logiciel de décider qui mérite une fiche.
 *
 * La seule chose qu'on doit à celui qui saisit, c'est de ne pas lui
 * faire retaper vingt fois le même nom. D'où les suggestions, tirées de
 * ce qui a déjà été écrit dans cette boutique.
 *
 * ── POURQUOI `datalist` ET PAS UN MENU MAISON ──
 *
 * C'est le navigateur qui ouvre la liste, la filtre à la frappe et la
 * parcourt aux flèches. Sur téléphone, elle s'affiche au-dessus du
 * clavier comme les suggestions du clavier lui-même. Un menu écrit à la
 * main ferait la même chose en moins bien, et devrait refaire le
 * clavier, le survol, le défilement et le lecteur d'écran.
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

  /** Dédoublonnées et triées : la liste doit se lire, pas se fouiller. */
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
