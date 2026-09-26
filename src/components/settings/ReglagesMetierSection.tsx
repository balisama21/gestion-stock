import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Coins, Loader2, Percent, Plus, RefreshCw, X } from "lucide-react";
import { SettingsBlock, SettingsFeedback, SettingsRow, SettingsSection } from "./primitives";
import { useDevises } from "../../hooks/useDevises";
import { lireParametre, PARAMETRES, type ValeursParametres } from "../../lib/parametres";
import type { Json } from "../../lib/database.types";
import { ficheDevise, formaterTaux, LIBELLE_SOURCE, type DeviseBoutique } from "../../lib/devises";

interface Props {
  storeId: string | null;
  userId: string | null;
  parametres: ValeursParametres;
  onSaveParametre: (cle: string, valeur: Json) => Promise<{ error: string | null }>;
}

type Retour = { type: "success" | "error"; texte: string } | null;

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Les réglages métier courants, réunis sur un seul écran. */
export const ReglagesMetierSection: React.FC<Props> = ({
  storeId,
  userId,
  parametres,
  onSaveParametre,
}) => {
  return (
    <>
      <CommissionBloc parametres={parametres} onSave={onSaveParametre} />
      <DevisesBloc storeId={storeId} userId={userId} />
    </>
  );
};

const CommissionBloc: React.FC<{
  parametres: ValeursParametres;
  onSave: Props["onSaveParametre"];
}> = ({ parametres, onSave }) => {
  const actuel = lireParametre(parametres, "commission_taux");
  const [valeur, setValeur] = useState(String(actuel));
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<Retour>(null);
  const def = PARAMETRES.commission_taux;

  useEffect(() => setValeur(String(actuel)), [actuel]);

  const enregistrer = async () => {
    const n = Number(valeur.replace(",", "."));
    if (!Number.isFinite(n) || n < def.min || n > def.max) {
      setRetour({ type: "error", texte: `Entrez un pourcentage entre ${def.min} et ${def.max}.` });
      return;
    }
    setEnCours(true);
    const { error } = await onSave("commission_taux", n);
    setEnCours(false);
    setRetour(
      error ? { type: "error", texte: error } : { type: "success", texte: "Taux enregistré." },
    );
  };

  const modifie = valeur !== String(actuel);

  return (
    <SettingsSection
      title="Commission"
      description="Le pourcentage que la boutique garde sur une prestation."
      icon={<Percent className="w-4 h-4" />}
    >
      <SettingsRow label={def.libelle} hint={def.aide} htmlFor="param-commission">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="param-commission"
              type="number"
              inputMode="decimal"
              min={def.min}
              max={def.max}
              step="0.5"
              value={valeur}
              onChange={(e) => {
                setValeur(e.target.value);
                setRetour(null);
              }}
              className="app-field pr-8 font-mono"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <button
            type="button"
            onClick={enregistrer}
            disabled={!modifie || enCours}
            className="app-btn-primary shrink-0"
          >
            {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </SettingsRow>
      {retour && (
        <SettingsBlock>
          <SettingsFeedback type={retour.type}>{retour.texte}</SettingsFeedback>
        </SettingsBlock>
      )}
    </SettingsSection>
  );
};

const DevisesBloc: React.FC<{ storeId: string | null; userId: string | null }> = ({
  storeId,
  userId,
}) => {
  const d = useDevises(storeId, userId);
  const [retour, setRetour] = useState<Retour>(null);
  const [actualisation, setActualisation] = useState(false);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [creationOuverte, setCreationOuverte] = useState(false);

  const symbolePrincipal = d.fichePrincipale?.symbole ?? "Ar";
  const secondaires = d.devises.filter((x) => !x.principale);
  const disponibles = useMemo(() => {
    const prises = new Set(secondaires.filter((x) => x.actif).map((x) => x.code));
    prises.add(d.principale);
    const vus = new Set<string>();
    return d.catalogue.filter((c) => {
      if (prises.has(c.code) || vus.has(c.code)) return false;
      vus.add(c.code);
      return true;
    });
  }, [d.catalogue, secondaires, d.principale]);

  const annoncer = (r: { error: string | null }, ok: string) =>
    setRetour(r.error ? { type: "error", texte: r.error } : { type: "success", texte: ok });

  const actualiser = async () => {
    setActualisation(true);
    const r = await d.actualiser();
    setActualisation(false);
    annoncer(r, "Taux du marché actualisés.");
  };

  const changerPrincipale = async (code: string) => {
    if (code === d.principale) return;
    const nom = ficheDevise(d.catalogue, code)?.nom ?? code;
    if (
      !window.confirm(
        `Faire de ${nom} la devise principale ?\n\nLes taux des autres devises seront recalculés. Les montants déjà enregistrés ne sont PAS convertis.`,
      )
    )
      return;
    annoncer(await d.definirPrincipale(code), `${nom} est maintenant la devise principale.`);
  };

  if (d.chargement) {
    return (
      <SettingsSection title="Devises" icon={<Coins className="w-4 h-4" />}>
        <SettingsBlock>
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </SettingsBlock>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Devises"
      description="La devise principale sert à tous vos montants. Les autres servent à saisir une dépense payée dans une autre monnaie."
      icon={<Coins className="w-4 h-4" />}
      aside={
        secondaires.some((x) => x.mode_taux === "auto" && x.actif) ? (
          <button
            type="button"
            onClick={actualiser}
            disabled={actualisation}
            className="app-btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${actualisation ? "animate-spin" : ""}`} />
            Actualiser les taux
          </button>
        ) : undefined
      }
    >
      <SettingsRow
        label="Devise principale"
        hint="Celle de votre caisse. En changer ne convertit pas les montants déjà enregistrés."
        htmlFor="devise-principale"
      >
        <select
          id="devise-principale"
          value={d.principale}
          onChange={(e) => changerPrincipale(e.target.value)}
          className="app-field"
        >
          {!d.catalogue.some((c) => c.code === d.principale) && (
            <option value={d.principale}>{d.principale}</option>
          )}
          {dedoublonner(d.catalogue).map((c) => (
            <option key={c.id} value={c.code}>
              {c.code} — {c.nom} ({c.symbole})
            </option>
          ))}
        </select>
      </SettingsRow>

      {secondaires.length > 0 && (
        <div className="app-list">
          {secondaires.map((x) => (
            <LigneDevise
              key={x.id}
              ligne={x}
              nom={ficheDevise(d.catalogue, x.code)?.nom ?? x.code}
              symbolePrincipal={symbolePrincipal}
              onModifier={async (patch) =>
                annoncer(await d.modifier(x.id, patch), "Devise mise à jour.")
              }
              onRetirer={async () => {
                if (!window.confirm(`Retirer ${x.code} des devises de la boutique ?`)) return;
                annoncer(await d.retirer(x.id), `${x.code} retirée.`);
              }}
            />
          ))}
        </div>
      )}

      <AjoutDevise
        disponibles={dedoublonner(disponibles)}
        symbolePrincipal={symbolePrincipal}
        onAjouter={async (code, taux, mode) =>
          annoncer(await d.ajouter(code, taux, mode), `${code} ajoutée.`)
        }
      />

      {retour && (
        <SettingsBlock>
          <div role="status">
            <SettingsFeedback type={retour.type}>{retour.texte}</SettingsFeedback>
          </div>
        </SettingsBlock>
      )}

      <SettingsBlock>
        <button
          type="button"
          onClick={() => setCreationOuverte((o) => !o)}
          aria-expanded={creationOuverte}
          className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground"
        >
          Votre devise n'est pas dans la liste ?
          <ChevronDown
            className={`h-4 w-4 transition-transform ${creationOuverte ? "" : "-rotate-90"}`}
          />
        </button>
        {creationOuverte && (
          <CreationDevise
            personnelles={d.catalogue.filter((c) => c.store_id)}
            onCreer={async (v) =>
              annoncer(await d.creerDevise(v), `${v.code.toUpperCase()} ajoutée à la liste.`)
            }
            onSupprimer={async (id, code) => {
              if (!window.confirm(`Supprimer ${code} de votre liste ?`)) return;
              annoncer(await d.supprimerDevise(id), `${code} supprimée.`);
            }}
          />
        )}
      </SettingsBlock>

      <SettingsBlock>
        <button
          type="button"
          onClick={() => setHistoriqueOuvert((o) => !o)}
          aria-expanded={historiqueOuvert}
          className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground"
        >
          Historique des taux
          <ChevronDown
            className={`h-4 w-4 transition-transform ${historiqueOuvert ? "" : "-rotate-90"}`}
          />
        </button>
        {historiqueOuvert &&
          (d.historique.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun changement de taux pour le moment.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {d.historique.map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{h.code}</span>{" "}
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {h.ancien_taux != null ? `${formaterTaux(Number(h.ancien_taux))} → ` : ""}
                      {formaterTaux(Number(h.nouveau_taux))}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {LIBELLE_SOURCE[h.source] ?? h.source}
                      {h.mode_taux === "auto" ? " · automatique" : " · manuel"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dateCourte(h.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </SettingsBlock>
    </SettingsSection>
  );
};

function dedoublonner<T extends { code: string }>(liste: T[]): T[] {
  const vus = new Set<string>();
  return liste.filter((c) => (vus.has(c.code) ? false : (vus.add(c.code), true)));
}

const LigneDevise: React.FC<{
  ligne: DeviseBoutique;
  nom: string;
  symbolePrincipal: string;
  onModifier: (
    patch: Partial<Pick<DeviseBoutique, "taux" | "mode_taux" | "actif">>,
  ) => Promise<void>;
  onRetirer: () => Promise<void>;
}> = ({ ligne, nom, symbolePrincipal, onModifier, onRetirer }) => {
  const [taux, setTaux] = useState(String(ligne.taux));
  useEffect(() => setTaux(String(ligne.taux)), [ligne.taux]);
  const auto = ligne.mode_taux === "auto";
  const tauxSaisi = Number(taux.replace(",", "."));

  return (
    <div className="app-list-row flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="app-list-primary">
          {ligne.code} <span className="font-normal text-muted-foreground">· {nom}</span>
        </p>
        <p className="app-list-secondary">
          1 {ligne.code} = {formaterTaux(Number(ligne.taux))} {symbolePrincipal} ·{" "}
          {LIBELLE_SOURCE[ligne.taux_source] ?? ligne.taux_source} · {dateCourte(ligne.taux_maj_le)}
          {!ligne.actif && " · désactivée"}
        </p>
        {ligne.derniere_erreur && (
          <p className="mt-0.5 text-xs t-warning">{ligne.derniere_erreur}</p>
        )}
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <div
          className="flex rounded-xl border border-border p-0.5"
          role="group"
          aria-label={`Mode de taux ${ligne.code}`}
        >
          {(["manuel", "auto"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={ligne.mode_taux === m}
              onClick={() => ligne.mode_taux !== m && onModifier({ mode_taux: m })}
              className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${
                ligne.mode_taux === m
                  ? "bg-success-soft t-success"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "manuel" ? "Manuel" : "Automatique"}
            </button>
          ))}
        </div>

        {!auto && (
          <div className="flex gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={taux}
              onChange={(e) => setTaux(e.target.value)}
              aria-label={`Taux ${ligne.code} en ${symbolePrincipal}`}
              className="app-field-sm w-28 font-mono"
            />
            <button
              type="button"
              disabled={!(tauxSaisi > 0) || tauxSaisi === Number(ligne.taux)}
              onClick={() => onModifier({ taux: tauxSaisi })}
              className="app-btn-secondary"
            >
              OK
            </button>
          </div>
        )}

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={ligne.actif}
            onChange={(e) => onModifier({ actif: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Active
        </label>

        <button
          type="button"
          onClick={onRetirer}
          className="app-btn-icon"
          aria-label={`Retirer ${ligne.code}`}
          title="Retirer"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

const AjoutDevise: React.FC<{
  disponibles: { id: string; code: string; nom: string; symbole: string; region: string | null }[];
  symbolePrincipal: string;
  onAjouter: (code: string, taux: number, mode: "manuel" | "auto") => Promise<void>;
}> = ({ disponibles, symbolePrincipal, onAjouter }) => {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"manuel" | "auto">("auto");
  const [taux, setTaux] = useState("");
  const [enCours, setEnCours] = useState(false);
  const tauxNum = Number(taux.replace(",", "."));
  const valide = code && (mode === "auto" || tauxNum > 0);

  const regions = useMemo(() => {
    const m = new Map<string, typeof disponibles>();
    disponibles.forEach((d) => {
      const r = d.region ?? "Autres";
      m.set(r, [...(m.get(r) ?? []), d]);
    });
    return Array.from(m);
  }, [disponibles]);

  return (
    <SettingsBlock>
      <p className="mb-2 text-sm font-semibold text-foreground">Ajouter une devise</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="app-field"
          aria-label="Devise à ajouter"
        >
          <option value="">Choisir une devise…</option>
          {regions.map(([r, liste]) => (
            <optgroup key={r} label={r}>
              {liste.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code} — {d.nom}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "manuel" | "auto")}
          className="app-field"
          aria-label="Mode de taux"
        >
          <option value="auto">Taux automatique</option>
          <option value="manuel">Taux manuel</option>
        </select>
        {mode === "manuel" && (
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={`Taux en ${symbolePrincipal}`}
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
            aria-label={`Valeur d'une unité en ${symbolePrincipal}`}
            className="app-field font-mono sm:w-40"
          />
        )}
        <button
          type="button"
          disabled={!valide || enCours}
          onClick={async () => {
            setEnCours(true);
            await onAjouter(code, mode === "auto" ? 1 : tauxNum, mode);
            setEnCours(false);
            setCode("");
            setTaux("");
          }}
          className="app-btn-primary"
        >
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ajouter
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Automatique : le taux suit le marché, mis à jour deux fois par jour. Si le service ne répond
        pas, le dernier taux connu est gardé. Manuel : vous fixez la valeur d'une unité en{" "}
        {symbolePrincipal}.
      </p>
    </SettingsBlock>
  );
};

const CreationDevise: React.FC<{
  personnelles: { id: string; code: string; nom: string; symbole: string }[];
  onCreer: (v: { code: string; nom: string; symbole: string; decimales: number }) => Promise<void>;
  onSupprimer: (id: string, code: string) => Promise<void>;
}> = ({ personnelles, onCreer, onSupprimer }) => {
  const [v, setV] = useState({ code: "", nom: "", symbole: "", decimales: "2" });
  const valide = /^[A-Za-z]{3}$/.test(v.code.trim()) && v.nom.trim() && v.symbole.trim();

  return (
    <div className="mt-3 space-y-3">
      {personnelles.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {personnelles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                {p.code} · {p.nom} ({p.symbole})
              </span>
              <button
                type="button"
                onClick={() => onSupprimer(p.id, p.code)}
                className="app-btn-icon"
                aria-label={`Supprimer ${p.code}`}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          placeholder="Code (3 lettres)"
          maxLength={3}
          value={v.code}
          onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })}
          aria-label="Code ISO"
          className="app-field font-mono uppercase"
        />
        <input
          placeholder="Nom"
          value={v.nom}
          onChange={(e) => setV({ ...v, nom: e.target.value })}
          aria-label="Nom de la devise"
          className="app-field"
        />
        <input
          placeholder="Symbole"
          value={v.symbole}
          onChange={(e) => setV({ ...v, symbole: e.target.value })}
          aria-label="Symbole"
          className="app-field"
        />
        <select
          value={v.decimales}
          onChange={(e) => setV({ ...v, decimales: e.target.value })}
          aria-label="Décimales"
          className="app-field"
        >
          <option value="0">Sans centimes</option>
          <option value="2">2 décimales</option>
          <option value="3">3 décimales</option>
        </select>
      </div>
      <button
        type="button"
        disabled={!valide}
        onClick={async () => {
          await onCreer({ ...v, decimales: Number(v.decimales) });
          setV({ code: "", nom: "", symbole: "", decimales: "2" });
        }}
        className="app-btn-secondary"
      >
        <Plus className="h-4 w-4" />
        Ajouter à la liste
      </button>
    </div>
  );
};
