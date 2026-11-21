import React, { useEffect, useMemo, useState } from "react";
import { Banknote, Plus, Printer, ShieldCheck } from "lucide-react";
import type { Sale } from "../../types";
import type { Database } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { MODES_DE_PAIEMENT } from "../facturation/paiement";
import { imprimerFeuille } from "../../features/documents/lib/imprimer";
import { repartirReglement } from "../../lib/habituesBar";
import { Chiffre, EnTete, Panneau, Vide } from "./ui";
import type { OrdonnancePharma, OrganismePharma } from "../../lib/pharmacie";
import type { Pharmacie } from "../../hooks/usePharmacie";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Resultat = { error: string | null };

const db = supabase as unknown as { from: (t: string) => any };

interface Props {
  storeName: string;
  clients: Client[];
  sales: Sale[];
  pharma: Pharmacie;
  estProprietaire: boolean;
  onAddClient: (d: {
    nom: string;
    telephone: string | null;
    type_client: string;
  }) => Promise<{ client: { id: string } | null; error: string | null }>;
  onAddPaymentToSale: (
    saleId: string,
    data: { montant: number; methode: string; note: string | null },
  ) => Promise<Resultat>;
}

const nomClient = (c: Client) => [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom;
const dateCourte = (jour: string) => jour.split("-").reverse().join("/");

/**
 * LE TIERS PAYANT
 *
 * Les assurances, mutuelles et employeurs qui paient une part des
 * médicaments de leurs assurés. La part de l'organisme reste due à son
 * nom ; on la suit ici, on imprime son relevé, on encaisse son
 * règlement — la dette la plus ancienne d'abord.
 */
export const OrganismesView: React.FC<Props> = ({
  storeName,
  clients,
  sales,
  pharma,
  estProprietaire,
  onAddClient,
  onAddPaymentToSale,
}) => {
  const [ajout, setAjout] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const lignes = useMemo(
    () =>
      pharma.organismes
        .map((o) => {
          const client = clients.find((c) => c.id === o.client_id);
          const dues = sales
            .filter((s) => s.clientId === o.client_id && s.soldeDu > 0)
            .sort((a, b) => a.date.localeCompare(b.date));
          return { organisme: o, client, dues, du: dues.reduce((n, s) => n + s.soldeDu, 0) };
        })
        .filter((l) => l.client)
        .sort((a, b) => b.du - a.du),
    [pharma.organismes, clients, sales],
  );
  const total = lignes.reduce((n, l) => n + l.du, 0);
  const choisi = lignes.find((l) => l.organisme.client_id === ouvert) ?? null;

  return (
    <div className="ph-page">
      <EnTete
        titre="Tiers payant"
        sousTitre="Assurances, mutuelles et employeurs qui paient une part des médicaments."
        icone={<ShieldCheck className="h-6 w-6" />}
        actions={
          estProprietaire && (
            <button type="button" onClick={() => setAjout(true)} className="app-btn-primary">
              <Plus className="h-4 w-4" />
              Organisme
            </button>
          )
        }
      >
        <Chiffre ton="plein" valeur={formatCurrency(total)} libelle="À recouvrer" />
        <Chiffre valeur={lignes.filter((l) => l.du > 0).length} libelle="Organismes débiteurs" />
        <Chiffre
          valeur={lignes.filter((l) => l.organisme.actif).length}
          libelle="Conventions actives"
        />
      </EnTete>

      <Panneau titre="Les organismes" icone={<ShieldCheck className="h-4 w-4" />}>
        {lignes.length === 0 ? (
          <Vide icone={<ShieldCheck className="h-6 w-6" />}>
            Aucun organisme. Ajoutez une assurance ou une mutuelle pour la proposer au comptoir.
          </Vide>
        ) : (
          <ul className="ph-liste">
            {lignes.map(({ organisme, client, dues, du }) => (
              <li key={organisme.client_id}>
                <button
                  type="button"
                  onClick={() => setOuvert(organisme.client_id)}
                  className="ph-ligne"
                  data-ton={du > 0 ? "warning" : organisme.actif ? "croix" : undefined}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-extrabold text-primary">
                    {organisme.taux}%
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {nomClient(client!)}
                      {!organisme.actif && (
                        <span className="ml-2 text-xs font-medium text-muted-foreground">
                          suspendu
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {organisme.convention ?? "Sans numéro de convention"}
                      {dues.length > 0 ? ` · ${dues.length} délivrance(s) à recouvrer` : ""}
                    </span>
                  </span>
                  {du > 0 ? (
                    <span className="text-right">
                      <span className="block text-sm font-extrabold tabular-nums t-warning">
                        {formatCurrency(du)}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">à recouvrer</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-[var(--croix)]">à jour</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      {ajout && (
        <EditionOrganisme
          onFermer={() => setAjout(false)}
          onEnregistrer={async (v) => {
            const c = await onAddClient({
              nom: v.nom,
              telephone: v.telephone || null,
              type_client: "organisme",
            });
            if (c.error || !c.client) return c.error ?? "L'organisme n'a pas pu être créé.";
            const r = await pharma.enregistrerOrganisme({
              clientId: c.client.id,
              taux: v.taux,
              convention: v.convention,
              actif: true,
            });
            if (!r.error) setAjout(false);
            return r.error;
          }}
        />
      )}
      {choisi && (
        <FicheOrganisme
          storeName={storeName}
          organisme={choisi.organisme}
          client={choisi.client!}
          dues={choisi.dues}
          estProprietaire={estProprietaire}
          onFermer={() => setOuvert(null)}
          onModifier={(v) =>
            pharma.enregistrerOrganisme({ clientId: choisi.organisme.client_id, ...v })
          }
          onAddPaymentToSale={onAddPaymentToSale}
        />
      )}
    </div>
  );
};

const EditionOrganisme: React.FC<{
  initial?: { nom: string; taux: number; convention: string | null };
  onFermer: () => void;
  onEnregistrer: (v: {
    nom: string;
    telephone: string;
    taux: number;
    convention: string | null;
  }) => Promise<string | null>;
}> = ({ initial, onFermer, onEnregistrer }) => {
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [telephone, setTelephone] = useState("");
  const [taux, setTaux] = useState(String(initial?.taux ?? 80));
  const [convention, setConvention] = useState(initial?.convention ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = Number(taux.replace(",", "."));
    if (!nom.trim()) return setErreur("Donnez le nom de l'organisme.");
    if (!Number.isFinite(t) || t <= 0 || t > 100) return setErreur("Le taux va de 1 à 100 %.");
    setEnvoi(true);
    const err = await onEnregistrer({
      nom: nom.trim(),
      telephone: telephone.trim(),
      taux: t,
      convention: convention.trim() || null,
    });
    setEnvoi(false);
    setErreur(err);
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="sm"
      icon={<ShieldCheck className="h-4 w-4" />}
      title={initial ? "Modifier l'organisme" : "Nouvel organisme"}
      description="Assurance, mutuelle, entreprise : la part qu'il paie pour ses assurés."
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button
            type="submit"
            form="edition-organisme"
            disabled={envoi}
            className="app-btn-primary"
          >
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form id="edition-organisme" onSubmit={valider} className="space-y-3">
        {!initial && (
          <>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom (ex. : ARO, OSTIE, Mutuelle X)"
              className="app-field"
              autoFocus
            />
            <input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="Téléphone (facultatif)"
              className="app-field"
            />
          </>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Part prise en charge (%)
          </span>
          <input
            inputMode="decimal"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
            className="app-field"
          />
        </label>
        <input
          value={convention}
          onChange={(e) => setConvention(e.target.value)}
          placeholder="N° de convention (facultatif)"
          className="app-field"
        />
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};

const FicheOrganisme: React.FC<{
  storeName: string;
  organisme: OrganismePharma;
  client: Client;
  dues: Sale[];
  estProprietaire: boolean;
  onFermer: () => void;
  onModifier: (v: { taux: number; convention: string | null; actif: boolean }) => Promise<Resultat>;
  onAddPaymentToSale: Props["onAddPaymentToSale"];
}> = ({
  storeName,
  organisme,
  client,
  dues,
  estProprietaire,
  onFermer,
  onModifier,
  onAddPaymentToSale,
}) => {
  const du = dues.reduce((n, s) => n + s.soldeDu, 0);
  const [ordonnances, setOrdonnances] = useState<Map<string, OrdonnancePharma>>(new Map());
  const [montant, setMontant] = useState(String(du));
  const [methode, setMethode] = useState<string>("virement");
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await db
        .from("pharma_ordonnances")
        .select("*")
        .eq("organisme_id", organisme.client_id)
        .order("numero", { ascending: false })
        .limit(1000);
      setOrdonnances(
        new Map(
          ((data ?? []) as OrdonnancePharma[])
            .filter((o) => o.ticket_id)
            .map((o) => [o.ticket_id!, o]),
        ),
      );
    })();
  }, [organisme.client_id]);

  /** Une ligne du relevé par ticket : la délivrance d'un assuré. */
  const releve = useMemo(() => {
    const parTicket = new Map<string, Sale[]>();
    for (const s of dues) {
      const cle = s.ticketId ?? s.id;
      parTicket.set(cle, [...(parTicket.get(cle) ?? []), s]);
    }
    return [...parTicket.entries()].map(([cle, ventes]) => ({
      cle,
      date: ventes[0].date,
      ordonnance: ordonnances.get(cle) ?? null,
      du: ventes.reduce((n, s) => n + s.soldeDu, 0),
    }));
  }, [dues, ordonnances]);

  const regler = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(montant.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(m) || m <= 0 || m > du)
      return setErreur(`Entre 1 et ${formatCurrency(du)}.`);
    setOccupe(true);
    setErreur(null);
    for (const part of repartirReglement(dues, m)) {
      const r = await onAddPaymentToSale(part.saleId, {
        montant: part.montant,
        methode,
        note: `Règlement ${nomClient(client)}`,
      });
      if (r.error) {
        setOccupe(false);
        return setErreur(r.error);
      }
    }
    setOccupe(false);
    setMessage(`${formatCurrency(m)} encaissés.`);
  };

  if (edition) {
    return (
      <EditionOrganisme
        initial={{ nom: nomClient(client), taux: organisme.taux, convention: organisme.convention }}
        onFermer={() => setEdition(false)}
        onEnregistrer={async (v) => {
          const r = await onModifier({
            taux: v.taux,
            convention: v.convention,
            actif: organisme.actif,
          });
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
      size="2xl"
      icon={<ShieldCheck className="h-4 w-4" />}
      title={nomClient(client)}
      description={`Prend en charge ${organisme.taux} %${organisme.convention ? ` · ${organisme.convention}` : ""}`}
      dismissible={!occupe}
    >
      <div className="space-y-4">
        <div className="receipt-viewport">
          <div className="printable-receipt space-y-2">
            <p className="hidden text-[14pt] font-bold print:block">
              Relevé {nomClient(client)} · {storeName}
            </p>
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">Relevé des délivrances</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(du)}</p>
            </div>
            {releve.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rien à recouvrer.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-1">Date</th>
                    <th className="py-1">Ordonnance</th>
                    <th className="py-1">Assuré</th>
                    <th className="py-1 text-right">Dû</th>
                  </tr>
                </thead>
                <tbody>
                  {releve.map((l) => (
                    <tr key={l.cle} className="border-b border-border">
                      <td className="py-1.5">{dateCourte(l.date)}</td>
                      <td className="py-1.5 tabular-nums">
                        {l.ordonnance ? `n° ${l.ordonnance.numero}` : "—"}
                      </td>
                      <td className="py-1.5">
                        {l.ordonnance?.patient_nom ?? "—"}
                        {l.ordonnance?.matricule ? ` · ${l.ordonnance.matricule}` : ""}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">
                        {formatCurrency(l.du)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {du > 0 && (
          <form onSubmit={regler} className="rounded-xl bg-muted/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Banknote className="h-4 w-4 text-primary" />
              Encaisser un règlement
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
        {message && <p className="text-sm font-medium t-success">{message}</p>}
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {releve.length > 0 && (
            <button type="button" onClick={() => imprimerFeuille()} className="app-btn-secondary">
              <Printer className="h-4 w-4" />
              Imprimer le relevé
            </button>
          )}
          {estProprietaire && (
            <>
              <button type="button" onClick={() => setEdition(true)} className="app-btn-secondary">
                Modifier le taux
              </button>
              <button
                type="button"
                onClick={() =>
                  onModifier({
                    taux: organisme.taux,
                    convention: organisme.convention,
                    actif: !organisme.actif,
                  })
                }
                className="app-btn-secondary"
              >
                {organisme.actif ? "Suspendre" : "Réactiver"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
