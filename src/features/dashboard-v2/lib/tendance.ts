/**
 * COMPARER UNE PÉRIODE À CELLE D'AVANT
 *
 * Isolé des composants parce que deux lecteurs s'en servent : la pastille
 * d'évolution d'une carte, et la phrase de synthèse de l'en-tête. Les deux
 * doivent dire la même chose du même chiffre — « ×8 » d'un côté et
 * « +713 % » de l'autre, ce serait deux vérités pour une seule.
 *
 * DEUX RÈGLES REPRISES DE L'APPLICATION (voir `src/components/shared/StatBar.tsx`).
 *
 * SANS BASE DE COMPARAISON, AUCUN POURCENTAGE. Une période précédente vide
 * donnerait « +∞ % » ou « −100 % » : une fausse alerte à chaque premier du
 * mois, et on cesse vite de regarder l'indicateur. On dit alors ce qui est
 * vrai — « nouveau » — ou rien du tout.
 *
 * AU-DELÀ DU DOUBLE, ON COMPTE EN FOIS. « +713 % » ne se lit pas, « ×8 » se
 * lit. En deçà de 5 %, on dit « stable » : trois pour cent d'écart sur un
 * mois de commerce, ce n'est pas une tendance, c'est du bruit.
 */

export interface TendanceData {
  /** Valeur de la période regardée. */
  valeur: number;
  /** Valeur de la période à laquelle on compare. */
  reference: number;
}

/** De quel côté se trouve la bonne nouvelle. `neutre` : ni l'un ni l'autre. */
export type Sens = "hausse" | "baisse" | "neutre";

export type FormeTendance =
  | { genre: "aucune" }
  | { genre: "nouveau" }
  | { genre: "stable" }
  | { genre: "fois"; facteur: number; hausse: boolean }
  | { genre: "pourcent"; valeur: number; hausse: boolean };

export function analyserTendance({ valeur, reference }: TendanceData): FormeTendance {
  if (reference === 0) {
    return valeur === 0 ? { genre: "aucune" } : { genre: "nouveau" };
  }
  const rapport = valeur / reference;
  const pct = Math.round((rapport - 1) * 100);
  if (Math.abs(pct) < 5) return { genre: "stable" };
  if (rapport >= 2) return { genre: "fois", facteur: Math.round(rapport), hausse: true };
  return { genre: "pourcent", valeur: pct, hausse: pct > 0 };
}
