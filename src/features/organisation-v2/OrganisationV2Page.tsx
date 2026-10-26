import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./organisation.css";
import type { Purchase } from "../../types";
import type { PermissionsMap } from "../../lib/permissions";
import type { DelaisRappel } from "../../lib/rappels";
import { estEnRetard } from "../../lib/taches";
import {
  Contexte,
  type ContexteOrganisation,
  type OngletOrg,
  type Panneau,
  type Portee,
} from "./contexte";
import { useOrganisationPermissions } from "./hooks/useOrganisationPermissions";
import { useActionsTaches, type SourceTaches } from "./hooks/useTaches";
import { useActionsEvenements, type SourceEvenements } from "./hooks/useEvenements";
import { useActionsRappels, type SourceRappels } from "./hooks/useRappels";
import { useEcheances, type DevisEcheance, type LivraisonEcheance } from "./hooks/useEcheances";
import { useActivite } from "./hooks/useActivite";
import { nomDe, type Membre } from "./lib/personnes";
import {
  ajouterJours,
  dateDuJour,
  heureMinute,
  JOURS_LONGS,
  majuscule,
  MOIS_LONGS,
} from "./lib/dates";
import { elementsEntre } from "./lib/elements";
import { Toast, type MessageToast } from "./components/elements";
import {
  IcActualiser,
  IcAgenda,
  IcChevron,
  IcCloche,
  IcPersonne,
  IcPlus,
  IcTache,
} from "./components/icones";
import { Panneaux } from "./components/Panneaux";
import { ApercuTab } from "./tabs/ApercuTab";
import { TachesTab } from "./tabs/TachesTab";
import { AgendaTab } from "./tabs/AgendaTab";
import { RappelsTab } from "./tabs/RappelsTab";

/**
 * ORGANISATION v2 — la page à quatre onglets de
 * `docs/maquette/organisation.html`.
 *
 * Elle REMPLACE, derrière le drapeau `organisation_v2`, les quatre
 * écrans du groupe « Organisation » du menu (Vue d'ensemble, Tâches,
 * Agenda, Rappels) : chaque entrée du menu ouvre la page sur l'onglet
 * correspondant, et changer d'onglet change d'entrée de menu.
 *
 * Elle ne charge rien elle-même : les tâches, les événements et les
 * rappels viennent des hooks que l'application a déjà ouverts (ceux
 * que partagent le tableau de bord et la cloche), et les échéances de
 * données déjà chargées. Seul le fil d'activité lit une table de plus,
 * en lecture seule. Toutes les écritures passent par les fonctions de
 * ces mêmes hooks — voir `hooks/useTaches.ts`, `useEvenements.ts`,
 * `useRappels.ts` de ce dossier.
 */

const LIBELLES: Record<OngletOrg, string> = {
  apercu: "Vue d'ensemble",
  taches: "Tâches",
  agenda: "Agenda",
  rappels: "Rappels",
};

const ACCROCHES: Record<OngletOrg, string> = {
  apercu: "Ce que l'équipe doit faire, ce qui est prévu, et ce qu'on doit vous redire.",
  taches: "Ce que l'équipe doit faire, et où ça en est.",
  agenda: "Vos rendez-vous, et ce que la boutique doit régler.",
  rappels: "Ce que vous voulez qu'on vous redise, et quand.",
};

export interface OrganisationV2Props {
  onglet: OngletOrg;
  /** Les onglets que le menu montre à cette personne, dans l'ordre de la maquette. */
  onglets: OngletOrg[];
  onChangerOnglet: (o: OngletOrg) => void;
  storeId: string | null;
  moiId: string | null;
  membres: Membre[];
  /** `null` pour le propriétaire, qui a tous les droits. */
  permissions: PermissionsMap | null;
  taches: SourceTaches;
  evenements: SourceEvenements;
  rappels: SourceRappels;
  purchases: Purchase[];
  quotes: DevisEcheance[];
  deliveries: LivraisonEcheance[];
  delaisRappel: DelaisRappel;
  /** Ouvre un autre écran de l'application (Achats, Devis, Paramètres…). */
  onNaviguer: (vue: string) => void;
}

