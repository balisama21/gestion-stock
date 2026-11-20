import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  HeartPulse,
  Phone,
  Plus,
  ScrollText,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import type { Sale } from "../../types";
import type { Database } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { MODES_DE_PAIEMENT } from "../facturation/paiement";
import { depuisLe, repartirReglement } from "../../lib/habituesBar";
import { normaliser, type OrdonnancePharma } from "../../lib/pharmacie";
import type { Pharmacie } from "../../hooks/usePharmacie";
import { Chiffre, EnTete, Panneau, Recherche, Vide } from "./ui";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Resultat = { error: string | null };

const db = supabase as unknown as { from: (t: string) => any };

interface Props {
  storeId: string;
  clients: Client[];
  sales: Sale[];
  pharma: Pharmacie;
  aujourdhui: string;
  onAddClient: (d: {
    nom: string;
    prenom: string | null;
    telephone: string | null;
    note: string | null;
  }) => Promise<{ error: string | null }>;
  onUpdateClient: (id: string, d: Partial<Client>) => Promise<Resultat>;
  onAddPaymentToSale: (
    saleId: string,
    data: { montant: number; methode: string; note: string | null },
  ) => Promise<Resultat>;
}

const nomClient = (c: Client) => [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom;
const dateCourte = (jour: string) => jour.split("-").reverse().join("/");

interface Dossier {
  client: Client;
  ventes: Sale[];
  derniere: string | null;
  du: number;
  dues: Sale[];
}

/**
 * LES PATIENTS
 *
 * Le dossier de chaque patient : ce qu'on lui a délivré, ses
 * ordonnances, ses allergies et remarques (écrites en tête du dossier,
 * en rouge, pour qu'on les voie avant de délivrer), et ce qu'il doit.
 * Les organismes de tiers payant ont leur propre écran.
 */
export const PatientsView: React.FC<Props> = ({
  storeId,
  clients,
  sales,
  pharma,
  aujourdhui,
  onAddClient,
  onUpdateClient,
  onAddPaymentToSale,
}) => {
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [edition, setEdition] = useState<Client | "nouveau" | null>(null);

  // Les ordonnances à leur nom disent aussi quand ils sont venus.
  const [venues, setVenues] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    void (async () => {
      const { data } = await db
        .from("pharma_ordonnances")
        .select("patient_client_id, date_delivrance")
        .eq("store_id", storeId)
        .limit(5000);
      const m = new Map<string, string>();
      for (const o of (data ?? []) as {
        patient_client_id: string | null;
        date_delivrance: string;
      }[]) {
        if (!o.patient_client_id) continue;
        if ((m.get(o.patient_client_id) ?? "") < o.date_delivrance)
          m.set(o.patient_client_id, o.date_delivrance);
      }
      setVenues(m);
    })();
  }, [storeId, sales]);

  const organismes = useMemo(
    () => new Set(pharma.organismes.map((o) => o.client_id)),
    [pharma.organismes],
  );
  const dossiers = useMemo<Dossier[]>(() => {
    const parClient = new Map<string, Sale[]>();
    for (const s of sales) {
      if (!s.clientId) continue;
      parClient.set(s.clientId, [...(parClient.get(s.clientId) ?? []), s]);
    }
    return clients
      .filter((c) => !organismes.has(c.id) && c.type_client !== "organisme")
      .map((client) => {
        const ventes = (parClient.get(client.id) ?? []).sort((a, b) =>
          b.date.localeCompare(a.date),
        );
        const dues = ventes
          .filter((v) => v.soldeDu > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
        const parOrdonnance = venues.get(client.id) ?? null;
        const parVente = ventes[0]?.date ?? null;
        return {
          client,
          ventes,
          derniere:
            parOrdonnance && (!parVente || parOrdonnance > parVente) ? parOrdonnance : parVente,
          du: dues.reduce((n, v) => n + v.soldeDu, 0),
          dues,
        };
      })
      .sort(
        (a, b) =>
          b.du - a.du ||
          (b.derniere ?? "").localeCompare(a.derniere ?? "") ||
          nomClient(a.client).localeCompare(nomClient(b.client), "fr"),
      );
  }, [clients, sales, organismes, venues]);

  const visibles = dossiers.filter((d) => {
    const q = normaliser(recherche);
    if (!q) return true;
    return (
      normaliser(nomClient(d.client)).includes(q) ||
      (d.client.telephone ?? "").replace(/\s/g, "").includes(recherche.replace(/\s/g, ""))
    );
  });
  const totalDu = dossiers.reduce((n, d) => n + d.du, 0);
  const ceMois = dossiers.filter((d) => d.derniere?.startsWith(aujourdhui.slice(0, 7))).length;
  const dossier = dossiers.find((d) => d.client.id === ouvert) ?? null;

  return (
    <div className="ph-page max-w-4xl">
      <EnTete
        titre="Patients"
        sousTitre="Le dossier de chacun : délivrances, ordonnances, allergies, crédit."
        icone={<Users className="h-6 w-6" />}
        actions={
          <button type="button" onClick={() => setEdition("nouveau")} className="app-btn-primary">
            <Plus className="h-4 w-4" />
            Patient
          </button>
        }
      >
        <Chiffre ton="plein" valeur={dossiers.length} libelle="Patients enregistrés" />
        <Chiffre valeur={ceMois} libelle="Venus ce mois" />
        <Chiffre
          valeur={formatCurrency(totalDu)}
          libelle="Crédit des patients"
          ton={totalDu > 0 ? "warning" : undefined}
        />
      </EnTete>

      <Recherche
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Nom ou téléphone"
        icone={<Search className="h-5 w-5" />}
      />

      <Panneau titre={`${visibles.length} patient(s)`} icone={<Users className="h-4 w-4" />}>
        {visibles.length === 0 ? (
          <Vide icone={<UserRound className="h-6 w-6" />}>
            {dossiers.length === 0
              ? "Aucun patient enregistré. Ajoutez-en un, ou choisissez-le au comptoir."
              : "Personne ne correspond."}
          </Vide>
        ) : (
          <ul className="ph-liste">
            {visibles.map((d) => (
              <li key={d.client.id}>
                <button
                  type="button"
                  onClick={() => setOuvert(d.client.id)}
                  className="ph-ligne"
                  data-ton={d.du > 0 ? "warning" : d.client.note ? "danger" : undefined}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-extrabold text-primary">
                    {nomClient(d.client)
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((m) => m[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{nomClient(d.client)}</span>
                      {d.client.note && (
                        <span title={d.client.note}>
                          <AlertTriangle className="h-3.5 w-3.5 t-danger" />
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {d.derniere ? `Venu ${depuisLe(d.derniere, aujourdhui)}` : "Pas encore venu"}
                      {d.client.telephone ? ` · ${d.client.telephone}` : ""}
                    </span>
                  </span>
                  {d.du > 0 ? (
                    <span className="text-sm font-extrabold tabular-nums t-warning">
                      {formatCurrency(d.du)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">à jour</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      {edition && (
        <EditionPatient
          initial={edition === "nouveau" ? undefined : edition}
          onFermer={() => setEdition(null)}
          onEnregistrer={async (v) => {
            const r =
              edition === "nouveau" ? await onAddClient(v) : await onUpdateClient(edition.id, v);
            if (!r.error) setEdition(null);
            return r.error;
          }}
        />
      )}
      {dossier && !edition && (
        <DossierPatient
          dossier={dossier}
          sales={sales}
          aujourdhui={aujourdhui}
          onFermer={() => setOuvert(null)}
          onModifier={() => setEdition(dossier.client)}
          onAddPaymentToSale={onAddPaymentToSale}
        />
      )}
    </div>
  );
};

const EditionPatient: React.FC<{
  initial?: Client;
  onFermer: () => void;
  onEnregistrer: (v: {
    nom: string;
    prenom: string | null;
    telephone: string | null;
    note: string | null;
  }) => Promise<string | null>;
}> = ({ initial, onFermer, onEnregistrer }) => {
  const [prenom, setPrenom] = useState(initial?.prenom ?? "");
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nom.trim() || prenom.trim();
    if (!n) return setErreur("Donnez au moins un nom.");
    setEnvoi(true);
    const err = await onEnregistrer({
      nom: n,
      prenom: nom.trim() ? prenom.trim() || null : null,
      telephone: telephone.trim() || null,
      note: note.trim() || null,
    });
    setEnvoi(false);
    setErreur(err);
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="md"
      icon={<UserRound className="h-4 w-4" />}
      title={initial ? "Modifier le patient" : "Nouveau patient"}
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="edition-patient" disabled={envoi} className="app-btn-primary">
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form id="edition-patient" onSubmit={valider} className="grid grid-cols-2 gap-3">
        <input
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          placeholder="Prénom"
          className="app-field"
          autoFocus
        />
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom"
          className="app-field"
        />
        <input
          type="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="Téléphone"
          className="app-field col-span-2"
        />
        <label className="col-span-2 block">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold t-danger">
            <AlertTriangle className="h-3.5 w-3.5" />
            Allergies, traitements en cours, remarques
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex. : allergique à la pénicilline, diabétique sous insuline…"
            className="app-field"
          />
        </label>
        {erreur && <p className="col-span-2 text-sm font-semibold t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};

const DossierPatient: React.FC<{
  dossier: Dossier;
  sales: Sale[];
  aujourdhui: string;
  onFermer: () => void;
  onModifier: () => void;
  onAddPaymentToSale: Props["onAddPaymentToSale"];
}> = ({ dossier, sales, aujourdhui, onFermer, onModifier, onAddPaymentToSale }) => {
  const { client } = dossier;
  const [ordonnances, setOrdonnances] = useState<OrdonnancePharma[]>([]);
  const [montant, setMontant] = useState(String(dossier.du));
  const [methode, setMethode] = useState<string>("especes");
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await db
        .from("pharma_ordonnances")
        .select("*")
        .eq("patient_client_id", client.id)
        .order("numero", { ascending: false })
        .limit(200);
      setOrdonnances((data ?? []) as OrdonnancePharma[]);
    })();
  }, [client.id]);

  /** Ce qui lui a été délivré : ses propres achats et ceux passés par ses ordonnances. */
  const delivrances = useMemo(() => {
    const tickets = new Set(ordonnances.map((o) => o.ticket_id).filter(Boolean));
    const siennes = sales.filter(
      (s) => s.clientId === client.id || (s.ticketId && tickets.has(s.ticketId)),
    );
    return [...siennes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  }, [sales, ordonnances, client.id]);

  const regler = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(montant.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(m) || m <= 0 || m > dossier.du)
      return setErreur(`Entre 1 et ${formatCurrency(dossier.du)}.`);
    setOccupe(true);
    setErreur(null);
    for (const part of repartirReglement(dossier.dues, m)) {
      const r = await onAddPaymentToSale(part.saleId, {
        montant: part.montant,
        methode,
        note: "Règlement du crédit",
      });
      if (r.error) {
        setOccupe(false);
        return setErreur(r.error);
      }
    }
    setOccupe(false);
    setMessage(`${formatCurrency(m)} encaissés.`);
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="2xl"
      icon={<HeartPulse className="h-4 w-4" />}
      title={nomClient(client)}
      description={
        dossier.derniere ? `Venu ${depuisLe(dossier.derniere, aujourdhui)}` : "Pas encore venu"
      }
      dismissible={!occupe}
    >
      <div className="space-y-4">
        {client.note && (
          <p className="flex gap-2 rounded-xl border border-danger-border bg-danger-soft p-3 text-sm font-semibold t-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {client.note}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Chiffre valeur={ordonnances.length} libelle="Ordonnances" />
          <Chiffre valeur={delivrances.length} libelle="Délivrances" />
          <Chiffre
            valeur={formatCurrency(dossier.du)}
            libelle="Crédit"
            ton={dossier.du > 0 ? "warning" : undefined}
          />
        </div>

        {dossier.du > 0 && (
          <form onSubmit={regler} className="rounded-xl bg-muted/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <Banknote className="h-4 w-4 text-primary" />
              Régler le crédit
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
          </form>
        )}
        {message && <p className="text-sm font-bold text-[var(--croix)]">{message}</p>}
        {erreur && <p className="text-sm font-semibold t-danger">{erreur}</p>}

        <Panneau titre="Ordonnances" icone={<ScrollText className="h-4 w-4" />}>
          {ordonnances.length === 0 ? (
            <Vide>Aucune ordonnance à son nom.</Vide>
          ) : (
            <ul className="ph-liste">
              {ordonnances.map((o) => (
                <li key={o.id} className="ph-ligne">
                  <span className="text-xs font-extrabold tabular-nums text-primary">
                    N° {o.numero}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {dateCourte(o.date_delivrance)}
                    {o.prescripteur ? ` · ${o.prescripteur}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau titre="Médicaments délivrés">
          {delivrances.length === 0 ? (
            <Vide>Rien de délivré à son nom.</Vide>
          ) : (
            <ul className="ph-liste max-h-60 overflow-y-auto">
              {delivrances.map((v) => (
                <li
                  key={v.id}
                  className="ph-ligne"
                  data-ton={v.soldeDu > 0 ? "warning" : undefined}
                >
                  <span className="w-20 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                    {dateCourte(v.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {v.designation} ×{" "}
                    {v.conditionnement
                      ? `${v.conditionnement.nombre} ${v.conditionnement.nom}`
                      : v.quantite}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatCurrency(v.totalVente)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {client.telephone && (
            <a href={`tel:${client.telephone.replace(/\s/g, "")}`} className="app-btn-secondary">
              <Phone className="h-4 w-4" />
              {client.telephone}
            </a>
          )}
          <button type="button" onClick={onModifier} className="app-btn-secondary">
            Modifier le dossier
          </button>
        </div>
      </div>
    </Modal>
  );
};
