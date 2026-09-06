import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Check,
  Clock,
  CreditCard,
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { formatCurrency } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import type { Sale, Payment } from "../types";
import type { Database } from "../lib/database.types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Client | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};

interface ClientsViewProps {
  clients: Client[];
  orders: Order[];
  /** Les ventes servent aux ventes à crédit rattachées à un client. */
  sales: Sale[];
  payments: Payment[];
  onAddClient: (
    data: Omit<ClientInsert, "store_id" | "created_by">,
  ) => Promise<{ client: Client | null; error: string | null }>;
  onUpdateClient: (
    id: string,
    data: Database["public"]["Tables"]["clients"]["Update"],
  ) => Promise<{ error: string | null }>;
  onDeleteClient: (id: string) => Promise<{ error: string | null }>;
  onNavigateToOrders?: (clientId: string) => void;
}

/* ─────────────────────────────────────────────────────────────
 * Libellés et pastilles
 * ───────────────────────────────────────────────────────────── */

const TYPES_CLIENT = [
  { valeur: "particulier", libelle: "Particulier" },
  { valeur: "entreprise", libelle: "Entreprise" },
  { valeur: "revendeur", libelle: "Revendeur" },
] as const;

const libelleType = (v: string | null) => TYPES_CLIENT.find((t) => t.valeur === v)?.libelle ?? null;

const LIBELLE_COMMANDE: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  livre: "Livré",
  annule: "Annulé",
};

const PASTILLE_COMMANDE: Record<string, string> = {
  en_attente: "app-badge-neutral",
  en_cours: "app-badge-info",
  livre: "app-badge-success",
  annule: "app-badge-danger",
};

/**
 * L'état de paiement, dit par une icône ET un mot.
 *
 * Il était écrit avec des émojis — ✅ ⚠️ 🔴. Un émoji dépend de la
 * police du système : il ne se colore pas comme le reste, change d'un
 * téléphone à l'autre, et ne se pilote par aucun jeton. Une icône
 * vectorielle accompagnée du mot dit la même chose partout, et reste
 * lisible pour qui ne distingue pas le rouge du vert.
 */
const PastillePaiement: React.FC<{ statut: string; reste: number }> = ({ statut, reste }) => {
  if (statut === "paye") {
    return (
      <span className="app-badge app-badge-success">
        <Check className="h-3 w-3" aria-hidden="true" />
        Payé
      </span>
    );
  }
  if (statut === "partiel") {
    return (
      <span className="app-badge app-badge-warning">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Reste {formatCurrency(reste)}
      </span>
    );
  }
  return (
    <span className="app-badge app-badge-danger">
      <AlertCircle className="h-3 w-3" aria-hidden="true" />
      Impayé
    </span>
  );
};

/** Un chiffre du bandeau de synthèse. */
const Chiffre: React.FC<{ libelle: string; valeur: string; teinte?: string }> = ({
  libelle,
  valeur,
  teinte = "text-foreground",
}) => (
  <div className="rounded-xl bg-muted p-3 text-center">
    <div className={`font-mono text-base font-bold tabular-nums ${teinte}`}>{valeur}</div>
    <div className="mt-0.5 text-[11px] text-muted-foreground">{libelle}</div>
  </div>
);

const FORMULAIRE_VIDE = {
  nom: "",
  prenom: "",
  entreprise: "",
  telephone: "",
  email: "",
  adresse: "",
  ville: "",
  pays: "",
  type_client: "",
  statut: "actif",
  note: "",
};

/** Ce qui va en base : les chaînes vides deviennent des nuls. */
const versBase = (f: typeof FORMULAIRE_VIDE) => {
  const vide = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    nom: f.nom.trim(),
    prenom: vide(f.prenom),
    entreprise: vide(f.entreprise),
    telephone: vide(f.telephone),
    email: vide(f.email),
    adresse: vide(f.adresse),
    ville: vide(f.ville),
    pays: vide(f.pays),
    type_client: vide(f.type_client),
    statut: f.statut,
    note: vide(f.note),
  };
};

const depuisClient = (c: Client) => ({
  nom: c.nom ?? "",
  prenom: c.prenom ?? "",
  entreprise: c.entreprise ?? "",
  telephone: c.telephone ?? "",
  email: c.email ?? "",
  adresse: c.adresse ?? "",
  ville: c.ville ?? "",
  pays: c.pays ?? "",
  type_client: c.type_client ?? "",
  statut: c.statut ?? "actif",
  note: c.note ?? "",
});

