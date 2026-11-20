import React, { useState } from "react";
import { Armchair } from "lucide-react";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { nomDeTable, type TableBar } from "../../lib/bar";

type Client = Database["public"]["Tables"]["clients"]["Row"];

const nomClient = (c: Client) => [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom;

/** Ouvrir une table libre : combien de personnes, et pour quel client (facultatif). */
export const OuvrirTableModal: React.FC<{
  table: TableBar;
  droit: number;
  clients: Client[];
  onFermer: () => void;
  onOuvrir: (o: { nbPersonnes: number | null; clientId: string | null }) => Promise<string | null>;
}> = ({ table, droit, clients, onFermer, onOuvrir }) => {
  const [personnes, setPersonnes] = useState("");
  const [clientId, setClientId] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const ouvrir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    const n = parseInt(personnes, 10);
    const err = await onOuvrir({
      nbPersonnes: Number.isFinite(n) && n > 0 ? n : null,
      clientId: clientId || null,
    });
    setEnvoi(false);
    setErreur(err);
  };

  return (
    <Modal
      open
      onClose={onFermer}
      size="sm"
      icon={<Armchair className="h-4 w-4" />}
      title={`Ouvrir ${nomDeTable(table.numero)}`}
      description={
        droit > 0
          ? `Le droit de table (${formatCurrency(droit)}) s'ajoute à l'addition.`
          : "La table passe en « occupée »."
      }
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="ouvrir-table" disabled={envoi} className="app-btn-primary">
            {envoi ? "Ouverture…" : "Ouvrir la table"}
          </button>
        </>
      }
    >
      <form id="ouvrir-table" onSubmit={ouvrir} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Nombre de personnes (facultatif)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={personnes}
            onChange={(e) => setPersonnes(e.target.value)}
            className="app-field"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Client (facultatif)
          </span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="app-field"
          >
            <option value="">Client de passage</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {nomClient(c)}
              </option>
            ))}
          </select>
        </label>
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};

export { nomClient };
