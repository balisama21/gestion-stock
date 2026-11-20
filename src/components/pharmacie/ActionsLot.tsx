import React, { useState } from "react";
import { CalendarClock, PackageMinus, PencilLine } from "lucide-react";
import { Modal } from "../shared/Modal";
import { finDeMois, moisAnnee, type LotPharma } from "../../lib/pharmacie";
import type { RaisonRetrait } from "../../hooks/usePharmacie";

type Resultat = { error: string | null };

const Champ: React.FC<{ libelle: string; children: React.ReactNode }> = ({ libelle, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{libelle}</span>
    {children}
  </label>
);

/** « 2028-03-31 » → « 2028-03 », la valeur d'un champ mois. */
const versMois = (jour: string | null) => (jour ? jour.slice(0, 7) : "");

const Fenetre: React.FC<{
  titre: string;
  description?: string;
  icone: React.ReactNode;
  envoi: boolean;
  libelle: string;
  danger?: boolean;
  onFermer: () => void;
  onValider: () => void;
  children: React.ReactNode;
}> = ({ titre, description, icone, envoi, libelle, danger, onFermer, onValider, children }) => (
  <Modal
    open
    onClose={onFermer}
    size="sm"
    icon={icone}
    title={titre}
    description={description}
    dismissible={!envoi}
    tone={danger ? "danger" : "default"}
    footer={
      <>
        <button type="button" onClick={onFermer} className="app-btn-secondary">
          Annuler
        </button>
        <button type="button" onClick={onValider} disabled={envoi} className="app-btn-primary">
          {envoi ? "Enregistrement…" : libelle}
        </button>
      </>
    }
  >
    <div className="space-y-3">{children}</div>
  </Modal>
);

/** Donner un numéro et une date au stock qui n'en a pas. */
export const DaterStockModal: React.FC<{
  nom: string;
  sansDate: number;
  onFermer: () => void;
  onDater: (numero: string | null, date: string | null, quantite: number) => Promise<Resultat>;
}> = ({ nom, sansDate, onFermer, onDater }) => {
  const [numero, setNumero] = useState("");
  const [mois, setMois] = useState("");
  const [quantite, setQuantite] = useState(String(sansDate));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    const q = parseInt(quantite, 10);
    const date = finDeMois(mois);
    if (!date) return setErreur("Indiquez le mois de péremption imprimé sur la boîte.");
    if (!Number.isFinite(q) || q <= 0 || q > sansDate)
      return setErreur(`Entre 1 et ${sansDate} unité(s).`);
    setEnvoi(true);
    const r = await onDater(numero.trim() || null, date, q);
    setEnvoi(false);
    if (r.error) setErreur(r.error);
    else onFermer();
  };

  return (
    <Fenetre
      titre="Dater le stock"
      description={`${nom} : ${sansDate} unité(s) sans date. Le stock ne change pas.`}
      icone={<CalendarClock className="h-4 w-4" />}
      envoi={envoi}
      libelle="Dater"
      onFermer={onFermer}
      onValider={valider}
    >
      <Champ libelle="Numéro de lot (facultatif)">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.toUpperCase())}
          className="app-field"
          autoFocus
        />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Périme fin">
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="app-field"
          />
        </Champ>
        <Champ libelle="Quantité">
          <input
            inputMode="numeric"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className="app-field"
          />
        </Champ>
      </div>
      <p className="text-xs text-muted-foreground">
        Plusieurs dates ? Datez une partie, puis recommencez pour le reste.
      </p>
      {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
    </Fenetre>
  );
};

/** Corriger une faute de saisie : numéro ou date d'un lot. */
export const CorrigerLotModal: React.FC<{
  lot: LotPharma;
  onFermer: () => void;
  onCorriger: (numero: string | null, date: string | null) => Promise<Resultat>;
}> = ({ lot, onFermer, onCorriger }) => {
  const [numero, setNumero] = useState(lot.numero_lot ?? "");
  const [mois, setMois] = useState(versMois(lot.date_peremption));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    const date = mois ? finDeMois(mois) : null;
    if (mois && !date) return setErreur("Mois invalide.");
    setEnvoi(true);
    const r = await onCorriger(numero.trim() || null, date);
    setEnvoi(false);
    if (r.error) setErreur(r.error);
    else onFermer();
  };

  return (
    <Fenetre
      titre="Corriger le lot"
      description={`Reçu le ${lot.recu_le.split("-").reverse().join("/")} · ${lot.quantite} en rayon`}
      icone={<PencilLine className="h-4 w-4" />}
      envoi={envoi}
      libelle="Enregistrer"
      onFermer={onFermer}
      onValider={valider}
    >
      <Champ libelle="Numéro de lot">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.toUpperCase())}
          className="app-field"
          autoFocus
        />
      </Champ>
      <Champ libelle="Périme fin">
        <input
          type="month"
          value={mois}
          onChange={(e) => setMois(e.target.value)}
          className="app-field"
        />
      </Champ>
      {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
    </Fenetre>
  );
};

const RAISONS: { valeur: RaisonRetrait; libelle: string }[] = [
  { valeur: "perime", libelle: "Périmé" },
  { valeur: "retour_fournisseur", libelle: "Rendu au fournisseur" },
  { valeur: "casse", libelle: "Cassé ou abîmé" },
  { valeur: "autre", libelle: "Autre" },
];

/** Sortir un lot du rayon : il quitte le stock, le retrait reste tracé. */
export const RetirerLotModal: React.FC<{
  lot: LotPharma;
  nom: string;
  raisonParDefaut?: RaisonRetrait;
  onFermer: () => void;
  onRetirer: (quantite: number, raison: RaisonRetrait, note: string | null) => Promise<Resultat>;
}> = ({ lot, nom, raisonParDefaut = "perime", onFermer, onRetirer }) => {
  const [quantite, setQuantite] = useState(String(lot.quantite));
  const [raison, setRaison] = useState<RaisonRetrait>(raisonParDefaut);
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    const q = parseInt(quantite, 10);
    if (!Number.isFinite(q) || q <= 0 || q > lot.quantite)
      return setErreur(`Entre 1 et ${lot.quantite} unité(s).`);
    setEnvoi(true);
    const r = await onRetirer(q, raison, note.trim() || null);
    setEnvoi(false);
    if (r.error) setErreur(r.error);
    else onFermer();
  };

  return (
    <Fenetre
      titre="Retirer du rayon"
      description={`${nom} · lot ${lot.numero_lot ?? "sans numéro"}${
        lot.date_peremption ? ` · ${moisAnnee(lot.date_peremption)}` : ""
      }`}
      icone={<PackageMinus className="h-4 w-4" />}
      envoi={envoi}
      libelle="Retirer"
      danger
      onFermer={onFermer}
      onValider={valider}
    >
      <div className="flex flex-wrap gap-2">
        {RAISONS.map((r) => (
          <button
            key={r.valeur}
            type="button"
            onClick={() => setRaison(r.valeur)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              raison === r.valeur
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {r.libelle}
          </button>
        ))}
      </div>
      <Champ libelle={`Quantité (sur ${lot.quantite})`}>
        <input
          inputMode="numeric"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          className="app-field"
        />
      </Champ>
      <Champ libelle="Note (facultatif)">
        <input value={note} onChange={(e) => setNote(e.target.value)} className="app-field" />
      </Champ>
      {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
    </Fenetre>
  );
};
