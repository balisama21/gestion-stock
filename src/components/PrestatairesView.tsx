import React, { useMemo, useState } from "react";
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { formatCurrency } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { ChampsPersoLecture, ChampsPersoSaisie } from "./shared/ChampsPersonnalises";
import {
  champObligatoireManquant,
  lireValeurs,
  type ChampPerso,
  type ValeursPerso,
} from "../lib/champsPersonnalises";
import type { Database } from "../lib/database.types";

type Provider = Database["public"]["Tables"]["providers"]["Row"];
type ProviderInsert = Database["public"]["Tables"]["providers"]["Insert"];
type ProviderService = Database["public"]["Tables"]["provider_services"]["Row"];
type ProviderServiceInsert = Database["public"]["Tables"]["provider_services"]["Insert"];

interface PrestatairesViewProps {
  providers: Provider[];
  providerServices: ProviderService[];
  onAddProvider: (
    data: Omit<ProviderInsert, "store_id" | "created_by">,
  ) => Promise<{ provider: Provider | null; error: string | null }>;
  onUpdateProvider: (
    id: string,
    data: Database["public"]["Tables"]["providers"]["Update"],
  ) => Promise<{ error: string | null }>;
  onDeleteProvider: (id: string) => Promise<{ error: string | null }>;
  onAddService: (
    providerId: string,
    data: Omit<ProviderServiceInsert, "store_id" | "created_by" | "provider_id">,
  ) => Promise<{ error: string | null }>;
  onDeleteService: (id: string) => Promise<{ error: string | null }>;
  /** Les champs que la boutique a ajoutés elle-même à cette fiche. */
  champsPersonnalises: ChampPerso[];
  peutCreer?: boolean;
  peutModifier?: boolean;
  peutSupprimer?: boolean;
}

/**
 * Des exemples, pas une liste fermée : le champ reste libre. Un
 * commerçant fait appel à des métiers qu'aucune liste ne prévoit.
 */
const TYPES_SUGGERES = [
  "Transporteur",
  "Livreur",
  "Imprimeur",
  "Réparateur",
  "Consultant",
  "Technicien",
];

const FORMULAIRE_VIDE = {
  nom: "",
  entreprise: "",
  type_service: "",
  contact: "",
  telephone: "",
  email: "",
  adresse: "",
  ville: "",
  pays: "",
  tarif_base: "",
  tarif_unite: "",
  conditions: "",
  statut: "actif",
  note: "",
};

const versBase = (f: typeof FORMULAIRE_VIDE) => {
  const vide = (v: string) => (v.trim() === "" ? null : v.trim());
  const tarif = f.tarif_base.trim();
  return {
    nom: f.nom.trim(),
    entreprise: vide(f.entreprise),
    type_service: vide(f.type_service),
    contact: vide(f.contact),
    telephone: vide(f.telephone),
    email: vide(f.email),
    adresse: vide(f.adresse),
    ville: vide(f.ville),
    pays: vide(f.pays),
    tarif_base: tarif === "" ? null : Number(tarif),
    tarif_unite: vide(f.tarif_unite),
    conditions: vide(f.conditions),
    statut: f.statut,
    note: vide(f.note),
  };
};

const depuisPrestataire = (p: Provider) => ({
  nom: p.nom ?? "",
  entreprise: p.entreprise ?? "",
  type_service: p.type_service ?? "",
  contact: p.contact ?? "",
  telephone: p.telephone ?? "",
  email: p.email ?? "",
  adresse: p.adresse ?? "",
  ville: p.ville ?? "",
  pays: p.pays ?? "",
  tarif_base: p.tarif_base === null || p.tarif_base === undefined ? "" : String(p.tarif_base),
  tarif_unite: p.tarif_unite ?? "",
  conditions: p.conditions ?? "",
  statut: p.statut ?? "actif",
  note: p.note ?? "",
});

/**
 * Les prestataires.
 *
 * Un prestataire n'est pas un fournisseur : il ne livre pas de stock, il
 * rend un service — une tournée, une impression, une réparation. Rien
 * de ce qu'il facture ne passe donc par les achats, et sa fiche ne
 * montre ni marchandise ni entrée en stock.
 *
 * Ce que l'écran ne montre pas encore : l'argent versé au prestataire.
 * Une dépense n'a en base aucun lien vers lui — ni colonne, ni nom. Le
 * rattachement suppose de toucher au formulaire de dépense, c'est-à-dire
 * au chemin de l'argent, ce qui relève de l'étape des Dépenses. D'ici
 * là, la fiche dit ce qu'elle sait : qui il est, ce qu'il fait, et à
 * quel tarif.
 */
