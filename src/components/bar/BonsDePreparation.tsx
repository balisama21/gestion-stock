import React, { useCallback, useMemo, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Printer } from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { dateDuJour } from "../../lib/dates";
import { imprimerFeuille } from "../../features/documents/lib/imprimer";
import {
  bonsDeLaCommande,
  enregistrerReglagesBons,
  LIBELLE_POSTE,
  lireReglagesBons,
  posteParDefaut,
  prochainNumeroDeBon,
  type ArticleDuBon,
  type Bon,
  type Poste,
  type ReglagesBons,
} from "../../lib/bonsBar";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

export interface ContexteBon {
  table: string;
  serveur: string | null;
  reimpression?: boolean;
}

interface BonsAImprimer {
  bons: Bon[];
  numero: number;
  heure: string;
  contexte: ContexteBon;
}

/**
 * Les bons de préparation d'une salle : le réglage de cet appareil, et
 * l'impression d'une commande.
 *
 * Le bon est rendu dans un portail, enfant direct de <body>, que la
 * feuille de style d'impression est seule à montrer le temps de l'appel
 * (classe `impression-bon` sur <body>) : le reste de l'application, la
 * fenêtre de la note comprise, ne sort pas sur le papier.
 */
export function useBonsDePreparation(
  storeId: string,
  products: Product[],
  categories: Categorie[],
) {
  const [reglages, setReglages] = useState<ReglagesBons>(() => lireReglagesBons(storeId));
  const [aImprimer, setAImprimer] = useState<BonsAImprimer | null>(null);

  const changer = useCallback(
    (r: ReglagesBons) => {
      enregistrerReglagesBons(storeId, r);
      setReglages(r);
    },
    [storeId],
  );

  const rubriqueDuProduit = useMemo(() => {
    const parId = new Map(categories.map((c) => [c.id, { id: c.id, nom: c.nom }]));
    return new Map(
      products.map((p) => [p.id, p.categoryId ? (parId.get(p.categoryId) ?? null) : null]),
    );
  }, [products, categories]);

  const lancer = useCallback(
    (bons: Bon[], contexte: ContexteBon): string | null => {
      if (bons.length === 0) return "Rien à préparer dans cette commande : aucun bon imprimé.";
      flushSync(() =>
        setAImprimer({
          bons,
          numero: prochainNumeroDeBon(storeId, dateDuJour()),
          heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          contexte,
        }),
      );
      document.body.classList.add("impression-bon");
      try {
        imprimerFeuille(reglages.largeur);
      } finally {
        document.body.classList.remove("impression-bon");
      }
      return null;
    },
    [reglages.largeur, storeId],
  );

  /** Imprime les bons d'une commande. Rend un message quand il n'y a rien à imprimer. */
  const imprimer = useCallback(
    (articles: ArticleDuBon[], contexte: ContexteBon) =>
      lancer(bonsDeLaCommande(articles, rubriqueDuProduit, reglages.postes), contexte),
    [lancer, rubriqueDuProduit, reglages.postes],
  );

  /** Un bon de contrôle : une ligne par rubrique, chacune vers son poste. */
  const imprimerControle = useCallback(
    (rubriques: { id: string; nom: string }[]) => {
      const articles = rubriques.map((c, i) => ({
        productId: `controle-${i}`,
        designation: c.nom,
        quantite: 1,
      }));
      const parArticle = new Map(rubriques.map((c, i) => [`controle-${i}`, c]));
      return (
        lancer(bonsDeLaCommande(articles, parArticle, reglages.postes), {
          table: "Bon de contrôle",
          serveur: null,
        }) ?? "Bon de contrôle envoyé à l'imprimante."
      );
    },
    [lancer, reglages.postes],
  );

  const portail =
    aImprimer && typeof document !== "undefined"
      ? createPortal(<FeuilleDeBons {...aImprimer} largeur={reglages.largeur} />, document.body)
      : null;

  return { reglages, changer, imprimer, imprimerControle, portail };
}

export type BonsDePreparation = ReturnType<typeof useBonsDePreparation>;

const FeuilleDeBons: React.FC<BonsAImprimer & { largeur: number }> = ({
  bons,
  numero,
  heure,
  contexte,
  largeur,
}) => (
  <div className="bon-impression" aria-hidden="true">
    {bons.map((b) => (
      <div key={b.poste} className="bon" style={{ width: `${largeur - 6}mm` }}>
        <p className="bon-poste">{LIBELLE_POSTE[b.poste].toUpperCase()}</p>
        <p className="bon-table">{contexte.table}</p>
        <p className="bon-detail">
          {heure} · Bon n° {numero}
          {contexte.serveur ? ` · ${contexte.serveur}` : ""}
        </p>
        {contexte.reimpression && <p className="bon-detail">*** RÉIMPRESSION ***</p>}
        <div className="bon-lignes">
          {b.lignes.map((l) => (
            <p key={l.designation} className="bon-ligne">
              <span className="bon-quantite">{l.quantite}</span>
              <span>{l.designation}</span>
            </p>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/** Le réglage des bons sur cet appareil. */
export const ReglagesBonsModal: React.FC<{
  bons: BonsDePreparation;
  categories: Categorie[];
  onFermer: () => void;
}> = ({ bons, categories, onFermer }) => {
  const { reglages, changer } = bons;
  const [message, setMessage] = useState<string | null>(null);
  const rubriques = categories
    .filter((c) => (c.usage ?? "produit") === "produit" && c.actif !== false)
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));

  return (
    <Modal
      open
      onClose={onFermer}
      size="lg"
      icon={<Printer className="h-4 w-4" />}
      title="Bons de préparation"
      description="Un bon pour le bar, un pour la cuisine, à chaque commande envoyée."
      footer={
        <button type="button" onClick={onFermer} className="app-btn-primary">
          Terminé
        </button>
      }
    >
      <div className="space-y-5">
        <label className="flex items-start gap-3 rounded-xl border border-border p-3">
          <input
            type="checkbox"
            checked={reglages.actif}
            onChange={(e) => changer({ ...reglages, actif: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block font-medium">Cet appareil a une imprimante de tickets</span>
            <span className="block text-sm text-muted-foreground">
              Les commandes ajoutées depuis cet appareil sortent en bons. Sans imprimante, laissez
              décoché : rien ne change.
            </span>
          </span>
        </label>

        {reglages.actif && (
          <>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Largeur du rouleau
              </p>
              <div className="flex gap-2">
                {([58, 80] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => changer({ ...reglages, largeur: l })}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                      reglages.largeur === l
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {l} mm
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Où part chaque rubrique
              </p>
              {rubriques.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune rubrique sur la carte.</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {rubriques.map((c) => {
                    const poste = reglages.postes[c.id] ?? posteParDefaut(c.nom);
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{c.nom}</span>
                        <select
                          value={poste}
                          onChange={(e) =>
                            changer({
                              ...reglages,
                              postes: { ...reglages.postes, [c.id]: e.target.value as Poste },
                            })
                          }
                          className="app-field w-36"
                          aria-label={`Poste de ${c.nom}`}
                        >
                          {(["bar", "cuisine", "aucun"] as Poste[]).map((p) => (
                            <option key={p} value={p}>
                              {LIBELLE_POSTE[p]}
                            </option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="app-btn-secondary"
              onClick={() => setMessage(bons.imprimerControle(rubriques))}
            >
              <Printer className="h-4 w-4" />
              Imprimer un bon de contrôle
            </button>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </>
        )}
      </div>
    </Modal>
  );
};