/* ─────────────────────────────────────────────────────────────
 * L'écran
 * ───────────────────────────────────────────────────────────── */

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  orders,
  sales,
  payments,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onNavigateToOrders,
}) => {
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "actifs" | "inactifs" | "impayes">("tous");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Client | null>(null);
  const [selection, setSelection] = useState<Client | null>(null);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [suppressionDemandee, setSuppressionDemandee] = useState(false);

  /**
   * Les ventes à crédit ne portent pas encore de clé vers le client :
   * `sales.client_id` existe en base mais n'est jamais renseigné, le nom
   * est saisi à la main dans `client_credit`. On rapproche donc par le
   * nom, à la casse près — comme la reprise des fournisseurs. Le jour où
   * la vente enregistrera la clé, `clientId` prendra le dessus sans que
   * cet écran change.
   */
  const ventesParClient = useMemo(() => {
    const parNom = new Map<string, Sale[]>();
    for (const v of sales) {
      const cle = (v.clientCredit ?? "").trim().toLowerCase();
      if (!cle) continue;
      const liste = parNom.get(cle);
      if (liste) liste.push(v);
      else parNom.set(cle, [v]);
    }
    const parClient: Record<string, Sale[]> = {};
    for (const c of clients) {
      const parId = sales.filter((v) => v.clientId === c.id);
      const parLeNom = parNom.get(c.nom.trim().toLowerCase()) ?? [];
      const fusion = [...parId];
      for (const v of parLeNom) if (!fusion.some((x) => x.id === v.id)) fusion.push(v);
      parClient[c.id] = fusion;
    }
    return parClient;
  }, [clients, sales]);

  /**
   * Le compte de chaque client.
   *
   * Les commandes annulées sortent du reste dû — c'est déjà la règle de
   * l'écran « Paiements à recevoir », et deux écrans qui annoncent une
   * dette différente pour le même client seraient pires que pas de
   * chiffre du tout.
   */
  const comptes = useMemo(() => {
    const table: Record<
      string,
      {
        commandes: number;
        ventesCredit: number;
        totalAchete: number;
        totalPaye: number;
        resteDu: number;
        rembourse: number;
        enCours: number;
      }
    > = {};
    for (const c of clients) {
      const sesCommandes = orders.filter((o) => o.client_id === c.id);
      const sesVentes = ventesParClient[c.id] ?? [];
      table[c.id] = {
        commandes: sesCommandes.length,
        ventesCredit: sesVentes.length,
        totalAchete:
          sesCommandes.reduce((s, o) => s + o.montant_total, 0) +
          sesVentes.reduce((s, v) => s + v.totalVente, 0),
        totalPaye:
          sesCommandes.reduce((s, o) => s + o.montant_paye, 0) +
          sesVentes.reduce((s, v) => s + v.montantPaye, 0),
        resteDu:
          sesCommandes
            .filter((o) => o.statut_commande !== "annule")
            .reduce((s, o) => s + (o.reste_a_payer ?? 0), 0) +
          sesVentes.reduce((s, v) => s + v.soldeDu, 0),
        rembourse:
          sesCommandes.reduce((s, o) => s + (o.montant_rembourse ?? 0), 0) +
          sesVentes.reduce((s, v) => s + v.montantRembourse, 0),
        enCours: sesCommandes.filter(
          (o) => o.statut_commande === "en_cours" || o.statut_commande === "en_attente",
        ).length,
      };
    }
    return table;
  }, [clients, orders, ventesParClient]);

  const compteVide = {
    commandes: 0,
    ventesCredit: 0,
    totalAchete: 0,
    totalPaye: 0,
    resteDu: 0,
    rembourse: 0,
    enCours: 0,
  };

  const listeFiltree = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      const compte = comptes[c.id] ?? compteVide;
      if (filtre === "actifs" && (c.statut ?? "actif") !== "actif") return false;
      if (filtre === "inactifs" && (c.statut ?? "actif") !== "inactif") return false;
      if (filtre === "impayes" && compte.resteDu <= 0) return false;
      if (!q) return true;
      return [c.nom, c.prenom, c.entreprise, c.telephone, c.email, c.ville]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
    // `compteVide` est une constante littérale, pas une dépendance utile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, comptes, filtre, search]);

  /* ── Actions ─────────────────────────────────────────────── */

  const ouvrirCreation = () => {
    setEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (c: Client) => {
    setEnEdition(c);
    setFormulaire(depuisClient(c));
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
      const { error } = await onUpdateClient(enEdition.id, donnees);
      setEnregistrement(false);
      if (error) {
        setErreur(error);
        return;
      }
      // La sélection affichée doit refléter tout de suite ce qu'on vient
      // d'écrire, sans attendre le prochain rafraîchissement des données.
      if (selection?.id === enEdition.id) setSelection({ ...selection, ...donnees });
      annoncer(`${donnees.nom} a été mis à jour.`);
    } else {
      const { error } = await onAddClient(donnees);
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
    const { error } = await onDeleteClient(selection.id);
    setEnregistrement(false);
    setSuppressionDemandee(false);
    if (error) {
      setErreur(error);
      return;
    }
    annoncer(`${selection.nom} a été supprimé.`);
    setSelection(null);
  };

  /* ── Détail du client sélectionné ────────────────────────── */

  const commandesDuClient = selection ? orders.filter((o) => o.client_id === selection.id) : [];
  const ventesDuClient = selection ? (ventesParClient[selection.id] ?? []) : [];
  const paiementsDuClient = selection
    ? payments
        .filter(
          (p) =>
            (p.orderId && commandesDuClient.some((o) => o.id === p.orderId)) ||
            (p.saleId && ventesDuClient.some((v) => v.id === p.saleId)),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const compteSelection = selection ? (comptes[selection.id] ?? compteVide) : compteVide;

  const champ = (cle: keyof typeof FORMULAIRE_VIDE) => ({
    value: formulaire[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormulaire((p) => ({ ...p, [cle]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<User className="w-5 h-5 t-success" />}
        title={`Clients (${clients.length})`}
        subtitle="Leur fiche, leurs commandes et ce qu'ils doivent encore."
        actions={
          <button onClick={ouvrirCreation} className="app-btn-primary w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Nouveau client
          </button>
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

      {/* ── Formulaire, en création comme en modification ── */}
      {formulaireOuvert && (
        <div className="app-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-foreground">
              {enEdition ? `Modifier ${enEdition.nom}` : "Nouveau client"}
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
                <label
                  htmlFor="cl-nom"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Nom <span className="t-danger">*</span>
                </label>
                <input id="cl-nom" type="text" required className="app-field" {...champ("nom")} />
              </div>
              <div>
                <label
                  htmlFor="cl-prenom"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Prénom
                </label>
                <input id="cl-prenom" type="text" className="app-field" {...champ("prenom")} />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="cl-entreprise"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Entreprise
                </label>
                <input
                  id="cl-entreprise"
                  type="text"
                  className="app-field"
                  {...champ("entreprise")}
                />
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </legend>
              <div>
                <label
                  htmlFor="cl-tel"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Téléphone
                </label>
                {/* `type=tel` fait apparaître le pavé numérique sur mobile. */}
                <input
                  id="cl-tel"
                  type="tel"
                  autoComplete="tel"
                  className="app-field"
                  {...champ("telephone")}
                />
              </div>
              <div>
                <label
                  htmlFor="cl-email"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  E-mail
                </label>
                <input
                  id="cl-email"
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
                <label
                  htmlFor="cl-adresse"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Adresse
                </label>
                <input id="cl-adresse" type="text" className="app-field" {...champ("adresse")} />
              </div>
              <div>
                <label
                  htmlFor="cl-ville"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Ville
                </label>
                <input id="cl-ville" type="text" className="app-field" {...champ("ville")} />
              </div>
              <div>
                <label
                  htmlFor="cl-pays"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Pays
                </label>
                <input id="cl-pays" type="text" className="app-field" {...champ("pays")} />
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Classement
              </legend>
              <div>
                <label
                  htmlFor="cl-type"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Type
                </label>
                <select id="cl-type" className="app-field" {...champ("type_client")}>
                  <option value="">Non précisé</option>
                  {TYPES_CLIENT.map((t) => (
                    <option key={t.valeur} value={t.valeur}>
                      {t.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="cl-statut"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Statut
                </label>
                <select id="cl-statut" className="app-field" {...champ("statut")}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="cl-note"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Note
                </label>
                <textarea
                  id="cl-note"
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
                    : "Créer le client"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Colonne de gauche : la liste ── */}
        <div className={`space-y-4 ${selection ? "lg:col-span-1" : "lg:col-span-3"}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="cl-recherche" className="sr-only">
              Rechercher un client
            </label>
            <input
              id="cl-recherche"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, entreprise, téléphone, ville…"
              className="app-field pl-10"
            />
          </div>

          {/* Les filtres restent sur une ligne qui passe à la ligne
              plutôt que de défiler : rien ne doit sortir de l'écran. */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["tous", `Tous (${clients.length})`],
                ["actifs", "Actifs"],
                ["inactifs", "Inactifs"],
                ["impayes", "Avec impayé"],
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
              <User className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">
                {clients.length === 0
                  ? "Aucun client enregistré pour l'instant."
                  : "Aucun client ne correspond à cette recherche."}
              </p>
              {clients.length === 0 && (
                <button onClick={ouvrirCreation} className="app-btn-secondary mt-4">
                  <Plus className="h-4 w-4" />
                  Ajouter le premier client
                </button>
              )}
            </div>
          ) : (
            <div className="app-card overflow-hidden">
              {/* Liste dense — le clic SÉLECTIONNE le client pour le
                  panneau de droite, il n'ouvre pas une modale : c'est un
                  écran maître-détail, pas un journal. */}
              <div className="app-list">
                {listeFiltree.map((client) => {
                  const compte = comptes[client.id] ?? compteVide;
                  const choisi = selection?.id === client.id;
                  const secondaire = [
                    client.entreprise,
                    client.telephone,
                    client.ville,
                    compte.commandes > 0
                      ? `${compte.commandes} commande${compte.commandes > 1 ? "s" : ""}`
                      : null,
                    compte.ventesCredit > 0 ? `${compte.ventesCredit} à crédit` : null,
                    compte.enCours > 0 ? `${compte.enCours} en cours` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelection(choisi ? null : client);
                        setSuppressionDemandee(false);
                      }}
                      aria-pressed={choisi}
                      className={`app-list-row w-full justify-between gap-3 text-left ${
                        choisi ? "bg-muted" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block">
                          {client.nom}
                          {client.prenom ? ` ${client.prenom}` : ""}
                          {/* L'espace est explicite : sans lui, un lecteur
                              d'écran annonce « AndrianinaInactif ». */}
                          {(client.statut ?? "actif") === "inactif" && " "}
                          {(client.statut ?? "actif") === "inactif" && (
                            <span className="app-badge app-badge-neutral ml-2">Inactif</span>
                          )}
                        </span>
                        {secondaire && (
                          <span className="app-list-secondary block">{secondaire}</span>
                        )}
                      </span>

                      <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <span className="text-right">
                          <span className="app-list-amount block tabular-nums">
                            {formatCurrency(compte.totalAchete)}
                          </span>
                          {compte.resteDu > 0 && (
                            <span className="app-list-secondary block tabular-nums t-danger">
                              {formatCurrency(compte.resteDu)} dû
                            </span>
                          )}
                        </span>
                        {compte.resteDu > 0 && (
                          <span className="app-badge app-badge-danger shrink-0">
                            <AlertCircle className="h-3 w-3" aria-hidden="true" />
                            Impayé
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne de droite : la fiche ── */}
        {selection && (
          <div className="space-y-4 lg:col-span-2">
            <div className="app-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-foreground">
                    {selection.nom}
                    {selection.prenom ? ` ${selection.prenom}` : ""}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {libelleType(selection.type_client) && (
                      <span className="app-badge app-badge-info">
                        {libelleType(selection.type_client)}
                      </span>
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
                    <span className="text-[11px] text-muted-foreground">
                      Client depuis le {new Date(selection.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => ouvrirEdition(selection)}
                    className="app-btn-icon h-9 w-9"
                    aria-label={`Modifier ${selection.nom}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuppressionDemandee(true)}
                    className="app-btn-icon h-9 w-9"
                    aria-label={`Supprimer ${selection.nom}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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

              {/* Une suppression ne se déclenche jamais au premier clic. */}
              {suppressionDemandee && (
                <div className="mb-4 rounded-xl border border-danger-border bg-danger-soft p-4">
                  <p className="text-sm font-semibold t-danger">
                    Supprimer {selection.nom} définitivement ?
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ses commandes et ses paiements restent enregistrés, mais ils ne seront plus
                    rattachés à personne.
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

              {/* Coordonnées : seules celles qui existent s'affichent. */}
              {(selection.telephone ||
                selection.email ||
                selection.entreprise ||
                selection.adresse ||
                selection.ville) && (
                <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {selection.entreprise && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {selection.entreprise}
                    </span>
                  )}
                  {/* `-my-1` compense le rembourrage : la cible atteint les
                      24 px exigés d'un lien pointable sans que l'espacement
                      visible de la ligne ne bouge. */}
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
                <Chiffre
                  libelle={compteSelection.ventesCredit > 0 ? "Commandes · ventes" : "Commandes"}
                  valeur={
                    compteSelection.ventesCredit > 0
                      ? `${compteSelection.commandes} · ${compteSelection.ventesCredit}`
                      : String(compteSelection.commandes)
                  }
                />
                <Chiffre
                  libelle="Total acheté"
                  valeur={formatCurrency(compteSelection.totalAchete)}
                />
                <Chiffre
                  libelle="Déjà payé"
                  valeur={formatCurrency(compteSelection.totalPaye)}
                  teinte="t-success"
                />
                <Chiffre
                  libelle="Reste dû"
                  valeur={formatCurrency(compteSelection.resteDu)}
                  teinte={compteSelection.resteDu > 0 ? "t-danger" : "text-muted-foreground"}
                />
              </div>

              {compteSelection.rembourse > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Dont {formatCurrency(compteSelection.rembourse)} remboursés.
                </p>
              )}

              {onNavigateToOrders && compteSelection.commandes > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToOrders(selection.id)}
                  className="app-btn-secondary mt-4 w-full sm:w-auto"
                >
                  Voir dans Commandes
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ── Commandes ── */}
            <div className="app-card p-5">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                <ShoppingBag className="h-4 w-4 t-info" aria-hidden="true" />
                Commandes ({commandesDuClient.length})
              </h4>
              {commandesDuClient.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune commande pour ce client.
                </p>
              ) : (
                <div className="app-list">
                  {commandesDuClient.map((commande) => (
                    <div key={commande.id} className="app-list-row justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block font-mono">{commande.numero}</span>
                        <span className="app-list-secondary block">
                          {new Date(commande.created_at).toLocaleDateString("fr-FR")}
                          {" · "}
                          <span
                            className={`app-badge ${
                              PASTILLE_COMMANDE[commande.statut_commande] ?? "app-badge-neutral"
                            }`}
                          >
                            {LIBELLE_COMMANDE[commande.statut_commande] ?? commande.statut_commande}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="app-list-amount block tabular-nums">
                          {formatCurrency(commande.montant_total)}
                        </span>
                        <span className="mt-1 block">
                          <PastillePaiement
                            statut={commande.statut_paiement}
                            reste={commande.reste_a_payer ?? 0}
                          />
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Ventes à crédit ── */}
            {ventesDuClient.length > 0 && (
              <div className="app-card p-5">
                <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
                  <CreditCard className="h-4 w-4 t-warning" aria-hidden="true" />
                  Ventes à crédit ({ventesDuClient.length})
                </h4>
                <p className="mb-4 text-xs text-muted-foreground">
                  Rapprochées par le nom saisi lors de la vente.
                </p>
                <div className="app-list">
                  {ventesDuClient.map((vente) => (
                    <div key={vente.id} className="app-list-row justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block font-mono">{vente.numero}</span>
                        <span className="app-list-secondary block">
                          {new Date(vente.date).toLocaleDateString("fr-FR")} · {vente.designation}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="app-list-amount block tabular-nums">
                          {formatCurrency(vente.totalVente)}
                        </span>
                        <span className="mt-1 block">
                          <PastillePaiement
                            statut={
                              vente.soldeDu <= 0
                                ? "paye"
                                : vente.montantPaye > 0
                                  ? "partiel"
                                  : "impaye"
                            }
                            reste={vente.soldeDu}
                          />
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Paiements ── */}
            <div className="app-card p-5">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                <History className="h-4 w-4 t-success" aria-hidden="true" />
                Paiements reçus ({paiementsDuClient.length})
              </h4>
              {paiementsDuClient.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun paiement enregistré pour ce client.
                </p>
              ) : (
                <div className="app-list">
                  {paiementsDuClient.map((paiement) => (
                    <div key={paiement.id} className="app-list-row justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary block font-mono">{paiement.numero}</span>
                        <span className="app-list-secondary block">
                          {new Date(paiement.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                          {paiement.methode}
                          {paiement.reference ? ` · ${paiement.reference}` : ""}
                        </span>
                      </span>
                      <span className="app-list-amount shrink-0 tabular-nums t-success">
                        + {formatCurrency(paiement.montant)}
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
