import React, { useCallback, useEffect, useState } from "react";
import { Moon, Plus, Quote, RotateCcw, Sun, Trash2 } from "lucide-react";
import { SettingsFeedback, SettingsSection } from "./primitives";
import {
  REGLAGES_PAR_DEFAUT,
  PHRASES_LIVREES,
  etatSerie,
  jourDeReference,
  serieComplete,
  type ALaFin,
  type Moment,
  type ReglagesPhrases,
} from "../../features/dashboard-v2/lib/phrases";
import {
  type PhraseAjoutee,
  ajouterPhrase,
  choisirALaFin,
  lirePhrases,
  lireReglages,
  recommencerSerie,
  supprimerPhrase,
} from "../../features/dashboard-v2/lib/phrasesTableau";
import { useConfirmation } from "../../hooks/useConfirmation";

/**
 * Les phrases du haut du tableau de bord, pour le créateur de la
 * plateforme seulement : elles valent pour toutes les boutiques.
 *
 * Une phrase pour la journée, une autre le soir, une nouvelle chaque
 * jour. L'écran dit combien de jours de phrases jamais vues il reste,
 * permet d'en ajouter, et de choisir ce qui se passe une fois la série
 * épuisée : la reprendre au début, ou attendre de nouvelles phrases.
 *
 * La base refuse de toute façon l'écriture à quiconque n'est pas super
 * admin : masquer l'onglet n'est que la politesse de ne pas montrer une
 * porte fermée.
 */

const MOMENTS: { cle: Moment; nom: string; icone: React.ReactNode }[] = [
  { cle: "jour", nom: "Journée (4 h – 18 h)", icone: <Sun className="h-4 w-4" /> },
  { cle: "soir", nom: "Soir (18 h – 4 h)", icone: <Moon className="h-4 w-4" /> },
];

