import type { Intervalle } from "../../features/dashboard-v2/hooks/useDashboardPeriod";
import { dansIntervalle } from "../../features/dashboard-v2/hooks/useDashboardPeriod";
import { jourDe } from "../../features/dashboard-v2/lib/chiffres";
import type { DocumentCommercial } from "./documents";

/**
 * LES QUATRE CHIFFRES DU HAUT DE PAGE.
 *
 * « Les indicateurs du tableau de bord et ceux de la page Facturation
 * doivent donner les mêmes chiffres sur la même période. »
 *
 * La seule façon sûre de tenir cette promesse est de ne rien
 * recalculer : l'encaissé additionne `payments.montant` comme
 * `chiffresFlux`, en ramenant l'horodatage au jour local par la MÊME
 * fonction — `jourDe`, jamais `toISOString` ; le chiffre d'affaires
 * additionne `total_vente` comme `chiffresVentes` ; et le reste à
 * encaisser vient de `solde_du`, que la base entretient elle-même.
 *
 * Une seconde implémentation, même juste le jour où elle est écrite,
 * dériverait de la première au premier changement.
 */

export interface Indicateur {
  montant: number;
  nombre: number;
}

export interface IndicateursFacturation {
  /** Ce qui est facturé et pas encore rentré. */
  aEncaisser: Indicateur;
  /** La part de ce reste dont l'échéance est passée. */
  enRetard: Indicateur;
  /** Ce qui est réellement rentré en caisse sur la période. */
  encaisse: Indicateur;
  /** Devis et proformas restés sans réponse. */
  offres: Indicateur;
  /** Le chiffre d'affaires facturé, pour se comparer au tableau de bord. */
  facture: Indicateur;
}

const vide = (): Indicateur => ({ montant: 0, nombre: 0 });

const ajouter = (i: Indicateur, montant: number): Indicateur => ({
  montant: i.montant + montant,
  nombre: i.nombre + 1,
});

export interface SourcesIndicateurs {
  documents: DocumentCommercial[];
  /** Les règlements, tels que la coquille les traduit déjà. */
  payments: { montant: number; createdAt: string }[];
  intervalle: Intervalle | null;
}

/**
 * Un intervalle nul veut dire « tout l'historique ». C'est le cas du
 * choix « Tout » du sélecteur, et celui d'une boutique qui vient
 * d'ouvrir.
 */
const dedans = (jour: string, i: Intervalle | null) => (i ? dansIntervalle(jour, i) : true);

export function calculerIndicateurs(s: SourcesIndicateurs): IndicateursFacturation {
  const r: IndicateursFacturation = {
    aEncaisser: vide(),
    enRetard: vide(),
    encaisse: vide(),
    offres: vide(),
    facture: vide(),
  };

  for (const d of s.documents) {
    if (!dedans(d.date, s.intervalle)) continue;

    if (d.entite === "vente") {
      if (d.statut !== "annulee") r.facture = ajouter(r.facture, d.montant);
      if (d.reste > 0 && d.statut !== "annulee") {
        r.aEncaisser = ajouter(r.aEncaisser, d.reste);
        if (d.statut === "retard") r.enRetard = ajouter(r.enRetard, d.reste);
      }
    }

    if (d.entite === "devis" && d.statut === "attente") {
      r.offres = ajouter(r.offres, d.montant);
    }
  }

  for (const p of s.payments) {
    if (!dedans(jourDe(p.createdAt), s.intervalle)) continue;
    r.encaisse = ajouter(r.encaisse, p.montant);
  }

  return r;
}

/**
 * Le compte des factures en retard, pour le badge du menu.
 *
 * Il ne connaît pas de période : une facture en retard le reste, qu'on
 * regarde ce mois-ci ou l'an dernier. Un badge qui changerait avec le
 * sélecteur de période ne voudrait rien dire dans une barre de menu.
 */
export const compterLesRetards = (documents: DocumentCommercial[]): number =>
  documents.filter((d) => d.statut === "retard").length;
