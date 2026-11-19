import React, { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Gift,
  Printer,
  ReceiptText,
  UserRound,
} from "lucide-react";
import type { Payment, Sale } from "../../types";
import { supabase } from "../../lib/supabase";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import { MODES_DE_PAIEMENT } from "../facturation/paiement";
import { recapCaisse, veille } from "../../lib/caisseBar";
import type { LigneNote, NoteBar, TableBar } from "../../lib/bar";

interface Props {
  storeId: string;
  sales: Sale[];
  payments: Payment[];
}

const db = supabase as unknown as { from: (t: string) => any };

const libelleMoyen = (m: string) =>
  MODES_DE_PAIEMENT.find((x) => x.valeur === m)?.libelle ?? (m || "Espèces");

const lendemain = (jour: string): string => {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
};

const jourLisible = (jour: string, aujourdhui: string): string => {
  if (jour === aujourdhui) return "Aujourd'hui";
  if (jour === veille(aujourdhui)) return "Hier";
  const [a, m, j] = jour.split("-");
  return `${j}/${m}/${a}`;
};

/**
 * Les lignes du bar qui éclairent la caisse d'un jour : celles des ventes
 * du jour (serveur, offerts, table) et celles annulées ce jour-là.
 */
function useLignesDuJour(storeId: string, jour: string, venteIds: string[]) {
  const [lignes, setLignes] = useState<LigneNote[]>([]);
  const [notes, setNotes] = useState<NoteBar[]>([]);
  const [tables, setTables] = useState<TableBar[]>([]);
  const cle = venteIds.join(",");

  useEffect(() => {
    let actif = true;
    const debut = new Date(`${jour}T00:00:00`).toISOString();
    const fin = new Date(`${lendemain(jour)}T00:00:00`).toISOString();
    void (async () => {
      const ids = cle ? cle.split(",") : [];
      const lots: string[][] = [];
      for (let i = 0; i < ids.length; i += 150) lots.push(ids.slice(i, i + 150));
      const reponses = await Promise.all([
        ...lots.map((l) => db.from("bar_note_lignes").select("*").in("sale_id", l)),
        db
          .from("bar_note_lignes")
          .select("*")
          .eq("store_id", storeId)
          .eq("annulee", true)
          .gte("cree_le", debut)
          .lt("cree_le", fin),
        db.from("bar_tables").select("*").eq("store_id", storeId),
      ]);
      if (!actif) return;
      const tablesLues = (reponses.pop()?.data ?? []) as TableBar[];
      const toutes = reponses.flatMap((r) => (r.data ?? []) as LigneNote[]);
      const noteIds = [...new Set(toutes.map((l) => l.note_id))];
      const n = noteIds.length
        ? await db.from("bar_notes").select("*").in("id", noteIds.slice(0, 300))
        : { data: [] };
      if (!actif) return;
      setLignes(toutes.map((l) => ({ ...l, prix_unit: Number(l.prix_unit) })));
      setNotes((n.data ?? []) as NoteBar[]);
      setTables(tablesLues);
    })();
    return () => {
      actif = false;
    };
  }, [storeId, jour, cle]);

  return { lignes, notes, tables };
}

/**
 * LA CAISSE DU BAR : LA SOIRÉE EN UN COUP D'ŒIL
 *
 * Ce qu'on compte en fermant : le vendu, l'argent reçu par moyen de
 * paiement (le tiroir doit tomber juste), le crédit, les offerts et les
 * annulations, ce que chaque serveur a servi, puis les additions une à
 * une. On remonte les soirées précédentes avec les flèches.
 */
