import React, { useMemo, useState } from "react";
import { BellRing, Plus, Save, Trash2, User } from "lucide-react";
import { PageHeader } from "./shared/PageHeader";
import { Modal } from "./shared/Modal";
import { DataList } from "./shared/DataList";
import { Toggle } from "./shared/Toggle";
import { dateDuJour } from "../lib/dates";
import {
  JOURS_SEMAINE,
  MEME_JOUR_MINUTES,
  RECURRENCES,
  VEILLE_HEURE,
  estEchu,
  libelleQuand,
  libelleRecurrence,
  prochaineOccurrence,
  type Rappel,
  type Recurrence,
} from "../lib/rappels";

interface Membre {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface RappelsViewProps {
  rappels: Rappel[];
  membres: Membre[];
  moiId: string | null;
  onCreer: (r: {
    titre: string;
    recurrence: string;
    jour?: string;
    heure: string;
    jourSemaine?: number | null;
    jourMois?: number | null;
    destinataireId?: string | null;
  }) => Promise<{ error: string | null }>;
  onBasculer: (id: string, actif: boolean) => Promise<{ error: string | null }>;
  onSupprimer: (id: string) => Promise<{ error: string | null }>;
}

/**
 * Les rappels.
 *
 * Deux sortes de choses vous sont redites, et l'écran le dit d'emblée :
 * ce que l'application sait déjà (un rendez-vous approche, une tâche est
 * en retard) et qu'elle annonce toute seule dans la cloche ; et ce
 * qu'on lui demande de redire, qui se règle ici.
 *
 * Un rappel n'a pas de portée : personne d'autre que celui qui le pose
 * et celui qui le reçoit ne le voit, pas même le propriétaire. Savoir de
 * quoi un collègue a besoin qu'on lui rappelle ne regarde personne.
 */
export const RappelsView: React.FC<RappelsViewProps> = ({
  rappels,
  membres,
  moiId,
  onCreer,
  onBasculer,
  onSupprimer,
}) => {
  const [formOuvert, setFormOuvert] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);

  const [titre, setTitre] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("aucune");
  const [jour, setJour] = useState(dateDuJour());
  const [heure, setHeure] = useState("08:00");
  const [jourSemaine, setJourSemaine] = useState(1);
  const [jourMois, setJourMois] = useState(1);
  const [destinataireId, setDestinataireId] = useState("");

  const maintenant = useMemo(() => new Date(), []);

  const nomDe = (id: string | null): string => {
    if (!id) return "—";
    if (id === moiId) return "Vous";
    const m = membres.find((x) => x.user_id === id);
    return m ? m.full_name?.trim() || m.email : "—";
  };

