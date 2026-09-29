import React, { useMemo } from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { AvatarInitiale } from "../../../components/shared/AvatarInitiale";
import { BoutonRepli } from "../components/BoutonRepli";
import { Lead, Lien, TeteCarte, Vide } from "../components/Tn";
import { LIGNES_EN_APERCU, useRepli } from "../lib/repli";
import { dateLocale, montant, montantMasque } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import { getSaleLabel } from "../../../utils/formulas";
import { VignetteProduit, vignettesParProduit } from "../../../components/shared/VignetteProduit";
import type { Product, Sale } from "../../../types";
import { illVideArgent } from "../assets/images";

/**
 * FIL DES VENTES — les dernières ventes, sur une frise.
 *
 * Il arrive replié sur trois lignes : la dernière vente répond souvent à
 * la question qu'on se pose en ouvrant l'écran. Le choix est retenu.
 */

const BADGE: Record<string, { texte: string; classe: string; icone: NomIcone }> = {
  Payé: { texte: "Payé", classe: "", icone: "checkcircle" },
  Partiel: { texte: "Partiel", classe: "wait", icone: "clock" },
  Impayé: { texte: "Crédit", classe: "crit", icone: "alertcircle" },
};

/** « 09:42 », seulement quand la saisie a eu lieu le jour même de la vente. */
function heureDeVente(v: Sale): string | null {
  if (!v.saisieLe) return null;
  const d = new Date(v.saisieLe);
  if (Number.isNaN(d.getTime()) || dateDuJour(d) !== v.date) return null;
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export const CarteFilVentes: React.FC<{
  ventes: Sale[];
  produits: Product[];
  images: { product_id: string | null; chemin: string; ordre: number }[];
  /** Les fiches clients, pour nommer l'acheteur d'une vente rattachée. */
  clients?: { id: string; nom: string }[];
  montantsVisibles: boolean;
  titre?: string;
  onToutVoir?: () => void;
}> = ({
  ventes,
  produits,
  images,
  clients = [],
  montantsVisibles,
  titre = "Fil des ventes",
  onToutVoir,
}) => {
  const vignettes = useMemo(() => vignettesParProduit(images), [images]);

  const { replie, basculer } = useRepli("tantana.dash.fil-replie");

  const parJour = useMemo(() => {
    const recentes = [...ventes]
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || (b.saisieLe ?? "").localeCompare(a.saisieLe ?? ""),
      )
      .slice(0, replie ? LIGNES_EN_APERCU : 8);
    const table = new Map<string, Sale[]>();
    for (const v of recentes) {
      const liste = table.get(v.date) ?? [];
      liste.push(v);
      table.set(v.date, liste);
    }
    return [...table.entries()];
  }, [ventes, replie]);

  const nomDuJour = (jour: string) =>
    dateLocale(jour).toLocaleDateString("fr-FR", { weekday: "long" });

  return (
    <article className={`card${replie ? " replie" : ""}`} id="carte-fil">
      <TeteCarte
        lead={<Lead nom="cart" />}
        titre={titre}
        action={
          <>
            <Lien onClick={onToutVoir}>Tout voir</Lien>
            <BoutonRepli
              replie={replie}
              onBasculer={basculer}
              quoi="le fil des ventes"
              className="plier-mini"
            />
          </>
        }
      />

      {parJour.length === 0 ? (
        <Vide
          image={illVideArgent}
          largeur={124}
          titre="Aucune vente enregistrée"
          detail="Les ventes du comptoir apparaîtront ici, jour après jour."
        />
      ) : (
        <div className="feed">
          {parJour.map(([jour, lignes]) => (
            <div className="day" key={jour}>
              {lignes.map((v) => {
                const produit = produits.find((p) => p.id === v.productId);
                const badge = BADGE[v.statutCredit] ?? BADGE["Payé"];
                const libelle = getSaleLabel(v, produits);
                const fiche = v.clientId ? clients.find((c) => c.id === v.clientId) : undefined;
                const client = (fiche?.nom ?? v.clientCredit)?.trim();
                const qui = client || "Vente au comptoir";
                const h = heureDeVente(v);
                const d = dateLocale(jour);
                return (
                  <div
                    className="r sale"
                    key={v.id}
                    title={v.vendeur ? `Vendu par ${v.vendeur}` : undefined}
                  >
                    <div className="d">
                      <b>
                        {String(d.getDate()).padStart(2, "0")}/
                        {String(d.getMonth() + 1).padStart(2, "0")}
                      </b>
                      <span className="jl">{nomDuJour(jour)}</span>
                      <span className="jc">{nomDuJour(jour).slice(0, 3)}.</span>
                      {h && <span>{h}</span>}
                    </div>
                    <span className="rail" aria-hidden="true">
                      <span className="dot" />
                    </span>
                    <AvatarInitiale nom={qui} taille={42} className="ava" />
                    <div className="who">
                      <b>{qui}</b>
                      <div className="prod">
                        <VignetteProduit
                          nom={libelle}
                          chemin={v.productId ? vignettes.get(v.productId) : null}
                          taille={32}
                        />
                        <span className="pl">
                          <span className="pn">{libelle}</span>
                          <span className="pq">
                            x{v.quantite}
                            {produit?.unite ? ` ${produit.unite}` : ""}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="fin">
                      <span className="amt num">
                        {montantsVisibles ? montant(v.totalVente) : montantMasque()}
                      </span>
                      <span className={`pill statut ${badge.classe}`}>
                        <Icone nom={badge.icone} />
                        {badge.texte}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </article>
  );
};
