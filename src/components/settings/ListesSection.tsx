import React, { useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Upload,
  X,
} from "lucide-react";
import { SettingsSection } from "./primitives";
import type { Database } from "../../lib/database.types";
import type { Personnalisation } from "../../lib/personnalisation";
import {
  LISTES,
  cleDeListe,
  LIBELLE_EFFECTUE_PAR,
  libelleEffectuePar,
  lireNomsCsv,
  lireReglagesListes,
  trierValeurs,
  valeurEquivalente,
  type DescriptionDeListe,
  type QuiPeutAjouter,
  type UsageDeListe,
  type ValeurDeListe,
} from "../../lib/listes";

interface ListesSectionProps {
  valeurs: ValeurDeListe[];
  /** Combien d'enregistrements portent chaque valeur, toutes listes confondues. */
  compteParValeur: Record<string, number>;
  onAdd: (data: {
    nom: string;
    parent_id?: string | null;
    usage?: string;
    ordre?: number;
    taux_marge?: number | null;
  }) => Promise<{ categorie: ValeurDeListe | null; error: string | null }>;
  onUpdate: (
    id: string,
    data: Database["public"]["Tables"]["categories"]["Update"],
  ) => Promise<{ error: string | null }>;
  personnalisation: Personnalisation;
  onSavePersonnalisation: (p: Personnalisation) => Promise<void> | void;
}

/**
 * Trois listes, un seul écran : ce sont trois fois le même objet.
 *
 * Pas de corbeille, on archive — supprimer une valeur utilisée
 * laisserait des achats sans fournisseur. Renommer se propage, puisque
 * c'est un identifiant qui est stocké et non le mot.
 */
