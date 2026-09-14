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
  /**
   * Filet d'état sur le bord gauche de la carte, dans la grille.
   *
   * Jamais décoratif : il ne paraît que lorsque la valeur demande
   * quelque chose. Une trésorerie saine n'en porte pas — un filet
   * permanent, fût-il vert, cesse d'être un signal au bout de trois
   * jours et redevient de la décoration.
   */
  filet?: "danger" | "warning";
}

interface StatBarProps {
  items: StatItem[];
  /** Nombre de colonnes aux différents paliers. */
  className?: string;
}

const Trend: React.FC<{ trend: NonNullable<StatItem["trend"]> }> = ({ trend }) => {
  if (trend.noBaseline) {
    return <span className="text-xs text-muted-foreground">{trend.label}</span>;
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
      <span>{trend.label}</span>
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
}

/**
 * Une colonne de la barre d'indicateurs, à utiliser directement quand la
 * liste des colonnes est conditionnelle (permissions) et se prête mal à
 * un tableau d'objets.
 *
 * `tone` et `hintTone` sont acceptés mais ignorés : la couleur de fond
 * et la pastille d'icône ont disparu avec le passage au style sobre.
 */
export const StatCol: React.FC<StatColProps> = ({ label, value, hint, icon, alert, onClick }) => {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className="app-statbar-item"
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
            <Trend trend={item.trend} />
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
   Les mêmes indicateurs, mais en cartes de taille égale sur une ligne
   ═══════════════════════════════════════════════════════════════════ */

/** Nombre de colonnes sur grand écran, selon le nombre de cartes.
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

const FILET: Record<NonNullable<StatItem["filet"]>, string> = {
  danger: "border-l-2 border-l-danger",
  warning: "border-l-2 border-l-warning",
};

/**
 * Une ligne de cartes de même taille — trésorerie, ventes, achats,
 * dépenses, stock — plutôt qu'une bande à colonnes.
 *
 * ── Ce que chaque carte doit dire d'elle-même ──
 *
 * La bande séparait les FLUX des SOLDES en deux blocs titrés, parce
 * que le sélecteur de période ne gouverne que les premiers. Sur une
 * seule ligne, ce regroupement disparaît : chaque carte porte donc son
 * propre horizon sous le chiffre — « argent disponible » pour une
 * caisse, « ce mois-ci » pour des ventes. L'information est la même,
 * dite carte par carte au lieu de bloc par bloc.
 *
 * ── Hauteurs égales ──
 *
 * `h-full` sur chaque carte, et la grille étire ses rangées : une
 * carte à deux lignes de texte prend la hauteur de sa voisine à
 * quatre. Sans cela, une ligne de cartes se lit comme un graphique en
 * bâtons dont les hauteurs ne voudraient rien dire.
 */
export const GrilleIndicateurs: React.FC<StatBarProps> = ({ items, className = "" }) => (
  <div
    className={`grid grid-cols-2 gap-3 md:grid-cols-3 sm:gap-4 ${
      COLONNES[items.length] ?? "xl:grid-cols-4"
    } ${className}`}
  >
    {items.map((item) => {
      const Wrapper = item.onClick ? "button" : "div";
      return (
        <Wrapper
          key={item.key}
          {...(item.onClick ? { onClick: item.onClick, type: "button" as const } : {})}
          className={`app-card flex h-full flex-col gap-1 p-3.5 text-left sm:p-4 ${
            item.filet ? FILET[item.filet] : ""
          } ${item.onClick ? "transition-colors hover:bg-muted/40" : ""}`}
        >
          <span className="app-statbar-label">
            {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </span>

          <span className="app-statbar-value truncate">{item.value}</span>

          {/* L'horizon d'abord, la tendance ensuite. Il qualifie le
              chiffre au-dessus — « 43 300 Ar, ce mois-ci » — tandis que
              la tendance parle du pourcentage. Dans l'autre sens, on
              lisait deux phrases de période à la suite sans savoir
              laquelle portait sur quoi. */}
          {item.hint && (
            <span className={`app-statbar-hint ${item.alert ? "t-warning" : ""}`}>{item.hint}</span>
          )}

          {item.trend && <Trend trend={item.trend} />}
        </Wrapper>
      );
    })}
  </div>
);
