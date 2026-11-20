import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  PackagePlus,
  PackageX,
  Plus,
  Search,
  Sparkles,
  Wine,
  Wrench,
} from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { VignetteProduit, vignettesParProduit } from "../shared/VignetteProduit";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import { estEnRupture, estSousLeSeuil } from "../../lib/prealerteStock";
import { planRubriquesBar, RUBRIQUES_BAR } from "../../lib/rubriquesBar";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];
type Resultat = { error: string | null };

/** Les raisons d'une correction de stock, dans les mots d'un bar. */
const MOTIFS = [
  "Casse",
  "Offert hors note",
  "Perte",
  "Erreur de comptage",
  "Consommation du personnel",
];

export interface CarteViewProps {
  products: Product[];
  categories: Categorie[];
  productImages: { product_id: string | null; chemin: string; ordre: number }[];
  peutModifier: boolean;
  onCreerProduit: (p: {
    nom: string;
    prixVente: number;
    prixAchat: number;
    stock: number;
    seuil: number;
    categorieId: string | null;
  }) => Promise<Resultat>;
  onModifierProduit: (
    p: Product,
    patch: {
      nom: string;
      prixVente: number;
      prixAchat: number;
      seuil: number;
      categorieId: string | null;
    },
  ) => Promise<Resultat>;
  onRecevoir: (p: Product, quantite: number, prixAchat: number) => Promise<Resultat>;
  onCorriger: (p: Product, delta: number, motif: string) => Promise<Resultat>;
  /** Remplace les catégories d'un commerce ordinaire par celles d'un bar. */
  onAdapterRubriques: () => Promise<Resultat>;
}

const nombre = (v: string): number =>
  Math.max(0, Number(v.replace(/\s/g, "").replace(",", ".")) || 0);

/**
 * LA CARTE DU BAR
 *
 * Ce que le bar vend, rangé par rubrique comme sur une ardoise : Bières,
 * Softs, Alcools… Chaque article montre son prix et ce qu'il en reste ;
 * on le touche pour le modifier, recevoir une livraison ou corriger le
 * stock (casse, perte…), sans quitter la carte.
 */