export const PrestatairesView: React.FC<PrestatairesViewProps> = ({
  providers,
  providerServices,
  onAddProvider,
  onUpdateProvider,
  onDeleteProvider,
  onAddService,
  onDeleteService,
  champsPersonnalises,
  peutCreer = true,
  peutModifier = true,
  peutSupprimer = true,
}) => {
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "actifs" | "inactifs">("tous");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Provider | null>(null);
  const [selection, setSelection] = useState<Provider | null>(null);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [suppressionDemandee, setSuppressionDemandee] = useState(false);
  const [valeursPerso, setValeursPerso] = useState<ValeursPerso>({});

  // Ajout d'une prestation, directement dans la fiche.
  const [prestation, setPrestation] = useState({ libelle: "", tarif: "", unite: "" });
  const [ajoutPrestation, setAjoutPrestation] = useState(false);

  const servicesParPrestataire = useMemo(() => {
    const table: Record<string, ProviderService[]> = {};
    for (const s of providerServices) {
      const liste = table[s.provider_id];
      if (liste) liste.push(s);
      else table[s.provider_id] = [s];
    }
    return table;
  }, [providerServices]);

  const listeFiltree = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providers.filter((p) => {
      if (filtre === "actifs" && (p.statut ?? "actif") !== "actif") return false;
      if (filtre === "inactifs" && (p.statut ?? "actif") !== "inactif") return false;
      if (!q) return true;
      return [p.nom, p.entreprise, p.type_service, p.contact, p.telephone, p.email, p.ville]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [providers, filtre, search]);

  /* ── Actions ─────────────────────────────────────────────── */

  const ouvrirCreation = () => {
    setEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setValeursPerso({});
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (p: Provider) => {
    setEnEdition(p);
    setFormulaire(depuisPrestataire(p));
    setValeursPerso(lireValeurs(p.champs_perso));
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
    // La base ne valide pas le contenu du JSON — c'est le prix du
    // stockage en colonne libre, assumé dans la migration. Un champ
    // obligatoire se vérifie donc ici, à la saisie.
    const manquant = champObligatoireManquant(champsPersonnalises, "prestataire", valeursPerso);
    if (manquant) {
      setErreur(`« ${manquant.libelle} » est obligatoire.`);
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    const donnees = { ...versBase(formulaire), champs_perso: valeursPerso };

    if (enEdition) {
      const { error } = await onUpdateProvider(enEdition.id, donnees);
      setEnregistrement(false);
      if (error) {
        setErreur(error);
        return;
      }
      if (selection?.id === enEdition.id) setSelection({ ...selection, ...donnees });
      annoncer(`${donnees.nom} a été mis à jour.`);
    } else {
      const { error } = await onAddProvider(donnees);
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
    const { error } = await onDeleteProvider(selection.id);
    setEnregistrement(false);
    setSuppressionDemandee(false);
    if (error) {
      setErreur(error);
      return;
    }
    annoncer(`${selection.nom} a été supprimé.`);
    setSelection(null);
  };

  const ajouterPrestation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selection || !prestation.libelle.trim()) return;
    setAjoutPrestation(true);
    const { error } = await onAddService(selection.id, {
      libelle: prestation.libelle.trim(),
      tarif: prestation.tarif.trim() === "" ? null : Number(prestation.tarif),
      unite: prestation.unite.trim() === "" ? null : prestation.unite.trim(),
    });
    setAjoutPrestation(false);
    if (error) {
      setErreur(error);
      return;
    }
    setPrestation({ libelle: "", tarif: "", unite: "" });
  };

  const servicesDuPrestataire = selection ? (servicesParPrestataire[selection.id] ?? []) : [];

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
        icon={<Wrench className="w-5 h-5 t-success" />}
        title={`Prestataires (${providers.length})`}
        subtitle="Transport, livraison, impression, réparation — ceux qui rendent un service, pas ceux qui livrent du stock."
        actions={
          peutCreer ? (
            <button onClick={ouvrirCreation} className="app-btn-primary w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Nouveau prestataire
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
              {enEdition ? `Modifier ${enEdition.nom}` : "Nouveau prestataire"}
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
            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identité
              </legend>
              <div>
                {etiquette("pr-nom", "Nom", true)}
                <input id="pr-nom" type="text" required className="app-field" {...champ("nom")} />
              </div>
              <div>
                {etiquette("pr-entreprise", "Entreprise")}
                <input
                  id="pr-entreprise"
                  type="text"
                  className="app-field"
                  {...champ("entreprise")}
                />
              </div>
              <div>
                {etiquette("pr-type", "Type de service")}
                {/* Une liste de suggestions, pas un choix imposé : le
                    champ reste libre pour les métiers qu'on n'a pas prévus. */}
                <input
                  id="pr-type"
                  type="text"
                  list="pr-types-suggeres"
                  placeholder="Transporteur, imprimeur…"
                  className="app-field"
                  {...champ("type_service")}
                />
                <datalist id="pr-types-suggeres">
                  {TYPES_SUGGERES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </legend>
              <div>
                {etiquette("pr-contact", "Personne à joindre")}
                <input id="pr-contact" type="text" className="app-field" {...champ("contact")} />
              </div>
              <div>
                {etiquette("pr-tel", "Téléphone")}
                <input
                  id="pr-tel"
                  type="tel"
                  autoComplete="tel"
                  className="app-field"
                  {...champ("telephone")}
                />
              </div>
              <div>
                {etiquette("pr-email", "E-mail")}
                <input
                  id="pr-email"
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
                {etiquette("pr-adresse", "Adresse")}
                <input id="pr-adresse" type="text" className="app-field" {...champ("adresse")} />
              </div>
              <div>
                {etiquette("pr-ville", "Ville")}
                <input id="pr-ville" type="text" className="app-field" {...champ("ville")} />
              </div>
              <div>
                {etiquette("pr-pays", "Pays")}
                <input id="pr-pays" type="text" className="app-field" {...champ("pays")} />
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tarif de référence
              </legend>
              <div>
                {etiquette("pr-tarif", "Montant")}
                <input
                  id="pr-tarif"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  className="app-field"
                  {...champ("tarif_base")}
                />
              </div>
              <div>
                {etiquette("pr-unite", "Par")}
                <input
                  id="pr-unite"
                  type="text"
                  placeholder="course, jour, page…"
                  className="app-field"
                  {...champ("tarif_unite")}
                />
              </div>
              <div>
                {etiquette("pr-statut", "Statut")}
                <select id="pr-statut" className="app-field" {...champ("statut")}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>
              <div>
                {etiquette("pr-conditions", "Conditions")}
                <input
                  id="pr-conditions"
                  type="text"
                  className="app-field"
                  {...champ("conditions")}
                />
              </div>
              <div className="sm:col-span-4">
                {etiquette("pr-note", "Note")}
                <textarea
                  id="pr-note"
                  rows={2}
                  className="app-field resize-none"
                  {...champ("note")}
                />
              </div>
            </fieldset>

            <ChampsPersoSaisie
              definitions={champsPersonnalises}
              entite="prestataire"
              valeurs={valeursPerso}
              onChange={setValeursPerso}
              prefixe="pr"
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={fermerFormulaire} className="app-btn-secondary">
                Annuler
              </button>
              <button type="submit" disabled={enregistrement} className="app-btn-primary">
                {enregistrement
                  ? "Enregistrement…"
                  : enEdition
                    ? "Enregistrer les modifications"
                    : "Créer le prestataire"}
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
            <label htmlFor="pr-recherche" className="sr-only">
              Rechercher un prestataire
            </label>
            <input
              id="pr-recherche"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, entreprise, type de service, ville…"
              className="app-field pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["tous", `Tous (${providers.length})`],
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
              <Wrench className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">
                {providers.length === 0
                  ? "Aucun prestataire enregistré pour l'instant."
                  : "Aucun prestataire ne correspond à cette recherche."}
              </p>
              {providers.length === 0 && peutCreer && (
                <button onClick={ouvrirCreation} className="app-btn-secondary mt-4">
                  <Plus className="h-4 w-4" />
                  Ajouter le premier prestataire
                </button>
              )}
            </div>
          ) : (
            <div className="app-card overflow-hidden">
              <div className="app-list">
                {listeFiltree.map((p) => {
                  const choisi = selection?.id === p.id;
                  const nbServices = (servicesParPrestataire[p.id] ?? []).length;
                  const secondaire = [
                    p.type_service,
                    p.telephone,
                    p.ville,
                    nbServices > 0 ? `${nbServices} prestation${nbServices > 1 ? "s" : ""}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelection(choisi ? null : p);
                        setSuppressionDemandee(false);
                        setPrestation({ libelle: "", tarif: "", unite: "" });
                      }}
                      aria-pressed={choisi}
                      className={`app-list-row w-full justify-between gap-3 text-left ${
                        choisi ? "bg-muted" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block">
                          {p.nom}
                          {/* L'espace est explicite : sans lui, un lecteur
                              d'écran annonce « Rado RéparationInactif ». */}
                          {(p.statut ?? "actif") === "inactif" && " "}
                          {(p.statut ?? "actif") === "inactif" && (
                            <span className="app-badge app-badge-neutral ml-2">Inactif</span>
                          )}
                        </span>
                        {secondaire && (
                          <span className="app-list-secondary block">{secondaire}</span>
                        )}
                      </span>
                      {p.tarif_base !== null && (
                        <span className="shrink-0 text-right">
                          <span className="app-list-amount block tabular-nums">
                            {formatCurrency(p.tarif_base)}
                          </span>
                          {p.tarif_unite && (
                            <span className="app-list-secondary block">par {p.tarif_unite}</span>
                          )}
                        </span>
                      )}
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
                    {selection.type_service && (
                      <span className="app-badge app-badge-info">{selection.type_service}</span>
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
                    {selection.tarif_base !== null && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatCurrency(selection.tarif_base)}
                        {selection.tarif_unite ? ` par ${selection.tarif_unite}` : ""}
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
                    Ses {servicesDuPrestataire.length} prestation
                    {servicesDuPrestataire.length > 1 ? "s" : ""} seront supprimée
                    {servicesDuPrestataire.length > 1 ? "s" : ""} avec lui.
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
                selection.contact ||
                selection.telephone ||
                selection.email ||
                selection.ville) && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {selection.entreprise && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {selection.entreprise}
                    </span>
                  )}
                  {selection.contact && (
                    <span className="flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {selection.contact}
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

              {selection.conditions && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Conditions : {selection.conditions}
                </p>
              )}
            </div>

            {/* ── Prestations ── */}
            <div className="app-card p-5">
              <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
                <Wrench className="h-4 w-4 t-info" aria-hidden="true" />
                Prestations ({servicesDuPrestataire.length})
              </h4>
              <p className="mb-4 text-xs text-muted-foreground">
                Ce que ce prestataire sait faire, et à quel prix. L&apos;argent qui lui est versé
                passe par les dépenses ; le lien entre les deux viendra avec cet écran-là.
              </p>

              {servicesDuPrestataire.length > 0 && (
                <div className="app-list mb-4">
                  {servicesDuPrestataire.map((service) => (
                    <div key={service.id} className="app-list-row justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block">{service.libelle}</span>
                        {service.note && (
                          <span className="app-list-secondary block">{service.note}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {service.tarif !== null && (
                          <span className="app-list-amount tabular-nums">
                            {formatCurrency(service.tarif)}
                            {service.unite ? ` / ${service.unite}` : ""}
                          </span>
                        )}
                        {peutModifier && (
                          <button
                            type="button"
                            onClick={() => onDeleteService(service.id)}
                            className="app-btn-icon h-8 w-8"
                            aria-label={`Retirer la prestation ${service.libelle}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {peutModifier && (
                <form
                  onSubmit={ajouterPrestation}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_8rem_auto]"
                >
                  <div>
                    <label htmlFor="pr-s-libelle" className="sr-only">
                      Intitulé de la prestation
                    </label>
                    <input
                      id="pr-s-libelle"
                      type="text"
                      required
                      placeholder="Intitulé de la prestation"
                      className="app-field"
                      value={prestation.libelle}
                      onChange={(e) => setPrestation((p) => ({ ...p, libelle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="pr-s-tarif" className="sr-only">
                      Tarif
                    </label>
                    <input
                      id="pr-s-tarif"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      placeholder="Tarif"
                      className="app-field"
                      value={prestation.tarif}
                      onChange={(e) => setPrestation((p) => ({ ...p, tarif: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="pr-s-unite" className="sr-only">
                      Unité
                    </label>
                    <input
                      id="pr-s-unite"
                      type="text"
                      placeholder="Par…"
                      className="app-field"
                      value={prestation.unite}
                      onChange={(e) => setPrestation((p) => ({ ...p, unite: e.target.value }))}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={ajoutPrestation || !prestation.libelle.trim()}
                    className="app-btn-secondary"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                </form>
              )}
            </div>

            <ChampsPersoLecture
              definitions={champsPersonnalises}
              entite="prestataire"
              valeurs={lireValeurs(selection.champs_perso)}
            />

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
