import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Table,
} from "lucide-react";
import type { StoreSettings } from "../../types";
import { Modal } from "../shared/Modal";
import { telechargerCsv, telechargerTableur } from "../../lib/exportTableur";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import {
  appliquerLesQuantites,
  cellulesDeLigne,
  COLONNES_BON_DE_COMMANDE,
  decouperLeBon,
  lignesDuBonDeCommande,
  totalDuBon,
  type DecoupageDuBon,
  type LigneBonDeCommande,
  type ProduitARecommander,
  type QuantitesChoisies,
} from "../../lib/bonDeCommande";
import type { ReglagesAlertesStock } from "../../lib/prealerteStock";
import { usePersonnalisation } from "../../lib/personnalisation";
import { lireReglagesDocuments } from "../../features/documents/lib/reglages";
import { documentDAchat } from "../../features/documents/lib/buildDocument";
import { DocumentPreview } from "../../features/documents/DocumentPreview";
import { ModifierMiseEnPage } from "../settings/ModifierMiseEnPage";
import { dispositionDuType } from "../../features/documents/lib/disposition";
import { resoudreType } from "../../features/documents/lib/resolveur";
import { dateDuJour } from "../../lib/dates";
import { nomDeFichier } from "../../lib/documentExport";

/**
 * LE BON DE COMMANDE FOURNISSEUR.
 *
 * Ce qu'on envoie au fournisseur pour réapprovisionner. Il était le
 * dernier document resté sur l'implémentation d'origine : il se
 * dessinait ici, à la main, hors du moteur commun.
 *
 * ── CE QUE LE PASSAGE AU MOTEUR COMMUN LUI APPORTE ─────────────────
 *
 * **Il tient sur un téléphone.** Il se mettait en page à la largeur de
 * l'écran : à trois cent vingt pixels, le tableau s'écrasait jusqu'à
 * écrire les en-têtes en vertical — « Q / T / É », « PRIX / UNITA /
 * IRE » — et le PDF, qui est une photographie de ce qu'on voit,
 * partait ainsi chez le fournisseur. La feuille fait désormais 210 mm
 * quelle que soit la fenêtre, et c'est une mise à l'échelle qui
 * l'adapte à l'écran.
 *
 * **Il se pagine.** Cinquante produits à racheter tenaient sur une
 * feuille unique, débitée ensuite en tranches de la hauteur d'une
 * page : la coupure tombait au milieu d'un montant. Le découpage
 * réserve maintenant sa place au total et répète l'en-tête du tableau.
 *
 * **Il suit les réglages de la boutique** — titre, préfixe, modèle,
 * couleur, mise en page — comme les huit autres types.
 *
 * ── CE QU'IL GARDE ─────────────────────────────────────────────────
 *
 * Le CSV et le tableur, que lui seul propose : celui-là, on le
 * retravaille avant de l'envoyer, et ces deux fichiers portent le
 * stock et le seuil que le papier tait.
 *
 * ── CE QUE LA BOUTIQUE DÉCIDE ─────────────────────────────────────
 *
 * La quantité de chaque produit part de la suggestion et se change
 * librement ; zéro retire le produit. La boutique choisit aussi d'en
 * faire un seul bon ou un bon par produit. Dans ce second cas, l'aperçu
 * montre un bon à la fois, et l'impression comme les fichiers portent
 * le bon affiché.
 */

interface BonDeCommandeProps {
  ouvert: boolean;
  onFermer: () => void;
  /** Le catalogue entier : le tri se fait ici, pas chez l'appelant. */
  produits: ProduitARecommander[];
  reglages: ReglagesAlertesStock;
  settings?: StoreSettings;
}

