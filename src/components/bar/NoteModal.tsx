import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Banknote,
  Gift,
  Minus,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Product } from "../../types";
import type { Database } from "../../lib/database.types";
import { Modal } from "../shared/Modal";
import { VignetteProduit, vignettesParProduit } from "../shared/VignetteProduit";
import { formatCurrency } from "../../utils/formulas";
import { dateDuJour } from "../../lib/dates";
import { MODES_DE_PAIEMENT } from "../facturation/paiement";
import { useConfirmation } from "../../hooks/useConfirmation";
import {
  dureeDepuis,
  grouperLignes,
  nomDeTable,
  resteAPayer,
  totalDesLignes,
  totalNote,
  type GroupeLignes,
  type NoteBar,
} from "../../lib/bar";
import type { ArticleAServir, Bar } from "../../hooks/useBar";
import { nomClient } from "./OuvrirTableModal";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Categorie = Database["public"]["Tables"]["categories"]["Row"];

type Mode = "note" | "servir" | "encaisser" | "deplacer";

interface Props {
  note: NoteBar;
  bar: Bar;
  products: Product[];
  categories: Categorie[];
  productImages: { product_id: string | null; chemin: string; ordre: number }[];
  clients: Client[];
  serveurs: string[];
  vendeur: string;
  onVentes: () => void;
  onFermer: () => void;
}

const CLE_SERVEUR = "tantana.bar.serveur";
const lireServeur = (): string => {
  try {
    return localStorage.getItem(CLE_SERVEUR) ?? "";
  } catch {
    return "";
  }
};
const retenirServeur = (nom: string) => {
  try {
    localStorage.setItem(CLE_SERVEUR, nom);
  } catch {
    /* navigation privée : on ne retient pas */
  }
};

/**
 * L'ADDITION D'UNE TABLE
 *
 * Quatre temps dans la même fenêtre : la note (ce qui a été servi), le
 * service (ajouter des consommations), le déplacement (changer de table
 * ou regrouper) et l'encaissement (tout, ou une partie pour diviser
 * l'addition).
 */
