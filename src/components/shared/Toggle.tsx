import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  id?: string;
  /** Obligatoire : lu par les lecteurs d'écran, le bouton n'a pas de texte. */
  label: string;
  disabled?: boolean;
  size?: "md" | "sm";
}

/**
 * Interrupteur partagé.
 *
 * Le curseur est un élément EN FLUX (`inline-block`) dans un conteneur
 * `inline-flex items-center`, et non un élément `absolute`. C'est
 * volontaire : un curseur en `position: absolute` sans `left` part de sa
 * position statique, que le décalage `translate-x` fait alors sortir de
 * la pilule — il venait peindre un rond blanc par-dessus la première
 * lettre du libellé voisin.
 */
export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  id,
  label,
  disabled,
  size = "md",
}) => {
  const dims =
    size === "sm"
      ? { track: "h-6 w-11", knob: "h-4 w-4", on: "translate-x-6", off: "translate-x-1" }
      : { track: "h-7 w-12", knob: "h-5 w-5", on: "translate-x-6", off: "translate-x-1" };

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${dims.track} ${
        checked ? "border-transparent bg-primary" : "border-border bg-muted"
      }`}
      style={{ minHeight: 0 }}
    >
      <span
        className={`inline-block transform rounded-full bg-card shadow transition-transform ${dims.knob} ${
          checked ? dims.on : dims.off
        }`}
      />
    </button>
  );
};
