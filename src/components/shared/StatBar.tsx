import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface StatItem {
  key: string;
  label: string;
  value: string;
  /** Information secondaire, en gris sous le chiffre. */
  hint?: string;
  /** Icône fine et monochrome. Jamais de pastille colorée. */
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Évolution vs période précédente, quand elle est calculable. */
  trend?: {
    percent: number;
    label: string;
    /**
     * De quel côté se trouve la bonne nouvelle.
     *
     * `neutre` quand il n'y en a pas : les achats, par exemple. Acheter
     * plus n'est ni bon ni mauvais — réapprovisionner n'est pas une
     * perte, c'est du stock qui change de forme. Peindre en rouge toute
     * hausse d'achats crée une fausse alerte à chaque commande
     * fournisseur, et on finit par ne plus regarder la couleur du tout.
     */
    goodDirection?: "up" | "down" | "neutre";
    noBaseline?: boolean;
  };
  /**
   * Signale une valeur qui demande une action (stock bas, impayés).
   * Seul cas où une couleur entre dans la barre — et uniquement sur le
   * texte secondaire, jamais en fond.
   */
  alert?: boolean;
}

interface StatBarProps {
  items: StatItem[];
  /** Nombre de colonnes aux différents paliers. */
  className?: string;
}

/**
 * Une evolution, fleche et pourcentage.
 *
 * `compact` retire la mention « vs … ». A n'employer que la ou cette
 * mention est deja portee UNE fois pour plusieurs chiffres : deux
 * tendances cote a cote qui repetent chacune « vs meme periode le mois
 * dernier » occupent quatre lignes pour dire une chose.
 */
export const Tendance: React.FC<{
  trend: NonNullable<StatItem["trend"]>;
  compact?: boolean;
}> = ({ trend, compact = false }) => {
  if (trend.noBaseline) {
    return compact ? null : <span className="text-xs text-muted-foreground">{trend.label}</span>;
  }
  const rounded = Math.round(trend.percent);
  const flat = rounded === 0;
  const up = trend.percent > 0;
  const sens = trend.goodDirection ?? "up";
  // `null` = la variation ne se colore pas. Soit elle est nulle, soit
  // aucune direction n'est meilleure que l'autre pour cette métrique.
  const good = flat || sens === "neutre" ? null : up === (sens === "up");
  const Icon = up ? ArrowUp : ArrowDown;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {!flat && (
        <span
          className={`inline-flex items-center ${
            good === null ? "" : good ? "t-success" : "t-danger"
          }`}
        >
          <Icon className="h-3 w-3" />
          {/* Espace INSÉCABLE avant le pourcent : dans une carte étroite,
              l'espace ordinaire laissait « 155 » en fin de ligne et le
              « % » tout seul au début de la suivante. */}
          {Math.abs(rounded)}&nbsp;%
        </span>
      )}
      {flat && <span>stable</span>}
      {!compact && <span>{trend.label}</span>}
    </span>
  );
};

interface StatColProps {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Signale une valeur qui demande une action ; colore le seul texte. */
  alert?: boolean;
  /** Conservé pour compatibilité d'appel — sans effet visuel. */
  tone?: string;
  hintTone?: string;
  onClick?: () => void;
  /**
   * Ce que le clic va faire, pour qui n'a que le libellé lu à voix
   * haute. « En retard » seul ne dit pas qu'on peut appuyer dessus.
   */
  ariaLabel?: string;
  /** Vrai quand ce filtre est celui qui est posé. */
  actif?: boolean;
}

/**
 * Une colonne de la barre d'indicateurs, à utiliser directement quand la
 * liste des colonnes est conditionnelle (permissions) et se prête mal à
 * un tableau d'objets.
 *
 * `tone` et `hintTone` sont acceptés mais ignorés : la couleur de fond
 * et la pastille d'icône ont disparu avec le passage au style sobre.
 */
export const StatCol: React.FC<StatColProps> = ({
  label,
  value,
  hint,
  icon,
  alert,
  onClick,
  ariaLabel,
  actif,
}) => {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick
        ? { onClick, type: "button" as const, "aria-label": ariaLabel, "aria-pressed": actif }
        : {})}
      className={`app-statbar-item ${actif ? "app-statbar-item-actif" : ""}`}
    >
      <span className="app-statbar-label">
        {icon && <span className="shrink-0 opacity-70">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="app-statbar-value truncate">{value}</span>
      {hint && <span className={`app-statbar-hint ${alert ? "t-warning" : ""}`}>{hint}</span>}
    </Wrapper>
  );
};

