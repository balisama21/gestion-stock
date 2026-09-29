import React, { useMemo } from "react";
import { Lead, Lien, TeteCarte, Vide } from "../components/Tn";
import { dateLocale, jourMoisChiffres, montant } from "../lib/format";
import { getSaleLabel } from "../../../utils/formulas";
import type { Expense, Product, Purchase, Sale } from "../../../types";
import { illVideArgent } from "../assets/images";

/**
 * MOUVEMENTS RÉCENTS — les dernières entrées et sorties d'argent.
 *
 * Les ventes pour ce qui en a été encaissé, les achats et les dépenses
 * pour leur montant : les trois postes qui font bouger la caisse au jour
 * le jour. Pas de colonne « solde » : un règlement de crédit arrivé plus
 * tard se range sous la date de la vente, et un solde recalculé ligne à
 * ligne serait faux.
 */

interface Mouvement {
  id: string;
  jour: string;
  ordre: string;
  description: string;
  type: string;
  montant: number;
}

export const CarteMouvementsArgent: React.FC<{
  ventes: Sale[];
  achats: Purchase[];
  depenses: Expense[];
  produits: Product[];
  /** Les achats ne paraissent que pour qui a le droit de voir leurs montants. */
  achatsVisibles: boolean;
  ventesVisibles: boolean;
  onToutVoir?: () => void;
}> = ({ ventes, achats, depenses, produits, achatsVisibles, ventesVisibles, onToutVoir }) => {
  const lignes = useMemo(() => {
    const tout: Mouvement[] = [];
    if (ventesVisibles) {
      for (const v of ventes) {
        if (v.montantPaye <= 0) continue;
        tout.push({
          id: `v${v.id}`,
          jour: v.date,
          ordre: v.saisieLe ?? "",
          description: `${getSaleLabel(v, produits)} × ${v.quantite}`,
          type: "Vente",
          montant: v.montantPaye,
        });
      }
    }
    if (achatsVisibles) {
      for (const a of achats) {
        tout.push({
          id: `a${a.id}`,
          jour: a.date,
          ordre: "",
          description: `${a.designation}${a.fournisseur ? ` · ${a.fournisseur}` : ""}`,
          type: "Achat",
          montant: -a.totalAchat,
        });
      }
    }
    for (const d of depenses) {
      tout.push({
        id: `d${d.id}`,
        jour: d.date,
        ordre: "",
        description: d.note?.trim() || d.type,
        type: d.type === "Achat de stock" ? "Achat" : "Dépense",
        montant: -d.montant,
      });
    }
    return tout
      .sort((a, b) => b.jour.localeCompare(a.jour) || b.ordre.localeCompare(a.ordre))
      .slice(0, 6);
  }, [ventes, achats, depenses, produits, achatsVisibles, ventesVisibles]);

  return (
    <article className="card" id="carte-mouvements-argent">
      <TeteCarte
        lead={<Lead nom="tasks" />}
        titre="Mouvements récents"
        action={<Lien onClick={onToutVoir}>Voir tout</Lien>}
      />
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th className="droite">Montant</th>
            </tr>
          </thead>
          {lignes.length > 0 && (
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap">{jourMoisChiffres(dateLocale(l.jour))}</td>
                  <td className="desc">{l.description}</td>
                  <td>
                    <span className={`pill ${l.montant >= 0 ? "" : "off"}`}>{l.type}</span>
                  </td>
                  <td className={`droite num nowrap ${l.montant >= 0 ? "pos" : "neg"}`}>
                    {l.montant >= 0 ? "+" : "−"}
                    {montant(Math.abs(l.montant))}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {lignes.length === 0 && (
        <Vide
          image={illVideArgent}
          largeur={124}
          titre="Aucune opération récente"
          detail="Les mouvements apparaîtront ici une fois enregistrés."
        />
      )}
    </article>
  );
};
