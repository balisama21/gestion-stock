import React, { useMemo } from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatVide } from "../components/States";
import { dateLocale, jourMoisChiffres, montant } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import { getSaleLabel, quantiteEnMots } from "../../../utils/formulas";
import { VignetteProduit, vignettesParProduit } from "../../../components/shared/VignetteProduit";
import type { Product, Sale } from "../../../types";

/**
 * 9. FIL DES VENTES
 *
 * Un journal, groupé par jour : la date à gauche, les lignes du jour
 * accrochées à un filet vertical. C'est la forme que prend un
 * historique qu'on parcourt, par opposition au tableau qu'on trie.
 *
 * ── LA PHOTO PLUTÔT QUE LA LETTRE ──
 *
 * La maquette pose un carré de couleur portant l'initiale du produit.
 * L'application a une règle contraire, demandée pour TOUS ses écrans :
 * la vraie photo sans cadre ni fond quand elle existe, et RIEN quand
 * elle manque — pas de carré à initiale, pas de silhouette. La place,
 * elle, reste, sinon les lignes sans photo cesseraient de s'aligner.
 * `VignetteProduit` fait exactement cela ; on s'en sert.
 *
 * ── UNE SEULE COULEUR PAR LIGNE ──
 *
 * Celle du badge de paiement. Ni le montant, ni la quantité, ni la date
 * ne se colorent : chaque teinte de plus affaiblit la seule qui porte
 * vraiment un sens.
 *
 * ── LA QUANTITÉ SE DIT EN TOUTES LETTRES ──
 *
 * « 20 unités », jamais « ×20 » : collé au nom du produit, l'abrégé se
 * lit comme une référence de catalogue.
 */

const BADGE: Record<string, { texte: string; classe: string }> = {
  Payé: { texte: "Payé", classe: "" },
  Partiel: { texte: "Partiel", classe: "partiel" },
  Impayé: { texte: "Crédit", classe: "credit" },
};

export const CarteFilVentes: React.FC<{
  ventes: Sale[];
  produits: Product[];
  images: { product_id: string | null; chemin: string; ordre: number }[];
  montantsVisibles: boolean;
  /** Renommée « Mes ventes » quand la portée est limitée au lecteur. */
  titre?: string;
  onToutVoir?: () => void;
}> = ({ ventes, produits, images, montantsVisibles, titre = "Fil des ventes", onToutVoir }) => {
  const aujourdhui = dateDuJour();
  const vignettes = useMemo(() => vignettesParProduit(images), [images]);

  /**
   * Les huit dernières lignes, groupées par jour, du plus récent au plus
   * ancien.
   *
   * Huit et non douze : chaque jour coûte une ligne de date en plus, et
   * au-delà la carte dépasse d'une tête celles qui l'entourent. Ce fil
   * sert à voir ce qui vient de se passer ; l'historique complet a sa
   * page.
   */
  const parJour = useMemo(() => {
    const recentes = [...ventes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const table = new Map<string, Sale[]>();
    for (const v of recentes) {
      const liste = table.get(v.date) ?? [];
      liste.push(v);
      table.set(v.date, liste);
    }
    return [...table.entries()];
  }, [ventes]);

  const nomDuJour = (jour: string) => {
    if (jour === aujourdhui) return "aujourd'hui";
    const d = dateLocale(jour);
    return d.toLocaleDateString("fr-FR", { weekday: "long" });
  };

  return (
    <Card span={8} secondary id="carte-fil">
      <CardHeader
        title={titre}
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
            <path d="M9 7h6M9 11h6" />
          </svg>
        }
        action={
          onToutVoir && (
            <button className="link" type="button" onClick={onToutVoir}>
              Tout voir
            </button>
          )
        }
      />

      {parJour.length === 0 ? (
        <EtatVide
          titre="Aucune vente enregistrée"
          detail="Les ventes du comptoir apparaîtront ici, jour après jour."
        />
      ) : (
        <div className="feed">
          {parJour.map(([jour, lignes]) => (
            <div className="day" key={jour}>
              <div className="when">
                <b>{jourMoisChiffres(dateLocale(jour))}</b>
                {nomDuJour(jour)}
              </div>
              <div className="items">
                {lignes.map((v) => {
                  const produit = produits.find((p) => p.id === v.productId);
                  const badge = BADGE[v.statutCredit] ?? BADGE["Payé"];
                  return (
                    <div className="sale" key={v.id}>
                      <VignetteProduit
                        nom={getSaleLabel(v, produits)}
                        chemin={v.productId ? vignettes.get(v.productId) : null}
                        taille={34}
                      />
                      <div style={{ minWidth: 0 }}>
                        <b>{getSaleLabel(v, produits)}</b>
                        <small>
                          {quantiteEnMots(v.quantite, produit?.unite)} · {v.vendeur}
                        </small>
                      </div>
                      <div className="amt num">
                        {montantsVisibles ? montant(v.totalVente) : "••• Ar"}
                      </div>
                      <span className={`paid ${badge.classe}`}>{badge.texte}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
