import React, { useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { dateDuJour, dateDansNJours } from "../lib/dates";
import {
  estEnRetard,
  libelleEcheance,
  libellePriorite,
  trierTaches,
  type Tache,
} from "../lib/taches";
import {
  heureDe,
  jourDe,
  libelleJour,
  libelleNature,
  type Evenement,
  type LigneAgenda,
} from "../lib/evenements";

interface Membre {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface VueEquipeViewProps {
  taches: Tache[];
  evenements: Evenement[];
  /** Les trois échéances que le métier porte déjà, déjà mises en forme. */
  echeances: LigneAgenda[];
  membres: Membre[];
  moiId: string | null;
  onNavigateTab: (tab: string) => void;
}

/**
 * La vue d'ensemble du responsable.
 *
 * ── Ce qu'elle est, et ce qu'elle n'est pas ──
 *
 * Elle n'ouvre AUCUNE donnée nouvelle. Elle range autrement ce que les
 * permissions ont déjà laissé passer : les tâches que la portée accorde,
 * les événements que leur visibilité autorise, les échéances que le
 * métier porte. Si la base n'a rien rendu, l'écran est vide — il n'a
 * aucun moyen d'aller chercher plus loin, et c'est voulu.
 *
 * Conséquence directe, et il faut la connaître : les rendez-vous privés
 * des collaborateurs n'y figurent pas. Un responsable voit les réunions
 * et les rendez-vous partagés avec l'équipe, jamais l'agenda personnel
 * de ses vendeurs. Le mot « privé » vaut pour tout le monde.
 *
 * ── L'ordre de lecture ──
 *
 * Ce qui brûle d'abord — le retard —, puis le jour, puis la semaine, et
 * enfin qui porte quoi. C'est l'ordre dans lequel on se pose les
 * questions en ouvrant sa boutique le matin : qu'est-ce qui a dérapé,
 * qu'est-ce qui m'attend aujourd'hui, à quoi me préparer, et qui est
 * chargé.
 */
export const VueEquipeView: React.FC<VueEquipeViewProps> = ({
  taches,
  evenements,
  echeances,
  membres,
  moiId,
  onNavigateTab,
}) => {
  const aujourdhui = dateDuJour();
  const dansUneSemaine = dateDansNJours(7);

  const nomDe = (id: string | null): string => {
    if (!id) return "Personne";
    if (id === moiId) return "Vous";
    const m = membres.find((x) => x.user_id === id);
    return m ? m.full_name?.trim() || m.email : "—";
  };

  const ouvertes = useMemo(() => taches.filter((t) => t.statut !== "termine"), [taches]);
  const enRetard = useMemo(
    () =>
      trierTaches(
        ouvertes.filter((t) => estEnRetard(t, aujourdhui)),
        aujourdhui,
      ),
    [ouvertes, aujourdhui],
  );
  const duJour = useMemo(
    () =>
      trierTaches(
        ouvertes.filter((t) => t.echeance === aujourdhui),
        aujourdhui,
      ),
    [ouvertes, aujourdhui],
  );

  /** Rendez-vous, réunions et échéances des sept prochains jours. */
  const aVenir = useMemo(() => {
    const lignes: {
      id: string;
      jour: string;
      heure: string | null;
      titre: string;
      detail: string;
      onglet: string;
    }[] = [];
    for (const e of evenements) {
      const j = jourDe(e.debut);
      if (j < aujourdhui || j > dansUneSemaine) continue;
      lignes.push({
        id: `ev-${e.id}`,
        jour: j,
        heure: e.journee_entiere ? null : heureDe(e.debut),
        titre: e.titre,
        detail: [libelleNature(e.nature), e.lieu, nomDe(e.createur_id)].filter(Boolean).join(" · "),
        onglet: "agenda",
      });
    }
    for (const ec of echeances) {
      if (ec.jour < aujourdhui || ec.jour > dansUneSemaine) continue;
      lignes.push({
        id: ec.id,
        jour: ec.jour,
        heure: null,
        titre: ec.titre,
        detail: ec.detail,
        onglet: ec.onglet ?? "dashboard",
      });
    }
    return lignes.sort((a, b) =>
      a.jour === b.jour ? ((a.heure ?? "") < (b.heure ?? "") ? -1 : 1) : a.jour < b.jour ? -1 : 1,
    );
  }, [evenements, echeances, aujourdhui, dansUneSemaine, membres, moiId]);

  /**
   * Qui porte quoi.
   *
   * Les membres sans aucune tâche restent dans la liste, avec un zéro
   * explicite : c'est précisément l'information qu'on vient chercher —
   * savoir qui est disponible vaut autant que savoir qui est chargé.
   * Une ligne manquante ferait croire que la personne n'existe pas.
   */
  const repartition = useMemo(() => {
    const parPersonne = new Map<string, { aFaire: number; enCours: number; retard: number }>();
    const initial = () => ({ aFaire: 0, enCours: 0, retard: 0 });
    for (const m of membres) parPersonne.set(m.user_id, initial());
    if (moiId && !parPersonne.has(moiId)) parPersonne.set(moiId, initial());

    for (const t of ouvertes) {
      const cle = t.assignee_id ?? "sans";
      if (!parPersonne.has(cle)) parPersonne.set(cle, initial());
      const c = parPersonne.get(cle)!;
      if (t.statut === "a_faire") c.aFaire += 1;
      if (t.statut === "en_cours") c.enCours += 1;
      if (estEnRetard(t, aujourdhui)) c.retard += 1;
    }
    return [...parPersonne.entries()]
      .map(([id, c]) => ({ id, nom: id === "sans" ? "Non attribuées" : nomDe(id), ...c }))
      .sort((a, b) => b.retard - a.retard || b.aFaire + b.enCours - (a.aFaire + a.enCours));
  }, [ouvertes, membres, moiId, aujourdhui]);

  /** Une section, avec son titre et son compte. */
  const Section: React.FC<{
    titre: string;
    compte: number;
    vide: string;
    children: React.ReactNode;
  }> = ({ titre, compte, vide, children }) => (
    <div className="app-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
          {titre}
        </span>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">{compte}</span>
      </div>
      {compte === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{vide}</p>
      ) : (
        <div className="divide-y divide-border/60">{children}</div>
      )}
    </div>
  );

  const LigneTache: React.FC<{ t: Tache; retard?: boolean }> = ({ t, retard }) => (
    <button
      onClick={() => onNavigateTab("taches")}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{t.titre}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[nomDe(t.assignee_id), libelleEcheance(t.echeance, aujourdhui)].join(" · ")}
        </span>
      </span>
      {retard ? (
        <span className="app-badge-danger shrink-0">En retard</span>
      ) : t.priorite === "urgente" || t.priorite === "haute" ? (
        <span className="app-badge-warning shrink-0">{libellePriorite(t.priorite)}</span>
      ) : null}
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5 text-primary" />}
        title="Vue d'ensemble"
        module="vue_equipe"
        subtitle="Ce que l'équipe doit faire, et ce qui vient."
        // L'indicateur donne le total, jamais le retard : la première
        // section l'annonce déjà juste en dessous, et le même chiffre
        // écrit deux fois à trois centimètres d'intervalle fait douter
        // qu'il s'agisse du même.
        metric={
          <HeaderMetric
            label="En cours"
            value={String(ouvertes.length)}
            tone={enRetard.length > 0 ? "danger" : "neutral"}
          />
        }
      />

      <Section titre="En retard" compte={enRetard.length} vide="Rien en retard dans l'équipe.">
        {enRetard.slice(0, 10).map((t) => (
          <LigneTache key={t.id} t={t} retard />
        ))}
      </Section>

      <Section titre="Pour aujourd'hui" compte={duJour.length} vide="Rien à boucler aujourd'hui.">
        {duJour.slice(0, 10).map((t) => (
          <LigneTache key={t.id} t={t} />
        ))}
      </Section>

      <Section
        titre="Les sept prochains jours"
        compte={aVenir.length}
        vide="Aucun rendez-vous ni échéance cette semaine."
      >
        {aVenir.slice(0, 15).map((l) => (
          <button
            key={l.id}
            onClick={() => onNavigateTab(l.onglet)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
          >
            <span className="w-11 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
              {l.heure ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{l.titre}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {libelleJour(l.jour)} · {l.detail}
              </span>
            </span>
          </button>
        ))}
      </Section>

      <div className="app-card">
        <div className="border-b border-border px-4 py-2.5">
          <span className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
            Qui porte quoi
          </span>
        </div>
        <div className="divide-y divide-border/60">
          {repartition.map((p) => (
            <div key={p.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {p.nom}
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                {p.aFaire + p.enCours === 0 ? (
                  "rien en cours"
                ) : (
                  <>
                    <span className="font-mono tabular-nums text-foreground">
                      {p.aFaire + p.enCours}
                    </span>{" "}
                    en cours
                    {p.retard > 0 && (
                      <>
                        {" · "}
                        <span className="font-mono tabular-nums t-danger">{p.retard}</span>{" "}
                        <span className="t-danger">en retard</span>
                      </>
                    )}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Les rendez-vous marqués privés n&apos;apparaissent pas ici, même pour un responsable. Seuls
        ceux partagés avec l&apos;équipe y figurent.
      </p>
    </div>
  );
};
