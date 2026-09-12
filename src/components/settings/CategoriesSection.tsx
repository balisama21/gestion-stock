import React, { useMemo, useState } from "react";
import { ChevronRight, FolderTree, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { SettingsSection } from "./primitives";
import type { Database } from "../../lib/database.types";

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

interface CategoriesSectionProps {
  categories: Categorie[];
  /** Combien de produits sont rangés dans chaque catégorie. */
  compteParCategorie: Record<string, number>;
  onAdd: (data: {
    nom: string;
    parent_id?: string | null;
    usage?: string;
  }) => Promise<{ error: string | null }>;
  /**
   * Ce que ces catégories rangent : des produits, ou des dépenses.
   *
   * La même section sert aux deux — mêmes deux niveaux, mêmes règles,
   * même écran. Seuls le vocabulaire et la liste changent, parce que
   * ranger un rayon et ranger un poste de dépense, c'est le même geste.
   */
  usage?: "produit" | "depense";
  onUpdate: (
    id: string,
    data: Database["public"]["Tables"]["categories"]["Update"],
  ) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
}

/**
 * Les catégories de produits, sur deux niveaux.
 *
 * Deux niveaux et pas davantage : c'est ce que demande le cahier des
 * charges, et une arborescence libre inviterait des hiérarchies de six
 * niveaux qu'aucun commerçant ne tient à jour. La base le fait
 * respecter de son côté par un déclencheur ; cet écran n'offre donc
 * simplement pas de quoi aller plus loin.
 */
export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  categories,
  compteParCategorie,
  onAdd,
  onUpdate,
  onDelete,
  usage = "produit",
}) => {
  const pourDepense = usage === "depense";
  const [nom, setNom] = useState("");
  const [parent, setParent] = useState<string>("");
  const [enEdition, setEnEdition] = useState<Categorie | null>(null);
  const [nomEdite, setNomEdite] = useState("");
  const [aSupprimer, setASupprimer] = useState<Categorie | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Les deux usages partagent la table : chaque section ne montre que
  // les siennes. Les lignes ecrites avant l ajout de la colonne n ont
  // pas d usage explicite — elles rangent des produits, comme avant.
  const siennes = useMemo(
    () => categories.filter((c) => (c.usage ?? "produit") === usage),
    [categories, usage],
  );

  const racines = useMemo(
    () =>
      siennes
        .filter((c) => !c.parent_id)
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr")),
    [siennes],
  );

  const enfantsDe = (id: string) =>
    siennes
      .filter((c) => c.parent_id === id)
      .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));

  const ajouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await onAdd({ nom: nom.trim(), parent_id: parent || null, usage });
    setEnCours(false);
    if (error) {
      setErreur(error);
      return;
    }
    setNom("");
  };

  const enregistrerEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enEdition || !nomEdite.trim()) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await onUpdate(enEdition.id, { nom: nomEdite.trim() });
    setEnCours(false);
    if (error) {
      setErreur(error);
      return;
    }
    setEnEdition(null);
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    setEnCours(true);
    const { error } = await onDelete(aSupprimer.id);
    setEnCours(false);
    setASupprimer(null);
    if (error) setErreur(error);
  };

  const ligne = (c: Categorie, estEnfant: boolean) => {
    const nbProduits = compteParCategorie[c.id] ?? 0;
    const nbEnfants = estEnfant ? 0 : enfantsDe(c.id).length;
    return (
      <div key={c.id} className="app-list-row justify-between gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {estEnfant && (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="min-w-0">
            <span className="app-list-primary block">{c.nom}</span>
            <span className="app-list-secondary block">
              {[
                // Un poste de dépense ne range pas de produits : compter
                // ceux qu'il n'aura jamais n'apprendrait rien à personne.
                pourDepense
                  ? null
                  : nbProduits > 0
                    ? `${nbProduits} produit${nbProduits > 1 ? "s" : ""}`
                    : "Aucun produit",
                nbEnfants > 0 ? `${nbEnfants} sous-catégorie${nbEnfants > 1 ? "s" : ""}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setEnEdition(c);
              setNomEdite(c.nom);
              setErreur(null);
            }}
            className="app-btn-icon h-8 w-8"
            aria-label={`Renommer ${c.nom}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setASupprimer(c)}
            className="app-btn-icon h-8 w-8"
            aria-label={`Supprimer ${c.nom}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    );
  };

  return (
    <SettingsSection
      title={pourDepense ? "Postes de dépenses" : "Catégories de produits"}
      description={
        pourDepense
          ? "Loyer, électricité, carburant, patente… nommez vos postes comme vous les dites."
          : "Rangez vos produits par famille, et par sous-famille si besoin."
      }
      icon={<FolderTree className="w-4 h-4" />}
    >
      {erreur && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
        >
          {erreur}
        </p>
      )}

      {racines.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Aucune catégorie pour l&apos;instant.</p>
      ) : (
        <div className="app-list">
          {racines.flatMap((r) => [ligne(r, false), ...enfantsDe(r.id).map((e) => ligne(e, true))])}
        </div>
      )}

      {enEdition && (
        <form onSubmit={enregistrerEdition} className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <label htmlFor="cat-edit" className="text-sm font-semibold text-foreground">
              Renommer « {enEdition.nom} »
            </label>
            <button
              type="button"
              onClick={() => setEnEdition(null)}
              className="app-btn-icon h-8 w-8"
              aria-label="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="cat-edit"
              type="text"
              required
              className="app-field flex-1"
              value={nomEdite}
              onChange={(e) => setNomEdite(e.target.value)}
            />
            <button type="submit" disabled={enCours} className="app-btn-primary shrink-0">
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {aSupprimer && (
        <div className="rounded-xl border border-danger-border bg-danger-soft p-4">
          <p className="text-sm font-semibold t-danger">
            Supprimer la catégorie « {aSupprimer.nom} » ?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(compteParCategorie[aSupprimer.id] ?? 0) > 0
              ? `Les ${compteParCategorie[aSupprimer.id]} produits qui y sont rangés ne seront pas supprimés : ils se retrouvent simplement sans catégorie.`
              : "Ses éventuelles sous-catégories remonteront au premier niveau."}
          </p>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setASupprimer(null)} className="app-btn-secondary">
              Annuler
            </button>
            <button type="button" onClick={supprimer} disabled={enCours} className="app-btn-danger">
              {enCours ? "Suppression…" : "Oui, supprimer"}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={ajouter} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="cat-nom" className="mb-1 block text-xs font-medium text-muted-foreground">
            Nouvelle catégorie
          </label>
          <input
            id="cat-nom"
            type="text"
            required
            placeholder="Alimentaire, quincaillerie…"
            className="app-field"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="cat-parent"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Rangée sous
          </label>
          {/* Seules les racines sont proposées : la base refuse une
              sous-catégorie de sous-catégorie, autant ne pas l'offrir. */}
          <select
            id="cat-parent"
            className="app-field"
            value={parent}
            onChange={(e) => setParent(e.target.value)}
          >
            <option value="">Aucune — premier niveau</option>
            {racines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={enCours || !nom.trim()}
            className="app-btn-secondary w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
      </form>
    </SettingsSection>
  );
};
