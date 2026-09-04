import React, { useState } from "react";
import { ChevronDown, Inbox } from "lucide-react";

export type Tone = "success" | "warning" | "danger" | "info" | "violet" | "neutral";

export const toneText: Record<Tone, string> = {
  success: "t-success",
  warning: "t-warning",
  danger: "t-danger",
  info: "t-info",
  violet: "t-violet",
  neutral: "text-foreground",
};

export interface CardField {
  label: string;
  value: React.ReactNode;
  /** Masque la ligne quand la valeur n'apporte rien (null, "", "-"). */
  hideIfEmpty?: boolean;
}

export interface CardItem {
  id: string;
  /**
   * Élément posé avant le titre, en dehors de la zone cliquable de
   * dépli — typiquement une case de sélection multiple. Il ne peut pas
   * vivre à l'intérieur du bouton : un contrôle interactif imbriqué
   * dans un bouton n'est ni valide en HTML ni utilisable au clavier.
   */
  leading?: React.ReactNode;
  /** Information la plus importante : nom du produit, du client… */
  title: React.ReactNode;
  /** Contexte secondaire : date, référence, vendeur… */
  subtitle?: React.ReactNode;
  /** Montant mis en évidence à droite. */
  amount?: string;
  amountTone?: Tone;
  /** Badge de statut affiché sous le montant. */
  badge?: React.ReactNode;
  /** Détails révélés au dépli. */
  fields: CardField[];
  /** Boutons d'action affichés en bas du bloc déplié. */
  actions?: React.ReactNode;
}

interface MobileCardListProps {
  items: CardItem[];
  emptyLabel?: string;
  /**
   * Affichée seulement sous 768px : au-dessus, la vue montre le tableau
   * classique. Les deux rendus consomment les mêmes données déjà
   * filtrées par les permissions côté vue appelante.
   */
  className?: string;
}

const isEmptyValue = (value: React.ReactNode) =>
  value === null || value === undefined || value === "" || value === "-";

const MobileCard: React.FC<{ item: CardItem }> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const fields = item.fields.filter((f) => !(f.hideIfEmpty && isEmptyValue(f.value)));
  const canExpand = fields.length > 0 || Boolean(item.actions);

  return (
    <div className="app-mcard">
      <div className="flex items-start">
        {item.leading && <div className="shrink-0 pl-4 pt-5">{item.leading}</div>}

        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          aria-expanded={canExpand ? expanded : undefined}
          className="app-mcard-head min-w-0 flex-1"
        >
          <div className="min-w-0 flex-1">
            <div className="app-mcard-title">{item.title}</div>
            {item.subtitle && <div className="app-mcard-sub">{item.subtitle}</div>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              {item.amount && (
                <div className={`app-mcard-amount ${toneText[item.amountTone ?? "neutral"]}`}>
                  {item.amount}
                </div>
              )}
              {item.badge && <div className="mt-1 flex justify-end">{item.badge}</div>}
            </div>
            {canExpand && (
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            )}
          </div>
        </button>
      </div>

      {expanded && canExpand && (
        <div className="app-mcard-body">
          {fields.map((field, i) => (
            <div key={i} className="app-mcard-row">
              <span className="app-mcard-label">{field.label}</span>
              <span className="app-mcard-value">{field.value}</span>
            </div>
          ))}
          {item.actions && (
            <div className="flex flex-wrap gap-2 pt-2">{item.actions}</div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Liste de cartes qui remplace les tableaux sur mobile.
 *
 * Chaque carte met en avant l'essentiel (désignation, montant, statut)
 * et replie le reste : aucune colonne du tableau desktop n'est perdue,
 * elle est simplement accessible d'un tap au lieu d'imposer un
 * défilement horizontal.
 */
export const MobileCardList: React.FC<MobileCardListProps> = ({
  items,
  emptyLabel = "Aucun élément à afficher.",
  className = "",
}) => {
  if (items.length === 0) {
    return (
      <div className={`app-card flex flex-col items-center gap-2 p-8 text-center ${className}`}>
        <Inbox className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item) => (
        <MobileCard key={item.id} item={item} />
      ))}
    </div>
  );
};
