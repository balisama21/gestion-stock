import React, { useMemo, useState } from "react";
import { Raccourcis } from "./ui";
import { decalerJour, formaterTelephone } from "../../lib/saisie";
import { useMemoireSaisie } from "../../hooks/useMemoireSaisie";
import { ChevronLeft, ChevronRight, FilePlus2, Printer, ScrollText, Search } from "lucide-react";
import type { Sale } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { imprimerFeuille } from "../../features/documents/lib/imprimer";
import { periodeDe, type Echelle } from "../../lib/bilanBar";
import { normaliser, type OrdonnancePharma } from "../../lib/pharmacie";
import { inscrireOrdonnance, useOrdonnances } from "../../hooks/usePharmacie";
import { Chiffre, EnTete, Panneau, Recherche, Segments, Vide } from "./ui";

type Client = Database["public"]["Tables"]["clients"]["Row"];

interface Props {
  storeId: string;
  storeName: string;
  sales: Sale[];
  clients: Client[];
  aujourdhui: string;
}

const nomClient = (c: Client) => [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom;
const dateCourte = (jour: string | null) => (jour ? jour.split("-").reverse().join("/") : "—");

/**
 * L'ORDONNANCIER
 *
 * Le registre des délivrances sur ordonnance, numéroté dans l'ordre :
 * qui, quand, prescrit par qui, quels médicaments. Chaque vente sur
 * ordonnance du comptoir s'y inscrit seule ; une ordonnance oubliée
 * s'ajoute à la main. Le registre s'imprime pour la période choisie.
 */
export const OrdonnancierView: React.FC<Props> = ({
  storeId,
  storeName,
  sales,
  clients,
  aujourdhui,
}) => {
  const [echelle, setEchelle] = useState<Echelle>("mois");
  const [recul, setRecul] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [impression, setImpression] = useState(false);
  const [ajout, setAjout] = useState(false);
  const periode = useMemo(
    () => periodeDe(echelle, recul, aujourdhui),
    [echelle, recul, aujourdhui],
  );
  const { ordonnances, chargement, recharger } = useOrdonnances(
    storeId,
    periode.debut,
    periode.fin,
  );

  /** Les médicaments délivrés, retrouvés par le ticket de la vente. */
  const delivre = useMemo(() => {
    const parTicket = new Map<string, Sale[]>();
    for (const s of sales) {
      if (!s.ticketId) continue;
      parTicket.set(s.ticketId, [...(parTicket.get(s.ticketId) ?? []), s]);
    }
    return (o: OrdonnancePharma) =>
      (o.ticket_id ? (parTicket.get(o.ticket_id) ?? []) : [])
        .map(
          (s) =>
            `${s.designation} × ${
              s.conditionnement
                ? `${s.conditionnement.nombre} ${s.conditionnement.nom}`
                : s.quantite
            }`,
        )
        .join(", ");
  }, [sales]);
  const nomDe = useMemo(() => new Map(clients.map((c) => [c.id, nomClient(c)])), [clients]);

  const visibles = ordonnances.filter((o) => {
    const q = normaliser(recherche);
    if (!q) return true;
    return (
      String(o.numero) === recherche.trim() ||
      normaliser(`${o.patient_nom} ${o.prescripteur ?? ""} ${o.matricule ?? ""}`).includes(q)
    );
  });
  const patients = new Set(ordonnances.map((o) => normaliser(o.patient_nom))).size;
  const partOrganismes = ordonnances.reduce((n, o) => n + o.part_organisme, 0);

  return (
    <div className="ph-page">
      <EnTete
        titre="Ordonnancier"
        sousTitre="Le registre des délivrances sur ordonnance, numéroté dans l'ordre."
        icone={<ScrollText className="h-6 w-6" />}
        actions={
          <>
            <button
              type="button"
              onClick={() => setImpression(true)}
              disabled={ordonnances.length === 0}
              className="app-btn-secondary"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
            <button type="button" onClick={() => setAjout(true)} className="app-btn-primary">
              <FilePlus2 className="h-4 w-4" />
              Inscrire
            </button>
          </>
        }
      >
        <Chiffre
          ton="plein"
          valeur={ordonnances.length}
          libelle={`Ordonnances · ${periode.libelle}`}
        />
        <Chiffre valeur={patients} libelle="Patients" />
        <Chiffre valeur={formatCurrency(partOrganismes)} libelle="Part des organismes" />
      </EnTete>

      <div className="flex flex-wrap items-center gap-2">
        <Segments
          libelle="Période"
          valeur={echelle}
          onChange={(e) => {
            setEchelle(e);
            setRecul(0);
          }}
          options={[
            { cle: "soir", libelle: "Jour" },
            { cle: "semaine", libelle: "Semaine" },
            { cle: "mois", libelle: "Mois" },
          ]}
        />
        <div className="ph-segments items-center">
          <button
            type="button"
            onClick={() => setRecul(recul + 1)}
            className="ph-segment"
            aria-label="Période précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-bold">{periode.libelle}</span>
          <button
            type="button"
            onClick={() => setRecul(recul - 1)}
            disabled={recul === 0}
            className="ph-segment disabled:opacity-30"
            aria-label="Période suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-[14rem] flex-1">
          <Recherche
            valeur={recherche}
            onChange={setRecherche}
            placeholder="Patient, médecin, matricule ou numéro"
            icone={<Search className="h-5 w-5" />}
          />
        </div>
      </div>

      <Panneau
        titre={`Registre · ${visibles.length} ligne(s)`}
        icone={<ScrollText className="h-4 w-4" />}
      >
        {chargement ? (
          <Vide>Chargement…</Vide>
        ) : visibles.length === 0 ? (
          <Vide icone={<ScrollText className="h-6 w-6" />}>
            Aucune ordonnance sur cette période.
          </Vide>
        ) : (
          <ul className="ph-liste">
            {visibles.map((o) => {
              const meds = delivre(o) || o.notes;
              return (
                <li
                  key={o.id}
                  className="ph-ligne !items-start"
                  data-ton={o.organisme_id ? "info" : undefined}
                >
                  <span className="flex h-10 min-w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary px-1.5 text-primary-foreground">
                    <span className="text-[9px] font-bold uppercase opacity-80">N°</span>
                    <span className="text-sm font-extrabold leading-none tabular-nums">
                      {o.numero}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {o.patient_nom}
                      {o.patient_age && (
                        <span className="ml-1 text-xs font-medium text-muted-foreground">
                          ({o.patient_age})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Délivrée le {dateCourte(o.date_delivrance)}
                      {o.prescripteur ? ` · ${o.prescripteur}` : ""}
                      {o.date_prescription
                        ? ` · prescrite le ${dateCourte(o.date_prescription)}`
                        : ""}
                    </p>
                    {meds && <p className="mt-1 text-xs font-semibold">{meds}</p>}
                  </div>
                  {o.organisme_id && (
                    <span className="shrink-0 text-right text-xs">
                      <span className="block font-bold">
                        {nomDe.get(o.organisme_id) ?? "Organisme"}
                      </span>
                      <span className="block tabular-nums text-muted-foreground">
                        {formatCurrency(o.part_organisme)}
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>

      {impression && (
        <Modal
          open
          onClose={() => setImpression(false)}
          size="3xl"
          icon={<Printer className="h-4 w-4" />}
          title="Imprimer le registre"
          description={periode.libelle}
          footer={
            <>
              <button
                type="button"
                onClick={() => setImpression(false)}
                className="app-btn-secondary"
              >
                Fermer
              </button>
              <button type="button" onClick={() => imprimerFeuille()} className="app-btn-primary">
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </>
          }
        >
          <div className="receipt-viewport overflow-x-auto">
            <div className="printable-receipt bg-white p-[12mm] text-[10pt] text-black">
              <p className="text-[14pt] font-bold">Ordonnancier · {storeName}</p>
              <p className="mb-3">{periode.libelle}</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black text-left">
                    <th className="py-1 pr-2">N°</th>
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1 pr-2">Patient</th>
                    <th className="py-1 pr-2">Prescripteur</th>
                    <th className="py-1">Médicaments délivrés</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ordonnances].reverse().map((o) => (
                    <tr key={o.id} className="border-b border-gray-300 align-top">
                      <td className="py-1 pr-2 tabular-nums">{o.numero}</td>
                      <td className="py-1 pr-2">{dateCourte(o.date_delivrance)}</td>
                      <td className="py-1 pr-2">
                        {o.patient_nom}
                        {o.patient_age ? ` (${o.patient_age})` : ""}
                      </td>
                      <td className="py-1 pr-2">{o.prescripteur ?? ""}</td>
                      <td className="py-1">{delivre(o) || o.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {ajout && (
        <AjoutOrdonnance
          storeId={storeId}
          aujourdhui={aujourdhui}
          onFermer={() => setAjout(false)}
          onInscrire={async (o) => {
            const r = await inscrireOrdonnance(storeId, o);
            if (!r.error) {
              setAjout(false);
              await recharger();
            }
            return r.error;
          }}
        />
      )}
    </div>
  );
};

const AjoutOrdonnance: React.FC<{
  storeId: string;
  aujourdhui: string;
  onFermer: () => void;
  onInscrire: (o: Parameters<typeof inscrireOrdonnance>[1]) => Promise<string | null>;
}> = ({ storeId, aujourdhui, onFermer, onInscrire }) => {
  // Les mêmes médecins qu'au comptoir.
  const [prescripteurs, retenirPrescripteur] = useMemoireSaisie(`tn-prescripteurs:${storeId}`);
  const [v, setV] = useState({
    nom: "",
    age: "",
    telephone: "",
    prescripteur: "",
    date: "",
    notes: "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = (cle: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [cle]: e.target.value });

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.nom.trim()) return setErreur("Le nom du patient est obligatoire.");
    setEnvoi(true);
    const err = await onInscrire({
      patientNom: v.nom,
      patientAge: v.age,
      patientTelephone: v.telephone,
      patientClientId: null,
      prescripteur: v.prescripteur,
      datePrescription: v.date || null,
      organismeId: null,
      matricule: null,
      partOrganisme: 0,
      ticketId: null,
      notes: v.notes,
    });
    setEnvoi(false);
    setErreur(err);
    if (!err) retenirPrescripteur(v.prescripteur);
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="md"
      icon={<FilePlus2 className="h-4 w-4" />}
      title="Inscrire une ordonnance"
      description="Pour une délivrance passée sans l'ordonnancier. Le numéro suit le registre."
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button
            type="submit"
            form="ajout-ordonnance"
            disabled={envoi}
            className="app-btn-primary"
          >
            {envoi ? "Inscription…" : "Inscrire"}
          </button>
        </>
      }
    >
      <form id="ajout-ordonnance" onSubmit={valider} className="grid grid-cols-2 gap-3">
        <input
          value={v.nom}
          onChange={champ("nom")}
          placeholder="Nom du patient"
          className="app-field col-span-2"
          autoFocus
        />
        <input value={v.age} onChange={champ("age")} placeholder="Âge" className="app-field" />
        <input
          value={v.telephone}
          onChange={champ("telephone")}
          onBlur={() => setV({ ...v, telephone: formaterTelephone(v.telephone) })}
          placeholder="Téléphone"
          className="app-field"
        />
        <div className="col-span-2">
          <input
            value={v.prescripteur}
            onChange={champ("prescripteur")}
            placeholder="Médecin prescripteur"
            className="app-field"
          />
          <Raccourcis
            libelle="Médecins récents"
            options={prescripteurs.slice(0, 4)}
            actif={v.prescripteur}
            onChoisir={(p) => setV({ ...v, prescripteur: p })}
          />
        </div>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Date de l&apos;ordonnance
          </span>
          <input
            type="date"
            value={v.date}
            max={aujourdhui}
            onChange={champ("date")}
            className="app-field"
          />
          <Raccourcis
            libelle="Date de l'ordonnance"
            actif={v.date}
            onChoisir={(d) => setV({ ...v, date: d })}
            options={[
              { valeur: aujourdhui, libelle: "Aujourd'hui" },
              { valeur: decalerJour(aujourdhui, -1), libelle: "Hier" },
              { valeur: decalerJour(aujourdhui, -2), libelle: "Avant-hier" },
            ]}
          />
        </label>
        <input
          value={v.notes}
          onChange={champ("notes")}
          placeholder="Médicaments délivrés, remarques"
          className="app-field col-span-2"
        />
        {erreur && <p className="col-span-2 text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};
