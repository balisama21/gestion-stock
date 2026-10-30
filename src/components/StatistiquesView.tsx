import React from "react";
import { Sale, Product, Seller, Expense, LocaleSetting } from "../types";
import { aUneEquipe, estResponsable, libelleNature } from "../lib/vendeurs";
import { Store, Users, Package, Tags } from "lucide-react";
import { formatCurrency, getProductLabel, quantiteEnMots } from "../utils/formulas";
import type { Database } from "../lib/database.types";
import { nomsDesCategories } from "../lib/detailsProduit";
import { PageHeader } from "./shared/PageHeader";
import { StatCol } from "./shared/StatBar";
import { DataList } from "./shared/DataList";
import {
  chiffreAffairesNet,
  effetDesAvoirsParProduit,
  effetDesAvoirsSurLaMarge,
  type AvoirDeVente,
} from "../lib/ventes";

interface StatistiquesViewProps {
  sales: Sale[];
  /** Les avoirs sur ces ventes : chiffre d'affaires et marge en sont nets. */
  avoirs?: AvoirDeVente[];
  /** Leurs lignes, pour retrancher chaque produit. */
  lignesAvoir?: { avoir_id: string; product_id: string | null; total: number | null }[];
  /** Les factures dont l'avoir a remis les articles en stock. */
  facturesRemisesEnStock?: ReadonlySet<string>;
  products: Product[];
  sellers: Seller[];
  expenses: Expense[];
  locale: LocaleSetting;
  /** Les catégories de produits : le chiffre d'affaires se répartit par elles. */
  categories?: Database["public"]["Tables"]["categories"]["Row"][];
}

