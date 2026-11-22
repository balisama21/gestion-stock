import React from "react";
import "./pharmacie.css";

/**
 * Les pièces de l'habit « officine » (voir `pharmacie.css`) : chaque écran
 * de la pharmacie se compose de ces briques, et d'elles seules pour sa
 * charpente. C'est ce qui le distingue d'un écran de boutique ou de bar.
 */

/** L'écriture de l'officine, demandée une seule fois et seulement dans une pharmacie. */
export function chargerPolicePharmacie() {
  if (typeof document === "undefined" || document.getElementById("tn-police-pharmacie")) return;
  const lien = document.createElement("link");
  lien.id = "tn-police-pharmacie";
  lien.rel = "stylesheet";
  lien.href =
    "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(lien);
}

type Ton = "danger" | "warning" | "info" | "croix" | "plein" | undefined;

/** La croix de la pharmacie, aux angles adoucis. */
export const Croix: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="currentColor"
      d="M9.2 2.5h5.6a1 1 0 0 1 1 1v4.7h4.7a1 1 0 0 1 1 1v5.6a1 1 0 0 1-1 1h-4.7v4.7a1 1 0 0 1-1 1H9.2a1 1 0 0 1-1-1v-4.7H3.5a1 1 0 0 1-1-1V9.2a1 1 0 0 1 1-1h4.7V3.5a1 1 0 0 1 1-1Z"
    />
  </svg>
);

/** L'en-tête d'une page : sa croix (ou son icône), son titre, ses gestes, ses chiffres. */
export const EnTete: React.FC<{
  icone?: React.ReactNode;
  titre: string;
  sousTitre?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ icone, titre, sousTitre, actions, children }) => (
  <header className="ph-entete">
    <div className="ph-entete-haut">
      <span className="ph-entete-icone">{icone ?? <Croix className="h-6 w-6" />}</span>
      <div className="ph-entete-texte">
        <h1 className="ph-entete-titre">{titre}</h1>
        {sousTitre && <p className="ph-entete-sous">{sousTitre}</p>}
      </div>
      {actions && <div className="ph-entete-actions">{actions}</div>}
    </div>
    {children && <div className="ph-entete-chiffres">{children}</div>}
  </header>
);

/** Un chiffre clé, cliquable ou non. */
export const Chiffre: React.FC<{
  valeur: React.ReactNode;
  libelle: React.ReactNode;
  icone?: React.ReactNode;
  ton?: Ton;
  onClick?: () => void;
  actif?: boolean;
}> = ({ valeur, libelle, icone, ton, onClick, actif }) => {
  const contenu = (
    <>
      <span className="ph-chiffre-valeur">{valeur}</span>
      <span className="ph-chiffre-libelle">
        {icone}
        {libelle}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      data-ton={ton}
      aria-pressed={actif}
      className={`ph-chiffre ${actif ? "ring-2 ring-primary" : ""}`}
    >
      {contenu}
    </button>
  ) : (
    <div data-ton={ton} className="ph-chiffre">
      {contenu}
    </div>
  );
};

/** Un panneau titré. */
export const Panneau: React.FC<{
  titre?: React.ReactNode;
  icone?: React.ReactNode;
  action?: React.ReactNode;
  corps?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ titre, icone, action, corps = false, className = "", children }) => (
  <section className={`ph-panneau ${className}`}>
    {(titre || action) && (
      <div className="ph-panneau-tete">
        {icone && <span className="text-primary">{icone}</span>}
        {titre && <h2 className="ph-panneau-titre">{titre}</h2>}
        {action && <div className="ph-panneau-action">{action}</div>}
      </div>
    )}
    {corps ? <div className="ph-panneau-corps">{children}</div> : children}
  </section>
);

export const Vide: React.FC<{ icone?: React.ReactNode; children: React.ReactNode }> = ({
  icone,
  children,
}) => (
  <div className="ph-vide">
    {icone && <div className="mb-2 flex justify-center text-primary">{icone}</div>}
    {children}
  </div>
);

/** Une étiquette de lot, comme imprimée sur la boîte. */
export const EtiquetteLot: React.FC<{ numero: string | null }> = ({ numero }) => (
  <span className="ph-lot">{numero ? `LOT ${numero}` : "LOT —"}</span>
);

/** Les deux premières lettres d'un médicament, dans une pastille. */
export const Pastille: React.FC<{ nom: string; className?: string }> = ({
  nom,
  className = "",
}) => (
  <span className={`ph-pastille ${className}`} aria-hidden="true">
    {nom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "℞"}
  </span>
);

/** Des onglets segmentés, avec un compte facultatif. */
export function Segments<T extends string>({
  valeur,
  options,
  onChange,
  libelle,
}: {
  valeur: T;
  options: { cle: T; libelle: string; compte?: number }[];
  onChange: (v: T) => void;
  libelle: string;
}) {
  return (
    <div className="ph-segments" role="tablist" aria-label={libelle}>
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          role="tab"
          aria-selected={valeur === o.cle}
          onClick={() => onChange(o.cle)}
          className="ph-segment"
        >
          {o.libelle}
          {o.compte !== undefined && <span className="ph-segment-compte">{o.compte}</span>}
        </button>
      ))}
    </div>
  );
}

/** Le grand champ de recherche des écrans de la pharmacie. */
export const Recherche: React.FC<{
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
  icone: React.ReactNode;
  autoFocus?: boolean;
  onEntree?: () => void;
}> = ({ valeur, onChange, placeholder, icone, autoFocus, onEntree }) => (
  <label className="ph-recherche block">
    <span className="ph-recherche-icone">{icone}</span>
    <input
      type="search"
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEntree) {
          e.preventDefault();
          onEntree();
        }
      }}
      placeholder={placeholder}
      className="app-field w-full"
      autoFocus={autoFocus}
    />
  </label>
);

/**
 * Des raccourcis sous un champ : un clic le remplit. Les valeurs qu'on
 * tape cent fois (un dosage, une posologie, un taux, une date) sont là,
 * prêtes ; le champ reste libre pour tout le reste.
 */
export function Raccourcis({
  options,
  actif,
  onChoisir,
  libelle,
}: {
  options: (string | { valeur: string; libelle: string })[];
  actif?: string;
  onChoisir: (valeur: string) => void;
  libelle?: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="ph-raccourcis" role="group" aria-label={libelle ?? "Raccourcis"}>
      {options.map((o) => {
        const { valeur, libelle: texte } = typeof o === "string" ? { valeur: o, libelle: o } : o;
        return (
          <button
            key={`${valeur}-${texte}`}
            type="button"
            onClick={() => onChoisir(valeur)}
            aria-pressed={actif !== undefined && actif === valeur}
            className="ph-raccourci"
          >
            {texte}
          </button>
        );
      })}
    </div>
  );
}
