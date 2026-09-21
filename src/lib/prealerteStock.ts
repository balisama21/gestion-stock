import type { Database } from "./database.types";

/**
 * LA PRÉALERTE DE STOCK — LE CALCUL, ET RIEN D'AUTRE
 *
 * Un commerçant a dix unités d'un produit et un seuil d'alerte à trois.
 * L'alerte existante le prévient à trois, c'est-à-dire trop tard : le
 * temps de joindre son fournisseur et d'être livré, il aura vendu ce qui
 * restait. La préalerte ajoute un niveau AU-DESSUS de ce seuil — à cinq,
 * par exemple — pour lui laisser le temps de commander.
 *
 * Le seuil lui-même ne bouge pas : il reste saisi produit par produit, et
 * la règle « sous le seuil » que connaissent déjà le tableau de bord, la
 * page Produits et la cloche reste exactement ce qu'elle était.
 *
 * ── POURQUOI CE FICHIER EXISTE ──
 *
 * La règle du seuil est aujourd'hui écrite trois fois dans le code, à
 * trois endroits qui doivent rester d'accord. On ne recommence pas : tout
 * ce qui concerne la préalerte — notification, tableau de bord, export —
 * appelle les fonctions d'ici, et elles seules.
 *
 * ── POURQUOI ELLE EXISTE AUSSI EN SQL ──
 *
 * Le calcul tourne dans deux mondes. Postgres, parce que les
 * notifications doivent partir même quand personne n'a l'application
 * ouverte ; le navigateur, pour l'affichage et l'export. Une seule
 * fonction littérale est donc impossible — le précédent exact dans ce
 * dépôt est `store_is_locked()`, recopiée en `boutiqueEstVerrouillee()`.
 *
 * Ce qui tient lieu de garantie : UNE implémentation par monde, et une
 * liste de cas écrite une seule fois, dans
 * `docs/prealerte/cas-de-calcul.json`, que les deux rejouent. Le test
 * vérifie les deux côtés ; deux implémentations qui divergeraient font un
 * test rouge, pas un client surpris.
 *
 * Ce fichier ne parle à personne : ni Supabase, ni React. C'est ce qui
 * permet de le tester sans monter quoi que ce soit.
 */

type LigneReglages = Database["public"]["Tables"]["reglages_alertes_stock"]["Row"];

/** Écart fixe en unités, ou pourcentage au-dessus du seuil. */
export type ModePrealerte = "ecart" | "pourcentage";

/** Prévenir dès que le stock bouge, ou une fois par jour. */
export type FrequencePrealerte = "mouvement" | "quotidien";

/**
 * Par où la préalerte atteint quelqu'un, EN PLUS de la notification
 * dans l'application — qui est toujours active et n'est donc pas un
 * réglage.
 *
 * Le canal appartient à la PERSONNE et non à la boutique : recevoir un
 * message dans sa boîte est une décision de celui qui le reçoit. Voir
 * `abonnements_alertes_stock` et `useAbonnementAlertesStock`.
 *
 * « whatsapp » est déjà accepté par la base et par ce type : le jour où
 * on l'enverra, il n'y aura ni migration ni changement de forme, juste
 * un envoyeur à écrire.
 */
export type CanalPrealerte = "email" | "whatsapp";

export interface ReglagesAlertesStock {
  prealerteActive: boolean;
  mode: ModePrealerte;
  ecart: number;
  pourcentage: number;
  frequence: FrequencePrealerte;
  /** Heure du résumé quotidien, en heure de Madagascar. */
  heureResume: number;
}

/**
 * Les valeurs par défaut, qui sont aussi celles de la base.
 *
 * Elles ne servent que tant qu'aucune ligne n'a été enregistrée : une
 * boutique qui n'a jamais ouvert cet écran n'a pas de ligne du tout, et
 * c'est ce qui rend « désactivé par défaut » gratuit.
 */
export const REGLAGES_PAR_DEFAUT: ReglagesAlertesStock = {
  prealerteActive: false,
  mode: "ecart",
  ecart: 2,
  pourcentage: 50,
  frequence: "quotidien",
  heureResume: 8,
};

/**
 * Les bornes, identiques aux CHECK de la base.
 *
 * Le minimum est UN et non zéro pour l'écart comme pour le pourcentage :
 * un écart nul poserait la préalerte sur le seuil lui-même, c'est-à-dire
 * un réglage qui a l'air actif et ne fait rien.
 */
