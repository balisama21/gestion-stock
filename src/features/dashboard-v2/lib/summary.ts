import { montant as enAriary } from "./format";
import { analyserTendance } from "./tendance";
import type { Periode } from "../hooks/useDashboardPeriod";
import type { ChiffresVentes } from "./chiffres";
import type { PointsDAttention } from "./chiffres";

/**
 * LA PHRASE DE SYNTHÈSE
 *
 * Elle dit en français ce que la courbe dit en pixels : combien de
 * ventes sur la période, et comment cela se compare à l'avant. Un
 * commerçant qui ouvre son écran entre deux clients lit une phrase,
 * pas un graphique.
 *
 * ELLE RENVOIE DES MORCEAUX, PAS DU HTML. La maquette assemblait une
 * chaîne avec des `<b>` dedans et l'injectait par `innerHTML` ; ici les
 * morceaux sont typés et React les rend lui-même. Le jour où un nom de
 * client entrera dans cette phrase, il n'y aura rien à échapper.
 *
 * ELLE DIT LA MÊME CHOSE QUE LA PASTILLE D'ÉVOLUTION, parce que les
 * deux passent par `analyserTendance` : « ×8 » sur la carte et « 8 fois
 * plus » dans la phrase, jamais « ×8 » d'un côté et « +713 % » de
 * l'autre.
 */

export interface Morceau {
  texte: string;
  /** En gras : le chiffre, et lui seul. */
  fort?: boolean;
}

/** « qu'hier », « que les 7 jours précédents ». */
function que(mot: string): string {
  return /^[aeiouyhé]/i.test(mot) ? `qu'${mot}` : `que ${mot}`;
}

const MOTS = ["", "Un", "Deux", "Trois", "Quatre", "Cinq"];

const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

export function phraseDeSynthese(
  ventes: ChiffresVentes,
  p: Periode,
  attention: PointsDAttention,
): Morceau[] {
  const m: Morceau[] = [];
  const { total, totalPrecedent } = ventes;

  if (total === 0) {
    m.push({ texte: `Pas encore de vente ${p.phrase}.` });
    if (totalPrecedent > 0) {
      m.push({ texte: ` ${cap(p.libellePrecedent)} : ` });
      m.push({ texte: enAriary(totalPrecedent), fort: true });
      m.push({ texte: "." });
    }
  } else {
    const forme = analyserTendance({ valeur: total, reference: totalPrecedent });
    const chiffre = { texte: `${enAriary(total)} de ventes`, fort: true };

    if (forme.genre === "nouveau") {
      m.push(chiffre, { texte: ` ${p.phrase}, contre aucune ${p.libellePrecedent}.` });
    } else if (forme.genre === "fois") {
      m.push({ texte: "Belle dynamique : " }, chiffre, { texte: ` ${p.phrase}, soit ` });
      m.push({ texte: `${forme.facteur} fois plus`, fort: true });
      m.push({ texte: ` ${que(p.libellePrecedent)}.` });
    } else if (forme.genre === "pourcent" && forme.hausse) {
      m.push({ texte: "En progression : " }, chiffre, { texte: ` ${p.phrase}, ` });
      m.push({ texte: `${forme.valeur} % de plus`, fort: true });
      m.push({ texte: ` ${que(p.libellePrecedent)}.` });
    } else if (forme.genre === "pourcent") {
      m.push(chiffre, { texte: ` ${p.phrase}, ` });
      m.push({ texte: `${Math.abs(forme.valeur)} % de moins`, fort: true });
      m.push({ texte: ` ${que(p.libellePrecedent)}.` });
    } else {
      // « stable », et « aucune » quand les deux périodes sont vides —
      // ce dernier cas ne peut pas survenir ici, `total` est non nul.
      m.push({ texte: "Ventes stables : " }, { texte: enAriary(total), fort: true });
      m.push({ texte: ` ${p.phrase}, comme ${p.libellePrecedent}.` });
    }
  }

  const n = attention.total;
  if (n > 0) {
    const mot = MOTS[n] ?? String(n);
    m.push({ texte: ` ${mot} point${n > 1 ? "s" : ""} à regarder aujourd'hui.` });
  }

  return m;
}

export interface SyntheseCompacte {
  /** « 344 800 Ar », le chiffre seul. */
  montant: string;
  /** « ×8 », « +12 % », « stable », « nouveau » — vide s'il n'y a rien à dire. */
  comparaison: string;
  ton: "up" | "down" | "flat";
  /** « vs 1–17 août » */
  reference: string;
}

/**
 * La même chose, ramenée à un bandeau.
 *
 * Sous neuf cents pixels, la phrase prend quatre lignes pour dire ce
 * qu'un montant et une pastille disent en une. La maquette relisait sa
 * propre phrase à l'expression régulière pour en extraire les morceaux ;
 * ici les deux partent du même calcul, donc rien à relire.
 */
export function syntheseCompacte(ventes: ChiffresVentes, p: Periode): SyntheseCompacte {
  const forme = analyserTendance({ valeur: ventes.total, reference: ventes.totalPrecedent });
  const abrege = p.libellePrecedent.replace(/^du (\d+) au /, "$1–").replace(/^les /, "");

  const table: Record<typeof forme.genre, { comparaison: string; ton: "up" | "down" | "flat" }> = {
    aucune: { comparaison: "", ton: "flat" },
    nouveau: { comparaison: "nouveau", ton: "up" },
    stable: { comparaison: "stable", ton: "flat" },
    fois: {
      comparaison: forme.genre === "fois" ? `×${forme.facteur}` : "",
      ton: "up",
    },
    pourcent: {
      comparaison:
        forme.genre === "pourcent"
          ? `${forme.valeur > 0 ? "+" : "−"}${Math.abs(forme.valeur)} %`
          : "",
      ton: forme.genre === "pourcent" && forme.hausse ? "up" : "down",
    },
  };

  return {
    montant: enAriary(ventes.total),
    ...table[forme.genre],
    reference: forme.genre === "aucune" ? "" : `vs ${abrege}`,
  };
}
