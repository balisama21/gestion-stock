import React from "react";

export interface LigneJournalProps {
  /** Vignette produit, ou tout autre visuel de 32 à 36 pixels. */
  vignette?: React.ReactNode;
  /** L'information principale : le nom du produit, le libellé d'une dépense. */
  titre: React.ReactNode;
  /** Étiquettes posées à droite du titre : variante, catégorie. */
  etiquettes?: React.ReactNode;
  /**
   * Le second rang d'informations, joint par « · ».
   * Par exemple « 20 unités » et « Lanto ». Les valeurs vides sautent.
   */
  details?: (string | null | undefined | false)[];
  /** La date, colonne à part sur grand écran, repliée dans les détails sinon. */
  quand?: string | null;
  montant?: string;
  /** Badge de statut — la seule couleur admise sur la ligne. */
  badge?: React.ReactNode;
  /** Élément de fin de ligne : chevron, bouton. */
  fin?: React.ReactNode;
  onClick?: () => void;
  titreAccessible?: string;
}

/**
 * Une ligne des journaux du tableau de bord — ventes, achats, dépenses.
 *
 * ── La hiérarchie, d'abord ──
 *
 * Un nom en gras foncé, et sous lui une seule ligne grise qui regroupe
 * tout le reste. C'est la règle de l'application depuis la refonte, et
 * elle vaut ici comme ailleurs : on lit le nom, puis le montant à
 * droite, puis le statut ; le second rang ne se lit que si l'on
 * s'arrête sur la ligne.
 *
 * Une seule chose sort de cette ligne grise : LA DATE, qui prend sa
 * propre colonne quand la place le permet. C'est la donnée qu'on
 * parcourt verticalement — « qu'est-ce qui s'est passé hier » — et une
 * colonne alignée se descend du regard, ce qu'une date noyée au milieu
 * d'un texte ne permet pas.
 *
 * ── Une seule couleur ──
 *
 * Le badge de statut, et lui seul. Le titre est foncé, le second rang
 * et la date sont gris, le montant est foncé. Un montant d'achat en
 * orange ou une dépense en rouge ne disent rien que le bloc qui les
 * contient ne dise déjà, et deux teintes de plus par ligne finissent
 * par rendre le badge — la seule couleur qui porte du sens — invisible.
 *
 * ── Le seuil se mesure sur le BLOC ──
 *
 * `@2xl` regarde la largeur du conteneur, pas celle de la fenêtre. À
 * 1024 pixels, l'accueil passe en deux colonnes et ses blocs sont plus
 * ÉTROITS qu'à 768 où ils tiennent toute la page : une règle en `md:`
 * sortirait la colonne de date précisément là où la place manque. Sous
 * 672 pixels de bloc, la date rejoint donc la ligne grise, et la
 * hiérarchie reste exactement la même.
 */
export const LigneJournal: React.FC<LigneJournalProps> = ({
  vignette,
  titre,
  etiquettes,
  details = [],
  quand,
  montant,
  badge,
  fin,
  onClick,
  titreAccessible,
}) => {
  const Wrapper = onClick ? "button" : "div";
  const secondaires = details.filter(Boolean) as string[];
  const replie = [...secondaires, quand].filter(Boolean).join(" · ");

  return (
    <Wrapper
      {...(onClick ? { onClick, type: "button" as const, title: titreAccessible } : {})}
      className="app-list-row w-full justify-between gap-3 py-3 text-left"
    >
      {vignette}

      <span className="min-w-0 flex-1">
        <span className="app-list-primary flex min-w-0 items-center gap-2">
          <span className="truncate">{titre}</span>
          {etiquettes}
        </span>
        {/* Repliée : la date rentre dans le rang. Étalée : elle en sort. */}
        {/* Repliée, la ligne grise a le droit de PASSER A LA LIGNE.
            Elle porte alors trois informations au lieu de deux — la
            date les a rejointes — et sur un téléphone « 20 litres ·
            Lanto · 13/09/2026 à 10:24 » se faisait couper au milieu de
            la date. Deux courtes lignes grises valent mieux qu'une
            seule amputée : rien n'est perdu, et la hiérarchie ne
            change pas. Étalée, elle reprend la troncature commune,
            puisqu'elle n'a plus que deux informations à porter. */}
        {replie && (
          <span className="app-list-secondary block whitespace-normal @2xl:hidden">{replie}</span>
        )}
        {secondaires.length > 0 && (
          <span className="app-list-secondary hidden @2xl:block">{secondaires.join(" · ")}</span>
        )}
      </span>

      {quand && (
        <span className="hidden w-36 shrink-0 text-sm text-muted-foreground @2xl:block">
          {quand}
        </span>
      )}

      {montant && <span className="app-list-amount">{montant}</span>}
      {badge}
      {fin}
    </Wrapper>
  );
};
