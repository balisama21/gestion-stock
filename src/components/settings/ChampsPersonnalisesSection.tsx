import React, { useMemo, useState } from "react";
import { ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { SettingsSection } from "./primitives";
import {
  ENTITES_CHAMPS,
  TYPES_CHAMPS,
  cleDepuisLibelle,
  libelleTypeChamp,
  type ChampPerso,
  type EntiteChamp,
} from "../../lib/champsPersonnalises";
import type { Database } from "../../lib/database.types";

type ChampInsert = Database["public"]["Tables"]["custom_field_definitions"]["Insert"];

interface ChampsPersonnalisesSectionProps {
  champs: ChampPerso[];
  onAdd: (data: Omit<ChampInsert, "store_id" | "created_by">) => Promise<{ error: string | null }>;
  onUpdate: (
    id: string,
    data: Database["public"]["Tables"]["custom_field_definitions"]["Update"],
  ) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
}
const FORMULAIRE_VIDE = {
  libelle: "",
  type: "texte",
  options: "",
  aide: "",
  obligatoire: false,
};

/**
 * Les champs que l'entreprise ajoute elle-même.
 *
 * Réservé au propriétaire, comme toute la section Boutique : définir un
 * champ change la structure des fiches de tout le monde. La base
 * l'impose aussi de son côté, la politique d'écriture demande
 * `is_store_owner`.
 */
export const ChampsPersonnalisesSection: React.FC<ChampsPersonnalisesSectionProps> = ({
  champs,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [entite, setEntite] = useState<EntiteChamp>("client");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<ChampPerso | null>(null);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<ChampPerso | null>(null);

  const champsDeLEntite = useMemo(
    () =>
      champs
        .filter((c) => c.entite === entite)
        .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, "fr")),
    [champs, entite],
  );

  const ouvrirCreation = () => {
    setEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (c: ChampPerso) => {
    setEnEdition(c);
    setFormulaire({
      libelle: c.libelle,
      type: c.type,
      options: (c.options ?? []).join(", "),
      aide: c.aide ?? "",
      obligatoire: c.obligatoire,
    });
    setErreur(null);
    setFormulaireOuvert(true);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    const libelle = formulaire.libelle.trim();
    if (!libelle) {
      setErreur("Le nom du champ est obligatoire.");
      return;
    }
    const options =
      formulaire.type === "liste"
        ? formulaire.options
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : null;
    if (formulaire.type === "liste" && (!options || options.length === 0)) {
      setErreur("Un champ de type liste doit proposer au moins un choix.");
      return;
    }

    setEnregistrement(true);
    setErreur(null);

    // La clé ne se recalcule jamais en modification : elle est le nom
    // sous lequel toutes les valeurs sont déjà rangées.
    const commun = {
      libelle,
      type: formulaire.type,
      options,
      aide: formulaire.aide.trim() || null,
      obligatoire: formulaire.obligatoire,
    };
    const { error } = enEdition
      ? await onUpdate(enEdition.id, commun)
      : await onAdd({
          ...commun,
          entite,
          cle: cleDepuisLibelle(libelle),
          ordre: champsDeLEntite.length,
        });

    setEnregistrement(false);
    if (error) {
      setErreur(error);
      return;
    }
    setFormulaireOuvert(false);
    setEnEdition(null);
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    setEnregistrement(true);
    const { error } = await onDelete(aSupprimer.id);
    setEnregistrement(false);
    setASupprimer(null);
    if (error) setErreur(error);
  };

  return (
    <SettingsSection
      title="Champs personnalisés"
      description="Ajoutez à vos fiches les informations que le logiciel ne prévoit pas : un numéro de dossier, une taille de palette, un code douane."
      icon={<ListPlus className="w-4 h-4" />}
    >
      {/* Le choix de la fiche concernée, en onglets plutôt qu'en liste
          déroulante : on doit voir d'un coup d'oeil où l'on travaille. */}
      <div className="flex flex-wrap gap-2">
        {ENTITES_CHAMPS.map((e) => {
          const nb = champs.filter((c) => c.entite === e.valeur).length;
          return (
            <button
              key={e.valeur}
              type="button"
              onClick={() => {
                setEntite(e.valeur);
                setFormulaireOuvert(false);
                setErreur(null);
              }}
              aria-pressed={entite === e.valeur}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                entite === e.valeur
                  ? "border-success-border bg-success-soft t-success"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {e.libelle}
              {nb > 0 && ` (${nb})`}
            </button>
          );
        })}
      </div>

      {erreur && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
        >
          {erreur}
        </p>
      )}

      {champsDeLEntite.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Aucun champ ajouté pour cette fiche.</p>
      ) : (
        <div className="app-list">
          {champsDeLEntite.map((champ) => (
            <div key={champ.id} className="app-list-row justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="app-list-primary block">
                  {champ.libelle}
                  {champ.obligatoire && (
                    <>
                      {" "}
                      <span className="app-badge app-badge-warning">Obligatoire</span>
                    </>
                  )}
                  {!champ.actif && (
                    <>
                      {" "}
                      <span className="app-badge app-badge-neutral">Masqué</span>
                    </>
                  )}
                </span>
                <span className="app-list-secondary block">
                  {libelleTypeChamp(champ.type)}
                  {champ.type === "liste" && champ.options ? ` · ${champ.options.join(", ")}` : ""}
                  {` · clé ${champ.cle}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdate(champ.id, { actif: !champ.actif })}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  {champ.actif ? "Masquer" : "Afficher"}
                </button>
                <button
                  type="button"
                  onClick={() => ouvrirEdition(champ)}
                  className="app-btn-icon h-8 w-8"
                  aria-label={`Modifier le champ ${champ.libelle}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setASupprimer(champ)}
                  className="app-btn-icon h-8 w-8"
                  aria-label={`Supprimer le champ ${champ.libelle}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {aSupprimer && (
        <div className="rounded-xl border border-danger-border bg-danger-soft p-4">
          <p className="text-sm font-semibold t-danger">
            Supprimer le champ « {aSupprimer.libelle} » ?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Les valeurs déjà saisies restent dans les fiches mais ne s&apos;afficheront plus. Pour
            les garder visibles tout en retirant le champ des formulaires, préférez « Masquer ».
          </p>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setASupprimer(null)} className="app-btn-secondary">
              Annuler
            </button>
            <button
              type="button"
              onClick={supprimer}
              disabled={enregistrement}
              className="app-btn-danger"
            >
              {enregistrement ? "Suppression…" : "Oui, supprimer"}
            </button>
          </div>
        </div>
      )}

      {formulaireOuvert ? (
        <form onSubmit={enregistrer} className="rounded-xl border border-border p-4">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">
              {enEdition ? `Modifier « ${enEdition.libelle} »` : "Nouveau champ"}
            </h4>
            <button
              type="button"
              onClick={() => setFormulaireOuvert(false)}
              className="app-btn-icon h-8 w-8"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cp-libelle"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Nom du champ <span className="t-danger">*</span>
              </label>
              <input
                id="cp-libelle"
                type="text"
                required
                placeholder="Code douane"
                className="app-field"
                value={formulaire.libelle}
                onChange={(e) => setFormulaire((p) => ({ ...p, libelle: e.target.value }))}
              />
              {!enEdition && formulaire.libelle.trim() !== "" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Enregistré sous le nom technique{" "}
                  <span className="font-mono">{cleDepuisLibelle(formulaire.libelle)}</span>, qui ne
                  changera plus.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="cp-type"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Type
              </label>
              <select
                id="cp-type"
                className="app-field"
                value={formulaire.type}
                onChange={(e) => setFormulaire((p) => ({ ...p, type: e.target.value }))}
                disabled={Boolean(enEdition)}
              >
                {TYPES_CHAMPS.map((t) => (
                  <option key={t.valeur} value={t.valeur}>
                    {t.libelle}
                  </option>
                ))}
              </select>
              {enEdition && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Le type ne se change pas : les valeurs déjà saisies ne s&apos;y convertiraient pas
                  toutes.
                </p>
              )}
            </div>

            {formulaire.type === "liste" && (
              <div className="sm:col-span-2">
                <label
                  htmlFor="cp-options"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Choix possibles <span className="t-danger">*</span>
                </label>
                <input
                  id="cp-options"
                  type="text"
                  placeholder="Détail, Demi-gros, Gros"
                  className="app-field"
                  value={formulaire.options}
                  onChange={(e) => setFormulaire((p) => ({ ...p, options: e.target.value }))}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Séparés par des virgules.</p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label
                htmlFor="cp-aide"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Texte d&apos;aide
              </label>
              <input
                id="cp-aide"
                type="text"
                placeholder="Affiché sous le champ, pour guider la saisie"
                className="app-field"
                value={formulaire.aide}
                onChange={(e) => setFormulaire((p) => ({ ...p, aide: e.target.value }))}
              />
            </div>

            <div className="flex items-start gap-2.5 sm:col-span-2">
              <input
                id="cp-obligatoire"
                type="checkbox"
                checked={formulaire.obligatoire}
                onChange={(e) => setFormulaire((p) => ({ ...p, obligatoire: e.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
              />
              <label htmlFor="cp-obligatoire" className="text-sm text-foreground">
                Obligatoire à la saisie
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setFormulaireOuvert(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" disabled={enregistrement} className="app-btn-primary">
              {enregistrement ? "Enregistrement…" : enEdition ? "Enregistrer" : "Ajouter le champ"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={ouvrirCreation}
          className="app-btn-secondary w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Ajouter un champ
        </button>
      )}
    </SettingsSection>
  );
};
