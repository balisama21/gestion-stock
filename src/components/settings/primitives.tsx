import React from "react";
import { Check, Loader2 } from "lucide-react";
import { Toggle } from "../shared/Toggle";

/**
 * Briques communes à toutes les sections de réglages.
 *
 * Objectif : que chaque réglage se présente de la même façon — libellé et
 * explication à gauche, contrôle à droite sur desktop, empilés sur mobile.
 * C'est ce qui donne à la page son unité, plutôt que des formulaires
 * dessinés différemment d'un onglet à l'autre.
 */

interface SectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** Bouton ou badge affiché à droite de l'en-tête. */
  aside?: React.ReactNode;
  /** Teinte de la bordure, pour les sections sensibles. */
  tone?: "default" | "danger";
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SectionProps> = ({
  title,
  description,
  icon,
  aside,
  tone = "default",
  children,
}) => (
  <section
    className={`app-card overflow-hidden ${tone === "danger" ? "border-danger-border" : ""}`}
  >
    <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
      <div className="flex min-w-0 gap-3">
        {icon && (
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              tone === "danger"
                ? "border-danger-border bg-danger-soft t-danger"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2
            className={`text-base font-bold tracking-tight ${
              tone === "danger" ? "t-danger" : "text-foreground"
            }`}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>

    <div className="divide-y divide-border">{children}</div>
  </section>
);

interface RowProps {
  label: string;
  /** Phrase courte qui explique la conséquence concrète du réglage. */
  hint?: string;
  /** Identifiant du contrôle, pour relier le <label>. */
  htmlFor?: string;
  /** Le contrôle passe pleine largeur sous le libellé (zones de texte). */
  stacked?: boolean;
  children: React.ReactNode;
}

export const SettingsRow: React.FC<RowProps> = ({ label, hint, htmlFor, stacked, children }) => (
  <div
    className={`px-4 py-4 sm:px-6 ${
      stacked ? "" : "sm:flex sm:items-start sm:justify-between sm:gap-8"
    }`}
  >
    <div className={stacked ? "mb-2" : "min-w-0 sm:max-w-[55%]"}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-foreground"
      >
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
    <div className={stacked ? "" : "mt-2 w-full sm:mt-0 sm:w-auto sm:min-w-[15rem] sm:shrink-0"}>
      {children}
    </div>
  </div>
);

/** Bloc libre à l'intérieur d'une section (listes, encarts, tableaux). */
export const SettingsBlock: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`px-4 py-4 sm:px-6 ${className}`}>{children}</div>;

/** Interrupteur accessible — bouton réel, pas une case déguisée. */
export const SettingsToggle = Toggle;

interface SaveBarProps {
  /** Vrai dès qu'un champ diffère de la valeur enregistrée. */
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  /** Affiché quelques secondes après un enregistrement réussi. */
  saved?: boolean;
  label?: string;
}

/**
 * Barre d'enregistrement collante, visible uniquement quand il y a des
 * modifications en attente. Elle remplace les boutons « Enregistrer »
 * dispersés : on sait toujours s'il reste quelque chose à sauvegarder.
 *
 * bottom-24 sur mobile pour passer au-dessus de la navigation basse.
 */
export const SaveBar: React.FC<SaveBarProps> = ({
  dirty,
  saving,
  onSave,
  onReset,
  saved,
  label = "Modifications non enregistrées",
}) => {
  if (saved && !dirty) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-success-border bg-success-soft px-4 py-3 text-sm font-semibold t-success">
        <Check className="h-4 w-4" />
        Modifications enregistrées
      </div>
    );
  }

  if (!dirty) return null;

  return (
    <div className="sticky bottom-24 z-30 lg:bottom-4">
      <div
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4"
        style={{ boxShadow: "var(--elev-3)" }}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
          {label}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="app-btn-ghost flex-1 sm:flex-none"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="app-btn-primary flex-1 sm:flex-none"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Message de retour (succès / erreur) sous un formulaire. */
export const SettingsFeedback: React.FC<{
  type: "success" | "error";
  children: React.ReactNode;
}> = ({ type, children }) => (
  <div
    className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
      type === "success"
        ? "border-success-border bg-success-soft t-success"
        : "border-danger-border bg-danger-soft t-danger"
    }`}
  >
    {children}
  </div>
);
