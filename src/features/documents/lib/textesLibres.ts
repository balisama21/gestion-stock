import type { Document } from "./buildDocument";
import type { Blocs, ClePosee } from "./disposition";
import type { ModeleDocument } from "./reglages";
import { introMontantEnLettres, TITRE_PAIEMENT } from "../parts/blocs";
import { cleLibelle, type ChampTiers } from "./coordonnees";

/**
 * LES MOTS QU'ON RÉÉCRIT SUR LA FEUILLE
 *
 * Titre, libellés, intitulés, mot de fin, conditions, pied : ce que le
 * document DIT. Jamais ce qu'il CHIFFRE — numéro, date, client, lignes,
 * montants et nom de la boutique restent ceux de la base.
 *
 * Rangés dans le bloc (`BlocPose.textes`), donc propres à la disposition.
 * Une clé absente garde le mot des réglages ; une chaîne vide efface.
 */

export interface TexteModifiable {
  cle: string;
  nom: string;
  /** Le mot des réglages, avant toute réécriture. */
  valeur: string;
  long?: boolean;
  /** Entrée y passe à la ligne ; ailleurs, elle valide. */
  multiligne?: boolean;
}

const LIBELLES_TOTAUX: { cle: keyof Document["totaux"]; nom: string }[] = [
  { cle: "libelleHorsTaxe", nom: "Hors taxe" },
  { cle: "libelleTva", nom: "TVA" },
  { cle: "libelleTotal", nom: "Total" },
  { cle: "libellePaye", nom: "Déjà payé" },
  { cle: "libelleReste", nom: "Reste à payer" },
];

/** Le libellé posé devant chaque coordonnée : rien, sauf « NIF/STAT » devant le numéro fiscal. */
export const libelleParDefaut = (c: ChampTiers) => (c.fiscal ? "NIF/STAT " : "");

const libellesDesChamps = (champs: ChampTiers[] | undefined): TexteModifiable[] =>
  (champs ?? []).map((c) => ({
    cle: cleLibelle(c.cle),
    nom: `Libellé « ${c.nom} »`,
    valeur: libelleParDefaut(c),
  }));

/** Ce qu'on peut réécrire dans ce bloc, pour ce document. */
export function textesDuBloc(cle: ClePosee, d: Document, base: ModeleDocument): TexteModifiable[] {
  switch (cle) {
    case "titre":
      return [{ cle: "titre", nom: "Titre", valeur: d.titre, multiligne: true }];
    case "reperes":
      return d.meta.map((m) => ({
        cle: m.libelle,
        nom: `Libellé « ${m.libelle} »`,
        valeur: m.libelle,
      }));
    case "emetteur":
      return [
        ...(base === "classique" || base === "epure"
          ? [{ cle: "titre", nom: "Intitulé", valeur: d.emetteur.titre }]
          : []),
        ...libellesDesChamps(d.emetteur.champs),
      ];
    case "destinataire":
      return [
        { cle: "titre", nom: "Intitulé", valeur: d.destinataire.titre },
        ...libellesDesChamps(d.destinataire.champs),
      ];
    case "tableau":
      return d.colonnes.map((c) => ({
        cle: c.cle,
        nom: `Colonne « ${c.libelle} »`,
        valeur: c.libelle,
      }));
    case "totaux": {
      const t = d.totaux;
      const presents: TexteModifiable[] = LIBELLES_TOTAUX.filter(
        ({ cle: k }) =>
          (k === "libelleHorsTaxe" && t.horsTaxe !== null) ||
          (k === "libelleTva" && t.tva !== null) ||
          k === "libelleTotal" ||
          (k === "libellePaye" && t.paye !== null) ||
          (k === "libelleReste" && t.reste !== null && t.reste > 0),
      ).map(({ cle: k, nom }) => ({ cle: k, nom, valeur: String(t[k]) }));
      if (t.commission) {
        presents.push(
          {
            cle: "commission.libellePrestation",
            nom: "Prestation",
            valeur: t.commission.libellePrestation,
          },
          { cle: "commission.libelle", nom: "Commission", valeur: t.commission.libelle },
        );
      }
      return presents;
    }
    case "lettres":
      return d.montantEnLettres
        ? [{ cle: "intro", nom: "Phrase", valeur: introMontantEnLettres(d.type) }]
        : [];
    case "mentions":
      return [{ cle: "texte", nom: "Conditions", valeur: d.mentions ?? "", long: true }];
    case "paiement":
      return d.coordonneesPaiement?.length
        ? [{ cle: "titre", nom: "Intitulé", valeur: TITRE_PAIEMENT }]
        : [];
    case "signatures":
      return d.signatures
        ? [
            { cle: "gauche", nom: "À gauche", valeur: d.signatures.gauche },
            { cle: "droite", nom: "À droite", valeur: d.signatures.droite },
          ]
        : [];
    case "motDeFin":
      return [{ cle: "texte", nom: "Mot de fin", valeur: d.motDeFin ?? "", multiligne: true }];
    case "pied":
      return [{ cle: "texte", nom: "Pied de page", valeur: d.piedDePage ?? "", multiligne: true }];
    default:
      return [];
  }
}

