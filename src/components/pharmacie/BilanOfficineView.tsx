import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  PackageX,
  PieChart,
  ScrollText,
  ShieldCheck,
  Trophy,
  Wallet,
} from "lucide-react";
import type { Expense, Product, Sale } from "../../types";
import type { Database } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";
import { formatCurrency } from "../../utils/formulas";
import { bilanBar, periodeDe, type Echelle } from "../../lib/bilanBar";
import type { OrganismePharma } from "../../lib/pharmacie";
import { useOrdonnances } from "../../hooks/usePharmacie";
import { Chiffre, EnTete, Panneau, Pastille, Segments } from "./ui";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

const db = supabase as unknown as { from: (t: string) => any };

interface Props {
  storeId: string;
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  categories: Categorie[];
  organismes: OrganismePharma[];
  aujourdhui: string;
  /** Le bilan comptable complet, pour qui veut le détail. */
  vueComptable: React.ReactNode;
}

const lendemain = (jour: string) => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Ce qui est sorti du rayon sans être vendu (périmé, cassé), au prix d'achat. */
function usePertes(storeId: string, debut: string, fin: string, products: Product[]) {
  const [pertes, setPertes] = useState({ perime: 0, casse: 0 });
  const prix = useMemo(() => new Map(products.map((p) => [p.id, p.prixAchat])), [products]);
  useEffect(() => {
    let actif = true;
    void (async () => {
      const { data } = await db
        .from("stock_movements")
        .select("product_id, stock_actuel_delta, note, created_at")
        .eq("store_id", storeId)
        .eq("type_mouvement", "ajustement")
        .gte("created_at", new Date(`${debut}T00:00:00`).toISOString())
        .lt("created_at", new Date(`${lendemain(fin)}T00:00:00`).toISOString())
        .limit(3000);
      if (!actif) return;
      let perime = 0;
      let casse = 0;
      for (const m of (data ?? []) as {
        product_id: string;
        stock_actuel_delta: number;
        note: string | null;
      }[]) {
        const valeur = Math.max(0, -Number(m.stock_actuel_delta)) * (prix.get(m.product_id) ?? 0);
        if (m.note?.startsWith("Périmé")) perime += valeur;
        else if (m.note?.startsWith("Cassé")) casse += valeur;
      }
      setPertes({ perime, casse });
    })();
    return () => {
      actif = false;
    };
  }, [storeId, debut, fin, prix]);
  return pertes;
}