export const CarteView: React.FC<CarteViewProps> = (props) => {
  const { products, categories, productImages, peutModifier } = props;
  const [rubrique, setRubrique] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [ajout, setAjout] = useState(false);
  const [choisi, setChoisi] = useState<Product | null>(null);
  const [occupe, setOccupe] = useState(false);
  const photos = useMemo(() => vignettesParProduit(productImages), [productImages]);
  const plan = useMemo(() => {
    const compte = new Map<string, number>();
    for (const p of products) {
      if (p.categoryId) compte.set(p.categoryId, (compte.get(p.categoryId) ?? 0) + 1);
    }
    return planRubriquesBar(categories, compte);
  }, [categories, products]);

  const articles = useMemo(
    () => products.filter((p) => p.typeProduit !== "service" && p.statut !== "archive"),
    [products],
  );
  const rubriques = useMemo(
    () =>
      categories
        .filter((c) => c.actif !== false && (c.usage ?? "produit") === "produit")
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr")),
    [categories],
  );
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return articles
      .filter((p) => rubrique === null || p.categoryId === rubrique)
      .filter((p) => !q || p.displayName.toLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
  }, [articles, rubrique, recherche]);

  const aRacheter = articles.filter(
    (p) => estEnRupture(p.stockActuel) || estSousLeSeuil(p.stockActuel, p.seuilAlerte),
  ).length;
  const valeur = articles.reduce((n, p) => n + Math.max(0, p.stockActuel) * p.prixAchat, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carte</h1>
          <p className="text-sm text-muted-foreground">
            {articles.length} article{articles.length > 1 ? "s" : ""} · stock{" "}
            {formatCurrency(valeur)}
            {aRacheter > 0 && <span className="t-warning"> · {aRacheter} à racheter</span>}
          </p>
        </div>
        {peutModifier && (
          <button type="button" onClick={() => setAjout(true)} className="app-btn-primary shrink-0">
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        )}
      </header>

      {peutModifier && (plan.aMasquer.length > 0 || plan.aCreer.length > 0) && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/50 bg-success-soft p-4 sm:flex-row sm:items-center">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm">
            {plan.aMasquer.length > 0 ? (
              <>
                Votre carte a encore les rubriques d&apos;un commerce ordinaire (
                {categories
                  .filter((c) => plan.aMasquer.includes(c.id))
                  .map((c) => c.nom)
                  .join(", ")}
                ). Rangez-la comme une ardoise de bar :{" "}
              </>
            ) : (
              "Complétez votre carte avec les rubriques d'un bar : "
            )}
            <span className="font-semibold">{RUBRIQUES_BAR.join(", ")}</span>.
          </p>
          <button
            type="button"
            disabled={occupe}
            onClick={async () => {
              setOccupe(true);
              await props.onAdapterRubriques();
              setOccupe(false);
            }}
            className="app-btn-primary"
          >
            {occupe ? "Rangement…" : "Ranger la carte"}
          </button>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: null as string | null, nom: "Tout" }, ...rubriques].map((c) => {
          const n =
            c.id === null ? articles.length : articles.filter((p) => p.categoryId === c.id).length;
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
              {c.nom} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {articles.length > 6 && (
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher sur la carte"
            aria-label="Chercher sur la carte"
            className="app-field pl-9"
          />
        </label>
      )}

      {articles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wine className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-bold">Votre carte est vide</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ajoutez vos boissons et vos plats avec leur prix et le stock que vous avez : ils
            apparaîtront dans la Salle, prêts à servir.
          </p>
          {peutModifier && (
            <button type="button" onClick={() => setAjout(true)} className="app-btn-primary">
              <Plus className="h-4 w-4" />
              Ajouter un article
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => {
            const rupture = estEnRupture(p.stockActuel);
            const bas = !rupture && estSousLeSeuil(p.stockActuel, p.seuilAlerte);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setChoisi(p)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
              >
                <VignetteProduit nom={p.displayName} chemin={photos.get(p.id)} taille={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.displayName}</span>
                  <span className="block text-sm tabular-nums text-primary">
                    {formatCurrency(p.prixVenteDefaut)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    rupture
                      ? "bg-danger-soft t-danger"
                      : bas
                        ? "bg-warning-soft t-warning"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {rupture ? "Épuisé" : `${p.stockActuel} en stock`}
                </span>
              </button>
            );
          })}
          {visibles.length === 0 && (
            <p className="col-span-full p-6 text-center text-sm text-muted-foreground">
              Rien dans cette rubrique.
            </p>
          )}
        </div>
      )}

      {ajout && (
        <FicheArticle
          titre="Ajouter à la carte"
          rubriques={rubriques}
          rubriqueParDefaut={rubrique}
          avecStock
          onFermer={() => setAjout(false)}
          onEnregistrer={async (v) => {
            const r = await props.onCreerProduit(v);
            if (!r.error) setAjout(false);
            return r;
          }}
        />
      )}

      {choisi && (
        <ArticleModal
          produit={products.find((p) => p.id === choisi.id) ?? choisi}
          rubriques={rubriques}
          peutModifier={peutModifier}
          onFermer={() => setChoisi(null)}
          props={props}
        />
      )}
    </div>
  );
};

/* ── La fiche d'un article : ajout ou modification ─────────────── */

