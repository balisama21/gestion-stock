import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, PackageX, Scale, Trophy } from "lucide-react";
import type { Expense, Product, Sale } from "../../types";
import type { Database } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import {
  bilanBar,
  JOURS_SEMAINE,
  periodeDe,
  rangDansLaSemaine,
  type Echelle,
} from "../../lib/bilanBar";
import {
  inventairesPasses,
  PREFIXE_INVENTAIRE,
  type MouvementInventaire,
} from "../../lib/inventaireBar";
import { ChoixPeriode } from "./ChoixPeriode";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

const db = supabase as unknown as { from: (t: string) => any };

interface Props {
  storeId: string;
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  categories: Categorie[];
  /** Le bilan comptable complet (jour, mois, année), pour qui veut le détail. */
  vueComptable: React.ReactNode;
}

const lendemain = (jour: string) => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const jourCourt = (jour: string) => {
  const [, m, j] = jour.split("-");
  return `${JOURS_SEMAINE[rangDansLaSemaine(jour)].slice(0, 3)}. ${Number(j)}/${m}`;
};

/** Ce que les inventaires du soir ont constaté de manquant, au prix d'achat. */
function usePertesInventaire(storeId: string, debut: string, fin: string, products: Product[]) {
  const [valeur, setValeur] = useState(0);
  const prixAchat = useMemo(() => new Map(products.map((p) => [p.id, p.prixAchat])), [products]);
  useEffect(() => {
    let actif = true;
    void (async () => {
      const { data } = await db
        .from("stock_movements")
        .select("product_id, stock_actuel_delta, note, created_at")
        .eq("store_id", storeId)
        .eq("type_mouvement", "ajustement")
        .like("note", `${PREFIXE_INVENTAIRE}%`)
        .gte("created_at", new Date(`${debut}T00:00:00`).toISOString())
        .lt("created_at", new Date(`${lendemain(fin)}T00:00:00`).toISOString())
        .limit(2000);
      if (!actif) return;
      const passes = inventairesPasses((data ?? []) as MouvementInventaire[], prixAchat);
      setValeur(passes.reduce((n, p) => n + p.valeur, 0));
    })();
    return () => {
      actif = false;
    };
  }, [storeId, debut, fin, prixAchat]);
  return valeur;
}

const Barre: React.FC<{ part: number }> = ({ part }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
    <div
      className="h-full rounded-full bg-primary"
      style={{ width: `${Math.max(2, Math.round(part * 100))}%` }}
    />
  </div>
);

/**
 * LE BILAN DU BAR
 *
 * Ce que la période a laissé une fois les boissons payées et les frais
 * réglés, puis comment elle s'est faite : soirée par soirée, les bons
 * soirs de la semaine, ce qui se vend, par rubrique, et où part
 * l'argent. Le bilan comptable complet reste à un clic.
 */
