import React, { useMemo, useState } from "react";
import { Banknote, Phone, Plus, Search, Star, Trash2, UserRound, Users } from "lucide-react";
import type { Sale } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import { MODES_DE_PAIEMENT } from "../facturation/paiement";
import { useConfirmation } from "../../hooks/useConfirmation";
import {
  depuisLe,
  fichesHabitues,
  nomHabitue,
  repartirReglement,
  trierHabitues,
  type ClientLu,
  type FicheHabitue,
} from "../../lib/habituesBar";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Resultat = { error: string | null };

interface Props {
  clients: Client[];
  sales: Sale[];
  onAddClient: (data: {
    nom: string;
    prenom: string | null;
    telephone: string | null;
  }) => Promise<Resultat>;
  onUpdateClient: (id: string, data: Partial<Client>) => Promise<Resultat>;
  onDeleteClient: (id: string) => Promise<Resultat>;
  onAddPaymentToSale: (
    saleId: string,
    data: { montant: number; methode: string; note: string | null },
  ) => Promise<Resultat>;
}

type Filtre = "tous" | "ardoises" | "mois";

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");

const dateCourte = (jour: string) => {
  const [a, m, j] = jour.split("-");
  return `${j}/${m}/${a.slice(2)}`;
};

/**
 * LES HABITUÉS : LE CARNET DU BAR
 *
 * Ceux qui doivent d'abord (l'ardoise, à récupérer), puis ceux qui
 * viennent souvent. Une fiche dit quand le client est venu, ce qu'il
 * boit, et permet de régler son ardoise en un geste.
 */