const FicheArticle: React.FC<{
  titre: string;
  rubriques: Categorie[];
  rubriqueParDefaut: string | null;
  initial?: Product;
  avecStock?: boolean;
  onFermer: () => void;
  onEnregistrer: (v: {
    nom: string;
    prixVente: number;
    prixAchat: number;
    stock: number;
    seuil: number;
    categorieId: string | null;
  }) => Promise<Resultat>;
}> = ({ titre, rubriques, rubriqueParDefaut, initial, avecStock, onFermer, onEnregistrer }) => {
  const [nom, setNom] = useState(initial?.designation ?? "");
  const [categorieId, setCategorieId] = useState(
    initial ? (initial.categoryId ?? "") : (rubriqueParDefaut ?? rubriques[0]?.id ?? ""),
  );
  const [prixVente, setPrixVente] = useState(initial ? String(initial.prixVenteDefaut) : "");
  const [prixAchat, setPrixAchat] = useState(initial ? String(initial.prixAchat) : "");
  const [stock, setStock] = useState("");
  const [seuil, setSeuil] = useState(initial ? String(initial.seuilAlerte) : "6");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const marge = nombre(prixVente) - nombre(prixAchat);

  return (
    <Modal
      open
      onClose={onFermer}
      size="md"
      icon={<Wine className="h-4 w-4" />}
      title={titre}
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="fiche-article" disabled={envoi} className="app-btn-primary">
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form
        id="fiche-article"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nom.trim()) return setErreur("Donnez un nom à l'article.");
          if (nombre(prixVente) <= 0) return setErreur("Indiquez le prix de vente.");
          setEnvoi(true);
          setErreur(null);
          const r = await onEnregistrer({
            nom: nom.trim(),
            prixVente: nombre(prixVente),
            prixAchat: nombre(prixAchat),
            stock: Math.round(nombre(stock)),
            seuil: Math.round(nombre(seuil)),
            categorieId: categorieId || null,
          });
          setEnvoi(false);
          if (r.error) setErreur(r.error);
        }}
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nom</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="THB grand modèle"
            className="app-field"
            autoFocus
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Rubrique</span>
          <select
            value={categorieId}
            onChange={(e) => setCategorieId(e.target.value)}
            className="app-field"
          >
            <option value="">Sans rubrique</option>
            {rubriques.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Prix de vente
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={prixVente}
            onChange={(e) => setPrixVente(e.target.value)}
            className="app-field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Prix d&apos;achat
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={prixAchat}
            onChange={(e) => setPrixAchat(e.target.value)}
            className="app-field"
          />
        </label>
        {avecStock && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              En stock aujourd&apos;hui
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="app-field"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Prévenir à partir de
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={seuil}
            onChange={(e) => setSeuil(e.target.value)}
            className="app-field"
          />
        </label>
        {nombre(prixVente) > 0 && nombre(prixAchat) > 0 && (
          <p className={`text-sm sm:col-span-2 ${marge > 0 ? "t-success" : "t-danger"}`}>
            Marge par article : {formatCurrency(marge)}
          </p>
        )}
        {erreur && <p className="text-sm font-medium t-danger sm:col-span-2">{erreur}</p>}
      </form>
    </Modal>
  );
};

/* ── Un article : modifier, recevoir, corriger ───────────────────── */

type Geste = "menu" | "modifier" | "recevoir" | "corriger";

