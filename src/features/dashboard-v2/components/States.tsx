import React from "react";
import { Card } from "./Card";

/**
 * LES TROIS ÉTATS D'UNE CARTE : elle charge, elle est vide, elle a
 * échoué.
 *
 * UNE CARTE EN ERREUR NE FAIT PAS TOMBER LA PAGE. Dix-neuf cartes lisent
 * des tables différentes ; qu'une lecture soit refusée ne doit pas
 * priver le commerçant des dix-huit autres. La carte fautive garde sa
 * place, dit ce qui manque, et propose de réessayer.
 *
 * LE SQUELETTE A LA FORME DE CE QU'IL ATTEND. Un rectangle gris de
 * taille quelconque fait sauter la page quand le contenu arrive ; un
 * squelette à la bonne forme réserve exactement la place.
 */

const COCHE = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="3"
    strokeLinecap="round"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
);

/** L'état vide, quand il est une bonne nouvelle : rien à traiter. */
export const EtatVide: React.FC<{ titre: string; detail: string }> = ({ titre, detail }) => (
  <div className="empty">
    <div className="ok">{COCHE}</div>
    <div>
      <b>{titre}</b>
      <small>{detail}</small>
    </div>
  </div>
);

export const EtatErreur: React.FC<{ message?: string; onReessayer?: () => void }> = ({
  message = "Ces données n'ont pas pu être lues.",
  onReessayer,
}) => (
  <div className="card-err" role="status">
    <div>
      <b>Lecture impossible</b>
      <br />
      <small>{message}</small>
    </div>
    {onReessayer && (
      <button type="button" className="btn ghost" onClick={onReessayer}>
        Réessayer
      </button>
    )}
  </div>
);

/** Une barre grise. `w` en pourcentage, `h` en pixels. */
export const Barre: React.FC<{ w?: string; h?: number }> = ({ w = "100%", h = 12 }) => (
  <span className="sk" style={{ width: w, height: h }} />
);

/** Quelques lignes de texte en attente. */
export const LignesSquelette: React.FC<{ n?: number }> = ({ n = 3 }) => (
  <div className="sk-lines">
    {Array.from({ length: n }, (_, i) => (
      <Barre key={i} w={i === n - 1 ? "60%" : "100%"} h={14} />
    ))}
  </div>
);

/** Une carte entière en attente, titre compris. */
export const CarteSquelette: React.FC<{ span?: 4 | 5 | 6 | 7 | 8 | 12; lignes?: number }> = ({
  span = 4,
  lignes = 4,
}) => (
  <Card span={span}>
    <div className="ch">
      <Barre w="40%" h={12} />
      <Barre w="18%" h={12} />
    </div>
    <Barre w="55%" h={30} />
    <LignesSquelette n={lignes} />
  </Card>
);
