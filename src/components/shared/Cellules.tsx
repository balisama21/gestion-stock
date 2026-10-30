import React from "react";
import { formatCurrency, formatDateLocale, quantiteEnMots } from "../../utils/formulas";
import type { LocaleSetting } from "../../types";

/**
 * LES CELLULES DES TABLEAUX DE PC
 *
 * Quelques formes qui reviennent d'une page à l'autre, pour que tous
 * les tableaux se lisent de la même façon : un chiffre en gras et sa
 * note en petit dessous, une date avec son jour, une marge en vert, un
 * stock avec sa jauge. Chaque page choisit ses colonnes ; l'allure,
 * elle, est commune.
 */

type Ton = "neutre" | "succes" | "alerte" | "danger";

const TON: Record<Ton, string> = {
  neutre: "",
  succes: "t-success",
  alerte: "t-warning",
  danger: "t-danger",
};

/** Un chiffre (ou un mot) en gras, et sa note dessous. */
export const Deux: React.FC<{
  haut: React.ReactNode;
  bas?: React.ReactNode;
  tonHaut?: Ton;
  tonBas?: Ton;
}> = ({ haut, bas, tonHaut = "neutre", tonBas = "neutre" }) => (
  <>
    <span className={`app-cellule-haut ${TON[tonHaut]}`}>{haut}</span>
    {bas && <span className={`app-cellule-bas ${TON[tonBas]}`}>{bas}</span>}
  </>
);

/** Un montant, et ce qui l'accompagne : « reste 16 000 Ar », « achat 850 Ar ». */
export const Montant: React.FC<{
  valeur: number;
  note?: React.ReactNode;
  tonNote?: Ton;
}> = ({ valeur, note, tonNote = "neutre" }) => (
  <Deux haut={formatCurrency(valeur)} bas={note} tonBas={tonNote} />
);

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** « 23/10/2026 », et le jour dessous : on situe une vente dans sa semaine. */
export const DateJour: React.FC<{ iso: string; locale: LocaleSetting }> = ({ iso, locale }) => {
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  const jour = a && m && j ? JOURS[new Date(a, m - 1, j).getDay()] : null;
  return <Deux haut={formatDateLocale(iso, locale)} bas={jour} />;
};

/** Un texte qui peut manquer (« — »), coupé proprement s'il est long. */
export const Texte: React.FC<{ valeur?: string | null; note?: React.ReactNode }> = ({
  valeur,
  note,
}) =>
  valeur ? (
    <>
      <span className="app-cellule-texte" title={valeur}>
        {valeur}
      </span>
      {note && <span className="app-cellule-bas">{note}</span>}
    </>
  ) : (
    <span className="app-grille-vide">—</span>
  );

/** La marge en vert, et son taux sur le prix de vente. */
export const Marge: React.FC<{ marge: number; total?: number }> = ({ marge, total }) => (
  <Deux
    haut={`${marge >= 0 ? "+" : ""}${formatCurrency(marge)}`}
    tonHaut={marge >= 0 ? "succes" : "danger"}
    bas={total && total > 0 ? `${Math.round((marge / total) * 100)} %` : undefined}
  />
);

/**
 * Le stock, et une jauge : la réserve rapportée au double du seuil
 * d'alerte. Pleine, la réserve est confortable ; au tiers, elle passe
 * sous le seuil ; vide, c'est la rupture.
 */
export const Stock: React.FC<{
  quantite: number;
  seuil: number;
  suivi?: boolean;
  unite?: string | null;
  /** Une note sous la jauge : le même stock en cartons, en sacs… */
  detail?: string | null;
}> = ({ quantite, seuil, suivi = true, unite, detail }) => {
  if (!suivi) return <span className="app-cellule-bas">non suivi</span>;
  const rupture = quantite <= 0;
  const bas = !rupture && quantite <= seuil;
  const plein = seuil > 0 ? Math.min(1, quantite / (seuil * 2)) : quantite > 0 ? 1 : 0;
  const couleur = rupture ? "var(--danger)" : bas ? "var(--warning)" : "var(--success)";
  return (
    <>
      <span className={`app-cellule-haut ${rupture ? "t-danger" : bas ? "t-warning" : ""}`}>
        {rupture ? "Rupture" : unite ? quantiteEnMots(quantite, unite) : `${quantite}`}
      </span>
      <span className="app-jauge" aria-hidden="true">
        <i style={{ width: `${Math.round(plein * 100)}%`, background: couleur }} />
      </span>
      {detail && !rupture && <span className="app-cellule-bas">{detail}</span>}
    </>
  );
};
