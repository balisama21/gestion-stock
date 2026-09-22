import React, { useMemo, useState } from "react";
import {
  Check,
  Edit3,
  FileText,
  Plus,
  Printer,
  Save,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import type { Product, StoreSettings } from "../types";
import type { Database } from "../lib/database.types";
import { formatCurrency, formatDateLocale, getProductLabel } from "../utils/formulas";
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList, type DataListItem } from "./shared/DataList";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import { DocumentDevis } from "./devis/DocumentDevis";
import type { ReglagesDocuments } from "../features/documents/lib/reglages";
import { resoudreType } from "../features/documents/lib/resolveur";
import {
  STATUTS_DEVIS,
  classeStatut,
  estExpire,
  texteStatut,
  totalDesLignes,
  type Devis,
  type LigneDevis,
  type LigneSaisie,
} from "../lib/devis";
import { dateDuJour, dateDansNJours } from "../lib/dates";
import { useRechercheInitiale } from "../lib/cibleRecherche";
import { AideLigneLibre, LIBELLE_LIGNE_LIBRE } from "./shared/LigneLibre";

type Client = Database["public"]["Tables"]["clients"]["Row"];

interface DevisViewProps {
  /**
   * Les nouveaux documents, et les réglages de la boutique.
   * Drapeau baissé, le devis imprimé est celui d'aujourd'hui.
   */
  documentsV2?: boolean;
  reglagesDocuments?: ReglagesDocuments;
  quotes: Devis[];
  quoteItems: LigneDevis[];
  clients: Client[];
  products: Product[];
  onAddQuote: (data: {
    client_id?: string | null;
    client_nom: string;
    date: string;
    valide_jusqu_au?: string | null;
    note?: string | null;
    lignes: {
      product_id?: string | null;
      designation: string;
      quantite: number;
      prix_unitaire: number;
    }[];
  }) => Promise<{ quote: Devis | null; error: string | null }>;
  onUpdateQuote: (
    id: string,
    data: {
      client_id?: string | null;
      client_nom: string;
      date: string;
      valide_jusqu_au?: string | null;
      note?: string | null;
      lignes: {
        product_id?: string | null;
        designation: string;
        quantite: number;
        prix_unitaire: number;
      }[];
    },
  ) => Promise<{ quote: Devis | null; error: string | null }>;
  onSetStatus: (
    id: string,
    statut: string,
    venteTicketId?: string | null,
  ) => Promise<{ error: string | null }>;
  onDeleteQuote: (id: string) => Promise<{ error: string | null }>;
  /** L'identité de la boutique, pour l'en-tête du document. */
  settings?: StoreSettings;
  /**
   * Reprendre les lignes du devis dans le panier de la caisse.
   * Absent quand l'utilisateur n'a pas le droit de vendre.
   */
  onTransformerEnVente?: (devis: Devis, lignes: LigneDevis[]) => void;
  peutCreer?: boolean;
  peutModifier?: boolean;
  peutSupprimer?: boolean;
}

const AUJOURDHUI = () => dateDuJour();

/**
 * Jusqu'à quand l'offre tient, par défaut.
 *
 * Trente jours étaient écrits en dur ici. C'est désormais un réglage
 * de boutique, par type de document — trente jours restant la valeur
 * que le logiciel propose, pour ne rien changer à qui n'y touche pas.
 * La date reste modifiable devis par devis : ce n'est qu'un point de
 * départ.
 */
type TypePiece = "devis" | "proforma";

/**
 * Les deux pièces que cet écran produit.
 *
 * Une proforma n'est pas un autre document : c'est le même, sous un
 * autre nom et avec un autre compteur. Elle vit donc dans la même
 * liste, se modifie dans le même formulaire et se transforme en vente
 * par le même chemin. Seuls les mots changent, et ils sont ici.
 */
const PIECES: Record<
  TypePiece,
  { nom: string; article: string; nouveau: string; destinataire: string }