export const ListesSection: React.FC<ListesSectionProps> = ({
  valeurs,
  compteParValeur,
  onAdd,
  onUpdate,
  personnalisation,
  onSavePersonnalisation,
}) => {
  const [usage, setUsage] = useState<UsageDeListe>("produit");
  const description: DescriptionDeListe = LISTES.find((l) => l.usage === usage) ?? LISTES[0];

  const [nom, setNom] = useState("");
  const [parent, setParent] = useState("");
  const [enEdition, setEnEdition] = useState<ValeurDeListe | null>(null);
  const [nomEdite, setNomEdite] = useState("");
  const [tauxEdite, setTauxEdite] = useState("");
  const [voirArchivees, setVoirArchivees] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [glissee, setGlissee] = useState<string | null>(null);

  const siennes = useMemo(
    () => trierValeurs(valeurs.filter((v) => (v.usage ?? "produit") === usage)),
    [valeurs, usage],
  );
  const actives = siennes.filter((v) => v.actif);
  const archivees = siennes.filter((v) => !v.actif);

  const racines = actives.filter((v) => !v.parent_id);
  const enfantsDe = (id: string) => actives.filter((v) => v.parent_id === id);

  /** Les racines suivies de leurs enfants. */
  const affichees = racines.flatMap((r) => [r, ...enfantsDe(r.id)]);

  const doublon = valeurEquivalente(siennes, nom);

  const ajouter = async (e: React.FormEvent) => {
    e.preventDefault();
    const propre = nom.trim();
    if (!propre) return;
    if (doublon) {
      setErreur(`« ${doublon.nom} » existe déjà dans cette liste.`);
      return;
    }
    setEnCours(true);
    setErreur(null);
    // En fin de liste : l'ordre est une décision.
    const dernier = siennes.reduce((m, v) => Math.max(m, v.ordre), 0);
    const { error } = await onAdd({
      nom: propre,
      parent_id: parent || null,
      usage,
      ordre: dernier + 10,
    });
    setEnCours(false);
    if (error) {
      setErreur(error);
      return;
    }
    setNom("");
  };

  const enregistrerEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enEdition) return;
    const propre = nomEdite.trim();
    if (!propre) return;
    const autre = siennes.find(
      (v) => v.id !== enEdition.id && cleDeListe(v.nom) === cleDeListe(propre),
    );
    if (autre) {
      setErreur(`« ${autre.nom} » porte déjà ce nom dans cette liste.`);
      return;
    }
    setEnCours(true);
    setErreur(null);
    const taux = tauxEdite.trim() === "" ? null : Number(tauxEdite);
    const { error } = await onUpdate(enEdition.id, {
      nom: propre,
      ...(description.porteUnTaux
        ? { taux_marge: taux !== null && Number.isFinite(taux) ? taux : null }
        : {}),
    });
    setEnCours(false);
    if (error) {
      setErreur(error);
      return;
    }
    setEnEdition(null);
  };

  const archiver = async (v: ValeurDeListe, actif: boolean) => {
    setEnCours(true);
    setErreur(null);
    const { error } = await onUpdate(v.id, { actif });
    setEnCours(false);
    if (error) setErreur(error);
  };

  /**
   * Les `ordre` sont réécrits en entier, par pas de dix : c'est le seul
   * moyen de rattraper une liste dont les ordres sont tous à zéro.
   */
  const reordonner = async (source: string, cible: string) => {
    if (source === cible) return;
    const meme = affichees.filter((v) => (v.parent_id ?? null) === null);
    const depart = meme.findIndex((v) => v.id === source);
    const arrivee = meme.findIndex((v) => v.id === cible);
    if (depart < 0 || arrivee < 0) return;
    const ordonnees = [...meme];
    const [deplacee] = ordonnees.splice(depart, 1);
    ordonnees.splice(arrivee, 0, deplacee);
    setEnCours(true);
    for (let i = 0; i < ordonnees.length; i += 1) {
      if (ordonnees[i].ordre !== i * 10) {
        await onUpdate(ordonnees[i].id, { ordre: i * 10 });
      }
    }
    setEnCours(false);
  };

  const deplacer = async (v: ValeurDeListe, sens: -1 | 1) => {
    const meme = affichees.filter((x) => (x.parent_id ?? null) === (v.parent_id ?? null));
    const i = meme.findIndex((x) => x.id === v.id);
    const voisin = meme[i + sens];
    if (!voisin) return;
    setEnCours(true);
    await onUpdate(v.id, { ordre: voisin.ordre });
    await onUpdate(voisin.id, { ordre: v.ordre });
    setEnCours(false);
  };

  /* ── Import CSV ── */
  const fichier = useRef<HTMLInputElement>(null);
  const [bilanImport, setBilanImport] = useState<string | null>(null);

  const importer = async (f: File) => {
    const contenu = await f.text();
    const noms = lireNomsCsv(contenu);
    if (noms.length === 0) {
      setBilanImport("Aucun nom lisible dans ce fichier.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    let ajoutes = 0;
    let ignores = 0;
    let ordre = siennes.reduce((m, v) => Math.max(m, v.ordre), 0);
    for (const n of noms) {
      if (valeurEquivalente(siennes, n)) {
        ignores += 1;
        continue;
      }
      ordre += 10;
      const { error } = await onAdd({ nom: n, usage, ordre });
      if (error) ignores += 1;
      else ajoutes += 1;
    }
    setEnCours(false);
    setBilanImport(
      `${ajoutes} valeur${ajoutes > 1 ? "s" : ""} ajoutée${ajoutes > 1 ? "s" : ""}` +
        (ignores > 0
          ? `, ${ignores} déjà présente${ignores > 1 ? "s" : ""} ou refusée${ignores > 1 ? "s" : ""}.`
          : "."),
    );
  };

  /* ── Les réglages qui accompagnent les listes ── */
  const reglages = lireReglagesListes(personnalisation);
  const [libelle, setLibelle] = useState(libelleEffectuePar(personnalisation));
  const [libelleEnregistre, setLibelleEnregistre] = useState(false);

  /**
   * `personnalisation` est une colonne partagée : les réglages voisins
   * sont recopiés, jamais reconstruits.
   */
  const objetOuVide = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};

  const changerQuiPeutAjouter = async (choix: QuiPeutAjouter) => {
    await onSavePersonnalisation({
      ...personnalisation,
      listes: { ...objetOuVide(personnalisation.listes), ajoutDepuisFormulaire: choix },
    });
  };

  const enregistrerLibelle = async () => {
    const propre = libelle.trim();
    const libelles = objetOuVide(personnalisation.libelles);
    // Clé absente : le champ suit le logiciel plutôt qu'un choix figé.
    if (propre && propre !== LIBELLE_EFFECTUE_PAR) libelles.effectuePar = propre;
    else delete libelles.effectuePar;
    await onSavePersonnalisation({ ...personnalisation, libelles });
    setLibelleEnregistre(true);
    window.setTimeout(() => setLibelleEnregistre(false), 3000);
  };

  const ligne = (v: ValeurDeListe, estEnfant: boolean) => {
    const combien = compteParValeur[v.id] ?? 0;
    const enfants = estEnfant ? 0 : enfantsDe(v.id).length;
    const secondaire = [
      combien > 0 ? `${combien} enregistrement${combien > 1 ? "s" : ""}` : "Pas encore utilisée",
      enfants > 0 ? `${enfants} sous-valeur${enfants > 1 ? "s" : ""}` : null,
      description.porteUnTaux && v.taux_marge != null ? `+${v.taux_marge} %` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <div
        key={v.id}
        draggable={!estEnfant}
        onDragStart={() => setGlissee(v.id)}
        onDragOver={(e) => {
          if (glissee && !estEnfant) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (glissee) void reordonner(glissee, v.id);
          setGlissee(null);
        }}
        onDragEnd={() => setGlissee(null)}
        className={`app-list-row justify-between gap-3 ${glissee === v.id ? "opacity-50" : ""}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {estEnfant ? (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <GripVertical
              className="hidden h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground sm:block"
              aria-hidden="true"
            />
          )}
          <span className="min-w-0">
            <span className="app-list-primary block">{v.nom}</span>
            <span className="app-list-secondary block">{secondaire}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void deplacer(v, -1)}
            disabled={enCours}
            className="app-btn-icon h-8 w-8"
            aria-label={`Monter ${v.nom}`}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void deplacer(v, 1)}
            disabled={enCours}
            className="app-btn-icon h-8 w-8"
            aria-label={`Descendre ${v.nom}`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEnEdition(v);
              setNomEdite(v.nom);
              setTauxEdite(v.taux_marge == null ? "" : String(v.taux_marge));
              setErreur(null);
            }}
            className="app-btn-icon h-8 w-8"
            aria-label={`Renommer ${v.nom}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void archiver(v, false)}
            disabled={enCours}
            className="app-btn-icon h-8 w-8"
            aria-label={`Archiver ${v.nom}`}
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Listes"
        description="Vos catégories, vos postes de dépense, vos types de fournisseur. Vos mots, pas les nôtres."
        icon={<ListChecks className="w-4 h-4" />}
      >
        {/* Un onglet par liste : on vient en régler une, pas les relire toutes. */}
        <div className="flex flex-wrap gap-2">
          {LISTES.map((l) => (
            <button
              key={l.usage}
              type="button"
              onClick={() => {
                setUsage(l.usage);
                setEnEdition(null);
                setErreur(null);
                setBilanImport(null);
                setParent("");
              }}
              className={
                l.usage === usage
                  ? "rounded-xl border border-primary bg-success-soft px-3 py-2 text-sm font-medium text-primary"
                  : "rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {l.titre}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {description.description} <span className="italic">{description.exemple}</span>
        </p>

        {erreur && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
          >
            {erreur}
          </p>
        )}

        {affichees.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Cette liste est vide. Ajoutez votre première valeur ci-dessous.
          </p>
        ) : (
          <div className="app-list">
            {racines.flatMap((r) => [
              ligne(r, false),
              ...enfantsDe(r.id).map((e) => ligne(e, true)),
            ])}
          </div>
        )}

        {enEdition && (
          <form onSubmit={enregistrerEdition} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <label htmlFor="liste-edit" className="text-sm font-semibold text-foreground">
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
            <p className="mb-3 text-xs text-muted-foreground">
              Le nouveau nom s&apos;applique partout où cette valeur est utilisée : les
              enregistrements gardent leur lien, seul le mot change.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="liste-edit"
                type="text"
                required
                className="app-field flex-1"
                value={nomEdite}
                onChange={(e) => setNomEdite(e.target.value)}
              />
              {description.porteUnTaux && (
                <label className="sm:w-40">
                  <span className="sr-only">Taux de marge par défaut, en pourcentage</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    inputMode="decimal"
                    placeholder="Taux (%)"
                    className="app-field font-mono"
                    value={tauxEdite}
                    onChange={(e) => setTauxEdite(e.target.value)}
                  />
                </label>
              )}
              <button type="submit" disabled={enCours} className="app-btn-primary shrink-0">
                <Save className="h-4 w-4" />
                Enregistrer
              </button>
            </div>
            {description.porteUnTaux && (
              <p className="mt-2 text-xs text-muted-foreground">
                Laissé vide, le taux de la boutique s&apos;applique. Rempli, il vaut pour tous les
                produits de cette catégorie qui n&apos;ont pas le leur.
              </p>
            )}
          </form>
        )}

        <form
          onSubmit={ajouter}
          className={`grid grid-cols-1 gap-3 ${description.deuxNiveaux ? "sm:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]"}`}
        >
          <div>
            <label
              htmlFor="liste-nom"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Nouvelle valeur
            </label>
            <input
              id="liste-nom"
              type="text"
              required
              placeholder={description.exemple}
              className="app-field"
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                setErreur(null);
              }}
            />
            {doublon && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                « {doublon.nom} » existe déjà{doublon.actif ? "" : " (archivée)"}.
              </p>
            )}
          </div>
          {description.deuxNiveaux && (
            <div>
              <label
                htmlFor="liste-parent"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Rangée sous
              </label>
              {/* La base refuse une sous-valeur de sous-valeur. */}
              <select
                id="liste-parent"
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
          )}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={enCours || !nom.trim() || Boolean(doublon)}
              className="app-btn-secondary w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        </form>

        {/* ── L'import, pour les listes longues ── */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">Importer une liste</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Un fichier texte ou CSV, un nom par ligne. Les valeurs déjà présentes sont reconnues et
            ignorées, accents et majuscules compris.
          </p>
          <input
            ref={fichier}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importer(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={enCours}
            onClick={() => fichier.current?.click()}
            className="app-btn-secondary mt-3"
          >
            <Upload className="h-4 w-4" />
            Choisir un fichier
          </button>
          {bilanImport && <p className="mt-2 text-xs text-muted-foreground">{bilanImport}</p>}
        </div>

        {/* ── Les archivées ── */}
        {archivees.length > 0 && (
          <div className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setVoirArchivees((v) => !v)}
              aria-expanded={voirArchivees}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground"
            >
              <span>
                {archivees.length} valeur{archivees.length > 1 ? "s" : ""} archivée
                {archivees.length > 1 ? "s" : ""}
              </span>
              {voirArchivees ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
            {voirArchivees && (
              <div className="app-list border-t border-border">
                {archivees.map((v) => (
                  <div key={v.id} className="app-list-row justify-between gap-3">
                    <span className="min-w-0">
                      <span className="app-list-primary block">{v.nom}</span>
                      <span className="app-list-secondary block">
                        {(compteParValeur[v.id] ?? 0) > 0
                          ? `Toujours lisible sur ${compteParValeur[v.id]} enregistrement${(compteParValeur[v.id] ?? 0) > 1 ? "s" : ""}`
                          : "Retirée des sélecteurs"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void archiver(v, true)}
                      disabled={enCours}
                      className="app-btn-icon h-8 w-8"
                      aria-label={`Remettre ${v.nom} en service`}
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Qui complète les listes"
        description="Depuis un formulaire, sans passer par cet écran."
        icon={<Plus className="w-4 h-4" />}
      >
        <div className="space-y-2">
          {(
            [
              {
                cle: "tous" as const,
                titre: "Tout le monde",
                aide: "Chacun ajoute la valeur qui lui manque au moment où elle lui manque. C'est le réglage actuel.",
              },
              {
                cle: "responsables" as const,
                titre: "Administrateurs et managers",
                aide: "Les autres choisissent dans la liste existante. Moins de doublons, mais une vente peut attendre.",
              },
            ] satisfies { cle: QuiPeutAjouter; titre: string; aide: string }[]
          ).map((choix) => (
            <label
              key={choix.cle}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                reglages.ajoutDepuisFormulaire === choix.cle
                  ? "border-primary bg-success-soft"
                  : "border-border"
              }`}
            >
              <input
                type="radio"
                name="qui-peut-ajouter"
                className="mt-1"
                checked={reglages.ajoutDepuisFormulaire === choix.cle}
                onChange={() => void changerQuiPeutAjouter(choix.cle)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{choix.titre}</span>
                <span className="block text-xs text-muted-foreground">{choix.aide}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Ce réglage est vérifié par la base, pas seulement par l&apos;écran : un formulaire modifié
          n&apos;y échappe pas.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Le nom du champ « Effectué par »"
        description="Dans une dépense, qui a sorti l'argent."
        icon={<Pencil className="w-4 h-4" />}
      >
        <p className="text-sm text-muted-foreground">
          Ce champ s&apos;appelait « Vendeur », et ne désignait déjà plus un vendeur : c&apos;est la
          personne qui a fait la dépense, membre de l&apos;équipe ou non. Certains disent «
          Exécutant », d&apos;autres « Responsable de l&apos;achat ».
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            className="app-field flex-1"
            placeholder="Effectué par"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void enregistrerLibelle()}
            className="app-btn-primary shrink-0"
          >
            <Save className="h-4 w-4" />
            {libelleEnregistre ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
};