/** « 12 janv. 2027 », pour dire jusqu'à quand il y a des phrases nouvelles. */
const dateLisible = (jour: string) =>
  new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const decalerJour = (jour: string, n: number) => {
  const d = new Date(`${jour}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const FORMULAIRE_VIDE = { moment: "jour" as Moment, l1: "", l2: "", d1: "", d2: "" };

export const PhrasesSection: React.FC = () => {
  const { confirmer, modaleConfirmation } = useConfirmation();
  const [phrases, setPhrases] = useState<PhraseAjoutee[] | null>(null);
  const [reglages, setReglages] = useState<ReglagesPhrases>(REGLAGES_PAR_DEFAUT);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const aujourdhui = jourDeReference(new Date());

  const recharger = useCallback(async () => {
    const [p, r] = await Promise.all([lirePhrases(), lireReglages()]);
    setPhrases(p.phrases);
    setReglages(r.reglages);
    const e = p.error ?? r.error;
    if (e)
      setErreur(
        /schema cache|does not exist|phrases_tableau_de_bord|reglages_phrases/.test(e)
          ? "Les phrases ajoutées ne sont pas encore activées en base : il reste à appliquer la migration 20261011100000_phrases_tableau_de_bord. Les phrases livrées s'affichent déjà."
          : e,
      );
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  /** Une action à la fois : les boutons se grisent pendant l'envoi. */
  const agir = async (action: () => Promise<string | null>, message: string) => {
    setOccupe(true);
    setErreur(null);
    setSucces(null);
    const e = await action();
    await recharger();
    setOccupe(false);
    if (e) setErreur(e);
    else {
      setSucces(message);
      window.setTimeout(() => setSucces(null), 3000);
    }
  };

  const ajoutees = (moment: Moment) => (phrases ?? []).filter((p) => p.moment === moment);

  const etat = (moment: Moment) =>
    etatSerie(
      serieComplete(moment, ajoutees(moment)),
      reglages.debut[moment],
      aujourdhui,
      reglages.aLaFin,
    );

  const valide = form.l1.trim() !== "" && form.d1.trim() !== "";

  const ajouter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valide || phrases === null) return;
    void agir(
      () =>
        ajouterPhrase(
          form.moment,
          { lignes: [form.l1, form.l2], devise: [form.d1, form.d2] },
          phrases,
          reglages,
          aujourdhui,
        ),
      "Phrase ajoutée.",
    ).then(() => setForm((f) => ({ ...FORMULAIRE_VIDE, moment: f.moment })));
  };

  const recommencer = async (moment: Moment) => {
    if (
      !(await confirmer(
        `Reprendre les phrases ${moment === "jour" ? "de la journée" : "du soir"} depuis la première, dès aujourd'hui ?`,
        { libelle: "Reprendre" },
      ))
    )
      return;
    void agir(() => recommencerSerie(moment, aujourdhui), "La série repart de la première phrase.");
  };

  const choisirFin = (a: ALaFin) => void agir(() => choisirALaFin(a), "Choix enregistré.");

  return (
    <SettingsSection
      title="Phrases du tableau de bord"
      icon={<Quote className="h-4 w-4" />}
      description="Le sous-titre et la devise du haut de page, pour toutes les boutiques. Visible par vous seul."
    >
      <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
        {erreur && <SettingsFeedback type="error">{erreur}</SettingsFeedback>}
        {succes && <SettingsFeedback type="success">{succes}</SettingsFeedback>}

        {/* Où en est chaque série */}
        <div className="grid gap-3 md:grid-cols-2">
          {MOMENTS.map(({ cle, nom, icone }) => {
            const s = etat(cle);
            const alerte = s.epuisee || s.restants <= 14;
            return (
              <div
                key={cle}
                className={`rounded-xl border p-4 ${
                  alerte ? "border-warning-border bg-warning-soft" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {icone}
                    {nom}
                  </span>
                  <button
                    type="button"
                    className="app-btn-secondary"
                    onClick={() => recommencer(cle)}
                    disabled={occupe}
                    title="Réutiliser les phrases depuis la première"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Réutiliser
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {s.total} phrases ({PHRASES_LIVREES[cle].length} livrées
                  {ajoutees(cle).length > 0 ? `, ${ajoutees(cle).length} ajoutées` : ""}) · jour{" "}
                  <strong className="text-foreground">{Math.min(s.rang + 1, s.total)}</strong> sur{" "}
                  {s.total}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, ((s.rang + 1) / Math.max(1, s.total)) * 100)}%`,
                    }}
                  />
                </div>
                <p
                  className={`mt-2 text-sm ${alerte ? "t-warning font-medium" : "text-muted-foreground"}`}
                >
                  {s.epuisee
                    ? reglages.aLaFin === "reutiliser"
                      ? "Toutes les phrases ont été affichées : elles sont réutilisées depuis le début."
                      : "Toutes les phrases ont été affichées : la dernière reste en place. Ajoutez-en de nouvelles."
                    : `Encore ${s.restants} jour${s.restants > 1 ? "s" : ""} de phrases nouvelles, jusqu'au ${dateLisible(decalerJour(aujourdhui, s.restants - 1))}.`}
                </p>
                <p className="mt-3 border-t border-border pt-3 text-sm text-foreground">
                  <span className="text-muted-foreground">Aujourd&apos;hui : </span>
                  {s.phrase.lignes.filter(Boolean).join(" ")}{" "}
                  <em className="text-muted-foreground">
                    — {s.phrase.devise.filter(Boolean).join(" ")}
                  </em>
                </p>
              </div>
            );
          })}
        </div>

        {/* Quand une série est épuisée */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Quand toutes les phrases ont été affichées
          </legend>
          {(
            [
              [
                "reutiliser",
                "Réutiliser les phrases",
                "La série recommence automatiquement à la première phrase.",
              ],
              [
                "attendre",
                "Attendre de nouvelles phrases",
                "Les anciennes ne reviennent pas : la dernière reste affichée jusqu'à ce que vous en ajoutiez.",
              ],
            ] as [ALaFin, string, string][]
          ).map(([valeur, titre, detail]) => (
            <label key={valeur} className="mt-2 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="phrases-a-la-fin"
                className="mt-1"
                checked={reglages.aLaFin === valeur}
                disabled={occupe}
                onChange={() => choisirFin(valeur)}
              />
              <span>
                <span className="font-medium text-foreground">{titre}</span>
                <span className="block text-muted-foreground">{detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* Ajouter une phrase */}
        <form onSubmit={ajouter} className="space-y-3 rounded-xl border border-border p-4">
          <div className="text-sm font-semibold text-foreground">Ajouter une phrase</div>
          <div className="flex flex-wrap gap-2">
            {MOMENTS.map(({ cle, nom, icone }) => (
              <button
                key={cle}
                type="button"
                onClick={() => setForm((f) => ({ ...f, moment: cle }))}
                aria-pressed={form.moment === cle}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  form.moment === cle
                    ? "border-success-border bg-success-soft t-success font-medium"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {icone}
                {nom}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted-foreground">Sous-titre, ligne 1 *</span>
              <input
                className="app-field mt-1"
                maxLength={120}
                value={form.l1}
                onChange={(e) => setForm({ ...form, l1: e.target.value })}
                placeholder="Chaque jour est une nouvelle opportunité."
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Sous-titre, ligne 2</span>
              <input
                className="app-field mt-1"
                maxLength={120}
                value={form.l2}
                onChange={(e) => setForm({ ...form, l2: e.target.value })}
                placeholder="Votre boutique grandit, pas à pas."
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Devise manuscrite, ligne 1 *</span>
              <input
                className="app-field mt-1"
                maxLength={30}
                value={form.d1}
                onChange={(e) => setForm({ ...form, d1: e.target.value })}
                placeholder="Ensemble vers"
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Devise manuscrite, ligne 2</span>
              <input
                className="app-field mt-1"
                maxLength={30}
                value={form.d2}
                onChange={(e) => setForm({ ...form, d2: e.target.value })}
                placeholder="plus de réussite !"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="app-btn-primary" disabled={!valide || occupe}>
              <Plus className="h-4 w-4" />
              {occupe ? "Enregistrement…" : "Ajouter à la suite"}
            </button>
          </div>
        </form>

        {/* Les phrases ajoutées */}
        {MOMENTS.map(({ cle, nom }) =>
          ajoutees(cle).length === 0 ? null : (
            <div key={cle}>
              <div className="mb-2 text-sm font-semibold text-foreground">
                Phrases ajoutées · {nom}
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {ajoutees(cle).map((p, i) => (
                  <li key={p.id} className="flex items-start gap-3 p-3 text-sm">
                    <span className="mt-0.5 w-8 shrink-0 text-muted-foreground">
                      {PHRASES_LIVREES[cle].length + i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-foreground">
                        {p.lignes.filter(Boolean).join(" ")}
                      </span>
                      <em className="text-muted-foreground">
                        {p.devise.filter(Boolean).join(" ")}
                      </em>
                    </span>
                    <button
                      type="button"
                      className="app-btn-icon h-8 w-8"
                      onClick={async () => {
                        if (
                          await confirmer("Supprimer cette phrase ?", {
                            danger: true,
                            libelle: "Supprimer",
                          })
                        )
                          void agir(() => supprimerPhrase(p.id), "Phrase supprimée.");
                      }}
                      disabled={occupe}
                      aria-label="Supprimer la phrase"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
      {modaleConfirmation}
    </SettingsSection>
  );
};
