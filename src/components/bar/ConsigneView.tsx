import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Box, Plus, RefreshCw, Settings2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Modal } from "../shared/Modal";
import { formatCurrency } from "../../utils/formulas";
import {
  LIBELLE_MOUVEMENT,
  montantPropose,
  soldes,
  type Emballage,
  type GenreMouvement,
  type MouvementEmballage,
} from "../../lib/consigneBar";

const db = supabase as unknown as { from: (t: string) => any };

const nombre = (v: string): number => Math.max(0, Number(v.replace(/\s/g, "")) || 0);

/** Les emballages qu'un bar malgache rend presque toujours. */
const EMBALLAGES_COURANTS = [
  { nom: "Bouteille 65 cl", consigne: 500 },
  { nom: "Bouteille 33 cl", consigne: 300 },
  { nom: "Casier", consigne: 3000 },
];

const GESTES: { genre: GenreMouvement; libelle: string; sortie: boolean }[] = [
  { genre: "recu", libelle: "Reçu", sortie: false },
  { genre: "rendu", libelle: "Rendu", sortie: true },
  { genre: "client_emporte", libelle: "Client emporte", sortie: true },
  { genre: "client_rapporte", libelle: "Client rapporte", sortie: false },
  { genre: "perdu_paye", libelle: "Cassé, payé", sortie: true },
  { genre: "correction", libelle: "Recompter", sortie: false },
];

