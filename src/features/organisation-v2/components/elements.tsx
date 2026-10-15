import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IcCoche } from "./icones";
import { couleurDe, initialeDe } from "../lib/personnes";

/** La pastille d'une personne : initiale sur sa couleur. */
export const Avatar: React.FC<{
  id: string | null;
  nom: string;
  moiId: string | null;
  taille?: "xs" | "sm";
}> = ({ id, nom, moiId, taille }) => (
  <i
    className={`av${taille ? ` ${taille}` : ""}`}
    style={{ background: couleurDe(id, moiId) }}
    aria-hidden="true"
  >
    {initialeDe(nom)}
  </i>
);

/** L'encadré vert « tout va bien » de la maquette, ou sa version neutre. */
export const EtatVide: React.FC<{ titre: string; detail?: string; neutre?: boolean }> = ({
  titre,
  detail,
  neutre,
}) => (
  <div className={`empty${neutre ? " neutre" : ""}`}>
    <div className="ok">
      <IcCoche blanc />
    </div>
    <div>
      <b>{titre}</b>
      {detail && <small>{detail}</small>}
    </div>
  </div>
);

/** Un groupe de boutons dont un seul est enfoncé. */
export function Segmente<T extends string>({
  valeur,
  options,
  onChange,
  label,
}: {
  valeur: T;
  options: { valeur: T; libelle: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          aria-pressed={valeur === o.valeur}
          onClick={() => onChange(o.valeur)}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/** L'interrupteur de la maquette. */
export const Interrupteur: React.FC<{
  actif: boolean;
  label: string;
  disabled?: boolean;
  onChange: () => void;
}> = ({ actif, label, disabled, onChange }) => (
  <button
    type="button"
    className="switch"
    role="switch"
    aria-checked={actif}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
  >
    <i />
  </button>
);

export interface MessageToast {
  id: number;
  texte: string;
  erreur?: boolean;
}

/**
 * Le message de confirmation, en bas de l'écran. Il ne s'affiche
 * qu'APRÈS une écriture réussie (ou pour en dire l'échec) : jamais
 * avant, pour ne pas faire croire à une sauvegarde qui n'a pas eu lieu.
 */
export const Toast: React.FC<{ message: MessageToast | null }> = ({ message }) => {
  const [monte, setMonte] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => setMonte(true), []);
  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), message.erreur ? 5000 : 2600);
    return () => window.clearTimeout(t);
  }, [message]);
  if (!monte) return null;
  return createPortal(
    <div className="org2-portal">
      <div
        className={`toast${visible ? " on" : ""}${message?.erreur ? " crit" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message?.texte}
      </div>
    </div>,
    document.body,
  );
};
