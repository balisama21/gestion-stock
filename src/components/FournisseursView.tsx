import React, { useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { formatCurrency } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import type { Purchase, Product } from "../types";
import type { Database } from "../lib/database.types";

type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];

interface FournisseursViewProps {
  suppliers: Supplier[];
  purchases: Purchase[];
  products: Product[];
  onAddSupplier: (
    data: Omit<SupplierInsert, "store_id" | "created_by">,
  ) => Promise<{ supplier: Supplier | null; error: string | null }>;
  onUpdateSupplier: (
    id: string,
    data: Database["public"]["Tables"]["suppliers"]["Update"],
  ) => Promise<{ error: string | null }>;
  onDeleteSupplier: (id: string) => Promise<{ error: string | null }>;
  /** Autorisations de l'utilisateur sur ce module. */
  peutCreer?: boolean;
  peutModifier?: boolean;
  peutSupprimer?: boolean;
}

const FORMULAIRE_VIDE = {
  nom: "",
  entreprise: "",
  contact_principal: "",
  telephone: "",
  email: "",
  adresse: "",
  ville: "",
  pays: "",
  numero_fiscal: "",
  categorie: "",
  conditions_paiement: "",
  delai_livraison_jours: "",
  statut: "actif",
  note: "",
};

const versBase = (f: typeof FORMULAIRE_VIDE) => {
  const vide = (v: string) => (v.trim() === "" ? null : v.trim());
  const delai = f.delai_livraison_jours.trim();
  return {
    nom: f.nom.trim(),
    entreprise: vide(f.entreprise),
    contact_principal: vide(f.contact_principal),
    telephone: vide(f.telephone),
    email: vide(f.email),
    adresse: vide(f.adresse),
    ville: vide(f.ville),
    pays: vide(f.pays),
    numero_fiscal: vide(f.numero_fiscal),
    categorie: vide(f.categorie),
    conditions_paiement: vide(f.conditions_paiement),
    delai_livraison_jours: delai === "" ? null : Number(delai),
    statut: f.statut,
    note: vide(f.note),
  };
};

const depuisFournisseur = (s: Supplier) => ({
  nom: s.nom ?? "",
  entreprise: s.entreprise ?? "",
  contact_principal: s.contact_principal ?? "",
  telephone: s.telephone ?? "",
  email: s.email ?? "",
  adresse: s.adresse ?? "",
  ville: s.ville ?? "",
  pays: s.pays ?? "",
  numero_fiscal: s.numero_fiscal ?? "",
  categorie: s.categorie ?? "",
  conditions_paiement: s.conditions_paiement ?? "",
  delai_livraison_jours:
    s.delai_livraison_jours === null || s.delai_livraison_jours === undefined
      ? ""
      : String(s.delai_livraison_jours),
  statut: s.statut ?? "actif",
  note: s.note ?? "",
});

/** Un chiffre du bandeau de synthèse. */
const Chiffre: React.FC<{ libelle: string; valeur: string }> = ({ libelle, valeur }) => (
  <div className="rounded-xl bg-muted p-3 text-center">
    <div className="font-mono text-base font-bold tabular-nums text-foreground">{valeur}</div>
    <div className="mt-0.5 text-[11px] text-muted-foreground">{libelle}</div>
  </div>
);

/**
 * Les fournisseurs.
 *
 * Le fournisseur n'était jusqu'ici qu'un mot tapé dans la case d'un
 * achat, sans fiche ni mémoire. Il a maintenant sa table, et cet écran
 * rapproche de chaque fiche ce que la boutique lui a acheté.
 *
 * Ce que l'écran ne montre PAS, faute de donnée : ce qu'on doit encore
 * au fournisseur. Un achat n'a ni montant payé ni échéance en base — il
 * sort intégralement de la caisse au moment où on l'enregistre. Une
 * dette fournisseur suppose donc d'abord un suivi de paiement sur les
 * achats, qui relève de leur propre étape. Afficher « reste à payer :
 * 0 » serait affirmer quelque chose que la base ne sait pas.
 *
 * Le rattachement des achats se fait par `supplier_id` quand il existe,
 * et à défaut par le nom — les achats saisis avant la création de la
 * table ne portent que du texte.
 */