export const NoteModal: React.FC<Props> = ({
  note,
  bar,
  products,
  categories,
  productImages,
  clients,
  serveurs,
  vendeur,
  onVentes,
  onFermer,
}) => {
  const [mode, setMode] = useState<Mode>("note");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { confirmer, modaleConfirmation } = useConfirmation();

  const table = bar.tables.find((t) => t.id === note.table_id);
  const lignes = bar.lignesDeLaNote(note.id);
  const groupes = useMemo(() => grouperLignes(lignes), [lignes]);
  const total = useMemo(() => totalNote(lignes), [lignes]);
  const client = clients.find((c) => c.id === note.client_id);

  const agir = async (f: () => Promise<{ error: string | null }>) => {
    setOccupe(true);
    setErreur(null);
    const r = await f();
    setOccupe(false);
    if (r.error) setErreur(r.error);
    return !r.error;
  };

  const titre = nomDeTable(table?.numero);
  const description = [
    `Ouverte depuis ${dureeDepuis(note.ouverte_le)}`,
    note.nb_personnes ? `${note.nb_personnes} pers.` : null,
    client ? nomClient(client) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      open
      onClose={onFermer}
      size="3xl"
      icon={<ReceiptText className="h-4 w-4" />}
      title={titre}
      description={description}
      dismissible={!occupe}
    >
      {erreur && (
        <p className="mb-3 rounded-lg border border-danger-border bg-danger-soft p-2.5 text-sm t-danger">
          {erreur}
        </p>
      )}

      {mode === "note" && (
        <VueNote
          groupes={groupes}
          total={total}
          peutEncaisser={lignes.some(resteAPayer)}
          occupe={occupe}
          onServir={() => setMode("servir")}
          onEncaisser={() => setMode("encaisser")}
          onDeplacer={() => setMode("deplacer")}
          onMoins={(g) => agir(() => bar.retirer(g.lignes, 1, null))}
          onAnnulerGroupe={async (g) => {
            if (
              !(await confirmer(`Annuler ${g.quantite} × ${g.designation} ?`, {
                danger: true,
                libelle: "Annuler la ligne",
              }))
            )
              return;
            await agir(() => bar.retirer(g.lignes, g.quantite, "Annulée à la caisse"));
          }}
          onOffrir={(g) => agir(() => bar.offrir(g.lignes, !g.offert))}
          onAnnulerNote={async () => {
            if (
              !(await confirmer(
                total.dejaPaye > 0
                  ? "Une partie est déjà encaissée : la note ne peut plus être annulée."
                  : `Annuler toute la note de ${titre} ? Rien ne sera encaissé.`,
                total.dejaPaye > 0
                  ? { libelle: "Compris" }
                  : { danger: true, libelle: "Annuler la note" },
              )) ||
              total.dejaPaye > 0
            )
              return;
            if (await agir(() => bar.annulerNote(note.id, "Annulée à la caisse"))) onFermer();
          }}
        />
      )}

      {mode === "servir" && (
        <VueServir
          products={products}
          categories={categories}
          productImages={productImages}
          serveurs={serveurs}
          occupe={occupe}
          onRetour={() => setMode("note")}
          onValider={async (articles) => {
            if (await agir(() => bar.servir(note.id, articles))) setMode("note");
          }}
        />
      )}

      {mode === "deplacer" && (
        <VueDeplacer
          note={note}
          bar={bar}
          occupe={occupe}
          onRetour={() => setMode("note")}
          onChanger={async (tableId) => {
            if (await agir(() => bar.changerDeTable(note.id, tableId))) setMode("note");
          }}
          onRegrouper={async (cibleId, numero) => {
            if (
              await agir(() =>
                bar.regrouper(note.id, cibleId, `Regroupée avec ${nomDeTable(numero)}`),
              )
            )
              onFermer();
          }}
        />
      )}

      {mode === "encaisser" && (
        <VueEncaisser
          groupes={groupes}
          clients={clients}
          clientNote={note.client_id}
          occupe={occupe}
          onRetour={() => setMode("note")}
          onEncaisser={async (e) => {
            const ok = await agir(() =>
              bar.encaisser(note.id, { ...e, date: dateDuJour(), vendeur }),
            );
            if (!ok) return;
            onVentes();
            // La note est close quand tout est payé ; sinon on revient à ce qui reste.
            const restant = bar
              .lignesDeLaNote(note.id)
              .filter((l) => resteAPayer(l) && (e.ligneIds === null || !e.ligneIds.includes(l.id)));
            if (e.ligneIds === null || restant.length === 0) onFermer();
            else setMode("note");
          }}
        />
      )}
      {modaleConfirmation}
    </Modal>
  );
};

/* ── La note ──────────────────────────────────────────────────── */

