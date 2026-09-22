import React, { useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useClicExterieur } from "../../hooks/useClicExterieur";

interface InfobulleProps {
  /** Une ou deux phrases. */
  children: React.ReactNode;
  /** Dit à voix haute par le lecteur d'écran : « Aide sur … ». */
  sujet: string;
}

/**
 * Un vrai bouton plutôt qu'un attribut `title`, qui ne dit rien au
 * doigt : tabulation, Entrée, Échap, et `aria-describedby` pour le
 * lecteur d'écran. Ni cadre ni fond — un « ? » se reconnaît seul.
 */
export const Infobulle: React.FC<InfobulleProps> = ({ children, sujet }) => {
  const zone = useRef<HTMLSpanElement>(null);
  const [ouverte, setOuverte] = useState(false);
  const id = useId();

  useClicExterieur(zone, ouverte, () => setOuverte(false));

  return (
    <span ref={zone} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOuverte((o) => !o)}
        onMouseEnter={() => setOuverte(true)}
        onMouseLeave={() => setOuverte(false)}
        onFocus={() => setOuverte(true)}
        aria-expanded={ouverte}
        aria-describedby={ouverte ? id : undefined}
        aria-label={`Aide sur ${sujet}`}
        className="app-btn-icon h-6 w-6 min-h-0 min-w-0 text-muted-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {ouverte && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-7 z-40 w-64 rounded-xl border border-border bg-card p-3 text-xs font-normal leading-relaxed text-muted-foreground shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
};
