import { createContext, useContext } from "react";

/**
 * Le vocabulaire et les modules, réglés par chaque entreprise.
 *
 * Une pharmacie dit « patients », une école dit « élèves », un atelier
 * dit « articles ». Et toutes n'ont pas les mêmes modules : une
 * entreprise de service n'a que faire d'un écran d'achats de
 * marchandise.
 *
 * Une clé absente veut dire « comme prévu par le logiciel ». C'est ce
 * qui permet d'ajouter un module plus tard sans toucher aux boutiques
 * déjà configurées : elles héritent du réglage par défaut sans qu'on
 * ait à écrire quoi que ce soit dans leur ligne.
 */

export interface ReglageModule {
  /** Le nom que l'entreprise donne à ce module. Vide = celui du logiciel. */
  libelle?: string;
  /** Retiré de la navigation. Les données restent, seul l'écran disparaît. */
  masque?: boolean;
}

export interface Personnalisation {
  modules?: Record<string, ReglageModule>;
}

/**
 * Les modules qu'une entreprise peut renommer ou masquer.
 *
 * Le tableau de bord et les paramètres n'y sont pas : on ne masque pas
 * la porte d'entrée d'une application, ni le moyen de revenir en
 * arrière si l'on a tout masqué par erreur.
 */
export const MODULES_PERSONNALISABLES: { cle: string; libelleParDefaut: string }[] = [
  { cle: "agenda", libelleParDefaut: "Agenda" },
  { cle: "vue_equipe", libelleParDefaut: "Vue d'ensemble" },
  { cle: "taches", libelleParDefaut: "Tâches" },
  { cle: "rappels", libelleParDefaut: "Rappels" },
  { cle: "rapports", libelleParDefaut: "Bilan" },
  { cle: "historique", libelleParDefaut: "Historique" },
  { cle: "commandes", libelleParDefaut: "Commandes" },
  { cle: "devis", libelleParDefaut: "Devis" },
  { cle: "livraisons", libelleParDefaut: "Livraisons" },
  { cle: "ventes", libelleParDefaut: "Ventes" },
  { cle: "clients", libelleParDefaut: "Clients" },
  { cle: "paiements", libelleParDefaut: "Paiements à recevoir" },
  { cle: "produits", libelleParDefaut: "Produits" },
  { cle: "achats", libelleParDefaut: "Achats" },
  { cle: "fournisseurs", libelleParDefaut: "Fournisseurs" },
  { cle: "prestataires", libelleParDefaut: "Prestataires" },
  { cle: "capital", libelleParDefaut: "Capital" },
  { cle: "depenses", libelleParDefaut: "Dépenses" },
  { cle: "vendeurs", libelleParDefaut: "Vendeurs" },
];

const PAR_DEFAUT = new Map(MODULES_PERSONNALISABLES.map((m) => [m.cle, m.libelleParDefaut]));

/** Ce que la colonne JSON contient, ramené à une forme sûre. */
export const lirePersonnalisation = (brut: unknown): Personnalisation => {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const p = brut as Personnalisation;
  return { modules: p.modules && typeof p.modules === "object" ? p.modules : {} };
};

/** Le nom donné à un module, ou celui du logiciel si rien n'est réglé. */
export const libelleModule = (p: Personnalisation, cle: string, defaut?: string): string => {
  const perso = p.modules?.[cle]?.libelle?.trim();
  return perso || defaut || PAR_DEFAUT.get(cle) || cle;
};

/** Vrai si l'entreprise a retiré ce module de sa navigation. */
export const moduleMasque = (p: Personnalisation, cle: string): boolean =>
  Boolean(p.modules?.[cle]?.masque);

/**
 * Applique le nom choisi à un titre déjà composé.
 *
 * Les titres de page valent « Clients (3) » ou « Commandes (12) » : le
 * nombre est calculé par l'écran, le mot vient d'ici. Plutôt que de
 * recomposer chaque titre, on substitue la première occurrence du nom
 * par défaut — ce qui laisse le reste du titre intact.
 */
export const titreAvecLibelle = (p: Personnalisation, cle: string, titre: string): string => {
  const defaut = PAR_DEFAUT.get(cle);
  const choisi = p.modules?.[cle]?.libelle?.trim();
  if (!defaut || !choisi || choisi === defaut) return titre;
  return titre.replace(defaut, choisi);
};

/* ─────────────────────────────────────────────────────────────
 * Diffusion dans l'arbre
 * ───────────────────────────────────────────────────────────── */

export const contextePersonnalisation = createContext<Personnalisation>({});

/**
 * Le réglage de la boutique active.
 *
 * Passe par un contexte plutôt que par des propriétés : l'en-tête de
 * page est à six niveaux de profondeur de l'application, et le faire
 * descendre à la main aurait obligé chaque composant intermédiaire à
 * transporter une donnée qui ne le concerne pas.
 */
export const usePersonnalisation = (): Personnalisation => useContext(contextePersonnalisation);
