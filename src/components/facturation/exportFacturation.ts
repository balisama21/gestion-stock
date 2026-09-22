import type { CelluleTableur } from "../../lib/exportTableur";
import { telechargerCsv, telechargerTableur } from "../../lib/exportTableur";
import type { DocumentCommercial } from "./documents";
import { LIBELLE_STATUT } from "./statuts";

/**
 * LA LISTE, POUR LE COMPTABLE.
 *
 * Ce qui part dans le fichier est ce qui est À L'ÉCRAN : la liste
 * filtrée, triée, dans son ordre. Un export qui reprendrait tout
 * l'historique ferait mentir le geste — on clique sur « Exporter »
 * après avoir filtré, pas avant.
 *
 * ── LES MONTANTS SORTENT EN NOMBRES ────────────────────────────────
 *
 * Pas « 250 000 Ar » mais 250000. Le comptable additionne une colonne ;
 * un montant mis en forme redevient du texte, et la somme rend zéro.
 * La devise est dite une fois, dans l'en-tête de la colonne.
 */

const NOM_TYPE: Record<DocumentCommercial["type"], string> = {
  facture: "Facture",
  commission: "Facture avec commission",
  recu: "Reçu",
  devis: "Devis",
  proforma: "Proforma",
  avoir: "Avoir",
  facture_achat: "Facture d'achat",
};

export function entetesFacturation(devise: string): string[] {
  return [
    "Numéro",
    "Type",
    "Client ou fournisseur",
    "Date",
    "Échéance",
    `Montant (${devise})`,
    `Payé (${devise})`,
    `Reste à payer (${devise})`,
    "Statut",
    "Vendeur",
    "Référence",
    "Annulée par",
  ];
}

export function lignesFacturation(documents: DocumentCommercial[]): CelluleTableur[][] {
  return documents.map((d) => [
    d.numero,
    NOM_TYPE[d.type],
    d.tiers,
    d.date,
    d.echeance ?? "",
    Math.round(d.montant),
    Math.round(d.paye),
    Math.round(d.reste),
    LIBELLE_STATUT[d.statut],
    d.vendeur,
    d.reference ?? "",
    d.avoirDe ?? "",
  ]);
}

/** Un nom de fichier qui dit ce qu'il contient et quand il a été tiré. */
export function nomDeLExport(periode: string, aujourdhui: string): string {
  const propre = periode
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `Facturation_${propre || "liste"}_${aujourdhui}`;
}

export function exporterCsv(
  documents: DocumentCommercial[],
  devise: string,
  nomDeFichier: string,
): void {
  telechargerCsv(nomDeFichier, entetesFacturation(devise), lignesFacturation(documents));
}

export async function exporterTableur(
  documents: DocumentCommercial[],
  devise: string,
  nomDeFichier: string,
): Promise<void> {
  await telechargerTableur(
    nomDeFichier,
    "Facturation",
    entetesFacturation(devise),
    lignesFacturation(documents),
  );
}