const pourcent = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)} %` : "—";

const jourCourt = (jour: string) => {
  const [, m, j] = jour.split("-");
  return `${Number(j)}/${m}`;
};

/**
 * LE BILAN DE L'OFFICINE
 *
 * Ce que la pharmacie a délivré sur la période, ce que ça laisse une
 * fois les boîtes payées au grossiste et les frais réglés, ce qui se
 * délivre le plus, la part qui attend les organismes, et ce que les
 * périmés ont coûté. Le bilan comptable complet reste à un geste.
 */
export const BilanOfficineView: React.FC<Props> = ({
  storeId,
  sales,
  expenses,
  products,
  categories,
  organismes,
  aujourdhui,
  vueComptable,
}) => {
  const [echelle, setEchelle] = useState<Echelle>("mois");
  const [recul, setRecul] = useState(0);
  const [comptable, setComptable] = useState(false);
  const periode = periodeDe(echelle, recul, aujourdhui);

  const rubriqueDe = useMemo(() => {
    const noms = new Map(categories.map((c) => [c.id, c.nom]));
    return new Map(
      products.map((p) => [p.id, (p.categoryId && noms.get(p.categoryId)) || "Sans rubrique"]),
    );
  }, [products, categories]);
  const posteDe = useMemo(() => new Map(categories.map((c) => [c.id, c.nom])), [categories]);
  const b = useMemo(
    () => bilanBar({ ventes: sales, depenses: expenses, periode, rubriqueDe, posteDe }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales, expenses, periode.debut, periode.fin, rubriqueDe, posteDe],
  );
  const { ordonnances } = useOrdonnances(storeId, periode.debut, periode.fin);
  const pertes = usePertes(storeId, periode.debut, periode.fin, products);
  const tiers = useMemo(() => {
    const ids = new Set(organismes.map((o) => o.client_id));
    const ventes = sales.filter(
      (v) => v.date >= periode.debut && v.date <= periode.fin && v.clientId && ids.has(v.clientId),
    );
    return {
      ca: ventes.reduce((n, v) => n + v.totalVente, 0),
      du: ventes.reduce((n, v) => n + Math.max(0, v.soldeDu), 0),
    };
  }, [sales, organismes, periode.debut, periode.fin]);
  const tiersVisible = tiers.ca > 0 || tiers.du > 0;
  const pertesVisibles = pertes.perime + pertes.casse > 0;

  if (comptable) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setComptable(false)} className="app-btn-secondary">
          <ChevronLeft className="h-4 w-4" />
          Revenir au bilan de l&apos;officine
        </button>
        {vueComptable}
      </div>
    );
  }

  const panier = b.additions ? b.ca / b.additions : 0;
  const plusHaut = Math.max(1, ...b.parSoir.map((j) => j.ca));
  const plusGrosArticle = Math.max(1, ...b.topArticles.map((a) => a.ca));
  const totalRubriques = b.parRubrique.reduce((n, r) => n + r.ca, 0);

  return (
    <div className="ph-page">
      <EnTete
        icone={<BarChart3 className="h-6 w-6" />}
        titre="Bilan de l'officine"
        sousTitre="Ce que la pharmacie délivre, ce que ça laisse, et où partent les boîtes."
        actions={
          <button type="button" onClick={() => setComptable(true)} className="app-btn-secondary">
            <BookOpen className="h-4 w-4" />
            Bilan comptable
          </button>
        }
      >
        <Chiffre ton="plein" valeur={formatCurrency(b.ca)} libelle="Chiffre d'affaires" />
        <Chiffre
          valeur={formatCurrency(b.marge)}
          libelle={`Marge brute · ${pourcent(b.marge, b.ca)}`}
        />
        <Chiffre
          ton={b.resultat < 0 ? "danger" : "croix"}
          valeur={formatCurrency(b.resultat)}
          libelle="Résultat"
          icone={<Wallet className="h-3 w-3" />}
        />
        <Chiffre
          valeur={formatCurrency(panier)}
          libelle={`Panier moyen · ${b.additions} clients`}
        />
        <Chiffre
          valeur={ordonnances.length}
          libelle="Ordonnances"
          icone={<ScrollText className="h-3 w-3" />}
        />
      </EnTete>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segments
          libelle="Échelle"
          valeur={echelle}
          onChange={(e) => {
            setEchelle(e);
            setRecul(0);
          }}
          options={[
            { cle: "soir", libelle: "Jour" },
            { cle: "semaine", libelle: "Semaine" },
            { cle: "mois", libelle: "Mois" },
          ]}
        />
        <div className="flex items-center rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setRecul(recul + 1)}
            className="p-2 text-muted-foreground hover:text-primary"
            aria-label="Période précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-bold">{periode.libelle}</span>
          <button
            type="button"
            onClick={() => setRecul(recul - 1)}
            disabled={recul === 0}
            className="p-2 text-muted-foreground hover:text-primary disabled:opacity-30"
            aria-label="Période suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {echelle !== "soir" && b.ca > 0 && (
        <Panneau titre="La recette, jour par jour" icone={<BarChart3 className="h-4 w-4" />} corps>
          <>
            <div className="flex h-44 items-end gap-[3px]" role="img" aria-label="Recette par jour">
              {b.parSoir.map((j) => (
                <div key={j.jour} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-[4px] transition-colors ${
                      j.jour === aujourdhui ? "bg-[var(--croix)]" : "bg-primary/75"
                    } group-hover:bg-primary`}
                    style={{ height: `${j.ca ? Math.max(2, (j.ca / plusHaut) * 100) : 0}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                    <span className="font-bold">{jourCourt(j.jour)}</span> · {formatCurrency(j.ca)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>{jourCourt(periode.debut)}</span>
              {b.meilleureSoiree && (
                <span>
                  Meilleur jour : <b>{jourCourt(b.meilleureSoiree.jour)}</b> ·{" "}
                  {formatCurrency(b.meilleureSoiree.ca)}
                </span>
              )}
              <span>{jourCourt(periode.fin)}</span>
            </div>
          </>
        </Panneau>
      )}

      {/* Un bloc ne s'affiche que s'il a quelque chose à montrer. */}
      {(b.topArticles.length > 0 || b.parRubrique.length > 0 || tiersVisible || pertesVisibles) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {b.topArticles.length > 0 && (
            <Panneau titre="Les plus délivrés" icone={<Trophy className="h-4 w-4" />}>
              <ul className="ph-liste">
                {b.topArticles.slice(0, 8).map((a, i) => (
                  <li key={a.nom} className="ph-ligne">
                    <span className="w-5 text-xs font-extrabold text-muted-foreground">
                      {i + 1}
                    </span>
                    <Pastille nom={a.nom} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.nom}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(3, (a.ca / plusGrosArticle) * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums">
                        {formatCurrency(a.ca)}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {a.quantite} boîte(s) · marge {pourcent(a.marge, a.ca)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panneau>
          )}

          <div className="space-y-5">
            {b.parRubrique.length > 0 && (
              <Panneau titre="Par rubrique" icone={<PieChart className="h-4 w-4" />} corps>
                <ul className="space-y-2.5">
                  {b.parRubrique.slice(0, 7).map((r) => (
                    <li key={r.nom}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{r.nom}</span>
                        <span className="tabular-nums">
                          <b>{formatCurrency(r.ca)}</b>{" "}
                          <span className="text-xs text-muted-foreground">
                            {pourcent(r.ca, totalRubriques)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max(3, (r.ca / Math.max(1, totalRubriques)) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panneau>
            )}

            {(tiersVisible || pertesVisibles) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {tiersVisible && (
                  <Panneau titre="Tiers payant" icone={<ShieldCheck className="h-4 w-4" />} corps>
                    <p className="text-xl font-extrabold tabular-nums">
                      {formatCurrency(tiers.ca)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pourcent(tiers.ca, b.ca)} du chiffre d&apos;affaires ·{" "}
                      {formatCurrency(tiers.du)} encore à recevoir
                    </p>
                  </Panneau>
                )}
                {pertesVisibles && (
                  <Panneau titre="Pertes" icone={<PackageX className="h-4 w-4" />} corps>
                    <p
                      className={`text-xl font-extrabold tabular-nums ${
                        pertes.perime + pertes.casse > 0 ? "t-danger" : ""
                      }`}
                    >
                      {formatCurrency(pertes.perime + pertes.casse)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(pertes.perime)} de périmés · {formatCurrency(pertes.casse)} de
                      casse, au prix d&apos;achat
                    </p>
                  </Panneau>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {(b.ca > 0 || b.depenses > 0) && (
        <Panneau
          titre="Du chiffre d'affaires au résultat"
          icone={<Wallet className="h-4 w-4" />}
          corps
        >
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Etape libelle="Chiffre d'affaires" valeur={b.ca} />
            <Etape libelle="Achat des boîtes vendues" valeur={-b.cout} />
            <Etape libelle="Dépenses de la période" valeur={-b.depenses} />
            <Etape libelle="Résultat" valeur={b.resultat} fort />
          </dl>
          {b.depensesParPoste.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {b.depensesParPoste.slice(0, 8).map((p) => (
                <span
                  key={p.nom}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs"
                >
                  {p.nom} · <b className="tabular-nums">{formatCurrency(p.montant)}</b>
                </span>
              ))}
            </div>
          )}
        </Panneau>
      )}
    </div>
  );
};

const Etape: React.FC<{ libelle: string; valeur: number; fort?: boolean }> = ({
  libelle,
  valeur,
  fort,
}) => (
  <div
    className={`rounded-xl border p-3 ${
      fort ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card"
    }`}
  >
    <dt className={`text-xs font-bold ${fort ? "opacity-85" : "text-muted-foreground"}`}>
      {libelle}
    </dt>
    <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{formatCurrency(valeur)}</dd>
  </div>
);