export const BilanBarView: React.FC<Props> = ({
  storeId,
  sales,
  expenses,
  products,
  categories,
  vueComptable,
}) => {
  const aujourdhui = dateDuJour();
  const [comptable, setComptable] = useState(false);
  const [echelle, setEchelle] = useState<Echelle>("semaine");
  const [recul, setRecul] = useState(0);
  const [survol, setSurvol] = useState<string | null>(null);
  const periode = useMemo(
    () => periodeDe(echelle, recul, aujourdhui),
    [echelle, recul, aujourdhui],
  );

  const rubriqueDe = useMemo(() => {
    const nom = new Map(categories.map((c) => [c.id, c.nom]));
    return new Map(
      products
        .filter((p) => p.categoryId && nom.has(p.categoryId))
        .map((p) => [p.id, nom.get(p.categoryId!)!]),
    );
  }, [products, categories]);
  const posteDe = useMemo(
    () => new Map(categories.filter((c) => c.usage === "depense").map((c) => [c.id, c.nom])),
    [categories],
  );
  const b = useMemo(
    () => bilanBar({ ventes: sales, depenses: expenses, periode, rubriqueDe, posteDe }),
    [sales, expenses, periode, rubriqueDe, posteDe],
  );
  const pertes = usePertesInventaire(storeId, periode.debut, periode.fin, products);

  if (comptable) {
    return (
      <div className="space-y-4">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => setComptable(false)}
            className="text-sm font-medium text-primary"
          >
            ← Bilan des soirées
          </button>
        </div>
        {vueComptable}
      </div>
    );
  }

  const tauxMarge = b.ca > 0 ? Math.round((b.marge / b.ca) * 100) : null;
  const plusHaut = Math.max(1, ...b.parSoir.map((s) => s.ca));
  const meilleurJour = Math.max(1, ...b.parJourSemaine.map((j) => j.moyenne));
  const premiereRubrique = Math.max(1, ...b.parRubrique.map((r) => r.ca));
  const premierPoste = Math.max(1, ...b.depensesParPoste.map((p) => p.montant));
  const pointe = survol ? b.parSoir.find((s) => s.jour === survol) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bilan</h1>
          <p className="text-sm text-muted-foreground">Ce que rapportent vos soirées</p>
        </div>
        <button type="button" onClick={() => setComptable(true)} className="app-btn-secondary">
          <BookOpen className="h-4 w-4" />
          Vue comptable
        </button>
      </header>

      <ChoixPeriode
        echelle={echelle}
        recul={recul}
        periode={periode}
        onEchelle={setEchelle}
        onRecul={setRecul}
      />

      <section
        className={`rounded-2xl p-5 ${
          b.resultat < 0 ? "bg-danger-soft" : "bg-primary text-primary-foreground"
        }`}
      >
        <p
          className={`flex items-center gap-1.5 text-sm ${b.resultat < 0 ? "t-danger" : "opacity-80"}`}
        >
          <Scale className="h-4 w-4" />
          {b.resultat < 0 ? "Perte" : "Ce qui reste"} · {periode.libelle}
        </p>
        <p className={`mt-0.5 text-3xl font-bold tabular-nums ${b.resultat < 0 ? "t-danger" : ""}`}>
          {b.resultat < 0 ? "−" : ""}
          {formatCurrency(Math.abs(b.resultat))}
        </p>
        <p className={`mt-1 text-sm ${b.resultat < 0 ? "text-foreground" : "opacity-80"}`}>
          Marge des ventes moins les dépenses.
        </p>
      </section>

      <section className="rounded-xl border border-border">
        {[
          {
            libelle: "Ventes",
            detail: `${b.additions} addition${b.additions > 1 ? "s" : ""}`,
            montant: b.ca,
          },
          { libelle: "Prix d'achat des boissons et plats", montant: -b.cout },
          {
            libelle: "Marge",
            detail: tauxMarge !== null ? `${tauxMarge} % des ventes` : undefined,
            montant: b.marge,
            total: true,
          },
          { libelle: "Dépenses", montant: -b.depenses },
          { libelle: "Résultat", montant: b.resultat, total: true },
        ].map((l) => (
          <div
            key={l.libelle}
            className={`flex items-center gap-3 border-b border-border px-3 py-2.5 text-sm last:border-b-0 ${
              l.total ? "bg-muted/50 font-semibold" : ""
            }`}
          >
            <span className="min-w-0 flex-1">
              {l.libelle}
              {l.detail && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">{l.detail}</span>
              )}
            </span>
            <span className={`tabular-nums ${l.montant < 0 ? "text-muted-foreground" : ""}`}>
              {l.montant < 0 ? "−" : ""}
              {formatCurrency(Math.abs(l.montant))}
            </span>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { libelle: "soirées", valeur: String(b.soirees) },
          { libelle: "par soirée", valeur: formatCurrency(b.moyenneParSoiree) },
          { libelle: "droits de table", valeur: formatCurrency(b.droitsDeTable) },
          {
            libelle: "manquant à l'inventaire",
            valeur: pertes < 0 ? `−${formatCurrency(Math.abs(pertes))}` : formatCurrency(0),
            alerte: pertes < 0,
          },
        ].map((t) => (
          <div key={t.libelle} className="rounded-xl border border-border p-3">
            <p className={`text-lg font-bold tabular-nums ${t.alerte ? "t-danger" : ""}`}>
              {t.valeur}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {t.alerte && <PackageX className="h-3 w-3 t-danger" />}
              {t.libelle}
            </p>
          </div>
        ))}
      </div>

      {echelle !== "soir" && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Soirée par soirée</h2>
            {b.meilleureSoiree && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                Meilleure : {jourCourt(b.meilleureSoiree.jour)} ·{" "}
                {formatCurrency(b.meilleureSoiree.ca)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 h-5 text-sm">
              {pointe ? (
                <>
                  <span className="text-muted-foreground">{jourCourt(pointe.jour)} · </span>
                  <span className="font-semibold tabular-nums">{formatCurrency(pointe.ca)}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Touchez une barre pour lire la soirée.
                </span>
              )}
            </p>
            <div
              className="flex h-32 items-end gap-0.5"
              role="img"
              aria-label={`Ventes de chaque soirée, ${periode.libelle}`}
              onMouseLeave={() => setSurvol(null)}
            >
              {b.parSoir.map((s) => (
                <button
                  key={s.jour}
                  type="button"
                  onMouseEnter={() => setSurvol(s.jour)}
                  onFocus={() => setSurvol(s.jour)}
                  onClick={() => setSurvol(s.jour)}
                  aria-label={`${jourCourt(s.jour)} : ${formatCurrency(s.ca)}`}
                  className="flex h-full min-w-0 flex-1 items-end"
                >
                  <span
                    className={`block w-full rounded-t ${
                      survol === s.jour ? "bg-primary" : "bg-primary/70"
                    }`}
                    style={{ height: s.ca > 0 ? `${Math.max(3, (s.ca / plusHaut) * 100)}%` : 0 }}
                  />
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 text-[11px] text-muted-foreground">
              <span>{jourCourt(b.parSoir[0].jour)}</span>
              <span>{jourCourt(b.parSoir[b.parSoir.length - 1].jour)}</span>
            </div>
          </div>
        </section>
      )}

      {echelle === "mois" && b.soirees > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Les bons soirs</h2>
          <ul className="space-y-2 rounded-xl border border-border p-3">
            {b.parJourSemaine.map((j) => (
              <li
                key={j.jour}
                className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm"
              >
                <span className={j.soirees ? "" : "text-muted-foreground"}>{j.jour}</span>
                <Barre part={j.moyenne / meilleurJour} />
                <span className="w-24 text-right tabular-nums">
                  {j.soirees ? formatCurrency(j.moyenne) : "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Recette moyenne d&apos;une soirée ouverte.
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Ce qui se vend</h2>
        {b.topArticles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aucune vente sur cette période.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {b.topArticles.map((a, i) => (
              <li key={a.nom} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{a.nom}</span>
                <span className="text-xs text-muted-foreground tabular-nums">× {a.quantite}</span>
                <span className="w-24 text-right font-semibold tabular-nums">
                  {formatCurrency(a.ca)}
                </span>
                <span className="hidden w-16 text-right text-xs text-muted-foreground tabular-nums sm:block">
                  {a.ca > 0 ? `${Math.round((a.marge / a.ca) * 100)} %` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {b.parRubrique.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Par rubrique</h2>
          <ul className="space-y-2 rounded-xl border border-border p-3">
            {b.parRubrique.map((r) => (
              <li key={r.nom} className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{r.nom}</span>
                  <span className="tabular-nums">
                    {formatCurrency(r.ca)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {b.ca > 0 ? `${Math.round((r.ca / b.ca) * 100)} %` : ""}
                    </span>
                  </span>
                </div>
                <Barre part={r.ca / premiereRubrique} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {b.depensesParPoste.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Où part l&apos;argent</h2>
          <ul className="space-y-2 rounded-xl border border-border p-3">
            {b.depensesParPoste.map((p) => (
              <li key={p.nom} className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{p.nom}</span>
                  <span className="tabular-nums">{formatCurrency(p.montant)}</span>
                </div>
                <Barre part={p.montant / premierPoste} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
