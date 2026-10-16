import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { LIBELLES_FONCTIONNALITES, type FonctionnaliteIA } from "./clientIA";

/**
 * Tableau de bord IA du super admin.
 *
 * Trois chiffres à ne pas confondre, et l'écran les sépare :
 *   - les limites internes (budget, plafonds, quotas) : appliquées par le
 *     serveur avant chaque appel ;
 *   - les coûts estimés : jetons × tarifs saisis ici ;
 *   - la facturation réelle : seulement sur le tableau de bord du
 *     fournisseur. Cet écran ne connaît pas le solde du compte.
 *
 * Aucun secret n'est lu ni affiché : seule la présence de la clé est connue.
 */

interface Reglages {
  ia_active: boolean;
  fournisseur: string;
  modele: string | null;
  budget_mensuel_usd: number;
  seuil_alerte_pct: number;
  requetes_par_minute: number;
  max_tokens_sortie: number;
  max_caracteres_entree: number;
  max_fichier_mo: number;
}

interface Tarif {
  fournisseur: string;
  modele: string;
  prix_entree_par_million_usd: number;
  prix_sortie_par_million_usd: number;
  source: string | null;
}

interface ReglageBoutique {
  store_id: string;
  ia_active: boolean;
  fonctionnalites: FonctionnaliteIA[];
  plafond_mensuel_usd: number;
  requetes_mensuelles_max: number | null;
}

interface TableauDeBord {
  totaux: {
    requetes: number;
    reussies: number;
    echecs: number;
    refus: number;
    en_cours: number;
    tokens_entree: number;
    tokens_sortie: number;
    cout_estime_usd: number;
  };
  par_boutique: {
    store_id: string | null;
    nom: string | null;
    requetes: number;
    refus: number;
    cout_estime_usd: number;
    plafond_mensuel_usd: number | null;
  }[];
  par_fonctionnalite: { fonctionnalite: string; requetes: number; cout_estime_usd: number }[];
  erreurs_recentes: {
    date: string;
    store_id: string | null;
    fonctionnalite: string;
    statut: string;
    code: string | null;
  }[];
}

const TOUTES: FonctionnaliteIA[] = Object.keys(LIBELLES_FONCTIONNALITES) as FonctionnaliteIA[];