export const CaisseView: React.FC<Props> = ({ storeId, sales, payments }) => {
  const aujourdhui = dateDuJour();
  const [jour, setJour] = useState(aujourdhui);

  const ventesDuJour = useMemo(
    () => sales.filter((v) => v.date === jour && v.origine !== "commande"),
    [sales, jour],
  );
  const { lignes, notes, tables } = useLignesDuJour(
    storeId,
    jour,
    ventesDuJour.map((v) => v.id),
  );
  const recap = useMemo(
    () => recapCaisse(jour, sales, payments, lignes),
    [jour, sales, payments, lignes],
  );

  const tableDeLaVente = useMemo(() => {
    const noteTable = new Map(notes.map((n) => [n.id, n.table_id]));
    const numero = new Map(tables.map((t) => [t.id, t.numero]));
    const m = new Map<string, string>();
    for (const l of lignes) {
      if (!l.sale_id) continue;
      const t = numero.get(noteTable.get(l.note_id) ?? "");
      if (t) m.set(l.sale_id, t);
    }
    return m;
  }, [lignes, notes, tables]);

  const additions = useMemo(() => {
    const groupes = new Map<string, Sale[]>();
    for (const v of ventesDuJour) {
      const k = v.ticketId ?? v.id;
      groupes.set(k, [...(groupes.get(k) ?? []), v]);
    }
    return [...groupes.entries()]
      .map(([cle, vs]) => ({
        cle,
        heure: vs[0].saisieLe
          ? new Date(vs[0].saisieLe).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        moment: vs[0].saisieLe ?? "",
        table: vs.map((v) => tableDeLaVente.get(v.id)).find(Boolean) ?? null,
        total: vs.reduce((n, v) => n + v.totalVente, 0),
        du: vs.reduce((n, v) => n + Math.max(0, v.soldeDu), 0),
        articles: vs.filter((v) => v.productId).reduce((n, v) => n + v.quantite, 0),
        client: vs.find((v) => v.clientCredit)?.clientCredit ?? null,
      }))
      .sort((a, b) => b.moment.localeCompare(a.moment));
  }, [ventesDuJour, tableDeLaVente]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caisse</h1>
          <p className="text-sm text-muted-foreground">
            {recap.additions} addition{recap.additions > 1 ? "s" : ""} encaissée
            {recap.additions > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 print:hidden">
          <button
            type="button"
            onClick={() => setJour(veille(jour))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
            aria-label="Soirée précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[6.5rem] text-center text-sm font-semibold">
            {jourLisible(jour, aujourdhui)}
          </span>
          <button
            type="button"
            onClick={() => setJour(lendemain(jour))}
            disabled={jour >= aujourdhui}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
            aria-label="Soirée suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-80">Vendu</p>
        <p className="mt-0.5 text-3xl font-bold tabular-nums">{formatCurrency(recap.vendu)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(recap.recu)}</p>
            <p className="opacity-80">argent reçu</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(recap.aCredit)}</p>
            <p className="opacity-80">à crédit</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Dans la caisse</h2>
        {recap.parMoyen.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Aucun paiement reçu ce jour-là.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {recap.parMoyen.map((m) => (
              <li key={m.methode} className="flex items-center gap-3 px-3 py-2.5">
                <Banknote className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-sm">
                  {libelleMoyen(m.methode)}
                  <span className="text-muted-foreground">
                    {" "}
                    · {m.nombre} paiement{m.nombre > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatCurrency(m.montant)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
          <Gift className="h-5 w-5 shrink-0 t-success" />
          <div>
            <p className="font-semibold tabular-nums">{formatCurrency(recap.offerts)}</p>
            <p className="text-xs text-muted-foreground">offert par la maison</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
          <Ban className="h-5 w-5 shrink-0 t-danger" />
          <div>
            <p className="font-semibold tabular-nums">{formatCurrency(recap.annule)}</p>
            <p className="text-xs text-muted-foreground">annulé sur les notes</p>
          </div>
        </div>
      </div>

      {recap.parServeur.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Par serveur</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {recap.parServeur.map((s) => (
              <li key={s.serveur} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  {s.serveur}
                  <span className="text-muted-foreground"> · {s.articles} art.</span>
                </span>
                <span className="font-semibold tabular-nums">{formatCurrency(s.montant)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Les additions</h2>
          {additions.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 text-sm font-medium text-primary print:hidden"
            >
              <Printer className="h-4 w-4" />
              Imprimer la soirée
            </button>
          )}
        </div>
        {additions.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Aucune addition encaissée. Elles s&apos;encaissent depuis la Salle, table par table.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {additions.map((a) => (
              <li key={a.cle} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <ReceiptText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{a.heure}</span>
                <span className="min-w-0 flex-1 truncate">
                  {a.table ? `Table ${a.table}` : "Comptoir"}
                  {a.client && <span className="text-muted-foreground"> · {a.client}</span>}
                  <span className="text-muted-foreground"> · {a.articles} art.</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums">
                    {formatCurrency(a.total)}
                  </span>
                  {a.du > 0 && (
                    <span className="block text-xs t-warning tabular-nums">
                      dû {formatCurrency(a.du)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
