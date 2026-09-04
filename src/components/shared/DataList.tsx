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

          const Row = clickable ? "button" : "div";
          return (
            <Row
              key={item.id}
              {...(clickable ? { type: "button" as const, onClick: () => setOpenItem(item) } : {})}
              className="app-list-row w-full justify-between gap-3 text-left"
            >
              {/* Bloc gauche : produit puis, en dessous, tout le contexte
                  sur une seule ligne grise. */}
              <span className="min-w-0 flex-1">
                <span className="app-list-primary block">{item.primary}</span>
                {meta.length > 0 && (
                  <span className="app-list-secondary block">{meta.join(" · ")}</span>
                )}
              </span>

              {/* Bloc droit : montant, puis badge de statut. */}
              <span className="flex shrink-0 items-center gap-3">
                {(item.amount || item.amountHint) && (
                  <span className="text-right">
                    {item.amount && <span className="app-list-amount block">{item.amount}</span>}
                    {item.amountHint && (
                      <span className="app-list-secondary block">{item.amountHint}</span>
                    )}
                  </span>
                )}
                {item.badge && <span className="shrink-0">{item.badge}</span>}
                {clickable && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
              </span>
            </Row>
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
