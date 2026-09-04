import React, { useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { Modal } from "./Modal";

export interface DetailField {
  label: string;
  value: React.ReactNode;
  /** Ligne masquée si la valeur est vide, nulle, « - » ou « 0 ». */
  hideIfEmpty?: boolean;
}

export interface DataListItem {
  id: string;
  /**
   * Élément posé avant le contenu, HORS de la zone cliquable : case de
   * sélection multiple, vignette produit, pastille d'avatar. Un contrôle
   * interactif imbriqué dans le bouton de ligne ne serait ni valide en
   * HTML ni utilisable au clavier.
   */
  leading?: React.ReactNode;
  /** Information principale : nom du produit, du client, du mouvement. */
  primary: React.ReactNode;
  /**
   * Informations secondaires regroupées sur UNE seule ligne grise sous
   * la principale (date, vendeur, prix unitaire…). Les valeurs vides
   * sont retirées et le séparateur « · » est posé automatiquement.
   */
  meta?: (string | null | undefined | false)[];
  /** Montant, aligné à droite. */
  amount?: string;
  /** Complément sous le montant (marge, reste dû…). */
  amountHint?: React.ReactNode;
  /** Badge de statut, à l'extrême droite. */
  badge?: React.ReactNode;
  /** Contenu du panneau de détails, ouvert au clic sur la ligne. */
  details?: DetailField[];
  /** Boutons affichés en pied du panneau de détails. */
  actions?: React.ReactNode;
  /** Titre du panneau de détails (par défaut : la valeur principale). */
  detailTitle?: string;
  detailSubtitle?: string;
}

interface DataListProps {
  items: DataListItem[];
  emptyLabel?: string;
  className?: string;
}

const isEmpty = (v: React.ReactNode) =>
  v === null || v === undefined || v === "" || v === "-" || v === "0";

/**
 * Liste dense, identique sur mobile et sur desktop.
 *
 * Elle remplace les tableaux à dix colonnes et plus, qui imposaient un
 * défilement horizontal aussi bien sur téléphone que sur grand écran :
 * il fallait suivre une ligne du regard puis faire glisser une barre en
 * bas pour lire la fin. Ici chaque ligne se lit d'un seul coup d'œil —
 * l'essentiel à gauche, le montant à droite, le statut à l'extrême
 * droite — et tout le reste est accessible d'un clic dans un panneau de
 * détails plutôt qu'étalé en colonnes.
 */
export const DataList: React.FC<DataListProps> = ({ items, emptyLabel, className = "" }) => {
  const [openItem, setOpenItem] = useState<DataListItem | null>(null);

  if (items.length === 0) {
    return (
      <div className={`flex flex-col items-center gap-2 px-4 py-10 text-center ${className}`}>
        <Inbox className="h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          {emptyLabel ?? "Aucun élément à afficher."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`app-list ${className}`}>
        {items.map((item) => {
          const meta = (item.meta ?? []).filter(Boolean) as string[];
          const clickable = Boolean(item.details?.length || item.actions);

          const inner = (
            <>
              {/* Bloc gauche : information principale puis, en dessous,
                  tout le contexte sur une seule ligne grise. */}
              <span className="min-w-0 flex-1">
                <span className="app-list-primary block">{item.primary}</span>
                {meta.length > 0 && (
                  <span className="app-list-secondary block">{meta.join(" · ")}</span>
                )}
              </span>

              {/* Bloc droit : montant, puis badge de statut. */}
              <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                {(item.amount || item.amountHint) && (
                  <span className="text-right">
                    {item.amount && <span className="app-list-amount block">{item.amount}</span>}
                    {item.amountHint && (
                      <span className="app-list-secondary block">{item.amountHint}</span>
                    )}
                  </span>
                )}
                {item.badge && <span className="shrink-0">{item.badge}</span>}
                {/* Le chevron disparaît sur écran étroit : ces 20 px sont
                    plus utiles au libellé principal qu'à un indice
                    d'affordance que le clic donne de toute façon. */}
                {clickable && (
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" />
                )}
              </span>
            </>
          );

          // Sans élément de tête, la ligne EST le bouton. Avec, c'est le
          // conteneur qui porte l'espacement et le bouton n'a plus de
          // marge interne propre — sinon les deux s'additionnent et la
          // ligne dépasse à droite.
          if (!item.leading) {
            const Row = clickable ? "button" : "div";
            return (
              <Row
                key={item.id}
                {...(clickable
                  ? { type: "button" as const, onClick: () => setOpenItem(item) }
                  : {})}
                className="app-list-row w-full justify-between gap-3 text-left"
              >
                {inner}
              </Row>
            );
          }

          return (
            <div key={item.id} className="app-list-row gap-3">
              <span className="shrink-0">{item.leading}</span>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => setOpenItem(item)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  {inner}
                </button>
              ) : (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  {inner}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {openItem && (
        <Modal
          open
          onClose={() => setOpenItem(null)}
          size="md"
          title={openItem.detailTitle ?? (typeof openItem.primary === "string" ? openItem.primary : "Détail")}
          description={openItem.detailSubtitle}
          footer={openItem.actions}
        >
          <dl className="divide-y divide-border">
            {(openItem.details ?? [])
              .filter((f) => !(f.hideIfEmpty && isEmpty(f.value)))
              .map((f, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 text-right font-medium text-foreground">{f.value}</dd>
                </div>
              ))}
          </dl>
        </Modal>
      )}
    </>
  );
};