export const BORNES = {
  ecart: { min: 1, max: 9999 },
  pourcentage: { min: 1, max: 1000 },
  heureResume: { min: 0, max: 23 },
} as const;

const borner = (valeur: number, { min, max }: { min: number; max: number }) =>
  Number.isFinite(valeur) ? Math.min(max, Math.max(min, Math.round(valeur))) : min;

/**
 * Ramène les trois nombres dans les bornes que la base acceptera.
 *
 * Employée à la saisie comme à l'enregistrement : ce que l'écran montre
 * dans sa phrase d'exemple est exactement ce qui partira, y compris
 * quand le champ est vide ou qu'on y a tapé n'importe quoi. Sans cela,
 * l'exemple décrirait un réglage que la base refuserait.
 */
export function bornerReglages(r: ReglagesAlertesStock): ReglagesAlertesStock {
  return {
    ...r,
    ecart: borner(r.ecart, BORNES.ecart),
    pourcentage: borner(r.pourcentage, BORNES.pourcentage),
    heureResume: borner(r.heureResume, BORNES.heureResume),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Le calcul
   ═══════════════════════════════════════════════════════════════════ */

/**
 * LE MIROIR EXACT de `public.niveau_de_prealerte()`.
 *
 * Prend les mêmes quatre nombres que la fonction SQL, dans le même ordre,
 * et doit rendre le même résultat sur tous les cas de
 * `docs/prealerte/cas-de-calcul.json`. Exportée pour que le test puisse
 * l'exercer directement, sans l'interrupteur qui la précède.
 *
 * L'ARRONDI EST AU SUPÉRIEUR. Avec un seuil de trois et cinquante pour
 * cent, descendre 4,5 à 4 ne laisserait qu'une unité d'avance — soit
 * exactement le problème qu'on essaie de résoudre.
 */
export function calculerNiveauDePrealerte(
  seuil: number,
  mode: ModePrealerte,
  ecart: number,
  pourcentage: number,
): number {
  if (!Number.isFinite(seuil) || seuil <= 0) return 0;
  return mode === "pourcentage"
    ? Math.ceil(seuil * (1 + pourcentage / 100))
    : seuil + Math.round(ecart);
}

/**
 * Le stock à partir duquel on prévient, pour un produit donné.
 *
 * C'est ce que le reste de l'application appelle : le même calcul, plus
 * l'interrupteur. Préalerte désactivée, la fonction rend zéro — et comme
 * aucun stock n'est inférieur ou égal à zéro sans être déjà en rupture,
 * rien ne peut se retrouver « en préalerte » par accident.
 */
export function niveauDePrealerte(seuil: number, r: ReglagesAlertesStock): number {
  if (!r.prealerteActive) return 0;
  return calculerNiveauDePrealerte(seuil, r.mode, r.ecart, r.pourcentage);
}

/**
 * Où en est un produit : au-dessus de tout, dans la bande de préalerte,
 * ou déjà sous son seuil.
 *
 * ON COMPARE `stockActuel`, PAS `stockDisponible`. Les deux diffèrent dès
 * qu'une commande a réservé de la marchandise, et `chiffres.ts`,
 * `ProduitsView` et la cloche emploient tous `stockActuel` pour la règle
 * du seuil. Changer de colonne ici ferait diverger des écrans qui doivent
 * s'accorder — c'est la même raison qui est déjà écrite en toutes lettres
 * dans `chiffres.ts`.
 */
export type EtatDeStock = "normal" | "prealerte" | "sous_le_seuil";

export function etatDeStock(
  stockActuel: number,
  seuil: number,
  r: ReglagesAlertesStock,
): EtatDeStock {
  if (seuil > 0 && stockActuel <= seuil) return "sous_le_seuil";
  const niveau = niveauDePrealerte(seuil, r);
  return niveau > 0 && stockActuel <= niveau ? "prealerte" : "normal";
}

/**
 * Faut-il racheter ce produit ?
 *
 * LES DEUX NIVEAUX À LA FOIS. Ce qui est déjà sous le seuil et ce qui
 * s'en approche : c'est la liste qu'on envoie au fournisseur, et elle
 * ne se coupe pas en deux. Préalerte éteinte, elle se réduit d'elle-même
 * au seuil, c'est-à-dire à ce que l'application faisait déjà.
 *
 * Écrit ici et appelé partout — filtre du catalogue, bon de commande —
 * plutôt que recopié : la règle du seuil est déjà écrite à trois
 * endroits dans ce dépôt, on ne recommence pas avec celle-ci.
 */
export function estARecommander(
  stockActuel: number,
  seuil: number,
  r: ReglagesAlertesStock,
): boolean {
  return etatDeStock(stockActuel, seuil, r) !== "normal";
}

/* ═══════════════════════════════════════════════════════════════════
   Lire ce que la base rend
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Une ligne de `reglages_alertes_stock`, ramenée à une forme sûre.
 *
 * Les CHECK de la base garantissent déjà les valeurs, mais les colonnes
 * y sont typées `text` : sans ce passage, `mode` arriverait en `string`
 * et il faudrait le transtyper à chaque usage. On borne au passage, pour
 * que le jour où une borne changerait en base, l'interface ne propose
 * jamais une valeur que la base refusera.
 */
export function lireReglages(ligne: LigneReglages | null | undefined): ReglagesAlertesStock {
  if (!ligne) return REGLAGES_PAR_DEFAUT;
  return {
    prealerteActive: Boolean(ligne.prealerte_active),
    mode: ligne.mode === "pourcentage" ? "pourcentage" : "ecart",
    ecart: borner(ligne.ecart, BORNES.ecart),
    pourcentage: borner(ligne.pourcentage, BORNES.pourcentage),
    frequence: ligne.frequence === "mouvement" ? "mouvement" : "quotidien",
    heureResume: borner(ligne.heure_resume, BORNES.heureResume),
  };
}

/** La forme attendue par la base, pour l'enregistrement. */
export function ecrireReglages(
  storeId: string,
  r: ReglagesAlertesStock,
): Database["public"]["Tables"]["reglages_alertes_stock"]["Insert"] {
  const borne = bornerReglages(r);
  return {
    store_id: storeId,
    prealerte_active: borne.prealerteActive,
    mode: borne.mode,
    ecart: borne.ecart,
    pourcentage: borne.pourcentage,
    frequence: borne.frequence,
    heure_resume: borne.heureResume,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   L'exemple montré sous le champ
   ═══════════════════════════════════════════════════════════════════ */

/** Le strict nécessaire pour composer l'exemple. */
export interface ProduitPourExemple {
  nom: string;
  seuil: number;
  stock: number;
}

export interface ExemplePrealerte {
  /** Le produit choisi. Vide quand la boutique n'en a aucun à seuil. */
  produit: string | null;
  seuil: number;
  niveau: number;
}

/**
 * Le seuil employé quand la boutique n'a encore aucun produit à seuil.
 * Trois, comme dans la phrase que le client a lui-même écrite.
 */
export const SEUIL_DEXEMPLE = 3;

/**
 * « Avec un seuil de 3, vous serez prévenu à partir de 5 unités. »
 *
 * Deux nombres posés dans deux cases ne disent pas grand-chose ; la
 * phrase rejoue la règle avec les valeurs choisies, si bien qu'on voit ce
 * qu'on règle avant d'enregistrer. C'est le procédé déjà employé par
 * l'écran des rappels, qui a exactement le même problème.
 *
 * ON PREND UN VRAI PRODUIT, LE PLUS PROCHE DE SON SEUIL. Un exemple
 * inventé se lit comme une documentation ; un produit que le commerçant
 * reconnaît se lit comme son magasin. Et le plus proche de son seuil est
 * précisément celui que la préalerte concernera en premier.
 *
 * Le calcul est fait par `niveauDePrealerte`, jamais refait ici : la
 * phrase montre ce qui se passera vraiment, y compris l'arrondi.
 */
export function exempleDePrealerte(
  produits: ProduitPourExemple[],
  r: ReglagesAlertesStock,
): ExemplePrealerte {
  const candidats = produits.filter((p) => p.seuil > 0);

  // Départage par le nom : sans cela, deux produits à égale distance
  // feraient changer l'exemple d'un rendu à l'autre.
  const choisi = candidats.sort((a, b) => {
    const ecart = Math.abs(a.stock - a.seuil) - Math.abs(b.stock - b.seuil);
    return ecart !== 0 ? ecart : a.nom.localeCompare(b.nom, "fr");
  })[0];

  const seuil = choisi ? choisi.seuil : SEUIL_DEXEMPLE;

  // Le niveau se calcule sur les réglages en cours d'édition, même quand
  // la préalerte n'est pas encore enregistrée comme active : on décrit ce
  // que le réglage FERA, et non ce qu'il fait à cet instant.
  return {
    produit: choisi ? choisi.nom : null,
    seuil,
    niveau: calculerNiveauDePrealerte(seuil, r.mode, r.ecart, r.pourcentage),
  };
}