export const OrganisationV2Page: React.FC<OrganisationV2Props> = (props) => {
  const { onglet, onglets, onChangerOnglet, moiId, membres } = props;
  const droits = useOrganisationPermissions(props.permissions);

  // L'heure avance : « maintenant » se rafraîchit chaque minute, et le
  // jour change à minuit sans recharger la page.
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setMaintenant(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const aujourdhui = dateDuJour(maintenant);

  // ── portée : « Toute l'équipe » ou « Ce qui m'est assigné » ──
  // Par défaut, celle que les droits donnent : toute l'équipe pour qui la
  // voit, ses propres tâches pour les autres.
  const [portee, setPortee] = useState<Portee>(droits.voitTouteLEquipe ? "equipe" : "moi");

  // Le jour choisi dans l agenda vit ici : « Ouvrir dans l agenda » et
  // « + Événement » en ont besoin hors de l onglet Agenda.
  const [jourAgenda, setJourAgenda] = useState(aujourdhui);

  // ── message de confirmation ──
  const [message, setMessage] = useState<MessageToast | null>(null);
  const dire = useCallback((texte: string, erreur?: boolean) => {
    setMessage({ id: Date.now(), texte, erreur });
  }, []);

  // ── panneau latéral ──
  const [panneau, setPanneau] = useState<Panneau | null>(null);
  const ouvrir = useCallback((p: Panneau) => setPanneau(p), []);
  const fermer = useCallback(() => setPanneau(null), []);

  const actionsTaches = useActionsTaches(props.taches, droits, dire);
  const actionsEvenements = useActionsEvenements(props.evenements, droits, dire);
  const actionsRappels = useActionsRappels(props.rappels, droits, dire);
  const echeances = useEcheances(props.purchases, props.quotes, props.deliveries, droits);
  const activite = useActivite(props.storeId, droits.voitTaches);

  const nom = useCallback((id: string | null) => nomDe(id, membres, moiId), [membres, moiId]);

  const taches = useMemo(
    () => (droits.voitTaches ? props.taches.taches : []),
    [droits.voitTaches, props.taches.taches],
  );
  const tachesPortee = useMemo(
    () => (portee === "moi" ? taches.filter((t) => t.assignee_id === moiId) : taches),
    [taches, portee, moiId],
  );
  const evenements = useMemo(
    () => (droits.voitAgenda ? props.evenements.evenements : []),
    [droits.voitAgenda, props.evenements.evenements],
  );
  const rappels = useMemo(
    () => (droits.voitRappels ? props.rappels.rappels : []),
    [droits.voitRappels, props.rappels.rappels],
  );
  const rappelsPortee = useMemo(
    () => (portee === "moi" ? rappels.filter((r) => r.destinataire_id === moiId) : rappels),
    [rappels, portee, moiId],
  );

  const sources = useMemo(
    () => ({
      taches: tachesPortee,
      evenements,
      rappels: rappelsPortee,
      echeances,
      aujourdhui,
      nomDe: nom,
    }),
    [tachesPortee, evenements, rappelsPortee, echeances, aujourdhui, nom],
  );

  // ── fraîcheur ──
  const [majA, setMajA] = useState(() => heureMinute(new Date()));
  const [tourne, setTourne] = useState(false);
  const actualiser = useCallback(async () => {
    setTourne(true);
    await Promise.all([
      props.taches.recharger(),
      props.evenements.recharger(),
      props.rappels.recharger(),
      activite.recharger(),
    ]);
    setMajA(heureMinute(new Date()));
    setMaintenant(new Date());
    window.setTimeout(() => setTourne(false), 700);
  }, [props.taches, props.evenements, props.rappels, activite]);

  const allerA = useCallback(
    (o: OngletOrg) => {
      if (onglets.includes(o)) onChangerOnglet(o);
    },
    [onglets, onChangerOnglet],
  );

  const valeur: ContexteOrganisation = {
    moiId,
    membres,
    droits,
    aujourdhui,
    maintenant,
    nom,
    portee,
    setPortee,
    jourAgenda,
    setJourAgenda,
    taches,
    tachesPortee,
    evenements,
    rappels,
    rappelsPortee,
    echeances,
    sources,
    chargement: {
      taches: props.taches.chargement,
      evenements: props.evenements.chargement,
      rappels: props.rappels.chargement,
    },
    erreurs: {
      taches: props.taches.erreur,
      evenements: props.evenements.erreur,
      rappels: props.rappels.erreur,
    },
    actionsTaches,
    actionsEvenements,
    actionsRappels,
    activite: { lignes: activite.lignes, erreur: activite.erreur, charge: activite.charge },
    delaisRappel: props.delaisRappel,
    ouvrir,
    fermer,
    allerA,
    naviguer: props.onNaviguer,
    dire,
  };

  // ── pastilles des onglets ──
  const ouvertes = tachesPortee.filter((t) => t.statut !== "termine");
  const enRetard = ouvertes.filter((t) => estEnRetard(t, aujourdhui)).length;
  const aVenir = elementsEntre(aujourdhui, ajouterJours(aujourdhui, 6), sources).filter(
    (i) => i.type === "rdv" || i.type === "echeance",
  ).length;
  const rappelsActifs = rappelsPortee.filter((r) => r.actif).length;
  const pastille: Partial<Record<OngletOrg, { n: number; crit?: boolean }>> = {
    taches: { n: ouvertes.length, crit: enRetard > 0 },
    agenda: { n: aVenir },
    rappels: { n: rappelsActifs },
  };

  // ── menus de l'en-tête ──
  const [menu, setMenu] = useState<"portee" | "nouveau" | null>(null);
  const outils = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const dehors = (e: MouseEvent) => {
      if (outils.current && !outils.current.contains(e.target as Node)) setMenu(null);
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [menu]);

  const nouveaux = [
    droits.creerTache && { quoi: "tache" as const, libelle: "Nouvelle tâche", Ic: IcTache },
    droits.creerEvenement && {
      quoi: "evenement" as const,
      libelle: "Nouvel événement",
      Ic: IcAgenda,
    },
    droits.creerRappel && { quoi: "rappel" as const, libelle: "Nouveau rappel", Ic: IcCloche },
  ].filter(Boolean) as { quoi: "tache" | "evenement" | "rappel"; libelle: string; Ic: React.FC }[];

  const dateDuJourLongue = majuscule(
    `${JOURS_LONGS[maintenant.getDay()]} ${maintenant.getDate()} ${MOIS_LONGS[maintenant.getMonth()]} ${maintenant.getFullYear()}`,
  );

  return (
    <Contexte.Provider value={valeur}>
      <div className="org2">
        <div className="wrap">
          <nav className="tabs" role="tablist" aria-label="Sections de l'organisation">
            {onglets.map((o) => (
              <button
                key={o}
                role="tab"
                type="button"
                id={`org2-tab-${o}`}
                aria-controls={`org2-pane-${o}`}
                aria-selected={onglet === o}
                onClick={() => onChangerOnglet(o)}
              >
                {LIBELLES[o]}
                {pastille[o] && (
                  <span className={`n${pastille[o]?.crit ? " crit" : ""}`}>{pastille[o]?.n}</span>
                )}
              </button>
            ))}
          </nav>

          <header className="top app-page-head">
            <div className="app-page-head-text">
              <span className="app-page-icon" aria-hidden="true">
                <IcTache />
              </span>
              <div className="min-w-0">
                <h1 className="app-page-title">Organisation</h1>
                <p className="app-page-subtitle">{ACCROCHES[onglet]}</p>
              </div>
            </div>
            <div className="tools" ref={outils}>
              <button
                className={`mini fresh-btn${tourne ? " spin" : ""}`}
                type="button"
                aria-label="Actualiser"
                title={`${dateDuJourLongue} · mis à jour à ${majA}`}
                onClick={actualiser}
              >
                <IcActualiser />
              </button>
              {droits.voitTaches && (
                <div className="menu-wrap">
                  <button
                    className="pill"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={menu === "portee"}
                    onClick={() => setMenu(menu === "portee" ? null : "portee")}
                  >
                    <IcPersonne />
                    <b>{portee === "moi" ? "Ce qui m'est assigné" : "Toute l'équipe"}</b>
                    <IcChevron />
                  </button>
                  {menu === "portee" && (
                    <div className="menu" role="menu">
                      {(
                        [
                          ["equipe", "Toute l'équipe"],
                          ["moi", "Ce qui m'est assigné"],
                        ] as const
                      ).map(([p, libelle]) => (
                        <button
                          key={p}
                          className="opt"
                          type="button"
                          role="menuitemradio"
                          aria-checked={portee === p}
                          onClick={() => {
                            setPortee(p);
                            setMenu(null);
                          }}
                        >
                          {libelle}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {nouveaux.length > 0 && (
                <div className="menu-wrap">
                  <button
                    className="btn"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={menu === "nouveau"}
                    onClick={() => setMenu(menu === "nouveau" ? null : "nouveau")}
                  >
                    <IcPlus />
                    Nouveau
                  </button>
                  {menu === "nouveau" && (
                    <div className="menu" role="menu">
                      {nouveaux.map(({ quoi, libelle, Ic }) => (
                        <button
                          key={quoi}
                          className="opt"
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenu(null);
                            ouvrir({ kind: "nouveau", quoi });
                          }}
                        >
                          <Ic />
                          {libelle}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          <section
            className="pane"
            id={`org2-pane-${onglet}`}
            role="tabpanel"
            aria-labelledby={`org2-tab-${onglet}`}
          >
            {onglet === "apercu" && <ApercuTab />}
            {onglet === "taches" && <TachesTab />}
            {onglet === "agenda" && <AgendaTab />}
            {onglet === "rappels" && <RappelsTab />}
          </section>
        </div>
      </div>
      <Panneaux panneau={panneau} />
      <Toast message={message} />
    </Contexte.Provider>
  );
};

export default OrganisationV2Page;