export const FournisseursView: React.FC<FournisseursViewProps> = ({
  suppliers,
  purchases,
  products,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  peutCreer = true,
  peutModifier = true,
  peutSupprimer = true,
}) => {
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "actifs" | "inactifs">("tous");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Supplier | null>(null);
  const [selection, setSelection] = useState<Supplier | null>(null);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [suppressionDemandee, setSuppressionDemandee] = useState(false);

  const achatsParFournisseur = useMemo(() => {
    const table: Record<string, Purchase[]> = {};
    for (const f of suppliers) {
      const nom = f.nom.trim().toLowerCase();
      table[f.id] = purchases.filter(
        (a) =>
          a.supplierId === f.id ||
          (!a.supplierId && (a.fournisseur ?? "").trim().toLowerCase() === nom),
      );
    }
    return table;
  }, [suppliers, purchases]);

  /** Ce que chaque fournisseur livre, d'après les produits enregistrés. */
  const produitsParFournisseur = useMemo(() => {
    const table: Record<string, string[]> = {};
    for (const f of suppliers) {
      const nom = f.nom.trim().toLowerCase();
      table[f.id] = products
        .filter((p) => (p.fournisseur ?? "").trim().toLowerCase() === nom)
        .map((p) => p.designation);
    }
    return table;
  }, [suppliers, products]);

  const comptes = useMemo(() => {
    const table: Record<
      string,
      { achats: number; total: number; dernier: string | null; produits: number }
    > = {};
    for (const f of suppliers) {
      const sesAchats = achatsParFournisseur[f.id] ?? [];
      const dates = sesAchats.map((a) => a.date).sort();
      table[f.id] = {
        achats: sesAchats.length,
        total: sesAchats.reduce((s, a) => s + a.totalAchat, 0),
        dernier: dates.length ? dates[dates.length - 1] : null,
        produits: (produitsParFournisseur[f.id] ?? []).length,
      };
    }
    return table;
  }, [suppliers, achatsParFournisseur, produitsParFournisseur]);

  const compteVide = { achats: 0, total: 0, dernier: null as string | null, produits: 0 };

  const listeFiltree = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((f) => {
      if (filtre === "actifs" && (f.statut ?? "actif") !== "actif") return false;
      if (filtre === "inactifs" && (f.statut ?? "actif") !== "inactif") return false;
      if (!q) return true;
      return [f.nom, f.entreprise, f.contact_principal, f.telephone, f.email, f.ville, f.categorie]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [suppliers, filtre, search]);

  /* ── Actions ─────────────────────────────────────────────── */

  const ouvrirCreation = () => {
    setEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (f: Supplier) => {
    setEnEdition(f);
    setFormulaire(depuisFournisseur(f));
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const fermerFormulaire = () => {
    setFormulaireOuvert(false);
    setEnEdition(null);
    setErreur(null);
  };

  const annoncer = (message: string) => {
    setSucces(message);
    window.setTimeout(() => setSucces(null), 4000);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaire.nom.trim()) {
      setErreur("Le nom est obligatoire.");
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    const donnees = versBase(formulaire);

    if (enEdition) {
      const { error } = await onUpdateSupplier(enEdition.id, donnees);
      setEnregistrement(false);
      if (error) {
        setErreur(error);
        return;
      }
      if (selection?.id === enEdition.id) setSelection({ ...selection, ...donnees });
      annoncer(`${donnees.nom} a été mis à jour.`);
    } else {
      const { error } = await onAddSupplier(donnees);
      setEnregistrement(false);
      if (error) {
        setErreur(error);
        return;
      }
      annoncer(`${donnees.nom} a été ajouté.`);
    }
    fermerFormulaire();
  };

  const supprimer = async () => {
    if (!selection) return;
    setEnregistrement(true);
    const { error } = await onDeleteSupplier(selection.id);
    setEnregistrement(false);
    setSuppressionDemandee(false);
    if (error) {
      setErreur(error);
      return;
    }
    annoncer(`${selection.nom} a été supprimé.`);
    setSelection(null);
  };

  const achatsDuFournisseur = selection ? (achatsParFournisseur[selection.id] ?? []) : [];
  const produitsDuFournisseur = selection ? (produitsParFournisseur[selection.id] ?? []) : [];
  const compteSelection = selection ? (comptes[selection.id] ?? compteVide) : compteVide;

  const champ = (cle: keyof typeof FORMULAIRE_VIDE) => ({
    value: formulaire[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormulaire((p) => ({ ...p, [cle]: e.target.value })),
  });

  const etiquette = (pour: string, texte: string, obligatoire = false) => (
    <label htmlFor={pour} className="mb-1 block text-xs font-medium text-muted-foreground">
      {texte}
      {obligatoire && <span className="t-danger"> *</span>}
    </label>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Truck className="w-5 h-5 t-success" />}
        title={`Fournisseurs (${suppliers.length})`}
        subtitle="Qui vous livre, à quelles conditions, et ce que vous leur avez acheté."
        actions={
          peutCreer ? (
            <button onClick={ouvrirCreation} className="app-btn-primary w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Nouveau fournisseur
            </button>
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

      {formulaireOuvert && (
        <div className="app-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-foreground">
              {enEdition ? `Modifier ${enEdition.nom}` : "Nouveau fournisseur"}
            </h3>
            <button
              type="button"
              onClick={fermerFormulaire}
              className="app-btn-icon h-8 w-8"
              aria-label="Fermer le formulaire"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {erreur && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
            >
              {erreur}
            </p>
          )}

          <form onSubmit={enregistrer} className="space-y-5">
            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identité
              </legend>
              <div>
                {etiquette("fo-nom", "Nom du fournisseur", true)}
                <input id="fo-nom" type="text" required className="app-field" {...champ("nom")} />
              </div>
              <div>
                {etiquette("fo-entreprise", "Entreprise")}
                <input
                  id="fo-entreprise"
                  type="text"
                  className="app-field"
                  {...champ("entreprise")}
                />
              </div>
              <div>
                {etiquette("fo-categorie", "Catégorie")}
                <input
                  id="fo-categorie"
                  type="text"
                  placeholder="Alimentaire, quincaillerie…"
                  className="app-field"
                  {...champ("categorie")}
                />
              </div>
              <div>
                {etiquette("fo-nif", "Numéro fiscal")}
                <input id="fo-nif" type="text" className="app-field" {...champ("numero_fiscal")} />
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </legend>
              <div>
                {etiquette("fo-contact", "Personne à joindre")}
                <input
                  id="fo-contact"
                  type="text"
                  className="app-field"
                  {...champ("contact_principal")}
                />
              </div>
              <div>
                {etiquette("fo-tel", "Téléphone")}
                <input
                  id="fo-tel"
                  type="tel"
                  autoComplete="tel"
                  className="app-field"
                  {...champ("telephone")}
                />
              </div>
              <div>
                {etiquette("fo-email", "E-mail")}
                <input
                  id="fo-email"
                  type="email"
                  autoComplete="email"
                  className="app-field"
                  {...champ("email")}
                />
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adresse
              </legend>
              <div className="sm:col-span-2">
                {etiquette("fo-adresse", "Adresse")}
                <input id="fo-adresse" type="text" className="app-field" {...champ("adresse")} />
              </div>
              <div>
                {etiquette("fo-ville", "Ville")}
                <input id="fo-ville" type="text" className="app-field" {...champ("ville")} />
              </div>
              <div>
                {etiquette("fo-pays", "Pays")}
                <input id="fo-pays" type="text" className="app-field" {...champ("pays")} />
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conditions
              </legend>
              <div>
                {etiquette("fo-paiement", "Conditions de paiement")}
                <input
                  id="fo-paiement"
                  type="text"
                  placeholder="Comptant, 30 jours…"
                  className="app-field"
                  {...champ("conditions_paiement")}
                />
              </div>
              <div>
                {etiquette("fo-delai", "Délai de livraison (jours)")}
                <input
                  id="fo-delai"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="app-field"
                  {...champ("delai_livraison_jours")}
                />
              </div>
              <div>
                {etiquette("fo-statut", "Statut")}
                <select id="fo-statut" className="app-field" {...champ("statut")}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                {etiquette("fo-note", "Note")}
                <textarea
                  id="fo-note"
                  rows={2}
                  className="app-field resize-none"
                  {...champ("note")}
                />
              </div>
            </fieldset>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={fermerFormulaire} className="app-btn-secondary">
                Annuler
              </button>
              <button type="submit" disabled={enregistrement} className="app-btn-primary">
                {enregistrement
                  ? "Enregistrement…"
                  : enEdition
                    ? "Enregistrer les modifications"
                    : "Créer le fournisseur"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── La liste ── */}
        <div className={`space-y-4 ${selection ? "lg:col-span-1" : "lg:col-span-3"}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="fo-recherche" className="sr-only">
              Rechercher un fournisseur
            </label>
            <input
              id="fo-recherche"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, entreprise, catégorie, ville…"
              className="app-field pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["tous", `Tous (${suppliers.length})`],
                ["actifs", "Actifs"],
                ["inactifs", "Inactifs"],
              ] as const
            ).map(([valeur, libelle]) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setFiltre(valeur)}
                aria-pressed={filtre === valeur}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filtre === valeur
                    ? "border-success-border bg-success-soft t-success"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {libelle}
              </button>
            ))}
          </div>

          {listeFiltree.length === 0 ? (
            <div className="app-card p-10 text-center text-muted-foreground">
              <Truck className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">
                {suppliers.length === 0
                  ? "Aucun fournisseur enregistré pour l'instant."
                  : "Aucun fournisseur ne correspond à cette recherche."}
              </p>
              {suppliers.length === 0 && peutCreer && (
                <button onClick={ouvrirCreation} className="app-btn-secondary mt-4">
                  <Plus className="h-4 w-4" />
                  Ajouter le premier fournisseur
                </button>
              )}
            </div>
          ) : (
            <div className="app-card overflow-hidden">
              <div className="app-list">
                {listeFiltree.map((fournisseur) => {
                  const compte = comptes[fournisseur.id] ?? compteVide;
                  const choisi = selection?.id === fournisseur.id;
                  const secondaire = [
                    fournisseur.categorie,
                    fournisseur.telephone,
                    fournisseur.ville,
                    compte.achats > 0
                      ? `${compte.achats} achat${compte.achats > 1 ? "s" : ""}`
                      : null,
                    compte.produits > 0
                      ? `${compte.produits} produit${compte.produits > 1 ? "s" : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <button
                      key={fournisseur.id}
                      type="button"
                      onClick={() => {
                        setSelection(choisi ? null : fournisseur);
                        setSuppressionDemandee(false);
                      }}
                      aria-pressed={choisi}
                      className={`app-list-row w-full justify-between gap-3 text-left ${
                        choisi ? "bg-muted" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block">
                          {fournisseur.nom}
                          {(fournisseur.statut ?? "actif") === "inactif" && (
                            <span className="app-badge app-badge-neutral ml-2">Inactif</span>
                          )}
                        </span>
                        {secondaire && (
                          <span className="app-list-secondary block">{secondaire}</span>
                        )}
                      </span>
                      <span className="app-list-amount shrink-0 tabular-nums">
                        {formatCurrency(compte.total)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── La fiche ── */}
        {selection && (
          <div className="space-y-4 lg:col-span-2">
            <div className="app-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-foreground">{selection.nom}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {selection.categorie && (
                      <span className="app-badge app-badge-info">{selection.categorie}</span>
                    )}
                    <span
                      className={`app-badge ${
                        (selection.statut ?? "actif") === "actif"
                          ? "app-badge-success"
                          : "app-badge-neutral"
                      }`}
                    >
                      {(selection.statut ?? "actif") === "actif" ? "Actif" : "Inactif"}
                    </span>
                    {selection.numero_fiscal && (
                      <span className="text-[11px] text-muted-foreground">
                        NIF/STAT {selection.numero_fiscal}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {peutModifier && (
                    <button
                      type="button"
                      onClick={() => ouvrirEdition(selection)}
                      className="app-btn-icon h-9 w-9"
                      aria-label={`Modifier ${selection.nom}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {peutSupprimer && (
                    <button
                      type="button"
                      onClick={() => setSuppressionDemandee(true)}
                      className="app-btn-icon h-9 w-9"
                      aria-label={`Supprimer ${selection.nom}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelection(null)}
                    className="app-btn-icon h-9 w-9"
                    aria-label="Fermer la fiche"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {suppressionDemandee && (
                <div className="mb-4 rounded-xl border border-danger-border bg-danger-soft p-4">
                  <p className="text-sm font-semibold t-danger">
                    Supprimer {selection.nom} définitivement ?
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Les {compteSelection.achats} achat
                    {compteSelection.achats > 1 ? "s" : ""} déjà enregistré
                    {compteSelection.achats > 1 ? "s" : ""} restent intacts, mais ne seront plus
                    rattachés à cette fiche.
                  </p>
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setSuppressionDemandee(false)}
                      className="app-btn-secondary"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={supprimer}
                      disabled={enregistrement}
                      className="app-btn-danger"
                    >
                      {enregistrement ? "Suppression…" : "Oui, supprimer"}
                    </button>
                  </div>
                </div>
              )}

              {(selection.entreprise ||
                selection.contact_principal ||
                selection.telephone ||
                selection.email ||
                selection.ville) && (
                <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {selection.entreprise && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {selection.entreprise}
                    </span>
                  )}
                  {selection.contact_principal && (
                    <span className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {selection.contact_principal}
                    </span>
                  )}
                  {selection.telephone && (
                    <a
                      href={`tel:${selection.telephone.replace(/\s/g, "")}`}
                      className="-my-1 flex items-center gap-1.5 py-1 hover:text-foreground"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {selection.telephone}
                    </a>
                  )}
                  {selection.email && (
                    <a
                      href={`mailto:${selection.email}`}
                      className="-my-1 flex items-center gap-1.5 py-1 hover:text-foreground"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {selection.email}
                    </a>
                  )}
                  {(selection.adresse || selection.ville || selection.pays) && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {[selection.adresse, selection.ville, selection.pays]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Chiffre libelle="Achats" valeur={String(compteSelection.achats)} />
                <Chiffre libelle="Total acheté" valeur={formatCurrency(compteSelection.total)} />
                <Chiffre libelle="Produits fournis" valeur={String(compteSelection.produits)} />
                <Chiffre
                  libelle="Dernier achat"
                  valeur={
                    compteSelection.dernier
                      ? new Date(compteSelection.dernier).toLocaleDateString("fr-FR")
                      : "—"
                  }
                />
              </div>

              {(selection.conditions_paiement || selection.delai_livraison_jours !== null) && (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {selection.conditions_paiement && (
                    <span className="flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Paiement : {selection.conditions_paiement}
                    </span>
                  )}
                  {selection.delai_livraison_jours !== null && (
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Livraison sous {selection.delai_livraison_jours} jour
                      {selection.delai_livraison_jours > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Produits fournis ── */}
            {produitsDuFournisseur.length > 0 && (
              <div className="app-card p-5">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Package className="h-4 w-4 t-info" aria-hidden="true" />
                  Produits fournis ({produitsDuFournisseur.length})
                </h4>
                {/* Les étiquettes passent à la ligne plutôt que de
                    déborder : rien ne doit sortir de l'écran. */}
                <div className="flex flex-wrap gap-2">
                  {produitsDuFournisseur.map((nom) => (
                    <span
                      key={nom}
                      className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                    >
                      {nom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Achats ── */}
            <div className="app-card p-5">
              <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
                <ShoppingCart className="h-4 w-4 t-success" aria-hidden="true" />
                Achats ({achatsDuFournisseur.length})
              </h4>
              <p className="mb-4 text-xs text-muted-foreground">
                Un achat sort intégralement de la caisse à son enregistrement : la base ne suit pas
                encore de paiement fournisseur, il n&apos;y a donc pas de dette à afficher.
              </p>
              {achatsDuFournisseur.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun achat enregistré auprès de ce fournisseur.
                </p>
              ) : (
                <div className="app-list">
                  {achatsDuFournisseur.map((achat) => (
                    <div key={achat.id} className="app-list-row justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block font-mono">{achat.numero}</span>
                        <span className="app-list-secondary block">
                          {new Date(achat.date).toLocaleDateString("fr-FR")} · {achat.designation} ·{" "}
                          {achat.quantite} × {formatCurrency(achat.prixAchatUnit)}
                        </span>
                      </span>
                      <span className="app-list-amount shrink-0 tabular-nums">
                        {formatCurrency(achat.totalAchat)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selection.note && (
              <div className="app-card p-4">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Note</p>
                <p className="text-sm text-foreground">{selection.note}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
