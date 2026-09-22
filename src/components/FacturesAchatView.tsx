import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  FileText,
  Paperclip,
  Plus,
  Printer,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Product, StoreSettings } from "../types";
import type { Database } from "../lib/database.types";
import { formatCurrency, formatDateLocale, getProductLabel } from "../utils/formulas";
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList, type DataListItem } from "./shared/DataList";
import { Modal } from "./shared/Modal";
import { SortieDocument } from "../features/documents/SortieDocument";
import { documentDeFactureAchat } from "../features/documents/lib/buildDocument";
import type { ReglagesDocuments } from "../features/documents/lib/reglages";
import { adresseDocument, envoyerFichier, reduireImage } from "../lib/stockageFichiers";
import { dateDuJour } from "../lib/dates";
import type { SaisieFactureAchat } from "../hooks/useStoreData";
import { AideLigneLibre, LIBELLE_LIGNE_LIBRE } from "./shared/LigneLibre";

type FactureAchat = Database["public"]["Tables"]["supplier_invoices"]["Row"];
type LigneFactureAchat = Database["public"]["Tables"]["supplier_invoice_items"]["Row"];
type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];

/**
 * LES FACTURES REÇUES DES FOURNISSEURS
 *
 * ── CE N'EST PAS UN ACHAT ──────────────────────────────────────────
 *
 * Un achat est un mouvement : il entre en trésorerie, il touche le
 * stock. Une facture reçue est une PIÈCE : elle peut couvrir dix
 * achats, n'en couvrir aucun, arriver un mois plus tard. Cet écran ne
 * touche donc ni à la caisse, ni au stock, ni aux achats. C'est un
 * classeur : on y range le papier, on le retrouve, on le réimprime.
 *
 * ── LE TOTAL EST CELUI DU PAPIER ───────────────────────────────────
 *
 * Il se saisit, il ne se calcule pas. Une facture porte des frais de
 * transport, des arrondis, une remise négociée au téléphone : la
 * somme des lignes n'est pas la vérité, le papier l'est. L'écran
 * montre la somme à côté du total pour qu'un écart se voie, et laisse
 * la personne trancher.
 *
 * ── LA LISTE EST UN JOURNAL ────────────────────────────────────────
 *
 * On vient y chercher « ce qui est arrivé ce mois-ci » et « ce qui
 * reste à régler », pas un tableau à colonnes. Chaque ligne porte le
 * fournisseur, ce qu'il a facturé, et l'état du règlement.
 */

interface Props {
  factures: FactureAchat[];
  lignes: LigneFactureAchat[];
  fournisseurs: Fournisseur[];
  products: Product[];
  settings?: StoreSettings;
  reglagesDocuments: ReglagesDocuments;
  storeId: string | null;
  onAdd: (data: SaisieFactureAchat) => Promise<{ error: string | null }>;
  onUpdate: (id: string, data: SaisieFactureAchat) => Promise<{ error: string | null }>;
  onDelete?: (id: string) => Promise<{ error: string | null }>;
  /** Revenir aux achats : cet écran s'ouvre depuis eux. */
  onRetour: () => void;
  peutCreer?: boolean;
  peutModifier?: boolean;
}

interface LigneSaisie {
  productId: string;
  designation: string;
  quantite: number;
  unite: string;
  prixUnitaire: number;
}

const LIGNE_VIDE: LigneSaisie = {
  productId: "",
  designation: "",
  quantite: 1,
  unite: "",
  prixUnitaire: 0,
};

const sommeDesLignes = (lignes: LigneSaisie[]) =>
  lignes.reduce((n, l) => n + l.quantite * l.prixUnitaire, 0);