export interface LigneSimple {
  cle: string;
  nom: string;
  /** Exigée sur la pièce : elle ne se retire pas. */
  obligatoire?: boolean;
}

/** Le numéro et la date d'une pièce ne se retirent jamais. */
const REPERES_OBLIGATOIRES = new Set(["N°", "Date"]);

/** Les lignes qu'on peut retirer d'un bloc, une à une. */
export function lignesSimples(cle: ClePosee, d: Document): LigneSimple[] {
  switch (cle) {
    case "reperes":
      return d.meta.map((m) => ({
        cle: m.libelle,
        nom: m.libelle,
        obligatoire: REPERES_OBLIGATOIRES.has(m.libelle),
      }));
    case "totaux":
      return [
        ...(d.totaux.paye !== null ? [{ cle: "paye", nom: d.totaux.libellePaye }] : []),
        ...(d.totaux.reste !== null && d.totaux.reste > 0
          ? [{ cle: "reste", nom: d.totaux.libelleReste }]
          : []),
      ];
    case "paiement":
      return (d.coordonneesPaiement ?? []).map((l) => ({ cle: l, nom: l }));
    case "signatures":
      return d.signatures
        ? [
            { cle: "gauche", nom: d.signatures.gauche || "À gauche" },
            { cle: "droite", nom: d.signatures.droite || "À droite" },
          ]
        : [];
    case "nom":
      return d.emetteur.sousTitre ? [{ cle: "sousTitre", nom: "Activité" }] : [];
    default:
      return [];
  }
}

/** Le document tel que la feuille le dit, une fois les mots réécrits. Les chiffres ne bougent pas. */
export function appliquerTextes(d: Document, blocs: Blocs): Document {
  const t = (cle: ClePosee, k: string) => blocs[cle]?.textes?.[k];
  const retire = (cle: ClePosee, k: string) => blocs[cle]?.masquees?.includes(k) === true;
  const ou = (v: string | undefined, defaut: string) => (v === undefined ? defaut : v);
  const ouRien = (v: string | undefined, defaut: string | null) =>
    v === undefined ? defaut : v.trim() ? v : null;

  const totaux = { ...d.totaux };
  if (retire("totaux", "paye")) totaux.paye = null;
  if (retire("totaux", "reste")) totaux.reste = null;
  for (const { cle } of LIBELLES_TOTAUX) {
    const v = t("totaux", cle);
    if (v !== undefined) (totaux as Record<string, unknown>)[cle] = v;
  }
  if (d.totaux.commission) {
    totaux.commission = {
      ...d.totaux.commission,
      libellePrestation: ou(
        t("totaux", "commission.libellePrestation"),
        d.totaux.commission.libellePrestation,
      ),
      libelle: ou(t("totaux", "commission.libelle"), d.totaux.commission.libelle),
    };
  }

  return {
    ...d,
    titre: ou(t("titre", "titre"), d.titre),
    meta: d.meta
      .filter((m) => REPERES_OBLIGATOIRES.has(m.libelle) || !retire("reperes", m.libelle))
      .map((m) => ({ ...m, libelle: ou(t("reperes", m.libelle), m.libelle) })),
    emetteur: {
      ...d.emetteur,
      titre: ou(t("emetteur", "titre"), d.emetteur.titre),
      sousTitre: retire("nom", "sousTitre") ? null : d.emetteur.sousTitre,
    },
    coordonneesPaiement: d.coordonneesPaiement
      ? d.coordonneesPaiement.filter((l) => !retire("paiement", l))
      : d.coordonneesPaiement,
    destinataire: {
      ...d.destinataire,
      titre: ou(t("destinataire", "titre"), d.destinataire.titre),
    },
    colonnes: d.colonnes.map((c) => {
      const v = t("tableau", c.cle);
      return v === undefined ? c : { ...c, libelle: v, personnalise: true };
    }),
    totaux,
    mentions: ouRien(t("mentions", "texte"), d.mentions),
    signatures: d.signatures
      ? {
          gauche: retire("signatures", "gauche")
            ? ""
            : ou(t("signatures", "gauche"), d.signatures.gauche),
          droite: retire("signatures", "droite")
            ? ""
            : ou(t("signatures", "droite"), d.signatures.droite),
        }
      : null,
    motDeFin: ouRien(t("motDeFin", "texte"), d.motDeFin),
    piedDePage: ouRien(t("pied", "texte"), d.piedDePage),
  };
}