export const BonDeCommande: React.FC<BonDeCommandeProps> = ({
  ouvert,
  onFermer,
  produits,
  reglages,
  settings,
}) => {
  const personnalisation = usePersonnalisation();
  const [edition, setEdition] = useState(false);
  const reglagesDocuments = useMemo(
    () => lireReglagesDocuments(personnalisation.documents),
    [personnalisation.documents],
  );

  const [exportEnCours, setExportEnCours] = useState<null | "csv" | "tableur">(null);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  const lignesSuggerees = useMemo(
    () => lignesDuBonDeCommande(produits, reglages),
    [produits, reglages],
  );

  // La saisie reste du texte tant qu'on tape : un champ vidé ne doit pas
  // devenir zéro, et retirer la ligne, avant qu'on ait fini d'écrire.
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [decoupage, setDecoupage] = useState<DecoupageDuBon>("un");
  const [indexBon, setIndexBon] = useState(0);

  // Chaque ouverture repart de la suggestion : une commande d'hier ne
  // se glisse pas dans celle d'aujourd'hui.
  useEffect(() => {
    if (ouvert) {
      setSaisies({});
      setIndexBon(0);
    }
  }, [ouvert]);

  const quantites = useMemo<QuantitesChoisies>(() => {
    const q: QuantitesChoisies = {};
    for (const [id, texte] of Object.entries(saisies)) {
      if (texte.trim() !== "") q[id] = Number(texte.replace(",", "."));
    }
    return q;
  }, [saisies]);

  const lignes = useMemo(
    () => appliquerLesQuantites(lignesSuggerees, quantites),
    [lignesSuggerees, quantites],
  );
  const bons = useMemo(() => decouperLeBon(lignes, decoupage), [lignes, decoupage]);
  const indexAffiche = Math.min(indexBon, Math.max(0, bons.length - 1));
  const bonAffiche = useMemo<LigneBonDeCommande[]>(
    () => bons[indexAffiche] ?? [],
    [bons, indexAffiche],
  );
  const total = useMemo(() => totalDuBon(bonAffiche), [bonAffiche]);

  /**
   * LE DESTINATAIRE, QUAND IL N'Y EN A QU'UN.
   *
   * Un bon de commande s'adresse à quelqu'un. Quand toutes les lignes
   * viennent du même fournisseur, son nom monte en tête du document —
   * c'est ainsi qu'on écrit une commande — et cesse de se répéter sous
   * chaque désignation.
   *
   * Il faut que TOUTES les lignes le portent : une seule fiche sans
   * fournisseur, et l'en-tête affirmerait quelque chose de faux sur
   * elle. Dans ce cas, le nom redescend ligne par ligne.
   */
  const fournisseurUnique = useMemo(() => {
    const noms = new Set(bonAffiche.map((l) => l.fournisseur));
    const [seul] = [...noms];
    return noms.size === 1 && seul ? seul : null;
  }, [bonAffiche]);

  const aujourdhui = dateDuJour();

  const document = useMemo(
    () =>
      documentDAchat({
        lignes: bonAffiche.map((l) => ({
          id: l.id,
          designation: l.produit,
          reference: l.reference,
          quantite: l.quantiteCommandee,
          unite: l.unite,
          prixUnitaire: l.prixAchat,
          total: l.totalEstime,
          fournisseur: l.fournisseur,
        })),
        total: total.montant,
        lignesSansPrix: total.lignesSansPrix,
        fournisseur: fournisseurUnique,
        date: aujourdhui,
        boutique: settings,
        reglages: reglagesDocuments,
      }),
    [bonAffiche, total, fournisseurUnique, aujourdhui, settings, reglagesDocuments],
  );

  const parProduit = decoupage === "parProduit" && bons.length > 0;
  const nom = nomDeFichier(
    parProduit ? `Bon_de_commande_${bonAffiche[0]?.produit ?? ""}` : "Bon_de_commande",
    settings?.storeName ?? "boutique",
    aujourdhui,
  );

  const exporter = async (type: "csv" | "tableur") => {
    if (exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      const cellules = bonAffiche.map(cellulesDeLigne);
      if (type === "csv") telechargerCsv(nom, COLONNES_BON_DE_COMMANDE, cellules);
      else await telechargerTableur(nom, "À commander", COLONNES_BON_DE_COMMANDE, cellules);
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même.
      if (reprendreApresDeploiement(err)) return;
      setExportErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  const vide = lignesSuggerees.length === 0;
  const toutRetire = !vide && lignes.length === 0;
  const modifie = Object.keys(quantites).length > 0;

  const changerQuantite = (id: string, texte: string) =>
    setSaisies((avant) => ({ ...avant, [id]: texte }));

  return (
    <Modal
      open={ouvert}
      onClose={onFermer}
      dismissible={!edition}
      size="3xl"
      icon={<FileText className="h-4 w-4" />}
      title="Bon de commande"
      description={
        vide
          ? "Rien à réapprovisionner pour le moment"
          : parProduit
            ? `${pluriel(lignes.length, "produit")} · ${pluriel(bons.length, "bon")}`
            : pluriel(lignes.length, "produit")
      }
      footer={
        !vide &&
        !toutRetire && (
          <>
            {/* Imprimer, PDF et image sont rendus par l'aperçu lui-même.
                Ne restent ici que les deux sorties propres à ce
                document : elles portent le stock et le seuil, que le
                papier tait. */}
            <button
              onClick={() => void exporter("csv")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
            >
              <Table className="h-4 w-4" />
              {exportEnCours === "csv" ? "…" : "CSV"}
            </button>
            <button
              onClick={() => void exporter("tableur")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportEnCours === "tableur" ? "…" : "Excel"}
            </button>
          </>
        )
      }
    >
      {exportErreur && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
        >
          {exportErreur}
        </p>
      )}

      {vide ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Tous vos produits sont au-dessus de leur seuil. Il n&apos;y a rien à commander.
        </p>
      ) : (
        <>
          <PreparationDuBon
            lignes={lignesSuggerees}
            saisies={saisies}
            onQuantite={changerQuantite}
            onRetablir={modifie ? () => setSaisies({}) : undefined}
            decoupage={decoupage}
            onDecoupage={(d) => {
              setDecoupage(d);
              setIndexBon(0);
            }}
          />

          {toutRetire ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Toutes les quantités sont à zéro. Indiquez au moins une quantité pour préparer le bon.
            </p>
          ) : (
            /* Pas de choix de format : un bon de commande s'envoie ou
               s'imprime sur une feuille, il ne sort pas d'une imprimante
               de comptoir. C'est déjà le cas du devis. */
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {parProduit ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIndexBon(Math.max(0, indexAffiche - 1))}
                      disabled={indexAffiche === 0}
                      className="app-btn-icon h-8 w-8"
                      aria-label="Bon précédent"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-muted-foreground" aria-live="polite">
                      Bon {indexAffiche + 1} sur {bons.length} ·{" "}
                      <span className="font-medium text-foreground">{bonAffiche[0]?.produit}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIndexBon(Math.min(bons.length - 1, indexAffiche + 1))}
                      disabled={indexAffiche >= bons.length - 1}
                      className="app-btn-icon h-8 w-8"
                      aria-label="Bon suivant"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <ModifierMiseEnPage
                  document={document}
                  format="a4"
                  dispositionId={
                    dispositionDuType(reglagesDocuments.libre, document.type)?.id ?? null
                  }
                  modele={resoudreType(reglagesDocuments, document.type).modele}
                  onOuverture={setEdition}
                />
              </div>
              <DocumentPreview document={document} reglages={reglagesDocuments} format="a4" />
            </>
          )}
        </>
      )}
    </Modal>
  );
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * LA PRÉPARATION : COMBIEN, ET EN COMBIEN DE BONS.
 *
 * Au-dessus de l'aperçu, et non dans un écran à part : on voit le bon
 * changer à mesure qu'on corrige une quantité.
 */