const usd = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(4)} $`;

export const AdminIASection: React.FC = () => {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [boutiques, setBoutiques] = useState<{ id: string; name: string }[]>([]);
  const [reglagesBoutiques, setReglagesBoutiques] = useState<Record<string, ReglageBoutique>>({});
  const [tdb, setTdb] = useState<TableauDeBord | null>(null);
  const [cle, setCle] = useState<{ cle_configuree: boolean; coupe: boolean } | null>(null);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [nouveauTarif, setNouveauTarif] = useState({
    modele: "",
    entree: "",
    sortie: "",
    source: "",
  });
  const [boutiqueChoisie, setBoutiqueChoisie] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    const [r, t, s, rb, d, e] = await Promise.all([
      supabase.from("ia_reglages_plateforme").select("*").maybeSingle(),
      supabase.from("ia_tarifs").select("*").order("modele"),
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("ia_reglages_boutique").select("*"),
      supabase.rpc("ia_tableau_de_bord", { p_mois: null }),
      supabase.functions
        .invoke("ia", { body: { action: "etat" } })
        .catch(() => ({ data: null, error: true })),
    ]);
    setReglages((r.data as Reglages | null) ?? null);
    setTarifs((t.data as Tarif[] | null) ?? []);
    setBoutiques((s.data as { id: string; name: string }[] | null) ?? []);
    setReglagesBoutiques(
      Object.fromEntries(((rb.data as ReglageBoutique[] | null) ?? []).map((x) => [x.store_id, x])),
    );
    setTdb((d.data as TableauDeBord | null) ?? null);
    setCle(e.error || !e.data ? null : (e.data as { cle_configuree: boolean; coupe: boolean }));
    if (r.error)
      setMessage({
        ok: false,
        texte: "Tables IA introuvables : la migration n'est pas appliquée.",
      });
    setChargement(false);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const resultat = (error: { message: string } | null, ok: string) => {
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: ok });
    if (!error) void charger();
  };

  const enregistrerReglages = async (modif: Partial<Reglages>) => {
    const { error } = await supabase.from("ia_reglages_plateforme").update(modif).eq("id", true);
    resultat(error, "Réglages enregistrés.");
  };

  const enregistrerTarif = async () => {
    const entree = Number(nouveauTarif.entree.replace(",", "."));
    const sortie = Number(nouveauTarif.sortie.replace(",", "."));
    if (!nouveauTarif.modele.trim() || !Number.isFinite(entree) || !Number.isFinite(sortie)) {
      setMessage({ ok: false, texte: "Modèle et deux prix numériques requis." });
      return;
    }
    const { error } = await supabase.from("ia_tarifs").upsert({
      fournisseur: "openai",
      modele: nouveauTarif.modele.trim(),
      prix_entree_par_million_usd: entree,
      prix_sortie_par_million_usd: sortie,
      source: nouveauTarif.source.trim() || null,
    });
    if (!error) setNouveauTarif({ modele: "", entree: "", sortie: "", source: "" });
    resultat(error, "Tarif enregistré.");
  };

  const enregistrerBoutique = async (rb: ReglageBoutique) => {
    const { error } = await supabase.from("ia_reglages_boutique").upsert(rb);
    resultat(error, "Réglages de la boutique enregistrés.");
  };

  if (chargement && !reglages) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    );
  }

  const cout = tdb?.totaux.cout_estime_usd ?? 0;
  const budget = Number(reglages?.budget_mensuel_usd ?? 0);
  const part = budget > 0 ? (cout / budget) * 100 : 0;
  const alerte = reglages && budget > 0 && part >= reglages.seuil_alerte_pct;
  const rbChoisie: ReglageBoutique | null = boutiqueChoisie
    ? (reglagesBoutiques[boutiqueChoisie] ?? {
        store_id: boutiqueChoisie,
        ia_active: false,
        fonctionnalites: [],
        plafond_mensuel_usd: 0,
        requetes_mensuelles_max: null,
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5" /> Intelligence artificielle
        </h2>
        <button type="button" className="app-btn-secondary" onClick={() => void charger()}>
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-xl border px-3 py-2 text-sm ${
            message.ok
              ? "border-success-border bg-success-soft t-success"
              : "border-danger-border bg-danger-soft t-danger"
          }`}
        >
          {message.texte}
        </p>
      )}

      {/* ── État de configuration ── */}
      <section className="app-card space-y-2 p-4 text-sm">
        <h3 className="font-semibold">État</h3>
        <p>
          Clé du fournisseur côté serveur :{" "}
          <strong>
            {cle === null
              ? "fonction « ia » non déployée ou injoignable"
              : cle.cle_configuree
                ? "configurée"
                : "absente"}
          </strong>
          {cle?.coupe && (
            <strong className="t-danger"> — coupe-circuit IA_COUPE_CIRCUIT actif</strong>
          )}
        </p>
        <p>
          Fournisseur : <strong>{reglages?.fournisseur ?? "—"}</strong> · Modèle :{" "}
          <strong>{reglages?.modele ?? "non défini"}</strong>
          {reglages?.modele && !tarifs.some((t) => t.modele === reglages.modele) && (
            <span className="t-danger"> (aucun tarif saisi : appels refusés)</span>
          )}
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={reglages?.ia_active ?? false}
            onChange={(e) => void enregistrerReglages({ ia_active: e.target.checked })}
          />
          <span>
            IA activée pour la plateforme{" "}
            <span className="text-muted-foreground">(interrupteur global)</span>
          </span>
        </label>
      </section>

      {/* ── Consommation du mois ── */}
      {tdb && (
        <section className="app-card space-y-3 p-4 text-sm">
          <h3 className="font-semibold">Consommation du mois (estimations internes)</h3>
          {alerte && (
            <p className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2">
              <AlertTriangle className="h-4 w-4" /> {part.toFixed(0)} % du budget mensuel consommé.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              Coût estimé : <strong>{usd(cout)}</strong>
            </div>
            <div>
              Budget : <strong>{usd(budget)}</strong> ({part.toFixed(1)} %)
            </div>
            <div>
              Requêtes : <strong>{tdb.totaux.requetes}</strong>
            </div>
            <div>
              Échecs / refus :{" "}
              <strong>
                {tdb.totaux.echecs} / {tdb.totaux.refus}
              </strong>
            </div>
            <div>
              Jetons entrée : <strong>{tdb.totaux.tokens_entree}</strong>
            </div>
            <div>
              Jetons sortie : <strong>{tdb.totaux.tokens_sortie}</strong>
            </div>
            <div>
              En cours : <strong>{tdb.totaux.en_cours}</strong>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Estimations calculées avec vos tarifs. La facturation réelle et le solde du compte ne
            sont visibles que sur le tableau de bord du fournisseur.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th>Boutique</th>
                  <th className="text-right">Req.</th>
                  <th className="text-right">Coût</th>
                  <th className="text-right">Plafond</th>
                </tr>
              </thead>
              <tbody>
                {tdb.par_boutique.map((b) => (
                  <tr key={b.store_id ?? "?"} className="border-t border-border">
                    <td>{b.nom ?? "(supprimée)"}</td>
                    <td className="text-right">{b.requetes}</td>
                    <td className="text-right">{usd(b.cout_estime_usd)}</td>
                    <td className="text-right">
                      {b.plafond_mensuel_usd === null ? "—" : usd(b.plafond_mensuel_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th>Fonction</th>
                  <th className="text-right">Req.</th>
                  <th className="text-right">Coût</th>
                </tr>
              </thead>
              <tbody>
                {tdb.par_fonctionnalite.map((f) => (
                  <tr key={f.fonctionnalite} className="border-t border-border">
                    <td>
                      {LIBELLES_FONCTIONNALITES[f.fonctionnalite as FonctionnaliteIA] ??
                        f.fonctionnalite}
                    </td>
                    <td className="text-right">{f.requetes}</td>
                    <td className="text-right">{usd(f.cout_estime_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tdb.erreurs_recentes.length > 0 && (
            <details>
              <summary className="cursor-pointer">
                Erreurs et refus récents ({tdb.erreurs_recentes.length})
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs">
                {tdb.erreurs_recentes.map((e, i) => (
                  <li key={i}>
                    {new Date(e.date).toLocaleString("fr-FR")} — {e.fonctionnalite} — {e.statut} —{" "}
                    {e.code ?? ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* ── Paramètres et limites ── */}
      {reglages && (
        <ReglagesForm
          reglages={reglages}
          tarifs={tarifs}
          onEnregistrer={(m) => void enregistrerReglages(m)}
        />
      )}

      {/* ── Tarifs ── */}
      <section className="app-card space-y-3 p-4 text-sm">
        <h3 className="font-semibold">Tarifs par modèle (USD par million de jetons)</h3>
        <p className="text-xs text-muted-foreground">
          Recopiez les prix publiés par le fournisseur. Sans tarif, le modèle est refusé : le budget
          ne pourrait pas être contrôlé.
        </p>
        <ul className="space-y-1 text-xs">
          {tarifs.map((t) => (
            <li key={t.modele}>
              <strong>{t.modele}</strong> — entrée {t.prix_entree_par_million_usd} $ · sortie{" "}
              {t.prix_sortie_par_million_usd} $ {t.source ? `(${t.source})` : ""}
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            className="app-field"
            placeholder="Modèle"
            value={nouveauTarif.modele}
            onChange={(e) => setNouveauTarif((p) => ({ ...p, modele: e.target.value }))}
          />
          <input
            className="app-field"
            placeholder="Prix entrée"
            inputMode="decimal"
            value={nouveauTarif.entree}
            onChange={(e) => setNouveauTarif((p) => ({ ...p, entree: e.target.value }))}
          />
          <input
            className="app-field"
            placeholder="Prix sortie"
            inputMode="decimal"
            value={nouveauTarif.sortie}
            onChange={(e) => setNouveauTarif((p) => ({ ...p, sortie: e.target.value }))}
          />
          <input
            className="app-field"
            placeholder="Source (date, page)"
            value={nouveauTarif.source}
            onChange={(e) => setNouveauTarif((p) => ({ ...p, source: e.target.value }))}
          />
        </div>
        <button type="button" className="app-btn-secondary" onClick={() => void enregistrerTarif()}>
          Enregistrer le tarif
        </button>
      </section>

      {/* ── Activation par boutique ── */}
      <section className="app-card space-y-3 p-4 text-sm">
        <h3 className="font-semibold">Activation par boutique</h3>
        <select
          className="app-field"
          value={boutiqueChoisie}
          onChange={(e) => setBoutiqueChoisie(e.target.value)}
        >
          <option value="">— Choisir une boutique —</option>
          {boutiques.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {reglagesBoutiques[b.id]?.ia_active ? "· IA active" : ""}
            </option>
          ))}
        </select>
        {rbChoisie && (
          <BoutiqueForm
            key={rbChoisie.store_id}
            initial={rbChoisie}
            onEnregistrer={(rb) => void enregistrerBoutique(rb)}
          />
        )}
      </section>
    </div>
  );
};

const ReglagesForm: React.FC<{
  reglages: Reglages;
  tarifs: Tarif[];
  onEnregistrer: (m: Partial<Reglages>) => void;
}> = ({ reglages, tarifs, onEnregistrer }) => {
  const [f, setF] = useState({
    modele: reglages.modele ?? "",
    budget_mensuel_usd: String(reglages.budget_mensuel_usd),
    seuil_alerte_pct: String(reglages.seuil_alerte_pct),
    requetes_par_minute: String(reglages.requetes_par_minute),
    max_tokens_sortie: String(reglages.max_tokens_sortie),
    max_caracteres_entree: String(reglages.max_caracteres_entree),
    max_fichier_mo: String(reglages.max_fichier_mo),
  });
  const champ = (cle: keyof typeof f, libelle: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{libelle}</span>
      <input
        className="app-field"
        inputMode="decimal"
        value={f[cle]}
        onChange={(e) => setF((p) => ({ ...p, [cle]: e.target.value }))}
      />
    </label>
  );
  return (
    <section className="app-card space-y-3 p-4 text-sm">
      <h3 className="font-semibold">Paramètres et limites internes</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Modèle utilisé</span>
          <select
            className="app-field"
            value={f.modele}
            onChange={(e) => setF((p) => ({ ...p, modele: e.target.value }))}
          >
            <option value="">— Aucun (IA inutilisable) —</option>
            {tarifs.map((t) => (
              <option key={t.modele} value={t.modele}>
                {t.modele}
              </option>
            ))}
          </select>
        </label>
        {champ("budget_mensuel_usd", "Budget mensuel global (USD)")}
        {champ("seuil_alerte_pct", "Seuil d'alerte (%)")}
        {champ("requetes_par_minute", "Requêtes / minute / utilisateur")}
        {champ("max_tokens_sortie", "Jetons de sortie max par requête")}
        {champ("max_caracteres_entree", "Caractères d'entrée max")}
        {champ("max_fichier_mo", "Taille de fichier max (Mo)")}
      </div>
      <button
        type="button"
        className="app-btn-primary"
        onClick={() =>
          onEnregistrer({
            modele: f.modele || null,
            budget_mensuel_usd: Number(f.budget_mensuel_usd.replace(",", ".")),
            seuil_alerte_pct: Number(f.seuil_alerte_pct),
            requetes_par_minute: Number(f.requetes_par_minute),
            max_tokens_sortie: Number(f.max_tokens_sortie),
            max_caracteres_entree: Number(f.max_caracteres_entree),
            max_fichier_mo: Number(f.max_fichier_mo),
          })
        }
      >
        Enregistrer les paramètres
      </button>
      <p className="text-xs text-muted-foreground">
        Ces limites sont appliquées par le serveur avant chaque appel. Elles ne remplacent pas le
        plafond de dépense à régler aussi chez le fournisseur.
      </p>
    </section>
  );
};

const BoutiqueForm: React.FC<{
  initial: ReglageBoutique;
  onEnregistrer: (rb: ReglageBoutique) => void;
}> = ({ initial, onEnregistrer }) => {
  const [rb, setRb] = useState(initial);
  const [plafond, setPlafond] = useState(String(initial.plafond_mensuel_usd));
  const [quota, setQuota] = useState(
    initial.requetes_mensuelles_max === null ? "" : String(initial.requetes_mensuelles_max),
  );
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rb.ia_active}
          onChange={(e) => setRb((p) => ({ ...p, ia_active: e.target.checked }))}
        />
        IA activée pour cette boutique
      </label>
      <fieldset className="space-y-1">
        <legend className="text-xs text-muted-foreground">Fonctionnalités</legend>
        {TOUTES.map((f) => (
          <label key={f} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rb.fonctionnalites.includes(f)}
              onChange={(e) =>
                setRb((p) => ({
                  ...p,
                  fonctionnalites: e.target.checked
                    ? [...p.fonctionnalites, f]
                    : p.fonctionnalites.filter((x) => x !== f),
                }))
              }
            />
            {LIBELLES_FONCTIONNALITES[f]}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Plafond mensuel (USD)</span>
          <input
            className="app-field"
            inputMode="decimal"
            value={plafond}
            onChange={(e) => setPlafond(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Quota de requêtes / mois (vide = sans quota)
          </span>
          <input
            className="app-field"
            inputMode="numeric"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        className="app-btn-primary"
        onClick={() =>
          onEnregistrer({
            ...rb,
            plafond_mensuel_usd: Number(plafond.replace(",", ".")) || 0,
            requetes_mensuelles_max:
              quota.trim() === "" ? null : Math.max(0, Math.trunc(Number(quota)) || 0),
          })
        }
      >
        Enregistrer pour cette boutique
      </button>
    </div>
  );
};
