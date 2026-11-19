import React, { useMemo } from "react";
import { AlertTriangle, ChevronRight, LayoutGrid, Mic, PackageX, Wine } from "lucide-react";
import type { ActiveTab, Product, Sale } from "../../types";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import { useBar } from "../../hooks/useBar";
import { totalNote, tablesParZone } from "../../lib/bar";
import { estEnRupture, estSousLeSeuil, stockEstSuivi } from "../../lib/prealerteStock";

interface Props {
  storeId: string;
  storeName: string;
  products: Product[];
  sales: Sale[];
  onAller: (tab: ActiveTab) => void;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/**
 * « CE SOIR » : L'ACCUEIL DU BAR-KARAOKÉ
 *
 * Ce qu'un gérant de bar regarde en arrivant et pendant le service, et
 * rien d'autre : l'argent de la soirée (encaissé, et encore sur les
 * tables), les tables occupées, ce qui va manquer, ce qui se boit.
 *
 * « Ce soir », ce sont les ventes du jour : une soirée qui passe minuit
 * se lit sur les deux jours, comme dans la caisse.
 */
export const CeSoirView: React.FC<Props> = ({ storeId, storeName, products, sales, onAller }) => {
  const bar = useBar(storeId);
  const aujourdhui = dateDuJour();
  const maintenant = new Date();

  const duJour = useMemo(() => sales.filter((s) => s.date === aujourdhui), [sales, aujourdhui]);
  // Vendu : tout ce qui est passé en caisse ; encaissé : l'argent reçu (sans le crédit).
  const vendu = duJour.reduce((n, s) => n + s.totalVente, 0);
  const encaisse = duJour.reduce((n, s) => n + s.montantPaye, 0);
  const surLesTables = useMemo(() => totalNote(bar.lignes).reste, [bar.lignes]);
  const actives = bar.tables.filter((t) => t.active).length;

  const plusServis = useMemo(() => {
    const parProduit = new Map<string, { nom: string; quantite: number }>();
    for (const s of duJour) {
      if (!s.productId) continue;
      const p = parProduit.get(s.productId) ?? { nom: s.designation, quantite: 0 };
      p.quantite += s.quantite;
      parProduit.set(s.productId, p);
    }
    return [...parProduit.values()].sort((a, b) => b.quantite - a.quantite).slice(0, 5);
  }, [duJour]);

  const aSurveiller = useMemo(
    () =>
      products
        .filter(
          (p) =>
            stockEstSuivi(p) &&
            (estEnRupture(p.stockActuel) || estSousLeSeuil(p.stockActuel, p.seuilAlerte)),
        )
        .sort((a, b) => a.stockActuel - b.stockActuel)
        .slice(0, 5),
    [products],
  );

  const occupees = useMemo(
    () =>
      tablesParZone(bar.tables, bar.zones)
        .flatMap((g) => g.tables)
        .filter((t) => bar.noteDeLaTable.has(t.id)),
    [bar.tables, bar.zones, bar.noteDeLaTable],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {JOURS[maintenant.getDay()]} {maintenant.getDate()} {MOIS[maintenant.getMonth()]}
          </p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{storeName}</h1>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mic className="h-5 w-5" />
        </span>
      </header>

      {/* L'argent de la soirée */}
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-80">Ce soir</p>
        <p className="mt-0.5 text-3xl font-bold tabular-nums">
          {formatCurrency(vendu + surLesTables)}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(encaisse)}</p>
            <p className="opacity-80">encaissé</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(surLesTables)}</p>
            <p className="opacity-80">sur les tables</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">
              {bar.notes.length} / {actives}
            </p>
            <p className="opacity-80">tables</p>
          </div>
        </div>
      </section>

      {/* Les tables occupées */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Tables occupées</h2>
          <button
            type="button"
            onClick={() => onAller("salle")}
            className="flex items-center gap-0.5 text-sm font-medium text-primary"
          >
            Voir la salle
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {actives === 0 ? (
          <button
            type="button"
            onClick={() => onAller("salle")}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left text-sm text-muted-foreground hover:border-primary"
          >
            <LayoutGrid className="h-5 w-5 text-primary" />
            Créez vos zones et vos tables pour commencer le service.
          </button>
        ) : occupees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Toutes les tables sont libres.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {occupees.map((t) => {
              const n = bar.noteDeLaTable.get(t.id)!;
              const reste = totalNote(bar.lignesDeLaNote(n.id)).reste;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onAller("salle")}
                  className="rounded-lg border border-primary bg-success-soft p-2 text-left"
                >
                  <p className="text-base font-bold leading-none">{t.numero}</p>
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    {formatCurrency(reste)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Ce qui va manquer */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">À surveiller</h2>
          <button
            type="button"
            onClick={() => onAller("inventaire")}
            className="flex items-center gap-0.5 text-sm font-medium text-primary"
          >
            Inventaire du soir
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {aSurveiller.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Rien ne manque : votre stock tient la soirée.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {aSurveiller.map((p) => {
              const rupture = estEnRupture(p.stockActuel);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onAller("achats")}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                  >
                    {rupture ? (
                      <PackageX className="h-4 w-4 shrink-0 t-danger" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 t-warning" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{p.displayName}</span>
                    <span className={`text-xs font-semibold ${rupture ? "t-danger" : "t-warning"}`}>
                      {rupture ? "épuisé" : `reste ${p.stockActuel}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ce qui se boit */}
      <section className="space-y-2">
        <h2 className="font-semibold">Les plus servis aujourd&apos;hui</h2>
        {plusServis.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Rien d&apos;encaissé pour l&apos;instant aujourd&apos;hui.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {plusServis.map((p, i) => (
              <li key={p.nom} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                <Wine className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{p.nom}</span>
                <span className="font-semibold tabular-nums">{p.quantite}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