function useConsigne(storeId: string) {
  const [emballages, setEmballages] = useState<Emballage[]>([]);
  const [mouvements, setMouvements] = useState<MouvementEmballage[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    const [e, m] = await Promise.all([
      db.from("bar_emballages").select("*").eq("store_id", storeId).order("ordre"),
      db
        .from("bar_mouvements_emballages")
        .select("*")
        .eq("store_id", storeId)
        .order("cree_le", { ascending: false })
        .limit(2000),
    ]);
    setChargement(false);
    if (e.error || m.error) return setErreur((e.error ?? m.error).message);
    setErreur(null);
    setEmballages((e.data ?? []).map((x: Emballage) => ({ ...x, consigne: Number(x.consigne) })));
    setMouvements(
      (m.data ?? []).map((x: MouvementEmballage) => ({ ...x, montant: Number(x.montant) })),
    );
  }, [storeId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  return { emballages, mouvements, erreur, chargement, recharger };
}

/**
 * LA CONSIGNE : BOUTEILLES ET CASIERS
 *
 * Pour chaque emballage, ce qu'on doit encore rendre au fournisseur et
 * ce qui est parti chez les clients avec une consigne. Un geste par
 * événement : une livraison arrive (Reçu), le camion repart avec les
 * vides (Rendu), un client emporte ou rapporte, une bouteille casse.
 */
export const ConsigneView: React.FC<{ storeId: string; estProprietaire: boolean }> = ({
  storeId,
  estProprietaire,
}) => {
  const c = useConsigne(storeId);
  const [geste, setGeste] = useState<{ emballage: Emballage; genre: GenreMouvement } | null>(null);
  const [reglage, setReglage] = useState(false);

  const lignes = useMemo(
    () =>
      soldes(
        c.emballages.filter((e) => e.actif),
        c.mouvements,
      ),
    [c.emballages, c.mouvements],
  );
  const totalARendre = lignes.reduce((n, l) => n + l.aRendre * l.emballage.consigne, 0);
  const totalGarde = lignes.reduce((n, l) => n + l.consignesGardees, 0);
  const nomDe = new Map(c.emballages.map((e) => [e.id, e.nom]));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consigne</h1>
          <p className="text-sm text-muted-foreground">
            Bouteilles et casiers à rendre au fournisseur, et ceux partis chez les clients.
          </p>
        </div>
        {estProprietaire && (
          <button
            type="button"
            onClick={() => setReglage(true)}
            className="app-btn-secondary shrink-0"
          >
            <Settings2 className="h-4 w-4" />
            Emballages
          </button>
        )}
      </header>

      {c.erreur && (
        <p className="rounded-lg border border-danger-border bg-danger-soft p-3 text-sm t-danger">
          {c.erreur}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">À rendre au fournisseur</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(totalARendre)}</p>
          <p className="text-xs text-muted-foreground">en valeur de consigne</p>
        </div>
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">Consignes des clients gardées</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(totalGarde)}</p>
          <p className="text-xs text-muted-foreground">à rendre quand ils rapportent</p>
        </div>
      </div>

      {!c.chargement && lignes.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Box className="h-6 w-6" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            Déclarez ce que vous rendez au fournisseur : bouteilles 65 cl, 33 cl, casiers… avec leur
            valeur de consigne.
          </p>
          {estProprietaire && (
            <button type="button" onClick={() => setReglage(true)} className="app-btn-primary">
              <Plus className="h-4 w-4" />
              Déclarer mes emballages
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {lignes.map((l) => (
          <div key={l.emballage.id} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">{l.emballage.nom}</h2>
              <span className="text-xs text-muted-foreground">
                consigne {formatCurrency(l.emballage.consigne)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 p-2">
                <p className={`text-lg font-bold tabular-nums ${l.aRendre > 0 ? "t-warning" : ""}`}>
                  {l.aRendre}
                </p>
                <p className="text-[11px] text-muted-foreground">à rendre</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <p className="text-lg font-bold tabular-nums">{l.chezClients}</p>
                <p className="text-[11px] text-muted-foreground">chez les clients</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {GESTES.map((g) => (
                <button
                  key={g.genre}
                  type="button"
                  onClick={() => setGeste({ emballage: l.emballage, genre: g.genre })}
                  className="flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold hover:border-primary/60"
                >
                  {g.genre === "correction" ? (
                    <RefreshCw className="h-3.5 w-3.5" />
                  ) : g.sortie ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                  )}
                  {g.libelle}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {c.mouvements.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Derniers mouvements</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {c.mouvements.slice(0, 30).map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(m.cree_le).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}{" "}
                  {new Date(m.cree_le).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {m.quantite > 0 && m.genre === "correction" ? "+" : ""}
                  {m.quantite} × {nomDe.get(m.emballage_id) ?? "?"}
                  <span className="text-muted-foreground"> · {LIBELLE_MOUVEMENT[m.genre]}</span>
                </span>
                {m.montant > 0 && (
                  <span className="shrink-0 tabular-nums">{formatCurrency(m.montant)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {geste && (
        <GesteModal
          storeId={storeId}
          emballage={geste.emballage}
          genre={geste.genre}
          onFermer={() => setGeste(null)}
          onFait={async () => {
            setGeste(null);
            await c.recharger();
          }}
        />
      )}
      {reglage && (
        <EmballagesModal
          storeId={storeId}
          emballages={c.emballages}
          onFermer={() => setReglage(false)}
          onChange={c.recharger}
        />
      )}
    </div>
  );
};

const GesteModal: React.FC<{
  storeId: string;
  emballage: Emballage;
  genre: GenreMouvement;
  onFermer: () => void;
  onFait: () => void;
}> = ({ storeId, emballage, genre, onFermer, onFait }) => {
  const [quantite, setQuantite] = useState("");
  const [sens, setSens] = useState<"plus" | "moins">("moins");
  const [montant, setMontant] = useState<string>("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const q = Math.round(nombre(quantite));
  const propose = montantPropose(genre, q, emballage.consigne);
  const avecArgent =
    genre === "client_emporte" || genre === "client_rapporte" || genre === "perdu_paye";

  return (
    <Modal
      open
      onClose={onFermer}
      size="sm"
      icon={<Box className="h-4 w-4" />}
      title={emballage.nom}
      description={LIBELLE_MOUVEMENT[genre]}
      dismissible={!envoi}
      footer={
        <>
          <button type="button" onClick={onFermer} className="app-btn-secondary">
            Annuler
          </button>
          <button type="submit" form="geste-consigne" disabled={envoi} className="app-btn-primary">
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form
        id="geste-consigne"
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (q <= 0) return setErreur("Indiquez une quantité.");
          setEnvoi(true);
          setErreur(null);
          const { error } = await db.from("bar_mouvements_emballages").insert({
            store_id: storeId,
            emballage_id: emballage.id,
            genre,
            quantite: genre === "correction" && sens === "moins" ? -q : q,
            montant: avecArgent ? (montant.trim() === "" ? propose : nombre(montant)) : 0,
            note: note.trim() || null,
          });
          setEnvoi(false);
          if (error) setErreur(error.message);
          else onFait();
        }}
      >
        {genre === "correction" && (
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
                {s === "moins" ? "On en doit moins" : "On en doit plus"}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Quantité</span>
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
        {avecArgent && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {genre === "client_emporte"
                ? "Consigne reçue du client"
                : genre === "client_rapporte"
                  ? "Consigne rendue au client"
                  : "Payé au fournisseur"}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder={String(propose)}
              className="app-field"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Note (facultatif)
          </span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="app-field" />
        </label>
        {erreur && <p className="text-sm font-medium t-danger">{erreur}</p>}
      </form>
    </Modal>
  );
};

const EmballagesModal: React.FC<{
  storeId: string;
  emballages: Emballage[];
  onFermer: () => void;
  onChange: () => Promise<void>;
}> = ({ storeId, emballages, onFermer, onChange }) => {
  const [nom, setNom] = useState("");
  const [consigne, setConsigne] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const ajouter = async (lignes: { nom: string; consigne: number }[]) => {
    setEnvoi(true);
    setErreur(null);
    const { error } = await db.from("bar_emballages").insert(
      lignes.map((l, i) => ({
        store_id: storeId,
        nom: l.nom,
        consigne: l.consigne,
        ordre: emballages.length + i,
      })),
    );
    setEnvoi(false);
    if (error) {
      setErreur(error.message.includes("duplicate") ? "Cet emballage existe déjà." : error.message);
      return false;
    }
    await onChange();
    return true;
  };

  const existants = new Set(emballages.map((e) => e.nom.toLowerCase()));
  const courantsManquants = EMBALLAGES_COURANTS.filter((e) => !existants.has(e.nom.toLowerCase()));

  return (
    <Modal
      open
      onClose={onFermer}
      size="md"
      icon={<Settings2 className="h-4 w-4" />}
      title="Vos emballages"
      description="Ce que vous rendez au fournisseur, avec sa valeur de consigne."
      dismissible={!envoi}
      footer={
        <button type="button" onClick={onFermer} className="app-btn-primary">
          Terminé
        </button>
      }
    >
      <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
        {emballages.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>{e.nom}</span>
            <span className="tabular-nums text-muted-foreground">{formatCurrency(e.consigne)}</span>
          </li>
        ))}
        {emballages.length === 0 && (
          <li className="p-3 text-center text-sm text-muted-foreground">Aucun emballage.</li>
        )}
      </ul>

      {courantsManquants.length > 0 && (
        <button
          type="button"
          disabled={envoi}
          onClick={() => void ajouter(courantsManquants)}
          className="app-btn-secondary mb-3 w-full"
        >
          <Plus className="h-4 w-4" />
          Ajouter {courantsManquants.map((e) => e.nom).join(", ")}
        </button>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          if (await ajouter([{ nom: nom.trim(), consigne: nombre(consigne) }])) {
            setNom("");
            setConsigne("");
          }
        }}
      >
        <label className="block min-w-[10rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Emballage</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Casier THB"
            className="app-field"
          />
        </label>
        <label className="block w-32">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Consigne</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={consigne}
            onChange={(e) => setConsigne(e.target.value)}
            className="app-field"
          />
        </label>
        <button type="submit" disabled={envoi || !nom.trim()} className="app-btn-primary">
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </form>
      {erreur && <p className="mt-2 text-sm font-medium t-danger">{erreur}</p>}
    </Modal>
  );
};