export const FacturesAchatView: React.FC<Props> = ({
  factures,
  lignes,
  fournisseurs,
  products,
  settings,
  reglagesDocuments,
  storeId,
  onAdd,
  onUpdate,
  onDelete,
  onRetour,
  peutCreer = true,
  peutModifier = true,
}) => {
  const [recherche, setRecherche] = useState("");
  const [filtreReglement, setFiltreReglement] = useState<"Tous" | "du" | "regle">("Tous");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<FactureAchat | null>(null);
  const [aImprimer, setAImprimer] = useState<FactureAchat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  /* ── Le formulaire ── */
  const [fournisseurId, setFournisseurId] = useState("");
  const [fournisseurNom, setFournisseurNom] = useState("");
  const [numeroFournisseur, setNumeroFournisseur] = useState("");
  const [date, setDate] = useState(dateDuJour);
  const [echeance, setEcheance] = useState("");
  const [total, setTotal] = useState(0);
  const [montantPaye, setMontantPaye] = useState(0);
  const [note, setNote] = useState("");
  const [pieceJointe, setPieceJointe] = useState("");
  const [saisie, setSaisie] = useState<LigneSaisie[]>([{ ...LIGNE_VIDE }]);

  const lignesDe = useMemo(() => {
    const table: Record<string, LigneFactureAchat[]> = {};
    for (const l of lignes) (table[l.invoice_id] ??= []).push(l);
    return table;
  }, [lignes]);

  const resteDe = (f: FactureAchat) => Math.max(0, (f.total ?? 0) - (f.montant_paye ?? 0));

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return factures.filter((f) => {
      const correspond =
        !q ||
        (f.numero ?? "").toLowerCase().includes(q) ||
        (f.numero_fournisseur ?? "").toLowerCase().includes(q) ||
        f.fournisseur.toLowerCase().includes(q) ||
        (lignesDe[f.id] ?? []).some((l) => l.designation.toLowerCase().includes(q));
      const reglement =
        filtreReglement === "Tous" ||
        (filtreReglement === "du" ? resteDe(f) > 0 : resteDe(f) === 0);
      return correspond && reglement;
    });
  }, [factures, recherche, filtreReglement, lignesDe]);

  const resteTotal = factures.reduce((n, f) => n + resteDe(f), 0);
  const nbDues = factures.filter((f) => resteDe(f) > 0).length;

  const ouvrirCreation = () => {
    setEnEdition(null);
    setFournisseurId("");
    setFournisseurNom("");
    setNumeroFournisseur("");
    setDate(dateDuJour());
    setEcheance("");
    setTotal(0);
    setMontantPaye(0);
    setNote("");
    setPieceJointe("");
    setSaisie([{ ...LIGNE_VIDE }]);
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (f: FactureAchat) => {
    setEnEdition(f);
    setFournisseurId(f.supplier_id ?? "");
    setFournisseurNom(f.fournisseur);
    setNumeroFournisseur(f.numero_fournisseur ?? "");
    setDate(f.date);
    setEcheance(f.date_echeance ?? "");
    setTotal(f.total ?? 0);
    setMontantPaye(f.montant_paye ?? 0);
    setNote(f.note ?? "");
    setPieceJointe(f.piece_jointe ?? "");
    const ses = lignesDe[f.id] ?? [];
    setSaisie(
      ses.length > 0
        ? ses.map((l) => ({
            productId: l.product_id ?? "",
            designation: l.designation,
            quantite: Number(l.quantite),
            unite: l.unite ?? "",
            prixUnitaire: Number(l.prix_unitaire),
          }))
        : [{ ...LIGNE_VIDE }],
    );
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const changerLigne = (i: number, patch: Partial<LigneSaisie>) =>
    setSaisie((l) => l.map((x, j) => (i === j ? { ...x, ...patch } : x)));

  const choisirProduit = (i: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    changerLigne(i, {
      productId,
      designation: p ? getProductLabel(p, products) : saisie[i].designation,
      unite: p?.unite ?? saisie[i].unite,
    });
  };

  const choisirFournisseur = (id: string) => {
    setFournisseurId(id);
    const fiche = fournisseurs.find((f) => f.id === id);
    if (fiche) setFournisseurNom(fiche.entreprise || fiche.nom);
  };

  /**
   * La photo ou le PDF de l'original.
   *
   * Une image est réduite avant l'envoi — un commerçant photographie
   * sa facture au téléphone — un PDF part tel quel. Le seau
   * « documents » est privé : la pièce ne s'ouvre que par une adresse
   * signée, valable une heure.
   */
  const envoyerPiece = async (fichier: File | undefined) => {
    if (!fichier || !storeId) return;
    setEnvoiEnCours(true);
    setErreur(null);
    const aEnvoyer = fichier.type === "application/pdf" ? fichier : await reduireImage(fichier);
    const { chemin, error } = await envoyerFichier(
      "documents",
      storeId,
      "factures-fournisseur",
      aEnvoyer,
    );
    setEnvoiEnCours(false);
    if (error) setErreur(error);
    else setPieceJointe(chemin ?? "");
  };

  const ouvrirPiece = async (chemin: string) => {
    const { url } = await adresseDocument(chemin);
    if (url) window.open(url, "_blank", "noopener");
  };

  const enregistrer = async () => {
    if (!fournisseurNom.trim()) {
      setErreur("Indiquez de quel fournisseur vient cette facture.");
      return;
    }
    if (total <= 0) {
      setErreur("Reportez le total inscrit sur la facture.");
      return;
    }
    if (montantPaye > total) {
      setErreur("Le montant déjà réglé dépasse le total de la facture.");
      return;
    }

    const charge: SaisieFactureAchat = {
      supplier_id: fournisseurId || null,
      fournisseur: fournisseurNom.trim(),
      numero_fournisseur: numeroFournisseur.trim() || null,
      date,
      date_echeance: echeance || null,
      total: Number(total),
      montant_paye: Number(montantPaye),
      note: note.trim() || null,
      piece_jointe: pieceJointe || null,
      lignes: saisie
        .filter((l) => l.designation.trim())
        .map((l) => ({
          product_id: l.productId || null,
          designation: l.designation.trim(),
          quantite: Number(l.quantite),
          unite: l.unite.trim() || null,
          prix_unitaire: Number(l.prixUnitaire),
        })),
    };

    setEnregistrement(true);
    setErreur(null);
    const res = enEdition ? await onUpdate(enEdition.id, charge) : await onAdd(charge);
    setEnregistrement(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setSucces(enEdition ? "Facture modifiée." : "Facture enregistrée.");
    setFormulaireOuvert(false);
  };

  const supprimer = async (f: FactureAchat) => {
    if (!onDelete) return;
    if (!window.confirm(`Retirer la facture ${f.numero ?? ""} du classeur ?`)) return;
    const res = await onDelete(f.id);
    if (res.error) setErreur(res.error);
    else setSucces(`Facture ${f.numero ?? ""} retirée.`);
  };

  const item = (f: FactureAchat): DataListItem => {
    const ses = lignesDe[f.id] ?? [];
    const reste = resteDe(f);
    return {
      id: f.id,
      primary: <span className="block truncate">{f.fournisseur || "Fournisseur inconnu"}</span>,
      meta: [
        f.numero,
        f.numero_fournisseur ? `n° ${f.numero_fournisseur}` : null,
        formatDateLocale(f.date, "FR"),
        f.date_echeance ? `échéance ${formatDateLocale(f.date_echeance, "FR")}` : null,
        f.piece_jointe ? "pièce jointe" : null,
      ],
      amount: formatCurrency(f.total ?? 0),
      badge: (
        <span className={`app-badge ${reste > 0 ? "app-badge-warning" : "app-badge-success"}`}>
          {reste > 0 ? "À régler" : "Réglée"}
        </span>
      ),
      detailTitle: f.fournisseur || "Fournisseur inconnu",
      detailSubtitle: `Facture ${f.numero ?? ""}`,
      detailBody:
        ses.length > 0 ? (
          <div className="app-list mb-2 rounded-xl border border-border">
            {ses.map((l) => (
              <div key={l.id} className="app-list-row justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="app-list-primary block">{l.designation}</span>
                  <span className="app-list-secondary block">
                    {l.quantite}
                    {l.unite ? ` ${l.unite}` : ""} × {formatCurrency(l.prix_unitaire)}
                  </span>
                </span>
                <span className="app-list-amount">
                  {formatCurrency(l.total ?? l.quantite * l.prix_unitaire)}
                </span>
              </div>
            ))}
          </div>
        ) : undefined,
      details: [
        { label: "Date", value: formatDateLocale(f.date, "FR") },
        {
          label: "Échéance",
          value: f.date_echeance ? formatDateLocale(f.date_echeance, "FR") : "—",
        },
        { label: "N° du fournisseur", value: f.numero_fournisseur || "—" },
        { label: "Total", value: formatCurrency(f.total ?? 0) },
        { label: "Déjà réglé", value: formatCurrency(f.montant_paye ?? 0) },
        { label: "Reste à régler", value: formatCurrency(reste) },
        { label: "Note", value: f.note || "-", hideIfEmpty: true },
      ],
      actions: (
        <>
          <button onClick={() => setAImprimer(f)} className="app-btn-secondary">
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          {f.piece_jointe && (
            <button
              onClick={() => ouvrirPiece(f.piece_jointe as string)}
              className="app-btn-secondary"
            >
              <Paperclip className="h-4 w-4" />
              Voir l&apos;original
            </button>
          )}
          {peutModifier && (
            <button onClick={() => ouvrirEdition(f)} className="app-btn-secondary">
              <Edit3 className="h-4 w-4" />
              Modifier
            </button>
          )}
          {onDelete && (
            <button onClick={() => supprimer(f)} className="app-btn-danger">
              <Trash2 className="h-4 w-4" />
              Retirer
            </button>
          )}
        </>
      ),
    };
  };

  const somme = sommeDesLignes(saisie.filter((l) => l.designation.trim()));
  const ecart = somme > 0 && Math.round(somme) !== Math.round(total);

  const document = useMemo(() => {
    if (!aImprimer) return null;
    return documentDeFactureAchat({
      facture: aImprimer,
      lignes: lignesDe[aImprimer.id] ?? [],
      fournisseur: fournisseurs.find((f) => f.id === aImprimer.supplier_id) ?? null,
      boutique: settings,
      reglages: reglagesDocuments,
    });
  }, [aImprimer, lignesDe, fournisseurs, settings, reglagesDocuments]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FileText className="h-5 w-5 t-success" />}
        title="Factures reçues"
        subtitle="Les factures de vos fournisseurs, rangées et retrouvables. Elles ne touchent ni à la caisse ni au stock."
        metric={
          <HeaderMetric
            label="Reste à régler"
            value={formatCurrency(resteTotal)}
            hint={`${nbDues} facture${nbDues > 1 ? "s" : ""} en attente`}
          />
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {/* Un bouton à symbole seul n'a ni cadre ni fond : la
                flèche se reconnaît sans qu'on l'encadre. */}
            <button onClick={onRetour} className="app-btn-icon" aria-label="Revenir aux achats">
              <ArrowLeft className="h-4 w-4" />
            </button>
            {peutCreer && (
              <button onClick={ouvrirCreation} className="app-btn-primary w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Enregistrer une facture
              </button>
            )}
          </div>
        }
      />

      {succes && (
        <p
          role="status"
          className="rounded-xl border border-success-border bg-success-soft px-4 py-2.5 text-sm font-medium t-success"
        >
          {succes}
        </p>
      )}

      {erreur && !formulaireOuvert && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-soft px-4 py-2.5 text-sm t-danger"
        >
          {erreur}
        </p>
      )}

      <FilterBar
        searchValue={recherche}
        onSearchChange={setRecherche}
        searchPlaceholder="Rechercher un fournisseur, un numéro, un article"
        activeFilterCount={filtreReglement === "Tous" ? 0 : 1}
        onReset={() => setFiltreReglement("Tous")}
      >
        <FilterField label="Règlement">
          <select
            value={filtreReglement}
            onChange={(e) => setFiltreReglement(e.target.value as "Tous" | "du" | "regle")}
            className="app-field"
          >
            <option value="Tous">Toutes</option>
            <option value="du">À régler</option>
            <option value="regle">Réglées</option>
          </select>
        </FilterField>
      </FilterBar>

      <div className="app-card overflow-hidden">
        <DataList
          emptyLabel="Aucune facture reçue ne correspond à ces filtres."
          items={filtrees.map(item)}
        />
      </div>

      <Modal
        open={formulaireOuvert}
        onClose={() => setFormulaireOuvert(false)}
        size="2xl"
        icon={<FileText className="h-4 w-4" />}
        title={enEdition ? `Modifier ${enEdition.numero ?? "la facture"}` : "Facture reçue"}
        description="Reportez ce qui est écrit sur le papier. Cet enregistrement ne touche ni au stock ni à la caisse."
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormulaireOuvert(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              disabled={enregistrement}
              className="app-btn-primary"
            >
              <Save className="h-4 w-4" />
              {enregistrement ? "Enregistrement…" : "Enregistrer la facture"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {erreur && (
            <p
              role="alert"
              className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-2.5 text-sm t-danger"
            >
              {erreur}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fa-frn" className="mb-1.5 block text-sm font-medium text-foreground">
                Fournisseur
              </label>
              <select
                id="fa-frn"
                value={fournisseurId}
                onChange={(e) => choisirFournisseur(e.target.value)}
                className="app-field"
              >
                <option value="">Saisir librement</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.entreprise || f.nom}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={fournisseurNom}
                onChange={(e) => setFournisseurNom(e.target.value)}
                placeholder="Nom du fournisseur"
                className="app-field mt-2"
                aria-label="Nom du fournisseur"
              />
            </div>

            <div>
              <label htmlFor="fa-num" className="mb-1.5 block text-sm font-medium text-foreground">
                N° de la facture reçue
              </label>
              <input
                id="fa-num"
                type="text"
                value={numeroFournisseur}
                onChange={(e) => setNumeroFournisseur(e.target.value)}
                placeholder="Celui que porte le papier"
                className="app-field"
              />
            </div>

            <div>
              <label htmlFor="fa-date" className="mb-1.5 block text-sm font-medium text-foreground">
                Date
              </label>
              <input
                id="fa-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="app-field"
              />
            </div>

            <div>
              <label htmlFor="fa-ech" className="mb-1.5 block text-sm font-medium text-foreground">
                Échéance
              </label>
              <input
                id="fa-ech"
                type="date"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                className="app-field"
              />
            </div>
          </div>

          {/* ── Le détail, facultatif ── */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Détail (facultatif)</p>
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
              Ce que la facture énumère. Il sert à retrouver un article plus tard ; le montant, lui,
              reste celui que vous inscrivez plus bas.
            </p>
            <div className="space-y-2">
              {saisie.map((ligne, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`fa-ligne-${i}-produit`}
                        className="mb-1 block text-xs font-medium text-muted-foreground"
                      >
                        Produit du catalogue
                      </label>
                      <AideLigneLibre />
                      <select
                        id={`fa-ligne-${i}-produit`}
                        value={ligne.productId}
                        onChange={(e) => choisirProduit(i, e.target.value)}
                        className="app-field"
                      >
                        <option value="">{LIBELLE_LIGNE_LIBRE}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {getProductLabel(p, products)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`fa-ligne-${i}-designation`}
                        className="mb-1 block text-xs font-medium text-muted-foreground"
                      >
                        Désignation
                      </label>
                      <input
                        id={`fa-ligne-${i}-designation`}
                        type="text"
                        value={ligne.designation}
                        onChange={(e) => changerLigne(i, { designation: e.target.value })}
                        placeholder="Ce que la facture énumère"
                        className="app-field"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-end gap-3">
                    <div className="w-20">
                      <label
                        htmlFor={`fa-ligne-${i}-quantite`}
                        className="mb-1 block text-xs font-medium text-muted-foreground"
                      >
                        Quantité
                      </label>
                      <input
                        id={`fa-ligne-${i}-quantite`}
                        type="number"
                        min={0}
                        value={ligne.quantite}
                        onChange={(e) => changerLigne(i, { quantite: Number(e.target.value) })}
                        className="app-field font-mono"
                      />
                    </div>
                    <div className="w-24">
                      <label
                        htmlFor={`fa-ligne-${i}-unite`}
                        className="mb-1 block text-xs font-medium text-muted-foreground"
                      >
                        Unité
                      </label>
                      <input
                        id={`fa-ligne-${i}-unite`}
                        type="text"
                        value={ligne.unite}
                        onChange={(e) => changerLigne(i, { unite: e.target.value })}
                        className="app-field"
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        htmlFor={`fa-ligne-${i}-prix`}
                        className="mb-1 block text-xs font-medium text-muted-foreground"
                      >
                        Prix unitaire
                      </label>
                      <input
                        id={`fa-ligne-${i}-prix`}
                        type="number"
                        min={0}
                        value={ligne.prixUnitaire}
                        onChange={(e) => changerLigne(i, { prixUnitaire: Number(e.target.value) })}
                        className="app-field font-mono"
                      />
                    </div>
                    {saisie.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSaisie((l) => l.filter((_, j) => j !== i))}
                        className="app-btn-icon"
                        aria-label={`Retirer la ligne ${i + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSaisie((l) => [...l, { ...LIGNE_VIDE }])}
              className="app-btn-secondary mt-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="fa-total"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Total de la facture
              </label>
              <input
                id="fa-total"
                type="number"
                min={0}
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
                className="app-field font-mono"
              />
              {/* Un écart n'est pas une erreur : transport, arrondi,
                  remise. On le signale, on ne le corrige pas d'office. */}
              {ecart && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Les lignes totalisent {formatCurrency(somme)}.{" "}
                  <button
                    type="button"
                    onClick={() => setTotal(somme)}
                    className="font-medium underline t-success"
                  >
                    Reprendre ce montant
                  </button>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="fa-paye" className="mb-1.5 block text-sm font-medium text-foreground">
                Déjà réglé
              </label>
              <input
                id="fa-paye"
                type="number"
                min={0}
                value={montantPaye}
                onChange={(e) => setMontantPaye(Number(e.target.value))}
                className="app-field font-mono"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Original</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="app-btn-secondary cursor-pointer">
                <Upload className="h-4 w-4" />
                {envoiEnCours ? "Envoi…" : pieceJointe ? "Remplacer" : "Photo ou PDF"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => envoyerPiece(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
              {pieceJointe && (
                <>
                  <button
                    type="button"
                    onClick={() => ouvrirPiece(pieceJointe)}
                    className="app-btn-secondary"
                  >
                    <Paperclip className="h-4 w-4" />
                    Voir
                  </button>
                  <button
                    type="button"
                    onClick={() => setPieceJointe("")}
                    className="app-btn-icon"
                    aria-label="Retirer la pièce jointe"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="fa-note" className="mb-1.5 block text-sm font-medium text-foreground">
              Note
            </label>
            <textarea
              id="fa-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="app-field"
            />
          </div>
        </div>
      </Modal>

      {document && aImprimer && (
        <SortieDocument
          document={document}
          reglages={reglagesDocuments}
          formats={["a4"]}
          titre={`Facture ${aImprimer.numero ?? ""}`}
          onFermer={() => setAImprimer(null)}
        />
      )}
    </div>
  );
};
