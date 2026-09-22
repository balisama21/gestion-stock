import React, { useState } from "react";
import { Wallet } from "lucide-react";
import { Modal } from "../shared/Modal";
import { montant as formaterMontant } from "../../features/documents/lib/format";
import type { DocumentCommercial } from "./documents";
import { MODES_DE_PAIEMENT, repartirLePaiement } from "./paiement";

/**
 * Enregistrer un règlement, total ou partiel.
 *
 * Le montant part sur le reste dû : c'est le cas courant, et le
 * changer demande une frappe plutôt que deux. Le statut de la pièce se
 * met à jour tout seul ensuite, parce qu'il se DÉDUIT du solde que la
 * base entretient — il n'y a rien à cocher.
 */
export const PaiementModal: React.FC<{
  document: DocumentCommercial;
  devise: string;
  enCours: boolean;
  erreur: string | null;
  onFermer: () => void;
  onValider: (montant: number, methode: string, reference: string) => void;
}> = ({ document: d, devise, enCours, erreur, onFermer, onValider }) => {
  const [montant, setMontant] = useState(String(Math.round(d.reste)));
  const [methode, setMethode] = useState<string>(MODES_DE_PAIEMENT[0].valeur);
  const [reference, setReference] = useState("");

  const valeur = Number(montant) || 0;
  const trop = valeur > d.reste;
  const parts = repartirLePaiement(d.ventes, valeur);
  const argent = (n: number) => formaterMontant(n, devise);

  return (
    <Modal
      open
      onClose={onFermer}
      size="md"
      icon={<Wallet className="h-4 w-4" />}
      title="Enregistrer un paiement"
      description={`${d.numero} · reste ${argent(d.reste)}`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valeur <= 0 || trop) return;
          onValider(valeur, methode, reference.trim());
        }}
      >
        <div>
          <label htmlFor="paiement-montant" className="mb-1.5 block text-sm font-medium">
            Montant reçu
          </label>
          <input
            id="paiement-montant"
            type="number"
            min={0}
            max={Math.round(d.reste)}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="app-field font-mono"
            autoFocus
          />
          {trop && (
            <p className="mt-1 text-xs t-danger">
              Le montant dépasse ce qui reste dû ({argent(d.reste)}).
            </p>
          )}
        </div>

        <div>
          <label htmlFor="paiement-methode" className="mb-1.5 block text-sm font-medium">
            Mode de paiement
          </label>
          <select
            id="paiement-methode"
            value={methode}
            onChange={(e) => setMethode(e.target.value)}
            className="app-field"
          >
            {MODES_DE_PAIEMENT.map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.libelle}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="paiement-reference" className="mb-1.5 block text-sm font-medium">
            Référence
          </label>
          <input
            id="paiement-reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Numéro de transaction, de chèque…"
            className="app-field"
          />
        </div>

        {/* Une facture à plusieurs lignes se règle ligne par ligne en
            base. On le dit plutôt que de le cacher : le commerçant
            retrouvera ces règlements dans l'écran Paiements. */}
        {parts.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Ce règlement se posera sur {parts.length} lignes de la facture, dans l&apos;ordre, en
            soldant chacune avant d&apos;entamer la suivante.
          </p>
        )}

        {erreur && <p className="text-xs t-danger">{erreur}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enCours || valeur <= 0 || trop}
            className="app-btn-primary flex-1"
          >
            {enCours ? "Enregistrement…" : `Encaisser ${argent(valeur)}`}
          </button>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  );
};