> = {
  devis: {
    nom: "Devis",
    article: "le devis",
    nouveau: "Nouveau devis",
    destinataire: "À qui ce devis est adressé",
  },
  proforma: {
    nom: "Facture proforma",
    article: "la proforma",
    nouveau: "Nouvelle proforma",
    destinataire: "À qui cette proforma est adressée",
  },
};

const validiteParDefaut = (reglages?: ReglagesDocuments, type: TypePiece = "devis") =>
  dateDansNJours(reglages ? resoudreType(reglages, type).validiteJours : 30);

const joursDeValidite = (reglages: ReglagesDocuments | undefined, type: TypePiece) =>
  reglages ? resoudreType(reglages, type).validiteJours : 30;

/** Ce que la pièce est. Une valeur inconnue en base se lit « devis ». */
const typeDe = (devis: { type?: string | null }): TypePiece =>
  devis.type === "proforma" ? "proforma" : "devis";

const LIGNE_VIDE: LigneSaisie = {
  productId: "",
  designation: "",
  quantite: 1,
  prixUnitaire: 0,
};

/**
 * Les devis.
 *
 * C'est le seul document de l'application qui n'engage rien : ni le
 * stock, ni la caisse. Il propose un prix, et attend une réponse. Tant
 * qu'il n'est pas accepté, tout y est modifiable ; une fois accepté, il
 * est figé — c'est la base qui le tient, pas cet écran.
 */