export const HabituesView: React.FC<Props> = ({
  clients,
  sales,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onAddPaymentToSale,
}) => {
  const aujourdhui = dateDuJour();
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  const fiches = useMemo(() => trierHabitues(fichesHabitues(clients, sales)), [clients, sales]);
  const moisEnCours = aujourdhui.slice(0, 7);
  const ardoises = fiches.filter((f) => f.ardoise > 0);
  const totalArdoises = ardoises.reduce((n, f) => n + f.ardoise, 0);
  const venusCeMois = fiches.filter((f) => f.derniereVenue?.startsWith(moisEnCours)).length;

  const visibles = fiches.filter((f) => {
    if (filtre === "ardoises" && f.ardoise <= 0) return false;
    if (filtre === "mois" && !f.derniereVenue?.startsWith(moisEnCours)) return false;
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return (
      nomHabitue(f.client).toLowerCase().includes(q) ||
      (f.client.telephone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))
    );
  });
  const fiche = fiches.find((f) => f.client.id === ouvert) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Habitués</h1>
          <p className="text-sm text-muted-foreground">Les ardoises et les clients fidèles</p>
        </div>
        <button type="button" onClick={() => setCreation(true)} className="app-btn-primary">
          <Plus className="h-4 w-4" />
          Habitué
        </button>
      </header>

      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-80">Ardoises à récupérer</p>
        <p className="mt-0.5 text-3xl font-bold tabular-nums">{formatCurrency(totalArdoises)}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-lg font-bold tabular-nums">{ardoises.length}</p>
            <p className="opacity-80">doivent</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{venusCeMois}</p>
            <p className="opacity-80">venus ce mois</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{fiches.length}</p>
            <p className="opacity-80">habitués</p>
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou téléphone"
            className="app-field pl-9"
          />
        </label>
        <div className="flex gap-2">
          {(
            [
              ["tous", "Tous"],
              ["ardoises", `Ardoises (${ardoises.length})`],
              ["mois", "Venus ce mois"],
            ] as [Filtre, string][]
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setFiltre(cle)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                filtre === cle
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-6 w-6 text-primary" />
          {fiches.length === 0
            ? "Aucun habitué pour l'instant. Ajoutez-en un, ou choisissez un client en ouvrant une table."
            : "Personne ne correspond."}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {visibles.map((f) => {
            const nom = nomHabitue(f.client);
            return (
              <li key={f.client.id}>
                <button
                  type="button"
                  onClick={() => setOuvert(f.client.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {initiales(nom) || <UserRound className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nom}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {f.visites > 0
                        ? `Venu ${depuisLe(f.derniereVenue, aujourdhui)} · ${f.visites} soirée${
                            f.visites > 1 ? "s" : ""
                          }`
                        : "Pas encore venu"}
                      {f.favoris[0] ? ` · ${f.favoris[0].nom}` : ""}
                    </span>
                  </span>
                  {f.ardoise > 0 ? (
                    <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold tabular-nums t-danger">
                      {formatCurrency(f.ardoise)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">à jour</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creation && (
        <EditionHabitue
          onFermer={() => setCreation(false)}
          onEnregistrer={async (d) => {
            const r = await onAddClient(d);
            if (!r.error) setCreation(false);
            return r.error;
          }}
        />
      )}
      {fiche && (
        <FicheModal
          fiche={fiche}
          aujourdhui={aujourdhui}
          onFermer={() => setOuvert(null)}
          onUpdateClient={onUpdateClient}
          onDeleteClient={async (id) => {
            const r = await onDeleteClient(id);
            if (!r.error) setOuvert(null);
            return r;
          }}
          onAddPaymentToSale={onAddPaymentToSale}
        />
      )}
    </div>
  );
};

/* ── Créer ou modifier ─────────────────────────────────────────── */

const EditionHabitue: React.FC<{
  initial?: ClientLu;
  onFermer: () => void;
  onEnregistrer: (d: {
    nom: string;
    prenom: string | null;
    telephone: string | null;
  }) => Promise<string | null>;
}> = ({ initial, onFermer, onEnregistrer }) => {
  const [prenom, setPrenom] = useState(initial?.prenom ?? "");
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    // Un seul nom suffit : « Rado » s'écrit dans le nom.
    const n = nom.trim() || prenom.trim();
    if (!n) {
      setErreur("Donnez au moins un nom.");
      return;
    }
    setEnvoi(true);
    const err = await onEnregistrer({
      nom: n,
      prenom: nom.trim() ? prenom.trim() || null : null,
      telephone: telephone.trim() || null,
    });
    setEnvoi(false);
    setErreur(err);
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="sm"
      icon={<UserRound className="h-4 w-4" />}
      title={initial ? "Modifier l'habitué" : "Nouvel habitué"}
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="edition-habitue" disabled={envoi} className="app-btn-primary">
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form id="edition-habitue" onSubmit={valider} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Prénom</span>
            <input
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className="app-field"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nom</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="app-field" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Téléphone (facultatif)
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            className="app-field"
          />
        </label>
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};

/* ── La fiche ──────────────────────────────────────────────────── */

const FicheModal: React.FC<{
  fiche: FicheHabitue;
  aujourdhui: string;
  onFermer: () => void;
  onUpdateClient: Props["onUpdateClient"];
  onDeleteClient: Props["onDeleteClient"];
  onAddPaymentToSale: Props["onAddPaymentToSale"];
}> = ({ fiche, aujourdhui, onFermer, onUpdateClient, onDeleteClient, onAddPaymentToSale }) => {
  const { client } = fiche;
  const nom = nomHabitue(client);
  const [edition, setEdition] = useState(false);
  const [montant, setMontant] = useState(String(fiche.ardoise));
  const [methode, setMethode] = useState<string>("especes");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { confirmer, modaleConfirmation } = useConfirmation();

  const regler = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(montant.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(m) || m <= 0) {
      setErreur("Indiquez le montant reçu.");
      return;
    }
    if (m > fiche.ardoise) {
      setErreur(`L'ardoise n'est que de ${formatCurrency(fiche.ardoise)}.`);
      return;
    }
    setOccupe(true);
    setErreur(null);
    for (const part of repartirReglement(fiche.ventesDues, m)) {
      const r = await onAddPaymentToSale(part.saleId, {
        montant: part.montant,
        methode,
        note: "Règlement d'ardoise",
      });
      if (r.error) {
        setErreur(r.error);
        setOccupe(false);
        return;
      }
    }
    setOccupe(false);
    setMessage(`${formatCurrency(m)} reçus. Merci !`);
    setMontant(String(Math.max(0, fiche.ardoise - m)));
  };

  if (edition) {
    return (
      <EditionHabitue
        initial={client}
        onFermer={() => setEdition(false)}
        onEnregistrer={async (d) => {
          const r = await onUpdateClient(client.id, d);
          if (!r.error) setEdition(false);
          return r.error;
        }}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onFermer}
      size="lg"
      icon={<UserRound className="h-4 w-4" />}
      title={nom}
      description={
        fiche.visites > 0
          ? `Venu ${depuisLe(fiche.derniereVenue, aujourdhui)} · ${fiche.visites} soirée${
              fiche.visites > 1 ? "s" : ""
            }`
          : "Pas encore venu"
      }
      dismissible={!occupe}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border p-3">
            <p className="text-lg font-bold tabular-nums">{fiche.visites}</p>
            <p className="text-xs text-muted-foreground">soirées</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-lg font-bold tabular-nums">{formatCurrency(fiche.depense)}</p>
            <p className="text-xs text-muted-foreground">consommé</p>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              fiche.ardoise > 0 ? "border-danger-border bg-danger-soft" : "border-border"
            }`}
          >
            <p className={`text-lg font-bold tabular-nums ${fiche.ardoise > 0 ? "t-danger" : ""}`}>
              {formatCurrency(fiche.ardoise)}
            </p>
            <p className="text-xs text-muted-foreground">ardoise</p>
          </div>
        </div>

        {fiche.favoris.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Ce qu&apos;il boit</p>
            <div className="flex flex-wrap gap-2">
              {fiche.favoris.map((f) => (
                <span
                  key={f.nom}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                >
                  <Star className="h-3.5 w-3.5" />
                  {f.nom} · {f.quantite}
                </span>
              ))}
            </div>
          </div>
        )}

        {fiche.ventesDues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Ce qui reste dû</p>
            <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {fiche.ventesDues.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {dateCourte(v.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {v.productId ? `${v.quantite} × ${v.designation}` : v.designation}
                  </span>
                  <span className="font-semibold tabular-nums t-danger">
                    {formatCurrency(v.soldeDu)}
                  </span>
                </li>
              ))}
            </ul>
            <form onSubmit={regler} className="rounded-xl bg-muted/50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Banknote className="h-4 w-4 text-primary" />
                Régler l&apos;ardoise
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  inputMode="decimal"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  className="app-field w-32 flex-1"
                  aria-label="Montant reçu"
                />
                <select
                  value={methode}
                  onChange={(e) => setMethode(e.target.value)}
                  className="app-field w-36"
                  aria-label="Moyen de paiement"
                >
                  {MODES_DE_PAIEMENT.map((m) => (
                    <option key={m.valeur} value={m.valeur}>
                      {m.libelle}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={occupe} className="app-btn-primary">
                  {occupe ? "Encaissement…" : "Encaisser"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Le règlement éteint d&apos;abord la dette la plus ancienne.
              </p>
            </form>
          </div>
        )}
        {message && <p className="text-sm font-medium t-success">{message}</p>}
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {client.telephone && (
            <a href={`tel:${client.telephone.replace(/\s/g, "")}`} className="app-btn-secondary">
              <Phone className="h-4 w-4" />
              {client.telephone}
            </a>
          )}
          <button type="button" onClick={() => setEdition(true)} className="app-btn-secondary">
            Modifier
          </button>
          <button
            type="button"
            disabled={occupe}
            onClick={async () => {
              if (fiche.visites > 0) {
                await confirmer(
                  `${nom} a déjà consommé : sa fiche reste, pour garder l'historique des ventes.`,
                  { libelle: "Compris" },
                );
                return;
              }
              if (!(await confirmer(`Supprimer ${nom} ?`, { danger: true, libelle: "Supprimer" })))
                return;
              const r = await onDeleteClient(client.id);
              if (r.error) setErreur(r.error);
            }}
            className="ml-auto flex items-center gap-1 text-sm font-medium t-danger"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
        </div>
      </div>
      {modaleConfirmation}
    </Modal>
  );
};
