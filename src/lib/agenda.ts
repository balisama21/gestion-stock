/**
 * L'agenda des échéances.
 *
 * Il n'invente rien : il relit ce que la base sait déjà dater. Trois
 * choses portent une date dans ce logiciel — un achat à crédit et son
 * échéance, un devis et sa validité, une course et son jour prévu. Ce
 * sont donc les trois seules qui peuvent être en retard, et l'agenda ne
 * parle que de celles-là.
 *
 * Ce qu'il ne montre pas, et pourquoi : les ventes à crédit. Le modèle
 * ne leur donne aucune date d'échéance — une dette client n'a pas de
 * terme enregistré. L'annoncer « en retard » demanderait d'inventer un
 * délai que personne n'a saisi. Elle reste donc au tableau de bord, dans
 * « ce qu'on vous doit », où elle est juste.
 */

export type UrgenceAgenda = "retard" | "aujourdhui" | "semaine" | "plus_tard";

export interface EcheanceAgenda {
  id: string;
  /** Ce qui arrive à échéance. */
  titre: string;
  /** De quoi il s'agit, en un mot. */
  nature: "achat" | "devis" | "livraison";
  date: string;
  montant: number | null;
  detail: string;
  urgence: UrgenceAgenda;
  /** L'écran où le régler. */
  onglet: string;
}

export const LIBELLE_NATURE: Record<EcheanceAgenda["nature"], string> = {
  achat: "Achat à régler",
  devis: "Devis à relancer",
  livraison: "Course à faire",
};

export const LIBELLE_URGENCE: Record<UrgenceAgenda, string> = {
  retard: "En retard",
  aujourdhui: "Aujourd'hui",
  semaine: "Cette semaine",
  plus_tard: "Plus tard",
};

/** La couleur ne sert qu'au retard, où elle informe vraiment. */
export const CLASSE_URGENCE: Record<UrgenceAgenda, string> = {
  retard: "app-badge-danger",
  aujourdhui: "app-badge-warning",
  semaine: "app-badge-info",
  plus_tard: "app-badge-neutral",
};

/** Le nombre de jours entiers entre aujourd'hui et une date. */
export const joursAvant = (date: string, aujourdhui = new Date()): number => {
  const cible = new Date(date + "T00:00:00");
  const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  return Math.round((cible.getTime() - debut.getTime()) / 86400000);
};

/**
 * Le degré d'urgence, déduit de la seule date.
 *
 * « Cette semaine » veut dire sept jours, pas « jusqu'à dimanche » : un
 * commerçant qui regarde son agenda le samedi n'y verrait sinon presque
 * rien, alors que sa semaine continue.
 */
export const urgenceDe = (date: string, aujourdhui = new Date()): UrgenceAgenda => {
  const jours = joursAvant(date, aujourdhui);
  if (jours < 0) return "retard";
  if (jours === 0) return "aujourdhui";
  if (jours <= 7) return "semaine";
  return "plus_tard";
};

export const ORDRE_URGENCE: UrgenceAgenda[] = ["retard", "aujourdhui", "semaine", "plus_tard"];
