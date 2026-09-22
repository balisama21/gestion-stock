import type { DocumentCommercial } from "./documents";
import { joursDeRetard } from "./statuts";

/**
 * LES MESSAGES QUI PARTENT CHEZ LE CLIENT.
 *
 * Pré-remplis et MODIFIABLES : le commerçant connaît son client mieux
 * que le logiciel, et un message qu'on ne peut pas retoucher finit
 * recopié à la main dans l'autre application.
 *
 * ── CE MODULE N'ENVOIE RIEN ────────────────────────────────────────
 *
 * Il compose un texte et une adresse. C'est le navigateur qui ouvre
 * WhatsApp ou le logiciel de courrier, et c'est la personne qui appuie
 * sur « Envoyer » là-bas. Le logiciel n'expédie jamais un message au
 * nom de quelqu'un sans qu'il l'ait vu.
 */

/** Un numéro réduit à ses chiffres. */
const chiffresDe = (tel: string | null | undefined): string =>
  (tel ?? "").replace(/[^0-9+]/g, "");

const INDICATIF_MADAGASCAR = "261";

/**
 * Le numéro sous la forme internationale que `wa.me` exige.
 *
 * Un numéro local n'ouvre rien : « 034 00 000 01 » ne mène nulle part.
 * On suppose Madagascar pour un numéro qui commence par zéro — même
 * hypothèse assumée que dans le tableau de bord, l'application écrivant
 * déjà l'ariary en dur pour tout le monde. Un numéro qu'on ne sait pas
 * interpréter ne reçoit pas de lien du tout : mieux vaut un canal de
 * moins qu'un lien qui ouvre une page d'erreur.
 */
export function numeroWhatsApp(tel: string | null | undefined): string | null {
  const propre = chiffresDe(tel);
  if (propre.replace(/\D/g, "").length < 6) return null;
  const chiffres = propre.replace(/\D/g, "");
  if (propre.startsWith("+")) return chiffres;
  if (chiffres.startsWith(INDICATIF_MADAGASCAR)) return chiffres;
  if (chiffres.startsWith("0")) return INDICATIF_MADAGASCAR + chiffres.slice(1);
  return null;
}

export interface ContexteEnvoi {
  document: DocumentCommercial;
  nomBoutique: string;
  /** Les montants déjà mis en forme par l'écran, devise comprise. */
  montant: string;
  reste: string;
  echeance: string | null;
  aujourdhui: string;
}

/** Le message d'un premier envoi. */
export function messageDEnvoi(c: ContexteEnvoi): string {
  const { document: d, nomBoutique } = c;
  const piece = NOM_PIECE[d.type];
  const lignes = [
    `Bonjour${d.tiers && d.tiers !== "Client comptoir" ? ` ${d.tiers}` : ""},`,
    "",
    `Voici votre ${piece}${d.numero ? ` ${d.numero}` : ""} d'un montant de ${c.montant}.`,
  ];

  if (d.reste > 0 && c.echeance) {
    lignes.push(`Reste à régler : ${c.reste}, au plus tard le ${c.echeance}.`);
  } else if (d.reste > 0) {
    lignes.push(`Reste à régler : ${c.reste}.`);
  }

  if (d.entite === "devis") {
    lignes.push("Merci de nous dire si cette offre vous convient.");
  }

  lignes.push("", `Merci de votre confiance.`, nomBoutique);
  return lignes.join("\n");
}

/**
 * Le message d'une relance.
 *
 * Il dit le numéro, le montant et le nombre de jours de retard, comme
 * le cahier le demande — et rien de plus. Un rappel de paiement qui
 * s'excuse ou qui menace se retouche de toute façon avant de partir ;
 * ce qu'on attend du logiciel, ce sont les trois faits exacts.
 */
export function messageDeRelance(c: ContexteEnvoi): string {
  const { document: d, nomBoutique } = c;
  const jours = d.echeance ? joursDeRetard(d.echeance, c.aujourdhui) : 0;
  const lignes = [
    `Bonjour${d.tiers && d.tiers !== "Client comptoir" ? ` ${d.tiers}` : ""},`,
    "",
    `Nous n'avons pas encore reçu le règlement de la facture ${d.numero} du ${
      c.echeance ? `échue le ${c.echeance}` : "en cours"
    }.`,
    `Montant restant dû : ${c.reste}.`,
  ];
  if (jours > 0) {
    lignes.push(`Le retard est de ${jours} jour${jours > 1 ? "s" : ""}.`);
  }
  lignes.push(
    "",
    "Merci de nous indiquer la date à laquelle vous pourrez le régler.",
    nomBoutique,
  );
  return lignes.join("\n");
}

const NOM_PIECE: Record<DocumentCommercial["type"], string> = {
  facture: "facture",
  commission: "facture",
  recu: "reçu",
  devis: "devis",
  proforma: "facture proforma",
  avoir: "avoir",
  facture_achat: "facture",
};

/** Le lien WhatsApp, ou rien quand le numéro ne se laisse pas lire. */
export function lienWhatsApp(tel: string | null | undefined, message: string): string | null {
  const numero = numeroWhatsApp(tel);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(message)}` : null;
}

/** Le lien de courrier, ou rien quand on n'a pas d'adresse. */
export function lienEmail(
  adresse: string | null | undefined,
  objet: string,
  message: string,
): string | null {
  const a = (adresse ?? "").trim();
  if (!a.includes("@")) return null;
  return `mailto:${encodeURIComponent(a)}?subject=${encodeURIComponent(
    objet,
  )}&body=${encodeURIComponent(message)}`;
}

/** L'objet du courrier : ce que le client lira dans sa boîte. */
export function objetDuCourrier(d: DocumentCommercial, nomBoutique: string, relance = false): string {
  const piece = NOM_PIECE[d.type];
  const tete = relance ? "Rappel — " : "";
  const capitale = piece.charAt(0).toUpperCase() + piece.slice(1);
  return `${tete}${capitale}${d.numero ? ` ${d.numero}` : ""}${nomBoutique ? ` — ${nomBoutique}` : ""}`;
}