  const reinitialiser = () => {
    setTitre("");
    setRecurrence("aucune");
    setJour(dateDuJour());
    setHeure("08:00");
    setJourSemaine(1);
    setJourMois(1);
    setDestinataireId("");
    setMessageErreur(null);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim() || enregistrement) return;
    setEnregistrement(true);
    const { error } = await onCreer({
      titre,
      recurrence,
      jour,
      heure,
      jourSemaine,
      jourMois,
      destinataireId: destinataireId || null,
    });
    setEnregistrement(false);
    if (error) {
      setMessageErreur(error);
      return;
    }
    reinitialiser();
    setFormOuvert(false);
  };

  const ranges = useMemo(
    () =>
      [...rappels].sort((a, b) => {
        // Ce qui sonne en ce moment passe devant ; ce qui est éteint
        // descend en bas.
        const ea = estEchu(a, maintenant) ? 0 : a.actif ? 1 : 2;
        const eb = estEchu(b, maintenant) ? 0 : b.actif ? 1 : 2;
        if (ea !== eb) return ea - eb;
        const pa = prochaineOccurrence(a, maintenant)?.getTime() ?? Infinity;
        const pb = prochaineOccurrence(b, maintenant)?.getTime() ?? Infinity;
        return pa - pb;
      }),
    [rappels, maintenant],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<BellRing className="h-5 w-5 text-primary" />}
        title="Rappels"
        module="rappels"
        subtitle="Ce que vous voulez qu'on vous redise, et quand."
        actions={
          <button
            onClick={() => {
              reinitialiser();
              setFormOuvert(true);
            }}
            className="app-btn-primary w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Nouveau rappel
          </button>
        }
      />

      {/* Ce que l'application fait d'elle-même. Le dire ici évite qu'on
          crée à la main des rappels pour des choses déjà surveillées. */}
      <div className="app-card p-4">
        <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
          Ce qui vous est signalé sans rien régler
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Un rendez-vous qui approche</span> — la veille à{" "}
            {VEILLE_HEURE} h, ou {MEME_JOUR_MINUTES} minutes avant s&apos;il tombe aujourd&apos;hui.
          </li>
          <li>
            <span className="text-foreground">Une tâche qu&apos;on vous confie</span>, et celles qui
            arrivent à échéance ou qui sont en retard.
          </li>
          <li>
            <span className="text-foreground">
              Un stock bas, une créance, une échéance d&apos;achat
            </span>{" "}
            — comme avant.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Tout cela paraît dans la cloche, en haut de l&apos;écran. Les rappels ci-dessous s&apos;y
          ajoutent.
        </p>
      </div>

      <DataList
        items={ranges.map((r) => {
          const sonne = estEchu(r, maintenant);
          const suivant = prochaineOccurrence(r, maintenant);
          return {
            id: r.id,
            primary: r.titre,
            meta: [
              libelleQuand(r),
              r.destinataire_id !== moiId ? `pour ${nomDe(r.destinataire_id)}` : null,
            ],
            badge: !r.actif ? (
              <span className="app-badge-neutral">En pause</span>
            ) : sonne ? (
              <span className="app-badge-warning">Maintenant</span>
            ) : null,
            details: [
              { label: "Quand", value: libelleQuand(r) },
              { label: "Répétition", value: libelleRecurrence(r.recurrence) },
              {
                label: "Prochaine fois",
                value: suivant
                  ? `${suivant.toLocaleDateString("fr-FR")} à ${String(suivant.getHours()).padStart(2, "0")}:${String(suivant.getMinutes()).padStart(2, "0")}`
                  : r.actif
                    ? "Aucune à venir"
                    : "En pause",
              },
              { label: "Pour", value: nomDe(r.destinataire_id) },
              { label: "Posé par", value: nomDe(r.createur_id) },
            ],
            detailBody: (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <span className="text-sm text-foreground">Rappel actif</span>
                <Toggle
                  checked={r.actif}
                  onChange={(v) => onBasculer(r.id, v)}
                  label={`Activer le rappel ${r.titre}`}
                />
              </div>
            ),
            actions: (
              <button
                onClick={() => {
                  if (window.confirm(`Supprimer le rappel « ${r.titre} » ?`)) onSupprimer(r.id);
                }}
                className="app-btn-danger"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            ),
          };
        })}
        emptyLabel="Aucun rappel pour le moment."
      />

      <Modal
        open={formOuvert}
        onClose={() => setFormOuvert(false)}
        size="lg"
        icon={<BellRing className="h-4 w-4" />}
        title="Nouveau rappel"
        description="Ce qu'il faut vous redire, et à quelle fréquence."
        dismissible={!enregistrement}
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOuvert(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="rappel-form"
              disabled={enregistrement}
              className="app-btn-primary"
            >
              <Save className="h-4 w-4" />
              {enregistrement ? "Enregistrement…" : "Créer le rappel"}
            </button>
          </>
        }
      >
        <form id="rappel-form" onSubmit={enregistrer} className="space-y-4">
          <label className="block">
            <span className="app-label">Que faut-il vous redire</span>
            <input
              className="app-field"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Faire la caisse"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="app-label">À quelle fréquence</span>
            <select
              className="app-field"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            >
              {RECURRENCES.map((r) => (
                <option key={r.valeur} value={r.valeur}>
                  {r.libelle}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Le champ de date ne paraît que pour un rappel unique : un
                « tous les lundis » n'a pas de jour de départ à choisir. */}
            {recurrence === "aucune" && (
              <label className="block">
                <span className="app-label">Le</span>
                <input
                  type="date"
                  className="app-field"
                  value={jour}
                  onChange={(e) => setJour(e.target.value)}
                />
              </label>
            )}
            {recurrence === "hebdomadaire" && (
              <label className="block">
                <span className="app-label">Quel jour</span>
                <select
                  className="app-field"
                  value={jourSemaine}
                  onChange={(e) => setJourSemaine(Number(e.target.value))}
                >
                  {JOURS_SEMAINE.map((j) => (
                    <option key={j.valeur} value={j.valeur}>
                      {j.libelle}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {recurrence === "mensuel" && (
              <label className="block">
                <span className="app-label">Quel jour du mois</span>
                <select
                  className="app-field"
                  value={jourMois}
                  onChange={(e) => setJourMois(Number(e.target.value))}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="app-label">À quelle heure</span>
              <input
                type="time"
                className="app-field"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
              />
            </label>
          </div>

          {recurrence === "mensuel" && (
            <p className="text-xs text-muted-foreground">
              Le choix s&apos;arrête au 28 : un rappel fixé au 31 ne sonnerait pas en février, et un
              rappel qui saute des mois n&apos;en est plus un.
            </p>
          )}

          {membres.filter((m) => m.user_id !== moiId).length > 0 && (
            <label className="block">
              <span className="app-label">
                <User className="mr-1 inline h-3.5 w-3.5" />
                Pour qui
              </span>
              <select
                className="app-field"
                value={destinataireId}
                onChange={(e) => setDestinataireId(e.target.value)}
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