/**
 * Bande d'indicateurs compacte, à la manière des barres de statistiques
 * en haut des listes d'un ERP.
 *
 * Remplace la grille de cartes colorées : un seul bloc blanc, colonnes
 * séparées par un filet vertical, libellé gris en petit au-dessus et
 * chiffre en taille moyenne. Aucune pastille ni fond coloré — à cette
 * densité, la couleur décorative fatigue plus qu'elle n'aide.
 */
export const StatBar: React.FC<StatBarProps> = ({ items, className = "" }) => (
  <div className={`app-statbar grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 ${className}`}>
    {items.map((item) => {
      const Wrapper = item.onClick ? "button" : "div";
      return (
        <Wrapper
          key={item.key}
          {...(item.onClick ? { onClick: item.onClick, type: "button" as const } : {})}
          className="app-statbar-item"
        >
          <span className="app-statbar-label">
            {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </span>

          <span className="app-statbar-value truncate">{item.value}</span>

          {item.trend ? (
            <Tendance trend={item.trend} />
          ) : (
            item.hint && (
              <span className={`app-statbar-hint ${item.alert ? "t-warning" : ""}`}>
                {item.hint}
              </span>
            )
          )}
        </Wrapper>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   La même barre, mais qui compte ses colonnes
   ═══════════════════════════════════════════════════════════════════ */

/** Nombre de colonnes sur grand écran, selon le nombre d'indicateurs.
    Écrites en toutes lettres : Tailwind ne voit pas les classes
    composées à l'exécution et les retirerait de la feuille finale. */
const COLONNES: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

/**
 * La barre d'indicateurs du tableau de bord : UNE carte, des colonnes
 * séparées d'un filet — jamais une carte par chiffre.
 *
 * Trois différences avec `StatBar`, et c'est pourquoi elle existe à
 * côté plutôt qu'à la place.
 *
 * ── Elle compte ses colonnes ──
 *
 * `StatBar` en fixe six, quel que soit le nombre d'indicateurs reçus.
 * Ici le nombre suit la liste : une boutique qui a retiré le module
 * Commandes en affiche cinq, sur cinq colonnes pleines, et non cinq
 * colonnes suivies d'un vide.
 *
 * ── Elle dit l'horizon ET la tendance ──
 *
 * `StatBar` montre l'un ou l'autre. Le tableau de bord a besoin des
 * deux depuis que ses indicateurs tiennent sur une seule ligne : la
 * trésorerie et le stock sont des SOLDES, les ventes et les achats des
 * FLUX, et le sélecteur de période ne gouverne que les seconds. Deux
 * blocs titrés le disaient par leur place ; une barre unique ne le peut
 * plus, c'est donc chaque colonne qui porte son horizon sous son
 * chiffre — « argent disponible » ici, « ce mois-ci » là.
 *
 * ── L'ordre des deux lignes ──
 *
 * L'horizon AVANT la tendance : il qualifie le chiffre au-dessus de lui
 * — « 43 300 Ar, ce mois-ci » — alors que la tendance parle du
 * pourcentage. Dans l'autre sens on lit deux phrases de période à la
 * suite sans savoir laquelle porte sur quoi.
 */
export const BarreIndicateurs: React.FC<StatBarProps> = ({ items, className = "" }) => (
  <div
    className={`app-statbar grid-cols-2 sm:grid-cols-3 ${
      COLONNES[items.length] ?? "xl:grid-cols-6"
    } ${className}`}
  >
    {items.map((item) => {
      const Wrapper = item.onClick ? "button" : "div";
      return (
        <Wrapper
          key={item.key}
          {...(item.onClick ? { onClick: item.onClick, type: "button" as const } : {})}
          className="app-statbar-item"
        >
          <span className="app-statbar-label">
            {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </span>

          <span className="app-statbar-value truncate">{item.value}</span>

          {item.hint && (
            <span className={`app-statbar-hint ${item.alert ? "t-warning" : ""}`}>{item.hint}</span>
          )}

          {item.trend && <Tendance trend={item.trend} />}
        </Wrapper>
      );
    })}
  </div>
);
