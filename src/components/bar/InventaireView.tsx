import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, History, Minus, Plus, RotateCcw } from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import { useConfirmation } from "../../hooks/useConfirmation";
import {
  bilanInventaire,
  ecarts,
  inventairesPasses,
  noteInventaire,
  PREFIXE_INVENTAIRE,
  type InventairePasse,
  type MouvementInventaire,
} from "../../lib/inventaireBar";
import { Chiffre, EnTete, Pastille } from "../pharmacie/ui";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

interface Props {
  storeId: string;
  products: Product[];
  categories: Categorie[];
  peutValider: boolean;
  /** Après validation : le stock a changé. */
  onValide: () => void;
  /** Le titre et la phrase d'en-tête, quand ce n'est pas un bar. */
  titre?: string;
  sousTitre?: string;
  /** « officine » : l'en-tête, les chiffres et les lignes de la pharmacie. */
  habit?: "officine";
}

const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (f: string, a: Record<string, unknown>) => any;
};

/** Le comptage en cours se garde sur l'appareil : un rechargement ne le perd pas. */
const cleBrouillon = (storeId: string, jour: string) => `tantana.inventaire.${storeId}.${jour}`;
const lireBrouillon = (cle: string): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(cle) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
};
const ecrireBrouillon = (cle: string, v: Record<string, number> | null) => {
  try {
    if (v === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    /* navigation privée : le comptage vit le temps de la page */
  }
};

/**
 * L'INVENTAIRE DU SOIR
 *
 * On compte, rubrique par rubrique, ce qui reste sur les étagères et
 * dans le frigo. Chaque article montre le stock attendu ; à côté du
 * compté, l'écart s'affiche aussitôt, en quantité et en Ariary. On
 * valide une fois tout compté : le stock se remet sur le compté, et
 * l'inventaire rejoint l'historique.
 */
export const InventaireView: React.FC<Props> = ({
  storeId,
  products,
  categories,
  peutValider,
  onValide,
  titre,
  sousTitre,
  habit,
}) => {
  const officine = habit === "officine";
  const jour = dateDuJour();
  const cle = cleBrouillon(storeId, jour);
  const [comptes, setComptes] = useState<Record<string, number>>(() => lireBrouillon(cle));
  const [rubrique, setRubrique] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [passes, setPasses] = useState<InventairePasse[]>([]);
  const { confirmer, modaleConfirmation } = useConfirmation();

  useEffect(
    () => ecrireBrouillon(cle, Object.keys(comptes).length ? comptes : null),
    [cle, comptes],
  );

  const articles = useMemo(
    () =>
      products
        .filter((p) => p.typeProduit !== "service" && p.statut !== "archive")
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
    [products],
  );
  const rubriques = useMemo(
    () =>
      categories
        .filter((c) => articles.some((p) => p.categoryId === c.id))
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr")),
    [categories, articles],
  );
  const visibles = articles.filter((p) => rubrique === null || p.categoryId === rubrique);
  const lignes = useMemo(() => ecarts(articles, comptes), [articles, comptes]);
  const bilan = bilanInventaire(lignes);
  const prixAchat = useMemo(() => new Map(articles.map((p) => [p.id, p.prixAchat])), [articles]);

  const chargerHistorique = async () => {
    const { data } = await db
      .from("stock_movements")
      .select("product_id, stock_actuel_delta, note, created_at")
      .eq("store_id", storeId)
      .eq("type_mouvement", "ajustement")
      .like("note", `${PREFIXE_INVENTAIRE}%`)
      .order("created_at", { ascending: false })
      .limit(500);
    setPasses(inventairesPasses((data ?? []) as MouvementInventaire[], prixAchat));
  };
  useEffect(() => {
    void chargerHistorique();
    // L'historique se relit au changement de boutique et après chaque validation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const fait = passes.find((p) => p.note === noteInventaire(jour));

  const poser = (id: string, v: number | undefined) =>
    setComptes((c) => {
      const suite = { ...c };
      if (v === undefined || Number.isNaN(v)) delete suite[id];
      else suite[id] = Math.max(0, Math.round(v));
      return suite;
    });

  const valider = async () => {
    const aCorriger = lignes.filter((l) => l.ecart !== 0);
    const ok = await confirmer(
      aCorriger.length === 0
        ? `Valider l'inventaire de ${bilan.comptes} article(s) ? Tout est juste, rien ne change.`
        : `Valider l'inventaire ? Le stock de ${aCorriger.length} article(s) sera remis sur le compté (écart ${formatCurrency(bilan.valeur)}).`,
      { libelle: "Valider l'inventaire" },
    );
    if (!ok) return;
    setEnvoi(true);
    setErreur(null);
    const note = noteInventaire(jour);
    for (const l of aCorriger) {
      const { error } = await db.rpc("ajuster_stock", {
        p_product_id: l.produit.id,
        p_delta: l.ecart,
        p_note: note,
      });
      if (error) {
        setErreur(`${l.produit.displayName} : ${error.message}`);
        setEnvoi(false);
        onValide();
        return;
      }
    }
    setEnvoi(false);
    setComptes({});
    ecrireBrouillon(cle, null);
    onValide();
    await chargerHistorique();
  };

  return (
    <div className={officine ? "ph-page pb-28" : "mx-auto max-w-3xl space-y-5 pb-28"}>
      {officine ? (
        <EnTete
          icone={<ClipboardCheck className="h-6 w-6" />}
          titre={titre ?? "Inventaire"}
          sousTitre={sousTitre}
        >
          <Chiffre ton="plein" valeur={articles.length} libelle="Références à compter" />
          <Chiffre valeur={`${bilan.comptes} / ${articles.length}`} libelle="Déjà comptées" />
          <Chiffre
            ton={bilan.valeur < 0 ? "danger" : undefined}
            valeur={formatCurrency(bilan.valeur)}
            libelle="Écart, au prix d'achat"
          />
          <Chiffre valeur={passes.length} libelle="Inventaires passés" />
        </EnTete>
      ) : (
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{titre ?? "Inventaire du soir"}</h1>
          <p className="text-sm text-muted-foreground">
            {sousTitre ??
              "Comptez ce qui reste après la fermeture : le logiciel montre ce qui manque."}
          </p>
        </header>
      )}

      {fait && (
        <div className="flex items-center gap-3 rounded-xl border border-success-border bg-success-soft p-3 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 t-success" />
          <span className="flex-1">
            Inventaire d&apos;aujourd&apos;hui validé à{" "}
            {new Date(fait.quand).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {fait.articles} correction{fait.articles > 1 ? "s" : ""} ·{" "}
            <span className={fait.valeur < 0 ? "t-danger" : ""}>{formatCurrency(fait.valeur)}</span>
          </span>
        </div>
      )}

      {articles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Votre carte est vide : ajoutez d&apos;abord vos articles.
        </p>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[{ id: null as string | null, nom: "Tout" }, ...rubriques].map((c) => {
              const dans = articles.filter((p) => c.id === null || p.categoryId === c.id);
              const faits = dans.filter((p) => comptes[p.id] !== undefined).length;
              return (
                <button
                  key={c.id ?? "tout"}
                  type="button"
                  onClick={() => setRubrique(c.id)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                    rubrique === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.nom}{" "}
                  <span className="opacity-70">
                    {faits}/{dans.length}
                  </span>
                </button>
              );
            })}
          </div>

          <ul
            className={
              officine
                ? "ph-panneau ph-liste"
                : "divide-y divide-border rounded-xl border border-border"
            }
          >
            {visibles.map((p) => {
              const compte = comptes[p.id];
              const ecart = compte === undefined ? null : compte - p.stockActuel;
              return (
                <li
                  key={p.id}
                  className={officine ? "ph-ligne" : "flex items-center gap-3 px-3 py-2.5"}
                  data-ton={
                    !officine || ecart === null
                      ? undefined
                      : ecart < 0
                        ? "danger"
                        : ecart > 0
                          ? "warning"
                          : "croix"
                  }
                >
                  {officine && <Pastille nom={p.displayName} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      Attendu {p.stockActuel}
                      {ecart !== null && ecart !== 0 && (
                        <span className={ecart < 0 ? " t-danger" : " t-success"}>
                          {" "}
                          · {ecart > 0 ? "+" : ""}
                          {ecart} ({formatCurrency(ecart * p.prixAchat)})
                        </span>
                      )}
                      {ecart === 0 && <span className="t-success"> · juste</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => poser(p.id, (compte ?? p.stockActuel) - 1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border"
                      aria-label={`Un ${p.displayName} de moins`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={compte ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        poser(p.id, e.target.value === "" ? undefined : Number(e.target.value))
                      }
                      aria-label={`Compté pour ${p.displayName}`}
                      className="app-field w-16 text-center tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => poser(p.id, (compte ?? p.stockActuel) + 1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border"
                      aria-label={`Un ${p.displayName} de plus`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {passes.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <History className="h-4 w-4" />
            Inventaires passés
          </h2>
          <ul
            className={
              officine
                ? "ph-panneau ph-liste"
                : "divide-y divide-border rounded-xl border border-border"
            }
          >
            {passes.slice(0, 20).map((i) => (
              <li key={i.note} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <ClipboardCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  {i.note.replace(`${PREFIXE_INVENTAIRE} · `, "")}
                  <span className="text-muted-foreground">
                    {" "}
                    · {i.articles} correction{i.articles > 1 ? "s" : ""}
                    {i.manquant < 0 ? ` · ${-i.manquant} manquant(s)` : ""}
                  </span>
                </span>
                <span className={`font-semibold tabular-nums ${i.valeur < 0 ? "t-danger" : ""}`}>
                  {formatCurrency(i.valeur)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bilan.comptes > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 px-4 lg:bottom-4 lg:left-[268px]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {bilan.comptes} / {articles.length} compté{bilan.comptes > 1 ? "s" : ""}
              </p>
              <p className={bilan.valeur < 0 ? "t-danger" : "text-muted-foreground"}>
                Écart {formatCurrency(bilan.valeur)}
                {bilan.manquant < 0 && ` · ${-bilan.manquant} manquant(s)`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setComptes({})}
              disabled={envoi}
              className="app-btn-secondary"
              aria-label="Effacer le comptage"
              title="Effacer le comptage"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {peutValider && (
              <button type="button" onClick={valider} disabled={envoi} className="app-btn-primary">
                <ClipboardCheck className="h-4 w-4" />
                {envoi ? "Validation…" : "Valider"}
              </button>
            )}
          </div>
          {erreur && (
            <p className="mx-auto mt-2 max-w-3xl text-sm font-medium t-danger">{erreur}</p>
          )}
        </div>
      )}
      {modaleConfirmation}
    </div>
  );
};
