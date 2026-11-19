import React, { useMemo, useState } from "react";
import { ChevronDown, PackagePlus, Plus, Trash2, Truck } from "lucide-react";
import type { Product, Purchase } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";

type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];
type Categorie = Database["public"]["Tables"]["categories"]["Row"];

export interface LigneReception {
  produit: Product;
  quantite: number;
  prixAchat: number;
}

export interface Reception {
  date: string;
  fournisseur: string;
  fournisseurId: string | null;
  lignes: LigneReception[];
  /** Ce qui est payé tout de suite ; le reste part en dette fournisseur. */
  paye: number;
}

interface Props {
  products: Product[];
  categories: Categorie[];
  purchases: Purchase[];
  fournisseurs: Fournisseur[];
  peutRecevoir: boolean;
  onRecevoir: (r: Reception) => Promise<{ error: string | null }>;
}

const nombre = (v: string): number =>
  Math.max(0, Number(v.replace(/\s/g, "").replace(",", ".")) || 0);

const dateLisible = (iso: string) => {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
};

/**
 * LES ENTRÉES DE STOCK DU BAR
 *
 * Une livraison arrive : on note le fournisseur, ce qu'il apporte, au
 * prix payé, et si on le règle tout de suite ou plus tard. Chaque article
 * s'ajoute au stock de la Carte, la dépense entre dans les achats, et ce
 * qui n'est pas payé devient une dette envers le fournisseur.
 *
 * En dessous, les livraisons passées, regroupées comme elles sont
 * arrivées : un jour, un fournisseur.
 */
