import React, { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Save, Trash2, Users } from "lucide-react";
import type { Purchase } from "../types";
import { formatCurrency } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { Modal } from "./shared/Modal";
import { dateDuJour } from "../lib/dates";
import { urgenceDe } from "../lib/agenda";
import {
  JOURS_COURTS,
  NATURES,
  VISIBILITES,
  ajouterJours,
  ajouterMois,
  compterParJour,
  grilleDuMois,
  libelleJour,
  libelleMois,
  libelleNature,
  libelleSemaine,
  libelleVisibilite,
  lignesDuJour,
  ligneDeEvenement,
  memeMois,
  semaineDe,
  type Evenement,
  type LigneAgenda,
  type NatureEvenement,
  type VisibiliteEvenement,
} from "../lib/evenements";

interface Membre {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface AgendaViewProps {
  evenements: Evenement[];
  membres: Membre[];
  moiId: string | null;
  /** Les trois échéances que le métier porte déjà. */
  purchases: Purchase[];
  quotes: {
    id: string;
    numero: string | null;
    client_nom: string;
    statut: string;
    total: number;
    valide_jusqu_au: string | null;
  }[];
  deliveries: {
    id: string;
    numero: string | null;
    destinataire: string;
    statut: string;
    date_prevue: string | null;
    montant_a_encaisser: number;
  }[];
  onCreer: (e: {
    titre: string;
    description?: string | null;
    lieu?: string | null;
    jour: string;
    heure?: string;
    journeeEntiere?: boolean;
    nature?: string;
    visibilite?: string;
    invites?: string[];
  }) => Promise<{ error: string | null }>;
  onSupprimer: (id: string) => Promise<{ error: string | null }>;
  onNavigateTab: (tab: string) => void;
}

type Vue = "jour" | "semaine" | "mois";

/**
 * L'agenda.
 *
 * Il montre deux choses que rien ne rapprochait : les rendez-vous qu'on
 * y saisit, et les échéances que le métier porte déjà — un achat à
 * régler, un devis qui expire, une course prévue. L'ancien agenda ne
 * savait montrer que les secondes ; les jeter en ajoutant les premières
 * aurait fait perdre ce qui marchait.
 *
 * ── Trois vues, et une règle qui les gouverne ──
 *
 * Le mois est une grille de sept colonnes ; c'est la seule qui tienne à
 * 375 pixels, à cinquante pixels par case. La semaine et le jour sont
 * des LISTES verticales, et non des colonnes horaires : sept colonnes de
 * rendez-vous imposeraient un défilement latéral, ce que ce logiciel
 * s'interdit absolument. Une liste de sept sections dit la même chose et
 * se lit au pouce.
 */
export const AgendaView: React.FC<AgendaViewProps> = ({
  evenements,
  membres,
  moiId,
  purchases,
  quotes,
  deliveries,
  onCreer,
  onSupprimer,
  onNavigateTab,
}) => {
  const aujourdhui = dateDuJour();
  const [vue, setVue] = useState<Vue>("jour");
  const [curseur, setCurseur] = useState(aujourdhui);
  const [formOuvert, setFormOuvert] = useState(false);
  const [detail, setDetail] = useState<LigneAgenda | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [lieu, setLieu] = useState("");
  const [jour, setJour] = useState(aujourdhui);
  const [heure, setHeure] = useState("09:00");
  const [journeeEntiere, setJourneeEntiere] = useState(false);
  const [nature, setNature] = useState<NatureEvenement>("rendez_vous");
  const [visibilite, setVisibilite] = useState<VisibiliteEvenement>("prive");
  const [invites, setInvites] = useState<string[]>([]);

  const nomDe = (id: string | null): string => {
    if (!id) return "—";
    if (id === moiId) return "Vous";
    const m = membres.find((x) => x.user_id === id);
    return m ? m.full_name?.trim() || m.email : "—";
  };

  /**
   * Les deux sources réunies. Les échéances reprennent la logique de
   * l'ancien agenda : ce sont les trois seules choses que la base sache
   * dater d'elle-même.
   */
  const lignes: LigneAgenda[] = useMemo(() => {
    const l: LigneAgenda[] = evenements.map(ligneDeEvenement);

    for (const a of purchases) {
      if (!a.dateEcheance || a.soldeDu <= 0) continue;
      l.push({
        id: `ach-${a.id}`,
        jour: a.dateEcheance,
        heure: null,
        titre: `Régler ${a.fournisseur || a.designation}`,
        detail: `${a.numero} · ${formatCurrency(a.soldeDu)} dû`,
        source: "achat",
        classe: urgenceDe(a.dateEcheance) === "retard" ? "app-badge-danger" : "app-badge-warning",
        onglet: "achats",
      });
    }
    for (const d of quotes) {
      if (!d.valide_jusqu_au || d.statut !== "envoye") continue;
      l.push({
        id: `dev-${d.id}`,
        jour: d.valide_jusqu_au,
        heure: null,
        titre: `Relancer ${d.client_nom}`,
        detail: `${d.numero ?? "Devis"} · ${formatCurrency(d.total)}`,
        source: "devis",
        classe: urgenceDe(d.valide_jusqu_au) === "retard" ? "app-badge-danger" : "app-badge-info",
        onglet: "devis",
      });
    }
    for (const c of deliveries) {
      if (!c.date_prevue || c.statut === "livree" || c.statut === "echouee") continue;
      l.push({
        id: `liv-${c.id}`,
        jour: c.date_prevue,
        heure: null,
        titre: `Livrer ${c.destinataire}`,
        detail: `${c.numero ?? "Course"} · ${formatCurrency(c.montant_a_encaisser)} à encaisser`,
        source: "livraison",
        classe: "app-badge-neutral",
        onglet: "livraisons",
      });
    }
    return l;
  }, [evenements, purchases, quotes, deliveries]);

  const parJour = useMemo(() => compterParJour(lignes), [lignes]);

  const reculer = () =>
    setCurseur(
      vue === "mois"
        ? ajouterMois(curseur, -1)
        : ajouterJours(curseur, vue === "semaine" ? -7 : -1),
    );
  const avancer = () =>
    setCurseur(
      vue === "mois" ? ajouterMois(curseur, 1) : ajouterJours(curseur, vue === "semaine" ? 7 : 1),
    );

  const intitule =
    vue === "mois"
      ? libelleMois(curseur)
      : vue === "semaine"
        ? libelleSemaine(curseur)
        : libelleJour(curseur);

  const reinitialiser = () => {
    setTitre("");
    setDescription("");
    setLieu("");
    setJour(curseur);
    setHeure("09:00");
    setJourneeEntiere(false);
    setNature("rendez_vous");
    setVisibilite("prive");
    setInvites([]);
    setMessageErreur(null);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim() || enregistrement) return;
    setEnregistrement(true);
    const { error } = await onCreer({
      titre,
      description,
      lieu,
      jour,
      heure,
      journeeEntiere,
      nature,
      visibilite,
      invites: visibilite === "choisis" ? invites : [],
    });
    setEnregistrement(false);
    if (error) {
      setMessageErreur(error);
      return;
    }
    reinitialiser();
    setFormOuvert(false);
  };