const ArticleModal: React.FC<{
  produit: Product;
  rubriques: Categorie[];
  peutModifier: boolean;
  onFermer: () => void;
  props: CarteViewProps;
}> = ({ produit, rubriques, peutModifier, onFermer, props }) => {
  const [geste, setGeste] = useState<Geste>("menu");
  const [quantite, setQuantite] = useState("");
  const [prixAchat, setPrixAchat] = useState(String(produit.prixAchat || ""));
  const [sens, setSens] = useState<"moins" | "plus">("moins");
  const [motif, setMotif] = useState(MOTIFS[0]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (geste === "modifier") {
    return (
      <FicheArticle
        titre={`Modifier ${produit.displayName}`}
        rubriques={rubriques}
        rubriqueParDefaut={null}
        initial={produit}
        onFermer={() => setGeste("menu")}
        onEnregistrer={async (v) => {
          const r = await props.onModifierProduit(produit, v);
          if (!r.error) setGeste("menu");
          return r;
        }}
      />
    );
  }

  const agir = async (f: () => Promise<Resultat>) => {
    setEnvoi(true);
    setErreur(null);
    const r = await f();
    setEnvoi(false);
    if (r.error) setErreur(r.error);
    else {
      setQuantite("");
      setGeste("menu");
    }
  };

  const rupture = estEnRupture(produit.stockActuel);
  const rubrique = rubriques.find((c) => c.id === produit.categoryId);

  return (
    <Modal
      open
      onClose={onFermer}
      size="sm"
      icon={<Wine className="h-4 w-4" />}
      title={produit.displayName}
      description={[rubrique?.nom, formatCurrency(produit.prixVenteDefaut)]
        .filter(Boolean)
        .join(" · ")}
      dismissible={!envoi}
    >
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/60 p-2">
          <p className={`text-lg font-bold tabular-nums ${rupture ? "t-danger" : ""}`}>
            {produit.stockActuel}
          </p>
          <p className="text-[11px] text-muted-foreground">en stock</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <p className="text-lg font-bold tabular-nums">{formatCurrency(produit.prixAchat)}</p>
          <p className="text-[11px] text-muted-foreground">achat</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <p className="text-lg font-bold tabular-nums">
            {formatCurrency(produit.prixVenteDefaut - produit.prixAchat)}
          </p>
          <p className="text-[11px] text-muted-foreground">marge</p>
        </div>
      </div>

      {geste === "menu" && (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              // Le prix a pu changer depuis l'ouverture de la fiche.
              setPrixAchat(produit.prixAchat ? String(produit.prixAchat) : "");
              setGeste("recevoir");
            }}
            className="app-btn-primary"
          >
            <PackagePlus className="h-4 w-4" />
            Recevoir une livraison
          </button>
          <button type="button" onClick={() => setGeste("corriger")} className="app-btn-secondary">
            <Wrench className="h-4 w-4" />
            Corriger le stock
          </button>
          {peutModifier && (
            <button
              type="button"
              onClick={() => setGeste("modifier")}
              className="app-btn-secondary"
            >
              Modifier le prix, le nom, la rubrique
            </button>
          )}
        </div>
      )}

      {geste === "recevoir" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const q = Math.round(nombre(quantite));
            if (q <= 0) return setErreur("Combien en avez-vous reçu ?");
            void agir(() => props.onRecevoir(produit, q, nombre(prixAchat)));
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Quantité reçue
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="app-field"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Prix d&apos;achat unitaire
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={prixAchat}
                onChange={(e) => setPrixAchat(e.target.value)}
                className="app-field"
              />
            </label>
          </div>
          {nombre(quantite) > 0 && (
            <p className="text-sm text-muted-foreground">
              Total de la livraison :{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(Math.round(nombre(quantite)) * nombre(prixAchat))}
              </span>{" "}
              — enregistré dans vos achats du {dateDuJour().split("-").reverse().join("/")}.
            </p>
          )}
          {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setGeste("menu")} className="app-btn-secondary">
              Retour
            </button>
            <button type="submit" disabled={envoi} className="app-btn-primary flex-1">
              {envoi ? "Enregistrement…" : "Ajouter au stock"}
            </button>
          </div>
        </form>
      )}

      {geste === "corriger" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const q = Math.round(nombre(quantite));
            if (q <= 0) return setErreur("Indiquez une quantité.");
            void agir(() => props.onCorriger(produit, sens === "moins" ? -q : q, motif));
          }}
        >
          <div className="flex gap-2">
            {(["moins", "plus"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSens(s)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  sens === s ? "border-primary bg-success-soft" : "border-border"
                }`}
              >
                {s === "moins" ? "Retirer du stock" : "Ajouter au stock"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Quantité
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="app-field"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Motif</span>
              <select
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="app-field"
              >
                {MOTIFS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          {sens === "moins" && Math.round(nombre(quantite)) > produit.stockActuel && (
            <p className="flex items-center gap-1.5 text-sm t-warning">
              <AlertTriangle className="h-4 w-4" />
              C&apos;est plus que le stock affiché ({produit.stockActuel}).
            </p>
          )}
          {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setGeste("menu")} className="app-btn-secondary">
              Retour
            </button>
            <button type="submit" disabled={envoi} className="app-btn-primary flex-1">
              {envoi ? "Enregistrement…" : "Corriger"}
            </button>
          </div>
        </form>
      )}
      {rupture && geste === "menu" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm t-danger">
          <PackageX className="h-4 w-4" />
          Épuisé : il n&apos;apparaît plus comme disponible dans la Salle.
        </p>
      )}
    </Modal>
  );
};