export const DevisView: React.FC<DevisViewProps> = ({
  documentsV2,
  reglagesDocuments,
  quotes,
  quoteItems,
  clients,
  products,
  onAddQuote,
  onUpdateQuote,
  onSetStatus,
  onDeleteQuote,
  settings,
  onTransformerEnVente,
  peutCreer = true,
  peutModifier = true,
  peutSupprimer = true,
}) => {
  const [recherche, setRecherche] = useState("");
  // Une notification peut viser une ligne précise : la recherche
  // s'ouvre alors remplie dessus. Voir `src/lib/cibleRecherche.ts`.
  useRechercheInitiale("devis", setRecherche);
  const [filtreStatut, setFiltreStatut] = useState("Tous");
  const [filtreType, setFiltreType] = useState<"Tous" | TypePiece>("Tous");

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Devis | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [devisAImprimer, setDevisAImprimer] = useState<Devis | null>(null);

  const [clientId, setClientId] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [date, setDate] = useState(AUJOURDHUI);
  const [typePiece, setTypePiece] = useState<TypePiece>("devis");
  const [validite, setValidite] = useState(() => validiteParDefaut(reglagesDocuments));
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<LigneSaisie[]>([{ ...LIGNE_VIDE }]);

  const lignesDe = useMemo(() => {
    const table: Record<string, LigneDevis[]> = {};
    for (const l of quoteItems) {
      (table[l.quote_id] ??= []).push(l);
    }
    return table;
  }, [quoteItems]);

  const clientsTries = useMemo(
    () => [...clients].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [clients],
  );

  const nomDeLaFiche = (c: Client) => [c.nom, c.prenom].filter(Boolean).join(" ");

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return quotes.filter((d) => {
      const correspond =
        !q ||
        (d.numero ?? "").toLowerCase().includes(q) ||
        d.client_nom.toLowerCase().includes(q) ||
        (lignesDe[d.id] ?? []).some((l) => l.designation.toLowerCase().includes(q));
      const statut =
        filtreStatut === "Tous" ||
        (filtreStatut === "expire" ? estExpire(d) : d.statut === filtreStatut);
      const type = filtreType === "Tous" || typeDe(d) === filtreType;
      return correspond && statut && type;
    });
  }, [quotes, recherche, filtreStatut, filtreType, lignesDe]);

  const enAttente = quotes.filter(
    (d) => (d.statut === "brouillon" || d.statut === "envoye") && !estExpire(d),
  );
  const montantEnAttente = enAttente.reduce((n, d) => n + d.total, 0);

  // ── Le formulaire ──
  const ouvrirCreation = (type: TypePiece = "devis") => {
    setEnEdition(null);
    setTypePiece(type);
    setClientId("");
    setClientNom("");
    setDate(AUJOURDHUI());
    setValidite(validiteParDefaut(reglagesDocuments, type));
    setNote("");
    setLignes([{ ...LIGNE_VIDE }]);
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (devis: Devis) => {
    setEnEdition(devis);
    setTypePiece(typeDe(devis));
    setClientId(devis.client_id ?? "");
    setClientNom(devis.client_nom);
    setDate(devis.date);
    setValidite(devis.valide_jusqu_au ?? "");
    setNote(devis.note ?? "");
    setLignes(
      (lignesDe[devis.id] ?? []).map((l) => ({
        productId: l.product_id ?? "",
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prix_unitaire,
      })),
    );
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const changerLigne = (index: number, champs: Partial<LigneSaisie>) =>
    setLignes((liste) => liste.map((l, i) => (i === index ? { ...l, ...champs } : l)));

  /**
   * Choisir un produit remplit la désignation et le prix, sans les
   * verrouiller : un devis se négocie, et la désignation d'une ligne
   * peut préciser ce que le catalogue ne dit pas.
   */
  const choisirProduit = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    changerLigne(index, {
      productId,
      designation: prod ? getProductLabel(prod, products) : lignes[index].designation,
      prixUnitaire: prod ? prod.prixVenteDefaut : lignes[index].prixUnitaire,
    });
  };

  /*
   * Passer du devis à la proforma recalcule la date de validité, sauf
   * si elle a été saisie à la main : les deux pièces n'ont pas
   * forcément la même durée, et une date restée sur l'ancienne
   * promettrait autre chose que ce que le réglage annonce.
   */
  const changerTypePiece = (type: TypePiece) => {
    if (validite === validiteParDefaut(reglagesDocuments, typePiece)) {
      setValidite(validiteParDefaut(reglagesDocuments, type));
    }
    setTypePiece(type);
  };

  const choisirClient = (id: string) => {
    setClientId(id);
    const fiche = clients.find((c) => c.id === id);
    if (fiche) setClientNom(nomDeLaFiche(fiche));
  };

  const enregistrer = async () => {
    const propres = lignes.filter((l) => l.designation.trim() && l.quantite > 0);
    if (propres.length === 0) {
      setErreur("Un devis sans ligne ne propose rien : ajoutez au moins un article.");
      return;
    }
    if (!clientNom.trim()) {
      setErreur("Indiquez à qui ce devis est adressé.");
      return;
    }
    if (propres.some((l) => l.prixUnitaire < 0)) {
      setErreur("Un prix ne peut pas être négatif.");
      return;
    }

    const charge = {
      client_id: clientId || null,
      client_nom: clientNom.trim(),
      date,
      valide_jusqu_au: validite || null,
      note: note.trim() || null,
      type: typePiece,
      // La durée est FIGÉE sur la pièce : changer le réglage de la
      // boutique demain ne doit pas réécrire ce qu'on a promis hier.
      duree_validite_jours: joursDeValidite(reglagesDocuments, typePiece),
      lignes: propres.map((l) => ({
        product_id: l.productId || null,
        designation: l.designation.trim(),
        quantite: Number(l.quantite),
        prix_unitaire: Number(l.prixUnitaire),
      })),
    };

    setEnregistrement(true);
    setErreur(null);
    const res = enEdition ? await onUpdateQuote(enEdition.id, charge) : await onAddQuote(charge);
    setEnregistrement(false);

    if (res.error) {
      setErreur(res.error);
      return;
    }
    setSucces(
      enEdition
        ? `${PIECES[typePiece].nom} ${enEdition.numero ?? ""} modifié${typePiece === "proforma" ? "e" : ""}.`
        : `${PIECES[typePiece].nom} ${res.quote?.numero ?? ""} créé${typePiece === "proforma" ? "e" : ""}.`,
    );
    setFormulaireOuvert(false);
  };

  const changerStatut = async (devis: Devis, statut: string) => {
    const res = await onSetStatus(devis.id, statut);
    if (res.error) setErreur(res.error);
    else
      setSucces(
        `${PIECES[typeDe(devis)].nom} ${devis.numero ?? ""} : ${texteStatut({ ...devis, statut })}.`,
      );
  };

  const supprimer = async (devis: Devis) => {
    const piece = PIECES[typeDe(devis)];
    if (!window.confirm(`Supprimer ${piece.article} ${devis.numero ?? ""} ?`)) return;
    const res = await onDeleteQuote(devis.id);
    if (res.error) setErreur(res.error);
    else
      setSucces(
        `${piece.nom} ${devis.numero ?? ""} supprimé${typeDe(devis) === "proforma" ? "e" : ""}.`,
      );
  };

  // ── La liste ──
  const item = (devis: Devis): DataListItem => {
    const sesLignes = lignesDe[devis.id] ?? [];
    const fige = devis.statut === "accepte";
    return {
      id: devis.id,
      primary: <span className="block truncate">{devis.client_nom || "Sans nom"}</span>,
      meta: [
        typeDe(devis) === "proforma" ? "Proforma" : null,
        devis.numero,
        formatDateLocale(devis.date, "FR"),
        `${sesLignes.length} ligne${sesLignes.length > 1 ? "s" : ""}`,
        devis.valide_jusqu_au
          ? `valable jusqu'au ${formatDateLocale(devis.valide_jusqu_au, "FR")}`
          : null,
      ],
      amount: formatCurrency(devis.total),
      badge: <span className={`app-badge ${classeStatut(devis)}`}>{texteStatut(devis)}</span>,
      detailTitle: devis.client_nom || "Sans nom",
      detailSubtitle: `${PIECES[typeDe(devis)].nom} ${devis.numero ?? ""}`,
      detailBody: (
        <div className="app-list mb-2 rounded-xl border border-border">
          {sesLignes.map((l) => (
            <div key={l.id} className="app-list-row justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="app-list-primary block">{l.designation}</span>
                <span className="app-list-secondary block">
                  {l.quantite} × {formatCurrency(l.prix_unitaire)}
                </span>
              </span>
              {/* La colonne est calculée en base, et le générateur de
                  types la déclare donc comme pouvant être nulle. On
                  refait le calcul plutôt que d'afficher zéro : un
                  montant faux se lit comme un montant. */}
              <span className="app-list-amount">
                {formatCurrency(l.total ?? l.quantite * l.prix_unitaire)}
              </span>
            </div>
          ))}
        </div>
      ),
      details: [
        { label: "Date", value: formatDateLocale(devis.date, "FR") },
        {
          label: "Valable jusqu'au",
          value: devis.valide_jusqu_au ? formatDateLocale(devis.valide_jusqu_au, "FR") : "—",
        },
        { label: "Total", value: formatCurrency(devis.total) },
        { label: "Statut", value: texteStatut(devis) },
        { label: "Note", value: devis.note || "-", hideIfEmpty: true },
      ],
      actions: (
        <>
          <button onClick={() => setDevisAImprimer(devis)} className="app-btn-secondary">
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          {onTransformerEnVente && !fige && devis.statut !== "refuse" && (
            <button
              onClick={() => onTransformerEnVente(devis, sesLignes)}
              className="app-btn-secondary"
            >
              <ShoppingCart className="h-4 w-4" />
              {typeDe(devis) === "proforma" ? "Convertir en facture" : "Transformer en vente"}
            </button>
          )}
          {peutModifier && !fige && (
            <button onClick={() => ouvrirEdition(devis)} className="app-btn-secondary">
              <Edit3 className="h-4 w-4" />
              Modifier
            </button>
          )}
          {peutModifier && devis.statut === "brouillon" && (
            <button onClick={() => changerStatut(devis, "envoye")} className="app-btn-secondary">
              <Send className="h-4 w-4" />
              Marquer envoyé
            </button>
          )}
          {peutModifier && !fige && devis.statut !== "refuse" && (
            <button onClick={() => changerStatut(devis, "accepte")} className="app-btn-primary">
              <Check className="h-4 w-4" />
              Accepté
            </button>
          )}
          {peutModifier && !fige && devis.statut !== "refuse" && (
            <button onClick={() => changerStatut(devis, "refuse")} className="app-btn-secondary">
              <X className="h-4 w-4" />
              Refusé
            </button>
          )}
          {peutSupprimer && !fige && (
            <button onClick={() => supprimer(devis)} className="app-btn-danger">
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          )}
        </>
      ),
    };
  };

  const totalSaisi = totalDesLignes(lignes);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FileText className="h-5 w-5 t-success" />}
        title="Devis"
        module="devis"
        subtitle="Ce que vous avez proposé, et ce qui attend encore une réponse."
        metric={
          <HeaderMetric
            label="En attente de réponse"
            value={formatCurrency(montantEnAttente)}
            hint={`${enAttente.length} devis en cours`}
          />
        }
        actions={
          peutCreer ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                onClick={() => ouvrirCreation("devis")}
                className="app-btn-primary w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Nouveau devis
              </button>
              {/* La proforma est le même papier sous un autre nom :
                  elle part du même écran, sans onglet à elle. */}
              <button
                onClick={() => ouvrirCreation("proforma")}
                className="app-btn-secondary w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Nouvelle proforma
              </button>
            </div>
          ) : undefined
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
        searchPlaceholder="Rechercher un devis, un client, un article"
        activeFilterCount={(filtreStatut === "Tous" ? 0 : 1) + (filtreType === "Tous" ? 0 : 1)}
        onReset={() => {
          setFiltreStatut("Tous");
          setFiltreType("Tous");
        }}
      >
        <FilterField label="Pièce">
          <select
            value={filtreType}
            onChange={(e) => setFiltreType(e.target.value as "Tous" | TypePiece)}
            className="app-field"
          >
            <option value="Tous">Toutes</option>
            <option value="devis">Devis</option>
            <option value="proforma">Factures proforma</option>
          </select>
        </FilterField>
        <FilterField label="Statut">
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
            className="app-field"
          >
            <option value="Tous">Tous</option>
            {STATUTS_DEVIS.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
            <option value="expire">Expiré</option>
          </select>
        </FilterField>
      </FilterBar>

      <div className="app-card overflow-hidden">
        <DataList emptyLabel="Aucun devis ne correspond à ces filtres." items={filtres.map(item)} />
      </div>

      <Modal
        open={formulaireOuvert}
        onClose={() => setFormulaireOuvert(false)}
        size="2xl"
        icon={<FileText className="h-4 w-4" />}
        title={
          enEdition
            ? `Modifier ${enEdition.numero ?? PIECES[typePiece].article}`
            : PIECES[typePiece].nouveau
        }
        description={
          typePiece === "proforma"
            ? "Une proforma annonce un prix ferme avant la vente. Elle ne touche ni au stock ni à la caisse tant qu'elle n'est pas convertie."
            : "Un devis ne touche ni au stock ni à la caisse : il propose un prix."
        }
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
              {enregistrement ? "Enregistrement…" : `Enregistrer ${PIECES[typePiece].article}`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* La nature de la pièce vient en premier : elle décide du
              titre imprimé, du numéro et de la durée de validité. */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Nature de la pièce
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PIECES) as TypePiece[]).map((t) => {
                const choisi = typePiece === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={choisi}
                    onClick={() => changerTypePiece(t)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      choisi
                        ? "border-success-border bg-success-soft"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <span className="block text-sm font-medium text-foreground">
                      {PIECES[t].nom}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t === "devis" ? "Une proposition de prix" : "Un prix ferme, avant la vente"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="dev-client"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Client
              </label>
              <select
                id="dev-client"
                value={clientId}
                onChange={(e) => choisirClient(e.target.value)}
                className="app-field"
              >
                <option value="">Pas encore client</option>
                {clientsTries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nomDeLaFiche(c)}
                    {c.entreprise ? ` — ${c.entreprise}` : ""}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
                placeholder={PIECES[typePiece].destinataire}
                className="app-field mt-2"
                aria-label={`Nom sur ${PIECES[typePiece].article}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="dev-date"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Date
                </label>
                <input
                  id="dev-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="app-field"
                />
              </div>
              <div>
                <label
                  htmlFor="dev-validite"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Valable jusqu&apos;au
                </label>
                <input
                  id="dev-validite"
                  type="date"
                  value={validite}
                  onChange={(e) => setValidite(e.target.value)}
                  className="app-field"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="app-section-title">Lignes</p>
            {lignes.map((ligne, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <label htmlFor={`dev-ligne-${i}-produit`}>Produit du catalogue</label>
                      <AideLigneLibre />
                    </span>
                    <select
                      id={`dev-ligne-${i}-produit`}
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
                      htmlFor={`dev-ligne-${i}-designation`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Désignation
                    </label>
                    <input
                      id={`dev-ligne-${i}-designation`}
                      type="text"
                      value={ligne.designation}
                      onChange={(e) => changerLigne(i, { designation: e.target.value })}
                      placeholder="Ce que le client lira"
                      className="app-field"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-end gap-3">
                  <div className="w-24">
                    <label
                      htmlFor={`dev-ligne-${i}-quantite`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Quantité
                    </label>
                    <input
                      id={`dev-ligne-${i}-quantite`}
                      type="number"
                      min={1}
                      value={ligne.quantite}
                      onChange={(e) => changerLigne(i, { quantite: Number(e.target.value) })}
                      className="app-field font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor={`dev-ligne-${i}-prix`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Prix unitaire
                    </label>
                    <input
                      id={`dev-ligne-${i}-prix`}
                      type="number"
                      min={0}
                      value={ligne.prixUnitaire}
                      onChange={(e) => changerLigne(i, { prixUnitaire: Number(e.target.value) })}
                      className="app-field font-mono"
                    />
                  </div>
                  <div className="pb-2 text-right">
                    <span className="app-list-amount block">
                      {formatCurrency(ligne.quantite * ligne.prixUnitaire)}
                    </span>
                  </div>
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLignes((l) => l.filter((_, k) => k !== i))}
                      className="app-btn-icon mb-1 h-9 w-9 shrink-0"
                      aria-label={`Retirer la ligne ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setLignes((l) => [...l, { ...LIGNE_VIDE }])}
              className="app-btn-secondary w-full"
            >
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </button>
          </div>

          <div>
            <label htmlFor="dev-note" className="mb-1.5 block text-sm font-medium text-foreground">
              Note (optionnel)
            </label>
            <textarea
              id="dev-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Conditions, délai de livraison…"
              className="app-field"
            />
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
            >
              {erreur}
            </p>
          )}

          <div className="app-statbar grid-cols-1">
            <StatCol label="Total du devis" value={formatCurrency(totalSaisi)} />
          </div>
        </div>
      </Modal>

      <DocumentDevis
        documentsV2={documentsV2}
        reglagesDocuments={reglagesDocuments}
        devis={devisAImprimer}
        lignes={devisAImprimer ? (lignesDe[devisAImprimer.id] ?? []) : []}
        settings={settings}
        onClose={() => setDevisAImprimer(null)}
      />
    </div>
  );
};
