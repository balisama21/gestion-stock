import React, { useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  History,
  MapPin,
  PackageMinus,
  PencilLine,
  Pill,
  Repeat,
} from "lucide-react";
import type { Product } from "../../types";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import {
  equivalents,
  etatStock,
  libelleRegime,
  lotsEnRayon,
  moisAnnee,
  type LotPharma,
  type MouvementLot,
} from "../../lib/pharmacie";
import type { Pharmacie } from "../../hooks/usePharmacie";
import { BadgeFroid, BadgePeremption, BadgeRegime } from "./badges";
import { CorrigerLotModal, DaterStockModal, RetirerLotModal } from "./ActionsLot";
import { EtiquetteLot } from "./ui";

type Onglet = "lots" | "fiche" | "equivalents";

const LIBELLE_MOTIF: Record<MouvementLot["motif"], string> = {
  reception: "Reçu",
  stock_date: "Stock daté",
  vente: "Vendu",
  retour: "Revenu (vente annulée)",
  retrait: "Retiré",
  correction: "Correction de stock",
};

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/** Un médicament : ses lots (le cœur), sa fiche, ses équivalents. */
export const FicheMedicament: React.FC<{
  produit: Product;
  produits: Product[];
  pharma: Pharmacie;
  aujourdhui: string;
  peutModifier: boolean;
  onModifier: () => void;
  onOuvrir: (p: Product) => void;
  /** Un retrait a changé le stock du produit. */
  onStockModifie: () => void;
  onFermer: () => void;
}> = ({
  produit,
  produits,
  pharma,
  aujourdhui,
  peutModifier,
  onModifier,
  onOuvrir,
  onStockModifie,
  onFermer,
}) => {
  const fiche = pharma.ficheDe.get(produit.id);
  const lots = lotsEnRayon(pharma.lots, produit.id, aujourdhui);
  const etat = etatStock(produit, pharma.lots, aujourdhui);
  const equiv = equivalents(produit, pharma.ficheDe, produits);
  const [onglet, setOnglet] = useState<Onglet>("lots");
  const [dater, setDater] = useState(false);
  const [aCorriger, setACorriger] = useState<LotPharma | null>(null);
  const [aRetirer, setARetirer] = useState<LotPharma | null>(null);
  const [historique, setHistorique] = useState<{ lotId: string; lignes: MouvementLot[] } | null>(
    null,
  );

  const voirHistorique = async (lot: LotPharma) => {
    if (historique?.lotId === lot.id) return setHistorique(null);
    setHistorique({ lotId: lot.id, lignes: [] });
    const lignes = await pharma.mouvementsDuLot(lot.id);
    setHistorique({ lotId: lot.id, lignes });
  };

  const description = [fiche?.dci, fiche?.forme, fiche?.laboratoire].filter(Boolean).join(" · ");

  return (
    <Modal
      open
      onClose={onFermer}
      size="3xl"
      icon={<Pill className="h-4 w-4" />}
      title={produit.displayName}
      description={description || undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <BadgeRegime regime={fiche?.regime} />
          <BadgeFroid conservation={fiche?.conservation} />
          {fiche?.emplacement && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {fiche.emplacement}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border p-3">
            <p
              className={`text-lg font-bold tabular-nums ${
                produit.stockActuel <= 0 ? "t-danger" : ""
              }`}
            >
              {produit.stockActuel}
            </p>
            <p className="text-xs text-muted-foreground">en stock</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(produit.prixVenteDefaut)}
            </p>
            <p className="text-xs text-muted-foreground">prix de vente</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            {etat.prochaine ? (
              <BadgePeremption date={etat.prochaine} aujourdhui={aujourdhui} />
            ) : (
              <p className="text-lg font-bold">—</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">prochaine péremption</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
          {(
            [
              ["lots", `Lots (${lots.length})`],
              ["fiche", "Fiche"],
              ["equivalents", `Équivalents (${equiv.length})`],
            ] as [Onglet, string][]
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={onglet === cle}
              onClick={() => setOnglet(cle)}
              className={`rounded-lg py-1.5 text-sm font-medium ${
                onglet === cle ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>

        {onglet === "lots" && (
          <div className="space-y-3">
            {etat.sansDate > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm">
                <CalendarClock className="h-4 w-4 shrink-0 t-warning" />
                <span className="flex-1">{etat.sansDate} unité(s) sans date de péremption.</span>
                <button type="button" onClick={() => setDater(true)} className="app-btn-secondary">
                  Dater
                </button>
              </div>
            )}
            {lots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Aucun lot en rayon. Le stock arrive par une réception, avec son numéro et sa date.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {lots.map((lot, i) => (
                  <li key={lot.id} className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <EtiquetteLot numero={lot.numero_lot} />
                        {i === 0 && (
                          <span className="ml-2 text-xs text-primary">sort en premier</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          Reçu le {lot.recu_le.split("-").reverse().join("/")}
                          {lot.fournisseur ? ` · ${lot.fournisseur}` : ""}
                          {lot.date_peremption ? ` · fin ${moisAnnee(lot.date_peremption)}` : ""}
                        </span>
                      </span>
                      <BadgePeremption date={lot.date_peremption} aujourdhui={aujourdhui} />
                      <span className="w-12 text-right font-semibold tabular-nums">
                        {lot.quantite}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => voirHistorique(lot)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <History className="h-3.5 w-3.5" />
                        Historique
                        <ChevronDown
                          className={`h-3 w-3 ${historique?.lotId === lot.id ? "rotate-180" : ""}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setACorriger(lot)}
                        className="flex items-center gap-1 text-primary"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                        Corriger
                      </button>
                      <button
                        type="button"
                        onClick={() => setARetirer(lot)}
                        className="flex items-center gap-1 t-danger"
                      >
                        <PackageMinus className="h-3.5 w-3.5" />
                        Retirer
                      </button>
                    </div>
                    {historique?.lotId === lot.id && (
                      <ul className="mt-2 space-y-1 rounded-lg bg-muted/50 p-2 text-xs">
                        {historique.lignes.length === 0 && (
                          <li className="text-muted-foreground">Chargement…</li>
                        )}
                        {historique.lignes.map((m) => (
                          <li key={m.id} className="flex gap-2">
                            <span className="w-16 shrink-0 text-muted-foreground">
                              {dateCourte(m.cree_le)}
                            </span>
                            <span className="flex-1">
                              {LIBELLE_MOTIF[m.motif]}
                              {m.motif === "retrait" && m.detail ? ` · ${m.detail}` : ""}
                            </span>
                            <span
                              className={`font-semibold tabular-nums ${
                                m.quantite < 0 ? "text-muted-foreground" : "t-success"
                              }`}
                            >
                              {m.quantite > 0 ? `+${m.quantite}` : m.quantite}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {onglet === "fiche" && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border p-3 text-sm">
              {(
                [
                  ["Molécule", fiche?.dci],
                  ["Dosage", fiche?.dosage],
                  ["Forme", fiche?.forme],
                  ["Laboratoire", fiche?.laboratoire],
                  ["Délivrance", libelleRegime(fiche?.regime)],
                  [
                    "Conservation",
                    fiche?.conservation === "frais" ? "Au frais" : "Température ambiante",
                  ],
                  ["Emplacement", fiche?.emplacement],
                  ["Prix d'achat", formatCurrency(produit.prixAchat)],
                  ["Alerte sous", String(produit.seuilAlerte)],
                  ["Code-barres", produit.codeBarres],
                ] as [string, string | null | undefined][]
              ).map(([t, val]) => (
                <div key={t}>
                  <dt className="text-xs text-muted-foreground">{t}</dt>
                  <dd className="font-medium">{val || "—"}</dd>
                </div>
              ))}
            </dl>
            {fiche?.notes && <p className="rounded-xl bg-muted/50 p-3 text-sm">{fiche.notes}</p>}
            {peutModifier && (
              <button type="button" onClick={onModifier} className="app-btn-secondary">
                <PencilLine className="h-4 w-4" />
                Modifier la fiche
              </button>
            )}
          </div>
        )}

        {onglet === "equivalents" &&
          (equiv.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {fiche?.dci
                ? "Aucun autre médicament de la même molécule dans votre catalogue."
                : "Renseignez la molécule (DCI) dans la fiche pour trouver les équivalents."}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {equiv.map((p) => {
                const f = pharma.ficheDe.get(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOuvrir(p)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50"
                    >
                      <Repeat className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[f?.forme, f?.laboratoire].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span
                        className={`text-xs tabular-nums ${p.stockActuel > 0 ? "" : "t-danger"}`}
                      >
                        {p.stockActuel > 0 ? `${p.stockActuel} en stock` : "rupture"}
                      </span>
                      <span className="w-24 text-right font-semibold tabular-nums">
                        {formatCurrency(p.prixVenteDefaut)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
      </div>

      {dater && (
        <DaterStockModal
          nom={produit.displayName}
          sansDate={etat.sansDate}
          onFermer={() => setDater(false)}
          onDater={(numero, date, quantite) =>
            pharma.daterStock(produit.id, numero, date, quantite)
          }
        />
      )}
      {aCorriger && (
        <CorrigerLotModal
          lot={aCorriger}
          onFermer={() => setACorriger(null)}
          onCorriger={(numero, date) => pharma.corrigerLot(aCorriger.id, numero, date)}
        />
      )}
      {aRetirer && (
        <RetirerLotModal
          lot={aRetirer}
          nom={produit.displayName}
          raisonParDefaut={
            aRetirer.date_peremption && aRetirer.date_peremption < aujourdhui ? "perime" : "casse"
          }
          onFermer={() => setARetirer(null)}
          onRetirer={async (q, raison, note) => {
            const r = await pharma.retirerLot(aRetirer.id, q, raison, note);
            if (!r.error) onStockModifie();
            return r;
          }}
        />
      )}
    </Modal>
  );
};
