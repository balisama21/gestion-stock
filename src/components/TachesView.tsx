import React, { useMemo, useState } from "react";
import { Check, ListChecks, Play, Plus, RotateCcw, Save, Trash2, User } from "lucide-react";
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { Modal } from "./shared/Modal";
import { DataList } from "./shared/DataList";
import {
  CLASSE_PRIORITE,
  CLASSE_STATUT,
  PRIORITES,
  STATUTS,
  estEnRetard,
  libelleEcheance,
  libellePriorite,
  libelleStatut,
  resumer,
  statutSuivant,
  trierTaches,
  type PrioriteTache,
  type StatutTache,
  type Tache,
} from "../lib/taches";
import { dateDuJour } from "../lib/dates";

interface Membre {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface TachesViewProps {
  taches: Tache[];
  membres: Membre[];
  moiId: string | null;
  /** Vrai si la portée accordée couvre toute l'équipe. */
  voitTouteLEquipe: boolean;
  /** Vrai si l'on a le droit d'attribuer une tâche à quelqu'un d'autre. */
  peutAttribuer: boolean;
  peutSupprimer: boolean;
  onCreer: (t: {
    titre: string;
    description?: string | null;
    echeance?: string | null;
    priorite?: string;
    assigneeId?: string | null;
  }) => Promise<{ error: string | null }>;
  onChangerStatut: (id: string, statut: string) => Promise<{ error: string | null }>;
  onSupprimer: (id: string) => Promise<{ error: string | null }>;
}

/**
 * Les tâches.
 *
 * Ce que l'écran montre dépend de ce que la base a bien voulu rendre :
 * un vendeur ne reçoit que ses propres tâches, un responsable les
 * reçoit toutes. L'écran ne refiltre rien — il se contente de dire, en
 * haut, de quoi il parle.
 *
 * Trois filtres seulement : ce qui reste à faire, ce qui est en retard,
 * tout. Un écran de tâches sert à savoir par quoi commencer ; une
 * barre de filtres complète y répondrait moins bien qu'un tri juste.
 */
export const TachesView: React.FC<TachesViewProps> = ({
  taches,
  membres,
  moiId,
  voitTouteLEquipe,
  peutAttribuer,
  peutSupprimer,
  onCreer,
  onChangerStatut,
  onSupprimer,
}) => {
  const [filtre, setFiltre] = useState<"ouvertes" | "retard" | "toutes">("ouvertes");
  const [formOuvert, setFormOuvert] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [echeance, setEcheance] = useState("");
  const [priorite, setPriorite] = useState<PrioriteTache>("moyenne");
  const [assigneeId, setAssigneeId] = useState("");

  const aujourdhui = dateDuJour();
  const resume = useMemo(() => resumer(taches, aujourdhui), [taches, aujourdhui]);

  const nomDe = (id: string | null): string => {
    if (!id) return "Personne";
    if (id === moiId) return "Vous";
    const m = membres.find((x) => x.user_id === id);
    return m ? m.full_name?.trim() || m.email : "—";
  };

  const listees = useMemo(() => {
    const filtrees = taches.filter((t) => {
      if (filtre === "retard") return estEnRetard(t, aujourdhui);
      if (filtre === "ouvertes") return t.statut !== "termine";
      return true;
    });
    return trierTaches(filtrees, aujourdhui);
  }, [taches, filtre, aujourdhui]);

  const reinitialiser = () => {
    setTitre("");
    setDescription("");
    setEcheance("");
    setPriorite("moyenne");
    setAssigneeId("");
    setMessageErreur(null);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim() || enregistrement) return;
    setEnregistrement(true);
    const { error } = await onCreer({
      titre,
      description,
      echeance: echeance || null,
      priorite,
      assigneeId: assigneeId || null,
    });
    setEnregistrement(false);
    if (error) {
      setMessageErreur(error);
      return;
    }
    reinitialiser();
    setFormOuvert(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<ListChecks className="h-5 w-5 text-primary" />}
        title="Tâches"
        module="taches"
        subtitle={
          voitTouteLEquipe
            ? "Ce que l'équipe doit faire, et où ça en est."
            : "Ce que vous avez à faire."
        }
        metric={
          resume.enRetard > 0 ? (
            <HeaderMetric label="En retard" value={String(resume.enRetard)} tone="danger" />
          ) : (
            <HeaderMetric label="À faire" value={String(resume.aFaire + resume.enCours)} />
          )
        }
        actions={
          <button onClick={() => setFormOuvert(true)} className="app-btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Nouvelle tâche
          </button>
        }
      />

      {/* Trois chiffres, pas davantage : ce qui reste, ce qui est en
          retard, ce qui est pour aujourd'hui. Le reste se lit dans la
          liste. */}
      <div className="app-card divide-y divide-border">
        {[
          {
            cle: "reste",
            label: "À faire",
            valeur: resume.aFaire + resume.enCours,
            hint: "tâches ouvertes",
          },
          {
            cle: "jour",
            label: "Pour aujourd'hui",
            valeur: resume.pourAujourdhui,
            hint: "à boucler avant ce soir",
          },
          {
            cle: "retard",
            label: "En retard",
            valeur: resume.enRetard,
            hint: "échéance dépassée",
            alerte: true,
          },
        ].map((s) => (
          <div key={s.cle} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <span className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
            <span className="text-right">
              <span
                className={`font-mono text-xl font-semibold tabular-nums ${
                  s.alerte && s.valeur > 0 ? "t-danger" : "text-foreground"
                }`}
              >
                {s.valeur}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">{s.hint}</span>
            </span>
          </div>
        ))}
      </div>

      <nav aria-label="Filtrer" className="flex flex-wrap gap-x-1">
        {[
          { cle: "ouvertes" as const, label: "À faire" },
          {
            cle: "retard" as const,
            label: `En retard${resume.enRetard ? ` (${resume.enRetard})` : ""}`,
          },
          { cle: "toutes" as const, label: "Tout" },
        ].map((f) => (
          <button
            key={f.cle}
            onClick={() => setFiltre(f.cle)}
            aria-current={filtre === f.cle ? "page" : undefined}
            className={`-mb-px border-b-2 px-2.5 py-2 text-[13px] transition-colors active:bg-muted ${
              filtre === f.cle
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </nav>

      <DataList
        items={listees.map((t) => {
          const retard = estEnRetard(t, aujourdhui);
          return {
            id: t.id,
            primary: t.titre,
            meta: [
              t.numero,
              libelleEcheance(t.echeance, aujourdhui),
              voitTouteLEquipe ? nomDe(t.assignee_id) : null,
            ],
            badge: retard ? (
              <span className="app-badge-danger">En retard</span>
            ) : (
              <span className={CLASSE_STATUT[t.statut as StatutTache] ?? "app-badge-neutral"}>
                {libelleStatut(t.statut)}
              </span>
            ),
            amountHint:
              t.priorite === "urgente" || t.priorite === "haute" ? (
                <span className={CLASSE_PRIORITE[t.priorite as PrioriteTache]}>
                  {libellePriorite(t.priorite)}
                </span>
              ) : null,
            details: [
              { label: "Statut", value: libelleStatut(t.statut) },
              { label: "Priorité", value: libellePriorite(t.priorite) },
              { label: "Échéance", value: libelleEcheance(t.echeance, aujourdhui) },
              { label: "Attribuée à", value: nomDe(t.assignee_id) },
              { label: "Créée par", value: nomDe(t.createur_id) },
              { label: "Description", value: t.description ?? "", hideIfEmpty: true },
            ],
            actions: (
              <>
                {peutSupprimer && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer la tâche « ${t.titre} » ?`)) onSupprimer(t.id);
                    }}
                    className="app-btn-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                )}
                {t.statut === "termine" ? (
                  <button
                    onClick={() => onChangerStatut(t.id, "a_faire")}
                    className="app-btn-secondary"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Rouvrir
                  </button>
                ) : (
                  <>
                    {t.statut === "a_faire" && (
                      <button
                        onClick={() => onChangerStatut(t.id, "en_cours")}
                        className="app-btn-secondary"
                      >
                        <Play className="h-4 w-4" />
                        Commencer
                      </button>
                    )}
                    <button
                      onClick={() => onChangerStatut(t.id, "termine")}
                      className="app-btn-primary"
                    >
                      <Check className="h-4 w-4" />
                      Terminé
                    </button>
                  </>
                )}
              </>
            ),
          };
        })}
        emptyLabel={
          filtre === "retard"
            ? "Rien en retard. C'est la bonne nouvelle du jour."
            : filtre === "ouvertes"
              ? "Aucune tâche en cours."
              : "Aucune tâche pour le moment."
        }
      />

      <Modal
        open={formOuvert}
        onClose={() => {
          setFormOuvert(false);
          reinitialiser();
        }}
        size="lg"
        icon={<ListChecks className="h-4 w-4" />}
        title="Nouvelle tâche"
        description="Ce qu'il y a à faire, pour qui, et pour quand."
        dismissible={!enregistrement}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setFormOuvert(false);
                reinitialiser();
              }}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="tache-form"
              disabled={enregistrement}
              className="app-btn-primary"
            >
              <Save className="h-4 w-4" />
              {enregistrement ? "Enregistrement…" : "Créer la tâche"}
            </button>
          </>
        }
      >
        <form id="tache-form" onSubmit={enregistrer} className="space-y-4">
          <label className="block">
            <span className="app-label">Ce qu'il y a à faire</span>
            <input
              className="app-field"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Relancer le fournisseur Rakoto"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="app-label">Précisions</span>
            <textarea
              className="app-field"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Facultatif"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="app-label">À faire avant le</span>
              <input
                type="date"
                className="app-field"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="app-label">Priorité</span>
              <select
                className="app-field"
                value={priorite}
                onChange={(e) => setPriorite(e.target.value as PrioriteTache)}
              >
                {PRIORITES.map((p) => (
                  <option key={p.valeur} value={p.valeur}>
                    {p.libelle}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Le choix du destinataire ne paraît que si l'on a le droit
              d'attribuer. Sans ce droit, la tâche est pour soi, et un
              menu grisé n'apprendrait rien. */}
          {peutAttribuer && membres.length > 0 && (
            <label className="block">
              <span className="app-label">
                <User className="mr-1 inline h-3.5 w-3.5" />
                Pour qui
              </span>
              <select
                className="app-field"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Pour moi</option>
                {membres
                  .filter((m) => m.user_id !== moiId)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name?.trim() || m.email}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {messageErreur && (
            <p className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm t-danger">
              {messageErreur}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};

export { STATUTS, statutSuivant };