const VueNote: React.FC<{
  groupes: GroupeLignes[];
  total: ReturnType<typeof totalNote>;
  /** Il reste des lignes à passer en caisse, même offertes (elles sortent du stock). */
  peutEncaisser: boolean;
  occupe: boolean;
  onServir: () => void;
  onEncaisser: () => void;
  onDeplacer: () => void;
  onMoins: (g: GroupeLignes) => void;
  onAnnulerGroupe: (g: GroupeLignes) => void;
  onOffrir: (g: GroupeLignes) => void;
  onAnnulerNote: () => void;
}> = ({
  groupes,
  total,
  peutEncaisser,
  occupe,
  onServir,
  onEncaisser,
  onDeplacer,
  onMoins,
  onAnnulerGroupe,
  onOffrir,
  onAnnulerNote,
}) => (
  <div className="space-y-4">
    {groupes.length === 0 ? (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Rien de servi pour l&apos;instant.
      </p>
    ) : (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {groupes.map((g) => (
          <li key={g.cle} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                <span className="tabular-nums">{g.quantite} ×</span> {g.designation}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(g.prix_unit)}
                {g.offert && <span className="ml-1.5 font-semibold t-success">Offert</span>}
                {g.payee && <span className="ml-1.5 font-semibold t-info">Encaissé</span>}
              </div>
            </div>
            <div className="w-24 text-right text-sm font-semibold tabular-nums">
              {g.offert ? "—" : formatCurrency(g.montant)}
            </div>
            {!g.payee && (
              <div className="flex shrink-0 items-center gap-1">
                {g.genre === "article" && (
                  <>
                    <button
                      type="button"
                      disabled={occupe}
                      onClick={() => onMoins(g)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
                      aria-label={`Retirer un ${g.designation}`}
                      title="Retirer un"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={occupe}
                      onClick={() => onOffrir(g)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted ${
                        g.offert ? "border-success-border t-success" : "border-border"
                      }`}
                      aria-label={g.offert ? "Ne plus offrir" : "Offrir"}
                      title={g.offert ? "Ne plus offrir" : "Offrir (offert maison)"}
                    >
                      {g.offert ? (
                        <Undo2 className="h-3.5 w-3.5" />
                      ) : (
                        <Gift className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => onAnnulerGroupe(g)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Annuler ${g.designation}`}
                  title="Annuler la ligne"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    )}

    <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
      {total.offerts > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Offerts par la maison</span>
          <span className="tabular-nums">{formatCurrency(total.offerts)}</span>
        </div>
      )}
      {total.dejaPaye > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Déjà encaissé</span>
          <span className="tabular-nums">{formatCurrency(total.dejaPaye)}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-bold">
        <span>Reste à payer</span>
        <span className="tabular-nums">{formatCurrency(total.reste)}</span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button type="button" onClick={onServir} disabled={occupe} className="app-btn-primary">
        <Plus className="h-4 w-4" />
        Servir
      </button>
      <button
        type="button"
        onClick={onEncaisser}
        disabled={occupe || !peutEncaisser}
        className="app-btn-primary"
      >
        <Banknote className="h-4 w-4" />
        Encaisser
      </button>
      <button type="button" onClick={onDeplacer} disabled={occupe} className="app-btn-secondary">
        <ArrowRightLeft className="h-4 w-4" />
        Déplacer
      </button>
      <button type="button" onClick={onAnnulerNote} disabled={occupe} className="app-btn-secondary">
        <Trash2 className="h-4 w-4" />
        Annuler la note
      </button>
    </div>
  </div>
);

/* ── Servir : ajouter des consommations ───────────────────────── */

const VueServir: React.FC<{
  products: Product[];
  categories: Categorie[];
  productImages: { product_id: string | null; chemin: string; ordre: number }[];
  serveurs: string[];
  occupe: boolean;
  onRetour: () => void;
  onValider: (a: ArticleAServir[]) => void;
}> = ({ products, categories, productImages, serveurs, occupe, onRetour, onValider }) => {
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [panier, setPanier] = useState<Map<string, number>>(new Map());
  const [serveur, setServeur] = useState(lireServeur);
  const photos = useMemo(() => vignettesParProduit(productImages), [productImages]);

  const vendables = useMemo(
    () =>
      products.filter(
        (p) => p.statut !== "archive" && p.statut !== "inactif" && p.typeProduit !== "service",
      ),
    [products],
  );
  const categoriesUtiles = useMemo(
    () =>
      categories
        .filter((c) => c.actif !== false && vendables.some((p) => p.categoryId === c.id))
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr")),
    [categories, vendables],
  );
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return vendables
      .filter((p) => !categorie || p.categoryId === categorie)
      .filter(
        (p) =>
          !q ||
          p.displayName.toLowerCase().includes(q) ||
          (p.codeBarres ?? "").includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
  }, [vendables, categorie, recherche]);

  const changer = (id: string, delta: number) =>
    setPanier((m) => {
      const suite = new Map(m);
      const v = (suite.get(id) ?? 0) + delta;
      if (v <= 0) suite.delete(id);
      else suite.set(id, v);
      return suite;
    });

  const nbArticles = [...panier.values()].reduce((n, q) => n + q, 0);
  const montant = [...panier.entries()].reduce(
    (n, [id, q]) => n + q * (products.find((p) => p.id === id)?.prixVenteDefaut ?? 0),
    0,
  );

  const valider = () => {
    retenirServeur(serveur.trim());
    onValider(
      [...panier.entries()].flatMap(([id, quantite]) => {
        const p = products.find((x) => x.id === id);
        return p
          ? [
              {
                productId: p.id,
                designation: p.displayName,
                quantite,
                prixUnit: p.prixVenteDefaut,
                serveur: serveur.trim() || null,
              },
            ]
          : [];
      }),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onRetour} className="app-btn-secondary" disabled={occupe}>
          <ArrowLeft className="h-4 w-4" />
          Note
        </button>
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher une boisson, un plat…"
            aria-label="Chercher un produit"
            className="app-field pl-9"
            autoFocus
          />
        </label>
      </div>

      {categoriesUtiles.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: null as string | null, nom: "Tout" }, ...categoriesUtiles].map((c) => (
            <button
              key={c.id ?? "tout"}
              type="button"
              onClick={() => setCategorie(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                categorie === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.nom}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
        {visibles.map((p) => {
          const q = panier.get(p.id) ?? 0;
          const epuise = p.stockDisponible - q <= 0;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col gap-1.5 rounded-lg border p-2 ${
                q > 0 ? "border-primary bg-success-soft" : "border-border bg-card"
              }`}
            >
              <button
                type="button"
                onClick={() => changer(p.id, 1)}
                disabled={occupe}
                className="flex flex-1 items-center gap-2 text-left"
                title={epuise ? "Plus de stock disponible" : undefined}
              >
                <VignetteProduit nom={p.displayName} chemin={photos.get(p.id)} taille={36} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs font-semibold leading-tight">
                    {p.displayName}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(p.prixVenteDefaut)}
                  </span>
                  <span
                    className={`block text-[10.5px] ${epuise ? "t-danger" : "text-muted-foreground"}`}
                  >
                    Stock {Math.max(0, p.stockDisponible)}
                  </span>
                </span>
              </button>
              {q > 0 && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => changer(p.id, -1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card"
                    aria-label={`Un ${p.displayName} de moins`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm font-bold tabular-nums">{q}</span>
                  <button
                    type="button"
                    onClick={() => changer(p.id, 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card"
                    aria-label={`Un ${p.displayName} de plus`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {visibles.length === 0 && (
          <p className="col-span-full p-6 text-center text-sm text-muted-foreground">
            Aucun produit ne correspond.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">Servi par</span>
          <input
            list="bar-serveurs"
            value={serveur}
            onChange={(e) => setServeur(e.target.value)}
            placeholder="Serveur (facultatif)"
            className="app-field"
          />
          <datalist id="bar-serveurs">
            {serveurs.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          onClick={valider}
          disabled={occupe || nbArticles === 0}
          className="app-btn-primary"
        >
          <Plus className="h-4 w-4" />
          {nbArticles === 0
            ? "Ajouter à la note"
            : `Ajouter ${nbArticles} article${nbArticles > 1 ? "s" : ""} · ${formatCurrency(montant)}`}
        </button>
      </div>
    </div>
  );
};

/* ── Déplacer : changer de table ou regrouper ─────────────────── */

const VueDeplacer: React.FC<{
  note: NoteBar;
  bar: Bar;
  occupe: boolean;
  onRetour: () => void;
  onChanger: (tableId: string) => void;
  onRegrouper: (noteCibleId: string, numero: string) => void;
}> = ({ note, bar, occupe, onRetour, onChanger, onRegrouper }) => {
  const autres = bar.tables
    .filter((t) => t.active && t.id !== note.table_id)
    .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  const libres = autres.filter((t) => !bar.noteDeLaTable.has(t.id));
  const occupees = autres.filter((t) => bar.noteDeLaTable.has(t.id));
  return (
    <div className="space-y-4">
      <button type="button" onClick={onRetour} className="app-btn-secondary" disabled={occupe}>
        <ArrowLeft className="h-4 w-4" />
        Note
      </button>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Changer de table</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Les clients changent de place : la note les suit. Le droit de table déjà compté reste.
        </p>
        <div className="flex flex-wrap gap-2">
          {libres.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={occupe}
              onClick={() => onChanger(t.id)}
              className="min-w-[3rem] rounded-lg border border-dashed border-border px-3 py-2 text-sm font-bold hover:border-primary"
            >
              {t.numero}
            </button>
          ))}
          {libres.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune table libre.</p>
          )}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Regrouper avec une table occupée</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Toute cette note passe sur l&apos;autre table, qui paiera l&apos;ensemble.
        </p>
        <div className="flex flex-wrap gap-2">
          {occupees.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={occupe}
              onClick={() => onRegrouper(bar.noteDeLaTable.get(t.id)!.id, t.numero)}
              className="min-w-[3rem] rounded-lg border border-primary bg-success-soft px-3 py-2 text-sm font-bold"
            >
              {t.numero}
            </button>
          ))}
          {occupees.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune autre table occupée.</p>
          )}
        </div>
      </section>
    </div>
  );
};

/* ── Encaisser : tout, ou une partie ──────────────────────────── */

const VueEncaisser: React.FC<{
  groupes: GroupeLignes[];
  clients: Client[];
  clientNote: string | null;
  occupe: boolean;
  onRetour: () => void;
  onEncaisser: (e: {
    ligneIds: string[] | null;
    clientId: string | null;
    montantPaye: number;
    methode: string;
  }) => void;
}> = ({ groupes, clients, clientNote, occupe, onRetour, onEncaisser }) => {
  const aPayer = groupes.filter((g) => !g.payee);
  const [partiel, setPartiel] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [methode, setMethode] = useState<string>("especes");
  const [clientId, setClientId] = useState(clientNote ?? "");
  const [recu, setRecu] = useState<string>("");

  const ids = useMemo(
    () =>
      partiel
        ? new Set(
            aPayer.filter((g) => choisis.has(g.cle)).flatMap((g) => g.lignes.map((l) => l.id)),
          )
        : new Set(aPayer.flatMap((g) => g.lignes.map((l) => l.id))),
    [partiel, choisis, aPayer],
  );
  const lignes = aPayer.flatMap((g) => g.lignes);
  const du = totalDesLignes(lignes, ids);
  const montantRecu = recu.trim() === "" ? du : Math.max(0, Number(recu.replace(/\s/g, "")) || 0);
  const paye = Math.min(montantRecu, du);
  const aRendre = Math.max(0, montantRecu - du);
  const credit = du - paye;
  const bloque = ids.size === 0 || (credit > 0 && !clientId);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onRetour} className="app-btn-secondary" disabled={occupe}>
        <ArrowLeft className="h-4 w-4" />
        Note
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPartiel(false)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
            !partiel ? "border-primary bg-success-soft" : "border-border"
          }`}
        >
          Toute la note
        </button>
        <button
          type="button"
          onClick={() => setPartiel(true)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
            partiel ? "border-primary bg-success-soft" : "border-border"
          }`}
        >
          Diviser l&apos;addition
        </button>
      </div>

      {partiel && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {aPayer.map((g) => (
            <li key={g.cle}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={choisis.has(g.cle)}
                  onChange={(e) =>
                    setChoisis((s) => {
                      const suite = new Set(s);
                      if (e.target.checked) suite.add(g.cle);
                      else suite.delete(g.cle);
                      return suite;
                    })
                  }
                />
                <span className="flex-1 text-sm">
                  {g.quantite} × {g.designation}
                  {g.offert && <span className="ml-1.5 text-xs t-success">Offert</span>}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {g.offert ? "—" : formatCurrency(g.montant)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Moyen de paiement
          </span>
          <select
            value={methode}
            onChange={(e) => setMethode(e.target.value)}
            className="app-field"
          >
            {MODES_DE_PAIEMENT.map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Montant reçu
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={recu}
            onChange={(e) => setRecu(e.target.value)}
            placeholder={String(du)}
            className="app-field"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Client {credit > 0 ? "(obligatoire : il reste un crédit)" : "(facultatif)"}
          </span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="app-field"
          >
            <option value="">Client de passage</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {nomClient(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between text-base font-bold">
          <span>À payer</span>
          <span className="tabular-nums">{formatCurrency(du)}</span>
        </div>
        {aRendre > 0 && (
          <div className="flex justify-between font-semibold t-success">
            <span>À rendre</span>
            <span className="tabular-nums">{formatCurrency(aRendre)}</span>
          </div>
        )}
        {credit > 0 && (
          <div className="flex justify-between font-semibold t-warning">
            <span>Reste à crédit</span>
            <span className="tabular-nums">{formatCurrency(credit)}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={occupe || bloque}
        onClick={() =>
          onEncaisser({
            ligneIds: partiel ? [...ids] : null,
            clientId: clientId || null,
            montantPaye: paye,
            methode,
          })
        }
        className="app-btn-primary w-full"
      >
        <Banknote className="h-4 w-4" />
        {occupe ? "Encaissement…" : `Encaisser ${formatCurrency(paye)}`}
      </button>
    </div>
  );
};