export const EntreesView: React.FC<Props> = ({
  products,
  categories,
  purchases,
  fournisseurs,
  peutRecevoir,
  onRecevoir,
}) => {
  const [reception, setReception] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const ceMois = dateDuJour().slice(0, 7);
  const duMois = purchases.filter((p) => p.date.startsWith(ceMois));
  const totalMois = duMois.reduce((n, p) => n + p.totalAchat, 0);
  const aPayer = purchases.reduce((n, p) => n + Math.max(0, p.soldeDu), 0);

  const livraisons = useMemo(() => {
    const groupes = new Map<string, Purchase[]>();
    for (const p of purchases) {
      const cle = `${p.date}|${p.fournisseur.trim() || "Sans fournisseur"}`;
      groupes.set(cle, [...(groupes.get(cle) ?? []), p]);
    }
    return [...groupes.entries()]
      .map(([cle, achats]) => ({
        cle,
        date: achats[0].date,
        fournisseur: achats[0].fournisseur.trim() || "Sans fournisseur",
        achats,
        total: achats.reduce((n, p) => n + p.totalAchat, 0),
        du: achats.reduce((n, p) => n + Math.max(0, p.soldeDu), 0),
        articles: achats.reduce((n, p) => n + p.quantite, 0),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);
  }, [purchases]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entrées de stock</h1>
          <p className="text-sm text-muted-foreground">
            Les livraisons de vos fournisseurs, ajoutées au stock de la Carte.
          </p>
        </div>
        {peutRecevoir && (
          <button
            type="button"
            onClick={() => setReception(true)}
            className="app-btn-primary shrink-0"
          >
            <PackagePlus className="h-4 w-4" />
            Recevoir
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">Reçu ce mois-ci</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(totalMois)}</p>
        </div>
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">Reste à payer aux fournisseurs</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${aPayer > 0 ? "t-warning" : ""}`}>
            {formatCurrency(aPayer)}
          </p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Les dernières livraisons</h2>
        {livraisons.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="h-6 w-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Aucune livraison enregistrée. Quand le camion arrive, touchez « Recevoir » et notez ce
              qu&apos;il apporte.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {livraisons.map((l) => (
              <li key={l.cle}>
                <button
                  type="button"
                  onClick={() => setOuverte(ouverte === l.cle ? null : l.cle)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40"
                  aria-expanded={ouverte === l.cle}
                >
                  <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{l.fournisseur}</span>
                    <span className="block text-xs text-muted-foreground">
                      {dateLisible(l.date)} · {l.articles} article{l.articles > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {formatCurrency(l.total)}
                    </span>
                    {l.du > 0 && (
                      <span className="block text-xs tabular-nums t-warning">
                        à payer {formatCurrency(l.du)}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      ouverte === l.cle ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {ouverte === l.cle && (
                  <ul className="space-y-1 bg-muted/30 px-10 py-2 text-sm">
                    {l.achats.map((a) => (
                      <li key={a.id} className="flex justify-between gap-3">
                        <span className="truncate">
                          {a.quantite} × {a.designation}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatCurrency(a.totalAchat)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {reception && (
        <ReceptionModal
          products={products}
          categories={categories}
          fournisseurs={fournisseurs}
          onFermer={() => setReception(false)}
          onRecevoir={async (r) => {
            const res = await onRecevoir(r);
            if (!res.error) setReception(false);
            return res;
          }}
        />
      )}
    </div>
  );
};

/* ── Recevoir une livraison ─────────────────────────────────────── */

interface LigneSaisie {
  cle: number;
  produitId: string;
  quantite: string;
  prix: string;
}

const ReceptionModal: React.FC<{
  products: Product[];
  categories: Categorie[];
  fournisseurs: Fournisseur[];
  onFermer: () => void;
  onRecevoir: (r: Reception) => Promise<{ error: string | null }>;
}> = ({ products, categories, fournisseurs, onFermer, onRecevoir }) => {
  const articles = useMemo(
    () =>
      products
        .filter((p) => p.typeProduit !== "service" && p.statut !== "archive")
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
    [products],
  );
  const parRubrique = useMemo(() => {
    const groupes = categories
      .map((c) => ({ nom: c.nom, articles: articles.filter((p) => p.categoryId === c.id) }))
      .filter((g) => g.articles.length > 0);
    const sans = articles.filter((p) => !categories.some((c) => c.id === p.categoryId));
    if (sans.length) groupes.push({ nom: "Autres", articles: sans });
    return groupes;
  }, [articles, categories]);

  const [fournisseurId, setFournisseurId] = useState(fournisseurs[0]?.id ?? "");
  const [fournisseurLibre, setFournisseurLibre] = useState("");
  const [date, setDate] = useState(dateDuJour());
  const [lignes, setLignes] = useState<LigneSaisie[]>([
    { cle: 1, produitId: "", quantite: "", prix: "" },
  ]);
  const [paye, setPaye] = useState<string>("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const changer = (cle: number, patch: Partial<LigneSaisie>) =>
    setLignes((ls) =>
      ls.map((l) => {
        if (l.cle !== cle) return l;
        const suite = { ...l, ...patch };
        // Choisir un article propose son dernier prix d'achat.
        if (patch.produitId !== undefined && !l.prix) {
          const p = articles.find((x) => x.id === patch.produitId);
          if (p?.prixAchat) suite.prix = String(p.prixAchat);
        }
        return suite;
      }),
    );

  const valides = lignes
    .map((l) => ({
      produit: articles.find((p) => p.id === l.produitId),
      quantite: Math.round(nombre(l.quantite)),
      prixAchat: nombre(l.prix),
    }))
    .filter((l): l is LigneReception => Boolean(l.produit) && l.quantite > 0);
  const total = valides.reduce((n, l) => n + l.quantite * l.prixAchat, 0);
  const payeMontant = paye.trim() === "" ? total : Math.min(total, nombre(paye));
  const nomFournisseur =
    fournisseurId === ""
      ? fournisseurLibre.trim()
      : (fournisseurs.find((f) => f.id === fournisseurId)?.nom ?? "");

  if (articles.length === 0) {
    return (
      <Modal open onClose={onFermer} size="sm" title="Recevoir une livraison">
        <p className="text-sm text-muted-foreground">
          Ajoutez d&apos;abord vos articles dans la Carte : la livraison s&apos;y ajoutera.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onFermer}
      size="2xl"
      icon={<PackagePlus className="h-4 w-4" />}
      title="Recevoir une livraison"
      description="Ce que le fournisseur apporte, au prix payé."
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="reception" disabled={envoi} className="app-btn-primary">
            {envoi ? "Enregistrement…" : `Ajouter au stock · ${formatCurrency(total)}`}
          </button>
        </>
      }
    >
      <form
        id="reception"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (valides.length === 0) return setErreur("Ajoutez au moins un article reçu.");
          setEnvoi(true);
          setErreur(null);
          const r = await onRecevoir({
            date,
            fournisseur: nomFournisseur,
            fournisseurId: fournisseurId || null,
            lignes: valides,
            paye: payeMontant,
          });
          setEnvoi(false);
          if (r.error) setErreur(r.error);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Fournisseur
            </span>
            <select
              value={fournisseurId}
              onChange={(e) => setFournisseurId(e.target.value)}
              className="app-field"
            >
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
              <option value="">Autre fournisseur…</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Date de livraison
            </span>
            <input
              type="date"
              value={date}
              max={dateDuJour()}
              onChange={(e) => setDate(e.target.value || dateDuJour())}
              className="app-field"
            />
          </label>
          {fournisseurId === "" && (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Nom du fournisseur
              </span>
              <input
                value={fournisseurLibre}
                onChange={(e) => setFournisseurLibre(e.target.value)}
                placeholder="Star Madagascar"
                className="app-field"
              />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_6rem_8rem_2.5rem] gap-2 px-1 text-xs font-semibold text-muted-foreground sm:grid">
            <span>Article</span>
            <span>Quantité</span>
            <span>Prix d&apos;achat</span>
            <span />
          </div>
          {lignes.map((l) => (
            <div
              key={l.cle}
              className="grid grid-cols-[1fr_5rem] gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_6rem_8rem_2.5rem] sm:border-0 sm:p-0"
            >
              <select
                value={l.produitId}
                onChange={(e) => changer(l.cle, { produitId: e.target.value })}
                aria-label="Article reçu"
                className="app-field col-span-2 sm:col-span-1"
              >
                <option value="">Choisir un article</option>
                {parRubrique.map((g) => (
                  <optgroup key={g.nom} label={g.nom}>
                    {g.articles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName} (stock {p.stockActuel})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={l.quantite}
                onChange={(e) => changer(l.cle, { quantite: e.target.value })}
                placeholder="Qté"
                aria-label="Quantité reçue"
                className="app-field"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={l.prix}
                onChange={(e) => changer(l.cle, { prix: e.target.value })}
                placeholder="Prix unitaire"
                aria-label="Prix d'achat unitaire"
                className="app-field"
              />
              <button
                type="button"
                onClick={() =>
                  setLignes((ls) => (ls.length > 1 ? ls.filter((x) => x.cle !== l.cle) : ls))
                }
                className="inline-flex h-[38px] items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Retirer cette ligne"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setLignes((ls) => [
                ...ls,
                {
                  cle: Math.max(...ls.map((x) => x.cle)) + 1,
                  produitId: "",
                  quantite: "",
                  prix: "",
                },
              ])
            }
            className="app-btn-secondary"
          >
            <Plus className="h-4 w-4" />
            Un autre article
          </button>
        </div>

        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Total de la livraison</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(total)}</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Payé maintenant
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={paye}
              onChange={(e) => setPaye(e.target.value)}
              placeholder={String(total)}
              className="app-field"
            />
          </label>
          {total - payeMontant > 0 && (
            <p className="text-sm font-semibold t-warning sm:col-span-2">
              Reste à payer au fournisseur : {formatCurrency(total - payeMontant)}
            </p>
          )}
        </div>
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};