const PreparationDuBon: React.FC<{
  lignes: LigneBonDeCommande[];
  saisies: Record<string, string>;
  onQuantite: (id: string, texte: string) => void;
  onRetablir?: () => void;
  decoupage: DecoupageDuBon;
  onDecoupage: (d: DecoupageDuBon) => void;
}> = ({ lignes, saisies, onQuantite, onRetablir, decoupage, onDecoupage }) => (
  <section aria-label="Préparer la commande" className="app-card mb-4 space-y-3 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Nombre de bons" className="flex flex-wrap gap-2">
        {(
          [
            ["un", "Un seul bon"],
            ["parProduit", "Un bon par produit"],
          ] as const
        ).map(([valeur, libelle]) => (
          <button
            key={valeur}
            type="button"
            onClick={() => onDecoupage(valeur)}
            aria-pressed={decoupage === valeur}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              decoupage === valeur
                ? "border-success-border bg-success-soft t-success"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>
      {onRetablir && (
        <button type="button" onClick={onRetablir} className="app-btn-secondary text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          Quantités conseillées
        </button>
      )}
    </div>

    <ul className="app-list">
      {lignes.map((l) => {
        const saisie = saisies[l.id];
        const valeur = saisie ?? String(l.quantiteSuggeree);
        // Même règle que `appliquerLesQuantites` : un champ vide garde la
        // suggestion, et une suggestion à zéro laisse aussi la ligne hors du bon.
        const effective =
          saisie === undefined || saisie.trim() === ""
            ? l.quantiteSuggeree
            : Number(saisie.replace(",", "."));
        const retire = !(Math.round(effective) > 0);
        return (
          <li
            key={l.id}
            className={`flex items-center justify-between gap-3 py-2 ${retire ? "opacity-60" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span className="app-list-primary block truncate">{l.produit}</span>
              <span className="app-list-secondary block">
                {retire
                  ? "Retiré du bon"
                  : `Conseillé : ${l.quantiteSuggeree} · en stock : ${l.stock}`}
              </span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={valeur}
              onChange={(e) => onQuantite(l.id, e.target.value)}
              aria-label={`Quantité à commander : ${l.produit}`}
              className="app-field w-24 shrink-0 text-right font-mono"
            />
          </li>
        );
      })}
    </ul>
  </section>
);
