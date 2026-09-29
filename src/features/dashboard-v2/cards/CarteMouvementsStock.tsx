import React, { useMemo } from "react";
import { Lead, Lien, TeteCarte, Vide } from "../components/Tn";
import { montant, montantMasque, nombre } from "../lib/format";
import type { MouvementStock } from "../hooks/useDashboardData";
import type { Product } from "../../../types";
import { illVideStock } from "../assets/images";

/**
 * MOUVEMENTS DE STOCK — les derniers mouvements de la période, tels
 * qu'écrits dans `stock_movements`, valorisés au prix d'achat du produit.
 */

const TYPES: Record<string, string> = {
  achat: "Achat",
  achat_suppression: "Achat annulé",
  vente: "Vente",
  vente_modification: "Vente modifiée",
  vente_suppression: "Vente annulée",
  commande_reservation: "Réservation",
  commande_liberation: "Libération",
  commande_livraison: "Livraison",
  commande_annulation_apres_livraison: "Retour",
  ajustement: "Ajustement",
};

export const CarteMouvementsStock: React.FC<{
  mouvements: MouvementStock[];
  produits: Product[];
  prixVisibles: boolean;
  onToutVoir?: () => void;
}> = ({ mouvements, produits, prixVisibles, onToutVoir }) => {
  const lignes = useMemo(() => {
    const parId = new Map(produits.map((p) => [p.id, p]));
    return [...mouvements]
      .filter((m) => m.stock_actuel_delta !== 0)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6)
      .map((m) => ({ m, produit: m.product_id ? parId.get(m.product_id) : undefined }));
  }, [mouvements, produits]);

  return (
    <article className="card gap" id="carte-mouvements-stock">
      <TeteCarte
        lead={<Lead nom="history" />}
        titre="Mouvements de stock"
        action={<Lien onClick={onToutVoir}>Voir tout</Lien>}
      />
      <div className="scroll-x">
        <table className="tbl large">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th>Type</th>
              <th className="droite">Quantité</th>
              <th className="droite">Prix unitaire</th>
              <th className="droite">Valeur</th>
            </tr>
          </thead>
          {lignes.length > 0 && (
            <tbody>
              {lignes.map(({ m, produit }) => {
                const prix = produit?.prixAchat ?? 0;
                const d = m.stock_actuel_delta;
                return (
                  <tr key={m.id}>
                    <td className="nowrap">
                      {new Date(m.created_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="desc">{produit?.displayName || produit?.designation || "—"}</td>
                    <td>
                      <span className={`pill ${d > 0 ? "" : "bleu"}`}>
                        {TYPES[m.type_mouvement] ?? m.type_mouvement}
                      </span>
                    </td>
                    <td className={`droite num ${d > 0 ? "pos" : "bleu"}`}>
                      {d > 0 ? "+" : "−"}
                      {nombre(Math.abs(d))}
                    </td>
                    <td className="droite num nowrap">
                      {prixVisibles ? montant(prix) : montantMasque()}
                    </td>
                    <td className="droite num nowrap">
                      {prixVisibles ? montant(Math.abs(d) * prix) : montantMasque()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
      {lignes.length === 0 && (
        <Vide
          image={illVideStock}
          largeur={140}
          titre="Aucun mouvement récent"
          detail="Les mouvements de stock apparaîtront ici une fois enregistrés."
        />
      )}
    </article>
  );
};
