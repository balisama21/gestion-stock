import type { CapitalSummary } from "../types";

/**
 * LA TRÉSORERIE, CALCULÉE À UN SEUL ENDROIT.
 *
 * L'argent en caisse : ce qui est entré moins ce qui est sorti, sur la
 * base des MOUVEMENTS D'ARGENT réels, jamais des montants facturés.
 *
 *   + capital de départ et apports
 *   + ce que les clients ont versé (ventes et commandes, `montant_paye`)
 *   − ce qui a été versé aux fournisseurs (`montant_paye` des achats)
 *   − les dépenses
 *   − les remboursements rendus aux clients
 *   − les salaires et avances versés (`paiements_salaire` au statut `versee`)
 *
 * Les ventes à crédit n'entrent qu'au paiement ; les achats à crédit ne
 * sortent qu'au règlement. Les cinq postes rendus retombent exactement sur
 * le total, ce que l'écran Capital et la carte Trésorerie affichent.
 */
export interface SourcesTresorerie {
  capitalInitial: number;
  seuilAlerte: number;
  apports: { montant: number }[];
  ventes: { montantPaye: number; montantRembourse?: number | null }[];
  commandes: { montant_paye: number | null; montant_rembourse?: number | null }[];
  achats: { montantPaye: number }[];
  depenses: { montant: number }[];
  /**
   * Les avances et soldes de salaire. Seuls ceux au statut `versee`
   * sortent de la caisse : une demande, une approbation ou un refus
   * n'ont rien déplacé. Ils ne sortaient de NULLE PART jusqu'ici — le
   * module Salaires l'annonçait, la trésorerie ne les retirait pas.
   */
  salaires?: { montant: number | string; statut: string }[];
}

const somme = <T>(l: T[], f: (x: T) => number): number => l.reduce((a, x) => a + (f(x) || 0), 0);

export function calculerTresorerie(s: SourcesTresorerie): CapitalSummary {
  const apportsTotal = somme(s.apports, (a) => a.montant);
  const ventesTotalEncaisse =
    somme(s.ventes, (v) => v.montantPaye) + somme(s.commandes, (o) => o.montant_paye ?? 0);
  const achatsTotal = somme(s.achats, (a) => a.montantPaye);
  const depensesVendeursTotal = somme(s.depenses, (d) => d.montant);
  // Les remboursements ne touchent jamais `montant_paye` (le paiement
  // d'origine est conservé) : ils se soustraient à part.
  const remboursementsTotal =
    somme(s.ventes, (v) => v.montantRembourse ?? 0) +
    somme(s.commandes, (o) => o.montant_rembourse ?? 0);
  const salairesTotal = somme(
    (s.salaires ?? []).filter((p) => p.statut === "versee"),
    (p) => Number(p.montant),
  );

  return {
    capitalInitial: s.capitalInitial,
    apportsTotal,
    ventesTotalEncaisse,
    achatsTotal,
    depensesVendeursTotal,
    remboursementsTotal,
    salairesTotal,
    tresorerieGlobaleActuelle:
      s.capitalInitial +
      apportsTotal +
      ventesTotalEncaisse -
      achatsTotal -
      depensesVendeursTotal -
      remboursementsTotal -
      salairesTotal,
    seuilAlerteTresorerie: s.seuilAlerte,
  };
}
