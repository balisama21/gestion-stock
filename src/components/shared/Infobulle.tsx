import React, { useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useClicExterieur } from "../../hooks/useClicExterieur";

interface InfobulleProps {
  /** Ce que le point d'interrogation explique. Une ou deux phrases. */
  children: React.ReactNode;
  /** Dit à voix haute par le lecteur d'écran : « Aide sur … ». */
  sujet: string;
}

/**
 * LE POINT D'INTERROGATION QUI RÉPOND VRAIMENT.
 *
 * ── POURQUOI CE N'EST PAS UN `title=""` ──
 *
 * L'attribut `title` du navigateur ne s'ouvre qu'au survol de la souris,
 * après une seconde d'attente, et n'existe pas du tout au doigt. Sur un
 * téléphone — c'est-à-dire là où ce logiciel est le plus utilisé — il ne
 * dit donc rien à personne.
 *
 * ── CE QUI LA REND ACCESSIBLE ──
 *
 * C'est un vrai bouton : il se reçoit à la tabulation, s'ouvre à Entrée
 * comme au clic, et se ferme à Échap. Le texte est relié au bouton par
 * `aria-describedby`, si bien qu'un lecteur d'écran le lit sans avoir à
 * entrer dedans.
 *
 * Le bouton ne porte ni cadre ni fond : un point d'interrogation se
 * reconnaît seul, et une rangée de petites boîtes grises au-dessus d'un
 * formulaire fait du bruit pour rien. Sa zone de clic, elle, reste
 * entière — c'est elle qui compte pour le doigt.
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