  /** Une ligne d'agenda, cliquable. */
  const Ligne: React.FC<{ l: LigneAgenda }> = ({ l }) => (
    <button
      onClick={() => (l.evenement ? setDetail(l) : l.onglet && onNavigateTab(l.onglet))}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <span className="w-11 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
        {l.heure ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{l.titre}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{l.detail}</span>
      </span>
    </button>
  );

  /** Un jour et ce qu'il contient, pour les vues jour et semaine. */
  const SectionJour: React.FC<{ j: string; compact?: boolean }> = ({ j, compact }) => {
    const dedans = lignesDuJour(lignes, j);
    const estAujourdhui = j === aujourdhui;
    if (compact && dedans.length === 0) return null;
    return (
      <div className="app-card">
        <div
          className={`flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5 ${
            estAujourdhui ? "bg-success-soft" : ""
          }`}
        >
          <span
            className={`text-[13px] font-medium ${estAujourdhui ? "text-primary" : "text-foreground"}`}
          >
            {libelleJour(j)}
            {estAujourdhui && " · aujourd'hui"}
          </span>
          <span className="text-xs text-muted-foreground">
            {dedans.length === 0
              ? "rien de prévu"
              : `${dedans.length} ${dedans.length > 1 ? "éléments" : "élément"}`}
          </span>
        </div>
        {dedans.length > 0 && (
          <div className="divide-y divide-border/60">
            {dedans.map((l) => (
              <Ligne key={l.id} l={l} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<CalendarClock className="h-5 w-5 text-primary" />}
        title="Agenda"
        module="agenda"
        subtitle="Vos rendez-vous, et ce que la boutique doit régler."
        actions={
          <button
            onClick={() => {
              reinitialiser();
              setFormOuvert(true);
            }}
            className="app-btn-primary w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Nouvel événement
          </button>
        }
      />

      {/* La barre de parcours : ce qu'on regarde, et de quand. */}
      <div className="app-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={reculer}
            className="app-btn-icon h-9 w-9"
            aria-label="Période précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-0 flex-1 truncate px-2 text-[15px] font-medium text-foreground">
            {intitule}
          </span>
          <button onClick={avancer} className="app-btn-icon h-9 w-9" aria-label="Période suivante">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          {(["jour", "semaine", "mois"] as Vue[]).map((v) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              aria-current={vue === v ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] capitalize transition-colors ${
                vue === v
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
          {curseur !== aujourdhui && (
            <button onClick={() => setCurseur(aujourdhui)} className="app-btn-ghost ml-1 px-2">
              Aujourd&apos;hui
            </button>
          )}
        </div>
      </div>

      {vue === "jour" && <SectionJour j={curseur} />}

      {vue === "semaine" && (
        <div className="space-y-3">
          {semaineDe(curseur).map((j) => (
            <SectionJour key={j} j={j} />
          ))}
        </div>
      )}

      {vue === "mois" && (
        <div className="app-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {JOURS_COURTS.map((j) => (
              <div
                key={j}
                className="py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {j.slice(0, 1)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grilleDuMois(curseur).map((j) => {
              const n = parJour[j] ?? 0;
              const dansLeMois = memeMois(j, curseur);
              const estAujourdhui = j === aujourdhui;
              return (
                <button
                  key={j}
                  onClick={() => {
                    setCurseur(j);
                    setVue("jour");
                  }}
                  className={`flex aspect-square flex-col items-center justify-center gap-0.5 border-b border-r border-border/60 text-xs transition-colors hover:bg-muted active:bg-muted ${
                    dansLeMois ? "text-foreground" : "text-muted-foreground/40"
                  } ${estAujourdhui ? "bg-success-soft font-semibold text-primary" : ""}`}
                >
                  <span className="tabular-nums">{Number(j.slice(8))}</span>
                  {/* Un point, pas un chiffre : à cinquante pixels de
                      côté, le nombre exact ne se lit pas et n'apprend
                      rien qu'un clic ne dise mieux. */}
                  {n > 0 && <span className="h-1 w-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Le détail d'un événement ── */}
      {detail?.evenement && (
        <Modal
          open
          onClose={() => setDetail(null)}
          size="md"
          icon={<CalendarClock className="h-4 w-4" />}
          title={detail.evenement.titre}
          description={libelleJour(detail.jour) + (detail.heure ? ` · ${detail.heure}` : "")}
          footer={
            detail.evenement.createur_id === moiId ? (
              <button
                onClick={async () => {
                  if (!detail.evenement) return;
                  if (window.confirm(`Supprimer « ${detail.evenement.titre} » ?`)) {
                    await onSupprimer(detail.evenement.id);
                    setDetail(null);
                  }
                }}
                className="app-btn-danger"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            ) : undefined
          }
        >
          <dl className="divide-y divide-border">
            {[
              { l: "Nature", v: libelleNature(detail.evenement.nature) },
              {
                l: "Quand",
                v: libelleJour(detail.jour) + (detail.heure ? ` à ${detail.heure}` : ""),
              },
              { l: "Lieu", v: detail.evenement.lieu ?? "" },
              { l: "Visible par", v: libelleVisibilite(detail.evenement.visibilite) },
              { l: "Créé par", v: nomDe(detail.evenement.createur_id) },
              { l: "Précisions", v: detail.evenement.description ?? "" },
            ]
              .filter((x) => x.v)
              .map((x) => (
                <div key={x.l} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-muted-foreground">{x.l}</dt>
                  <dd className="min-w-0 text-right font-medium text-foreground">{x.v}</dd>
                </div>
              ))}
          </dl>
        </Modal>
      )}

      {/* ── Nouvel événement ── */}
      <Modal
        open={formOuvert}
        onClose={() => setFormOuvert(false)}
        size="lg"
        icon={<CalendarClock className="h-4 w-4" />}
        title="Nouvel événement"
        description="Un rendez-vous, une réunion, une date à retenir."
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
              form="evenement-form"
              disabled={enregistrement}
              className="app-btn-primary"
            >
              <Save className="h-4 w-4" />
              {enregistrement ? "Enregistrement…" : "Créer l'événement"}
            </button>
          </>
        }
      >
        <form id="evenement-form" onSubmit={enregistrer} className="space-y-4">
          <label className="block">
            <span className="app-label">De quoi s&apos;agit-il</span>
            <input
              className="app-field"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Rendez-vous avec Rakoto"
              autoFocus
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="app-label">Le</span>
              <input
                type="date"
                className="app-field"
                value={jour}
                onChange={(e) => setJour(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="app-label">À</span>
              <input
                type="time"
                className="app-field"
                value={heure}
                disabled={journeeEntiere}
                onChange={(e) => setHeure(e.target.value)}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={journeeEntiere}
              onChange={(e) => setJourneeEntiere(e.target.checked)}
            />
            Toute la journée
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="app-label">Nature</span>
              <select
                className="app-field"
                value={nature}
                onChange={(e) => setNature(e.target.value as NatureEvenement)}
              >
                {NATURES.map((n) => (
                  <option key={n.valeur} value={n.valeur}>
                    {n.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="app-label">Lieu</span>
              <input
                className="app-field"
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                placeholder="Facultatif"
              />
            </label>
          </div>

          <label className="block">
            <span className="app-label">Précisions</span>
            <textarea
              className="app-field"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Facultatif"
            />
          </label>

          {/* ── Qui le voit ──
              Le choix par défaut est « privé ». Un agenda dont les
              rendez-vous seraient partagés par défaut n'en serait plus
              un : on y note aussi le médecin et l'école. */}
          <fieldset className="space-y-2">
            <legend className="app-label">
              <Users className="mr-1 inline h-3.5 w-3.5" />
              Qui le voit
            </legend>
            {VISIBILITES.map((v) => (
              <label
                key={v.valeur}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm has-[:checked]:border-primary"
              >
                <input
                  type="radio"
                  name="visibilite"
                  className="mt-0.5"
                  checked={visibilite === v.valeur}
                  onChange={() => setVisibilite(v.valeur)}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{v.libelle}</span>
                  <span className="block text-xs text-muted-foreground">{v.aide}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {visibilite === "choisis" && (
            <div className="space-y-1.5">
              {membres.filter((m) => m.user_id !== moiId).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Vous n&apos;avez pas encore de collaborateur à qui le partager.
                </p>
              ) : (
                membres
                  .filter((m) => m.user_id !== moiId)
                  .map((m) => (
                    <label key={m.user_id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={invites.includes(m.user_id)}
                        onChange={(e) =>
                          setInvites((l) =>
                            e.target.checked ? [...l, m.user_id] : l.filter((x) => x !== m.user_id),
                          )
                        }
                      />
                      {m.full_name?.trim() || m.email}
                    </label>
                  ))
              )}
            </div>
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
