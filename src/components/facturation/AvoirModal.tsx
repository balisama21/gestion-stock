import React, { useMemo, useState } from "react";
import { FileMinus } from "lucide-react";
import { Modal } from "../shared/Modal";
import { montant as formaterMontant } from "../../features/documents/lib/format";
import type { DocumentCommercial } from "./documents";

/**
 * L'AVOIR : LA PIÈCE QUI ANNULE UNE FACTURE.
 *
 * « Une facture émise ne se supprime JAMAIS et ne se modifie plus.
 * Pour l'annuler ou la corriger, on crée un AVOIR. »
 *
 * ── IL NE REMBOURSE PAS DE LUI-MÊME ────────────────────────────────
 *
 * C'est la décision qui garantit qu'aucune opération n'est comptée deux
 * fois : l'argent rendu passe par le remboursement, la marchandise
 * reprise par l'ajustement de stock, chacun une seule fois et par son
 * chemin habituel. Les deux cases sont donc DÉCOCHÉES : on les coche
 * quand c'est vrai, pas par défaut.
 *
 * ── LE CHIFFRE D'AFFAIRES DU MOIS PASSÉ NE CHANGE PAS ──────────────
 *
 * Le montant de la facture d'origine reste dans sa période. On ne
 * réécrit pas un mois déjà lu : le contre-mouvement porte sa propre
 * date, comme en comptabilité.
 */

export interface SaisieAvoir {
  montant: number;
  motif: string;
  rembourser: boolean;
  remettreEnStock: boolean;
}

export const AvoirModal: React.FC<{
  document: DocumentCommercial;
  devise: string;
  enCours: boolean;
  erreur: string | null;
  onFermer: () => void;
  onValider: (saisie: SaisieAvoir) => void;
}> = ({ document: d, devise, enCours, erreur, onFermer, onValider }) => {
  const [montant, setMontant] = useState(String(Math.round(d.montant)));
  const [motif, setMotif] = useState("");
  const [rembourser, setRembourser] = useState(false);
  const [remettreEnStock, setRemettreEnStock] = useState(false);

  const valeur = Number(montant) || 0;
  const trop = valeur > d.montant;
  const argent = (n: number) => formaterMontant(n, devise);

  /* On ne rend que ce qui a été encaissé. Proposer de rembourser une
     facture jamais réglée ferait sortir de la caisse un argent qui n'y
     est jamais entré. */
  const remboursable = Math.min(valeur, d.paye);

  const articles = useMemo(
    () => d.ventes.filter((v) => v.productId && v.quantite > 0),
    [d.ventes],
  );

  const partiel = valeur > 0 && valeur < d.montant;

  return (
    <Modal
      open
      onClose={onFermer}
      size="lg"
      icon={<FileMinus className="h-4 w-4" />}
      title="Établir un avoir"
      description={`Sur la facture ${d.numero}`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valeur <= 0 || trop) return;
          onValider({ montant: valeur, motif: motif.trim(), rembourser, remettreEnStock });
        }}
      >
        <div>
          <label htmlFor="avoir-montant" className="mb-1.5 block text-sm font-medium">
            Montant de l&apos;avoir
          </label>
          <input
            id="avoir-montant"
            type="number"
            min={0}
            max={Math.round(d.montant)}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="app-field font-mono"
            autoFocus
          />
          {trop && (
            <p className="mt-1 text-xs t-danger">
              Un avoir ne rend jamais plus que ce que la facture a porté ({argent(d.montant)}).
            </p>
          )}
          {partiel && !trop && (
            <p className="mt-1 text-xs text-muted-foreground">
              Avoir partiel : la facture reste due pour {argent(d.montant - valeur)} et ne passera
              pas en « Annulée ».
            </p>
          )}
        </div>

        <div>
          <label htmlFor="avoir-motif" className="mb-1.5 block text-sm font-medium">
            Motif
          </label>
          <input
            id="avoir-motif"
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Erreur de facturation, retour de marchandise…"
            className="app-field"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Il s&apos;imprime sur l&apos;avoir : c&apos;est ce que le client lira.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">
            L&apos;avoir est une pièce : il ne rembourse rien et ne remet rien en stock de
            lui-même. Cochez ce qui a réellement eu lieu.
          </p>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={rembourser}
              disabled={remboursable <= 0}
              onChange={(e) => setRembourser(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Enregistrer aussi le remboursement
              {remboursable > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  {argent(remboursable)} sortiront de la caisse.
                </span>
              ) : (
                <span className="block text-xs text-muted-foreground">
                  Rien n&apos;a été encaissé sur cette facture : il n&apos;y a rien à rendre.
                </span>
              )}
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={remettreEnStock}
              disabled={articles.length === 0 || partiel}
              onChange={(e) => setRemettreEnStock(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Remettre les articles en stock
              {articles.length === 0 ? (
                <span className="block text-xs text-muted-foreground">
                  Cette facture ne porte aucun article du catalogue.
                </span>
              ) : partiel ? (
                <span className="block text-xs text-muted-foreground">
                  Impossible sur un avoir partiel : on ne saurait pas quels articles reviennent.
                </span>
              ) : (
                <span className="block text-xs text-muted-foreground">
                  {articles.map((v) => `${v.quantite} × ${v.designation}`).join(", ")}
                </span>
              )}
            </span>
          </label>
        </div>

        {erreur && <p className="text-xs t-danger">{erreur}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enCours || valeur <= 0 || trop}
            className="app-btn-primary flex-1"
          >
            {enCours ? "Enregistrement…" : "Établir l'avoir"}
          </button>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  );
};