export const StatistiquesView: React.FC<StatistiquesViewProps> = ({
  sales,
  avoirs = [],
  lignesAvoir = [],
  facturesRemisesEnStock,
  products,
  sellers,
  categories = [],
}) => {
  // Nets des avoirs : la règle du tableau de bord et du Bilan.
  const totalCA = chiffreAffairesNet(sales, avoirs);
  const totalMarge =
    sales.reduce((acc, s) => acc + s.margeTotale, 0) -
    effetDesAvoirsSurLaMarge(avoirs, sales, facturesRemisesEnStock);
  const effetsParProduit = effetDesAvoirsParProduit(
    avoirs,
    lignesAvoir,
    sales,
    facturesRemisesEnStock,
  );
  const averageMarginRate = totalCA > 0 ? (totalMarge / totalCA) * 100 : 0;

  // Sales per product
  const productStats = products.map((p) => {
    const pSales = sales.filter((s) => s.productId === p.id);
    const qtySold = pSales.reduce((acc, s) => acc + s.quantite, 0);
    const effet = effetsParProduit.get(p.id);
    const caSold = pSales.reduce((acc, s) => acc + s.totalVente, 0) - (effet?.ca ?? 0);
    const margeSold = pSales.reduce((acc, s) => acc + s.margeTotale, 0) - (effet?.marge ?? 0);
    return {
      id: p.id,
      displayName: getProductLabel(p, products),
      unite: p.unite,
      categoryId: p.categoryId,
      qtySold,
      caSold,
      margeSold,
    };
  });

  // Un produit jamais vendu n'a pas sa place dans un classement de
  // ventes, et le classement n'a de sens que trié : la section affichait
  // des numéros d'ordre sur une liste qui suivait l'ordre de création.
  const soldProducts = [...productStats]
    .filter((p) => p.qtySold > 0)
    .sort((a, b) => b.caSold - a.caSold);

  /**
   * Le chiffre d'affaires par catégorie, net des avoirs comme le reste.
   *
   * Chaque produit compte dans la catégorie où il est rangé — une
   * sous-catégorie se lit avec son chemin, « Alimentaire › Huiles ». Les
   * produits sans catégorie forment leur propre ligne : les cacher ferait
   * croire que les catégories couvrent tout le chiffre.
   */
  const nomsCategories = nomsDesCategories(categories);
  const parCategorie = [
    ...soldProducts
      .reduce((acc, p) => {
        const nom = (p.categoryId && nomsCategories.get(p.categoryId)) || "Sans catégorie";
        const ligne = acc.get(nom) ?? { nom, ca: 0, marge: 0, produits: 0 };
        ligne.ca += p.caSold;
        ligne.marge += p.margeSold;
        ligne.produits += 1;
        acc.set(nom, ligne);
        return acc;
      }, new Map<string, { nom: string; ca: number; marge: number; produits: number }>())
      .values(),
  ].sort((a, b) => b.ca - a.ca);
  const caDesProduits = soldProducts.reduce((n, p) => n + p.caSold, 0);
  const montrerCategories =
    nomsCategories.size > 0 && parCategorie.some((c) => c.nom !== "Sans catégorie");

  /*
   * Un classement suppose des concurrents. Seul dans sa boutique, le
   * responsable serait « premier sur un », à 100 % du chiffre : la
   * section se tait et dit quand elle parlera. Avec une équipe, il
   * figure dans le classement — il vend aussi — marqué comme tel.
   */
  const equipe = aUneEquipe(sellers);
  const rankedSellers = equipe
    ? [...sellers]
        .filter((v) => v.totalVentesNombre > 0 || !estResponsable(v))
        .sort((a, b) => b.totalVentesMontant - a.totalVentesMontant)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Store className="h-5 w-5 text-muted-foreground" />}
        title="Statistiques"
        subtitle={
          equipe
            ? "Vos meilleurs vendeurs, vos produits les plus rentables."
            : "Vos produits les plus vendus et les plus rentables."
        }
      />

      <div className="app-statbar grid-cols-1 sm:grid-cols-3">
        <StatCol label="Chiffre d'affaires" value={formatCurrency(totalCA)} hint="Toutes ventes" />
        <StatCol
          label="Marge brute"
          value={formatCurrency(totalMarge)}
          hint="Cumulée sur la période"
        />
        <StatCol
          label="Taux de marge moyen"
          value={`${averageMarginRate.toFixed(1)} %`}
          hint="Marge rapportée au chiffre d'affaires"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Classement des vendeurs.
            La barre de part est le seul graphisme conservé : ici elle
            porte de l'information — la longueur se compare d'un regard,
            ce qu'une colonne de pourcentages ne permet pas. */}
        <div className="app-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="app-section-title">
              <Users className="h-4 w-4" />
              Classement des vendeurs
            </h3>
          </div>

          {!equipe ? (
            <div className="px-4 py-10 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground">Pas encore d&apos;équipe</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Vous vendez seul. Le classement comparera vos vendeurs dès qu&apos;un premier
                collaborateur rejoindra la boutique.
              </p>
            </div>
          ) : rankedSellers.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aucune vente de l&apos;équipe pour l&apos;instant.
            </p>
          ) : (
            <div className="app-list">
              {rankedSellers.map((v, idx) => {
                const share = totalCA > 0 ? (v.totalVentesMontant / totalCA) * 100 : 0;
                return (
                  <div key={v.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="app-list-primary truncate">{v.nom}</span>
                        <span className="app-badge app-badge-neutral shrink-0 px-2 py-0.5 text-[10px]">
                          {libelleNature(v)}
                        </span>
                      </span>
                      <span className="app-list-amount">
                        {formatCurrency(v.totalVentesMontant)}
                      </span>
                    </div>

                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(share, 100)}%` }}
                      />
                    </div>

                    <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                      <span className="truncate">
                        {v.totalVentesNombre} vente{v.totalVentesNombre > 1 ? "s" : ""}
                      </span>
                      <span className="shrink-0">{share.toFixed(1)} % du CA</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Produits les plus vendus */}
        <div className="app-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="app-section-title">
              <Package className="h-4 w-4" />
              Ventes par référence
            </h3>
          </div>

          <DataList
            emptyLabel="Aucune vente enregistrée pour l'instant."
            items={soldProducts.map((p) => ({
              id: p.id,
              primary: p.displayName,
              meta: [
                // Sans « vendu » accordé : « 3 pièces vendus » sonnerait faux.
                quantiteEnMots(p.qtySold, p.unite),
                p.categoryId ? (nomsCategories.get(p.categoryId) ?? null) : null,
              ],
              amount: formatCurrency(p.caSold),
              amountHint:
                p.margeSold !== 0 ? (
                  <span className="t-success">+{formatCurrency(p.margeSold)}</span>
                ) : undefined,
              detailTitle: p.displayName,
              details: [
                { label: "Quantité vendue", value: quantiteEnMots(p.qtySold, p.unite) },
                { label: "Chiffre d'affaires", value: formatCurrency(p.caSold) },
                {
                  label: "Marge générée",
                  value: <span className="t-success">+{formatCurrency(p.margeSold)}</span>,
                },
              ],
            }))}
          />
        </div>

        {/* Par catégorie : où se fait le chiffre, d'un regard. */}
        {montrerCategories && (
          <div className="app-card overflow-hidden lg:col-span-2">
            <div className="border-b border-border px-4 py-3">
              <h3 className="app-section-title">
                <Tags className="h-4 w-4" />
                Ventes par catégorie
              </h3>
            </div>
            <div className="app-list">
              {parCategorie.map((c) => {
                const part = caDesProduits > 0 ? (c.ca / caDesProduits) * 100 : 0;
                return (
                  <div key={c.nom} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="app-list-primary min-w-0 truncate">{c.nom}</span>
                      <span className="app-list-amount">{formatCurrency(c.ca)}</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(Math.max(part, 0), 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                      <span className="truncate">
                        {c.produits} produit{c.produits > 1 ? "s" : ""}
                        {c.marge !== 0 && (
                          <>
                            {" "}
                            · marge <span className="t-success">+{formatCurrency(c.marge)}</span>
                          </>
                        )}
                      </span>
                      <span className="shrink-0">{part.toFixed(1)} % du CA produits</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
