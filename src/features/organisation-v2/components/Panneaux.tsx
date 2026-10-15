import React, { useEffect, useMemo, useState } from "react";
import { estEnRetard, libellePriorite, PRIORITES, type PrioriteTache } from "../../../lib/taches";
import {
  heureDe,
  jourDe,
  libelleNature,
  libelleVisibilite,
  NATURES,
  type NatureEvenement,
} from "../../../lib/evenements";
import {
  JOURS_SEMAINE,
  libelleQuand,
  prochaineOccurrence,
  RECURRENCES,
  type Recurrence,
} from "../../../lib/rappels";
import { useOrg, type Panneau } from "../contexte";
import { historiqueDe } from "../lib/activite";
import { dateCourte, dateLongue, heureMinute, jourLocal, majuscule, relatif } from "../lib/dates";
import { Drawer, DrawerCorps, DrawerPied, DrawerTete } from "./Drawer";
import { Avatar, EtatVide } from "./elements";

/**
 * LE CONTENU DU PANNEAU LATÉRAL, partagé par les quatre onglets.
 *
 * Fiches (tâche, événement, rappel, échéances, réglages) et formulaires
 * de création. Les boutons ÉCRIVENT par les actions du contexte, qui
 * passent par les fonctions existantes de l'application ; le panneau
 * ne se ferme qu'une fois la base d'accord. Ouvrir ou lire une fiche
 * n'écrit jamais rien.
 */
export const Panneaux: React.FC<{ panneau: Panneau | null }> = ({ panneau }) => {
  const { fermer } = useOrg();
  // Le contenu reste affiché pendant l'animation de fermeture.
  const [dernier, setDernier] = useState<Panneau | null>(panneau);
  useEffect(() => {
    if (panneau) setDernier(panneau);
  }, [panneau]);
  const p = panneau ?? dernier;
  return (
    <Drawer open={!!panneau} onClose={fermer}>
      {p && <Contenu p={p} />}
    </Drawer>
  );
};

const Contenu: React.FC<{ p: Panneau }> = ({ p }) => {
  switch (p.kind) {
    case "tache":
      return <FicheTache id={p.id} />;
    case "actions":
      return <ActionsTache id={p.id} />;
    case "evenement":
      return <FicheEvenement id={p.id} />;
    case "rappel":
      return <FicheRappel id={p.id} />;
    case "echeances":
      return <ListeEcheances ids={p.ids} />;
    case "params":
      return <Reglages />;
    case "nouveau":
      if (p.quoi === "tache") return <NouvelleTache />;
      if (p.quoi === "evenement") return <NouvelEvenement jour={p.jour} />;
      return <NouveauRappel />;
  }
};

/** La fiche d'un élément qui a disparu entre-temps (supprimé ailleurs). */
const Introuvable: React.FC = () => {
  const { fermer } = useOrg();
  return (
    <>
      <DrawerTete titre="Introuvable" onClose={fermer} />
      <DrawerCorps>
        <p className="none">Cet élément n'existe plus ou ne vous est plus visible.</p>
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Fermer
        </button>
      </DrawerPied>
    </>
  );
};

/* ─────────────────────────────── tâches ─────────────────────────────── */

const FicheTache: React.FC<{ id: string }> = ({ id }) => {
  const { taches, aujourdhui, nom, moiId, droits, actionsTaches, activite, fermer } = useOrg();
  const t = taches.find((x) => x.id === id);
  if (!t) return <Introuvable />;

  const fini = t.statut === "termine";
  const etat = fini ? (
    <span className="tag ok">terminée</span>
  ) : estEnRetard(t, aujourdhui) ? (
    <span className="tag crit">en retard</span>
  ) : t.statut === "en_cours" ? (
    <span className="tag warn">en cours</span>
  ) : (
    <span className="tag grey">à faire</span>
  );
  const qui = nom(t.assignee_id);

  // L'historique vient du journal d'activité quand il est lisible ; à
  // défaut, de ce que la ligne elle-même sait (création, date de fin).
  const journal = activite.lignes
    .filter((l) => l.entite_id === t.id)
    .sort((a, b) => a.cree_le.localeCompare(b.cree_le));
  const historique = journal.length
    ? journal.map((l) => ({
        cle: String(l.id),
        texte: historiqueDe(l, nom),
        quand: dateCourte(jourDe(l.cree_le)),
      }))
    : [
        {
          cle: "creation",
          texte: `Créée par ${nom(t.createur_id)}`,
          quand: dateCourte(jourDe(t.created_at)),
        },
        ...(t.termine_le
          ? [{ cle: "fin", texte: "Terminée", quand: dateCourte(jourDe(t.termine_le)) }]
          : []),
      ];

  const occupe = actionsTaches.occupe !== null;
  const terminer = async () => {
    if (await actionsTaches.terminer(t.id)) fermer();
  };
  const reporter = async () => {
    if (await actionsTaches.reporterADemain(t.id)) fermer();
  };

  return (
    <>
      <DrawerTete
        titre={t.titre}
        sous={`${t.numero ?? "Tâche"} · créée le ${dateCourte(jourDe(t.created_at))}`}
        onClose={fermer}
      />
      <DrawerCorps>
        <dl className="kv">
          <dt>État</dt>
          <dd>{etat}</dd>
          <dt>Assignée à</dt>
          <dd>
            <span className="personne">
              <Avatar id={t.assignee_id} nom={qui} moiId={moiId} taille="sm" />
              {qui}
            </span>
          </dd>
          <dt>Échéance</dt>
          <dd>
            {t.echeance
              ? `${dateLongue(t.echeance)} · ${relatif(t.echeance, aujourdhui)}`
              : "aucune"}
          </dd>
          <dt>Priorité</dt>
          <dd>{libellePriorite(t.priorite).toLowerCase()}</dd>
        </dl>
        {t.description && <p className="texte">{t.description}</p>}
        <div className="sub">Historique</div>
        <div className="rows">
          {historique.map((h) => (
            <div className="row" key={h.cle}>
              <span />
              <div className="rtxt">
                <span className="title">{h.texte}</span>
                <span className="meta">{h.quand}</span>
              </div>
              <span />
            </div>
          ))}
        </div>
      </DrawerCorps>
      <DrawerPied>
        {fini || !droits.modifierTache ? (
          <button className="btn ghost" type="button" onClick={fermer}>
            Fermer
          </button>
        ) : (
          <>
            <button className="btn ghost" type="button" disabled={occupe} onClick={reporter}>
              Reporter à demain
            </button>
            <button className="btn" type="button" disabled={occupe} onClick={terminer}>
              Marquer terminée
            </button>
          </>
        )}
      </DrawerPied>
    </>
  );
};

/** Les personnes qu'on peut choisir : soi d'abord, puis l'équipe. */
const useChoixPersonnes = () => {
  const { membres, moiId } = useOrg();
  return useMemo(() => {
    const autres = membres
      .filter((m) => m.user_id !== moiId)
      .map((m) => ({ id: m.user_id, nom: m.full_name?.trim() || m.email }));
    return moiId ? [{ id: moiId, nom: "Vous" }, ...autres] : autres;
  }, [membres, moiId]);
};

const ActionsTache: React.FC<{ id: string }> = ({ id }) => {
  const { taches, nom, moiId, droits, actionsTaches, fermer } = useOrg();
  const personnes = useChoixPersonnes();
  const t = taches.find((x) => x.id === id);
  if (!t) return <Introuvable />;
  const occupe = actionsTaches.occupe !== null;
  const apres = (ok: boolean) => ok && fermer();

  return (
    <>
      <DrawerTete titre={t.titre} sous="Actions rapides" onClose={fermer} />
      <DrawerCorps>
        <div className="rows">
          {droits.modifierTache && (
            <>
              <button
                className="row"
                type="button"
                disabled={occupe}
                onClick={async () => apres(await actionsTaches.terminer(t.id))}
              >
                <span />
                <span className="rtxt">
                  <span className="title">Marquer terminée</span>
                </span>
                <span />
              </button>
              <button
                className="row"
                type="button"
                disabled={occupe}
                onClick={async () => apres(await actionsTaches.reporterADemain(t.id))}
              >
                <span />
                <span className="rtxt">
                  <span className="title">Reporter à demain</span>
                </span>
                <span />
              </button>
            </>
          )}
        </div>
        {droits.attribuerTache && personnes.length > 1 && (
          <>
            <div className="sub">Réassigner · actuellement {nom(t.assignee_id)}</div>
            <div className="rows">
              {personnes
                .filter((pers) => pers.id !== t.assignee_id)
                .map((pers) => (
                  <button
                    key={pers.id}
                    className="row"
                    type="button"
                    disabled={occupe}
                    onClick={async () =>
                      apres(await actionsTaches.reassigner(t.id, pers.id, pers.nom))
                    }
                  >
                    <Avatar id={pers.id} nom={pers.nom} moiId={moiId} taille="sm" />
                    <span className="rtxt">
                      <span className="title">{pers.nom}</span>
                    </span>
                    <span />
                  </button>
                ))}
            </div>
          </>
        )}
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Fermer
        </button>
      </DrawerPied>
    </>
  );
};

/** Un message d'erreur de saisie, sous le formulaire. */
const ErreurSaisie: React.FC<{ texte: string | null }> = ({ texte }) =>
  texte ? (
    <p className="erreur" role="alert">
      {texte}
    </p>
  ) : null;

const ID_FORMULAIRE = "org2-formulaire";

const NouvelleTache: React.FC = () => {
  const { aujourdhui, droits, actionsTaches, moiId, fermer } = useOrg();
  const personnes = useChoixPersonnes();
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [echeance, setEcheance] = useState(aujourdhui);
  const [priorite, setPriorite] = useState<PrioriteTache>("moyenne");
  const [assignee, setAssignee] = useState(moiId ?? "");
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) {
      setErreur("Donnez un titre à la tâche.");
      return;
    }
    setErreur(null);
    const ok = await actionsTaches.creer({
      titre,
      description,
      echeance: echeance || null,
      priorite,
      assigneeId: droits.attribuerTache && assignee ? assignee : null,
    });
    if (ok) fermer();
  };

  return (
    <>
      <DrawerTete
        titre="Nouvelle tâche"
        sous="Elle apparaîtra dans la liste et dans l'agenda"
        onClose={fermer}
      />
      <DrawerCorps>
        <form id={ID_FORMULAIRE} className="form" onSubmit={envoyer} noValidate>
          <label className="field">
            Titre
            <input
              type="text"
              placeholder="Ex. Relancer le fournisseur"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            Description
            <textarea
              rows={3}
              placeholder="Facultatif"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="two">
            <label className="field">
              Échéance
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
            </label>
            <label className="field">
              Priorité
              <select
                value={priorite}
                onChange={(e) => setPriorite(e.target.value as PrioriteTache)}
              >
                {PRIORITES.map((p) => (
                  <option key={p.valeur} value={p.valeur}>
                    {p.libelle.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {droits.attribuerTache && personnes.length > 1 && (
            <label className="field">
              Assignée à
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                {personnes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ErreurSaisie texte={erreur} />
        </form>
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Annuler
        </button>
        <button
          className="btn"
          type="submit"
          form={ID_FORMULAIRE}
          disabled={actionsTaches.occupe !== null}
        >
          Créer la tâche
        </button>
      </DrawerPied>
    </>
  );
};

/* ───────────────────────────── événements ───────────────────────────── */

const FicheEvenement: React.FC<{ id: string }> = ({ id }) => {
  const { evenements, fermer, allerA, setJourAgenda, nom } = useOrg();
  const e = evenements.find((x) => x.id === id);
  if (!e) return <Introuvable />;
  const jour = jourDe(e.debut);
  return (
    <>
      <DrawerTete titre={e.titre} sous={majuscule(dateLongue(jour))} onClose={fermer} />
      <DrawerCorps>
        <dl className="kv">
          <dt>Quand</dt>
          <dd>
            {e.journee_entiere
              ? "Toute la journée"
              : `${heureDe(e.debut)}${e.fin ? ` → ${heureDe(e.fin)}` : ""}`}
          </dd>
          <dt>Où</dt>
          <dd>{e.lieu || "—"}</dd>
          <dt>Nature</dt>
          <dd>{libelleNature(e.nature).toLowerCase()}</dd>
          <dt>Visibilité</dt>
          <dd>{libelleVisibilite(e.visibilite)}</dd>
          <dt>Créé par</dt>
          <dd>{nom(e.createur_id)}</dd>
        </dl>
        {e.description && <p className="texte">{e.description}</p>}
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Fermer
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setJourAgenda(jour);
            allerA("agenda");
            fermer();
          }}
        >
          Ouvrir dans l'agenda
        </button>
      </DrawerPied>
    </>
  );
};

const NouvelEvenement: React.FC<{ jour?: string }> = ({ jour }) => {
  const { jourAgenda, actionsEvenements, fermer } = useOrg();
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(jour ?? jourAgenda);
  const [heure, setHeure] = useState("10:00");
  const [journee, setJournee] = useState(false);
  const [lieu, setLieu] = useState("");
  const [nature, setNature] = useState<NatureEvenement>("rendez_vous");
  // « Privé » par défaut, comme l'agenda actuel : partager doit être un choix.
  const [visibilite, setVisibilite] = useState<"equipe" | "prive">("prive");
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!titre.trim()) return setErreur("Donnez un titre à l'événement.");
    if (!date) return setErreur("Choisissez une date.");
    if (!journee && !heure) return setErreur("Indiquez une heure, ou cochez « Toute la journée ».");
    setErreur(null);
    const ok = await actionsEvenements.creer({
      titre,
      jour: date,
      heure,
      journeeEntiere: journee,
      lieu,
      nature,
      visibilite,
    });
    if (ok) fermer();
  };

  return (
    <>
      <DrawerTete
        titre="Nouvel événement"
        sous="Rendez-vous, réunion ou journée entière"
        onClose={fermer}
      />
      <DrawerCorps>
        <form id={ID_FORMULAIRE} className="form" onSubmit={envoyer} noValidate>
          <label className="field">
            Titre
            <input
              type="text"
              placeholder="Ex. Fournisseur Distri Tana"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
              autoFocus
            />
          </label>
          <div className="two">
            <label className="field">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              Heure
              <input
                type="time"
                value={heure}
                disabled={journee}
                onChange={(e) => setHeure(e.target.value)}
              />
            </label>
          </div>
          <label className="field coche">
            <input
              type="checkbox"
              checked={journee}
              onChange={(e) => setJournee(e.target.checked)}
            />
            Toute la journée
          </label>
          <label className="field">
            Lieu
            <input
              type="text"
              placeholder="Boutique, Ivato…"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
            />
          </label>
          <div className="two">
            <label className="field">
              Nature
              <select value={nature} onChange={(e) => setNature(e.target.value as NatureEvenement)}>
                {NATURES.map((n) => (
                  <option key={n.valeur} value={n.valeur}>
                    {n.libelle.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Visibilité
              <select
                value={visibilite}
                onChange={(e) => setVisibilite(e.target.value as "equipe" | "prive")}
              >
                <option value="equipe">Toute l'équipe</option>
                <option value="prive">Privé</option>
              </select>
            </label>
          </div>
          <ErreurSaisie texte={erreur} />
        </form>
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Annuler
        </button>
        <button
          className="btn"
          type="submit"
          form={ID_FORMULAIRE}
          disabled={actionsEvenements.occupe}
        >
          Créer l'événement
        </button>
      </DrawerPied>
    </>
  );
};

/* ────────────────────────────── rappels ────────────────────────────── */

const FicheRappel: React.FC<{ id: string }> = ({ id }) => {
  const { rappels, nom, maintenant, actionsRappels, fermer } = useOrg();
  const r = rappels.find((x) => x.id === id);
  if (!r) return <Introuvable />;
  const prochain = prochaineOccurrence(r, maintenant);
  const basculer = async () => {
    if (await actionsRappels.basculer(r.id, !r.actif)) fermer();
  };
  return (
    <>
      <DrawerTete titre={r.titre} sous={libelleQuand(r)} onClose={fermer} />
      <DrawerCorps>
        <p className="texte">
          Ce rappel arrive dans la cloche, en haut de l'écran. Il ne règle rien tout seul.
        </p>
        <dl className="kv">
          <dt>Pour</dt>
          <dd>{nom(r.destinataire_id)}</dd>
          <dt>État</dt>
          <dd>
            {r.actif ? (
              <span className="tag ok">actif</span>
            ) : (
              <span className="tag grey">désactivé</span>
            )}
          </dd>
          <dt>Prochain</dt>
          <dd>
            {prochain
              ? `${majuscule(relatif(jourLocal(prochain)))} à ${heureMinute(prochain)}`
              : "—"}
          </dd>
        </dl>
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Fermer
        </button>
        <button
          className="btn"
          type="button"
          disabled={actionsRappels.occupe !== null}
          onClick={basculer}
        >
          {r.actif ? "Désactiver" : "Activer"}
        </button>
      </DrawerPied>
    </>
  );
};

const NouveauRappel: React.FC = () => {
  const { aujourdhui, moiId, actionsRappels, fermer } = useOrg();
  const personnes = useChoixPersonnes();
  const [titre, setTitre] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("quotidien");
  const [heure, setHeure] = useState("09:00");
  const [jour, setJour] = useState(aujourdhui);
  const [jourSemaine, setJourSemaine] = useState(1);
  const [jourMois, setJourMois] = useState(() => Number(aujourdhui.slice(8, 10)));
  const [pour, setPour] = useState(moiId ?? "");
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return setErreur("Donnez un titre au rappel.");
    if (!heure) return setErreur("Indiquez une heure.");
    if (recurrence === "aucune" && !jour) return setErreur("Indiquez le jour du rappel.");
    if (recurrence === "mensuel" && (jourMois < 1 || jourMois > 31))
      return setErreur("Le jour du mois va de 1 à 31.");
    setErreur(null);
    const ok = await actionsRappels.creer({
      titre,
      recurrence,
      heure,
      jour: recurrence === "aucune" ? jour : undefined,
      jourSemaine: recurrence === "hebdomadaire" ? jourSemaine : null,
      jourMois: recurrence === "mensuel" ? jourMois : null,
      destinataireId: pour || null,
    });
    if (ok) fermer();
  };

  return (
    <>
      <DrawerTete
        titre="Nouveau rappel"
        sous="Ce qu'on doit vous redire, et quand"
        onClose={fermer}
      />
      <DrawerCorps>
        <form id={ID_FORMULAIRE} className="form" onSubmit={envoyer} noValidate>
          <label className="field">
            Titre
            <input
              type="text"
              placeholder="Ex. Faire la caisse"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
              autoFocus
            />
          </label>
          <div className="two">
            <label className="field">
              Répétition
              <select
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
            <label className="field">
              Heure
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </label>
          </div>
          {recurrence === "aucune" && (
            <label className="field">
              Le
              <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
            </label>
          )}
          {recurrence === "hebdomadaire" && (
            <label className="field">
              Chaque
              <select value={jourSemaine} onChange={(e) => setJourSemaine(Number(e.target.value))}>
                {JOURS_SEMAINE.map((j) => (
                  <option key={j.valeur} value={j.valeur}>
                    {j.libelle}
                  </option>
                ))}
              </select>
            </label>
          )}
          {recurrence === "mensuel" && (
            <label className="field">
              Le jour du mois
              <input
                type="number"
                min={1}
                max={31}
                value={jourMois}
                onChange={(e) => setJourMois(Number(e.target.value))}
              />
              <span className="aide">Un mois qui n'a pas ce jour-là est sauté.</span>
            </label>
          )}
          {personnes.length > 1 && (
            <label className="field">
              Pour qui
              <select value={pour} onChange={(e) => setPour(e.target.value)}>
                {personnes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ErreurSaisie texte={erreur} />
        </form>
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Annuler
        </button>
        <button
          className="btn"
          type="submit"
          form={ID_FORMULAIRE}
          disabled={actionsRappels.occupe !== null}
        >
          Créer le rappel
        </button>
      </DrawerPied>
    </>
  );
};

/* ───────────────────────────── échéances ───────────────────────────── */

const LIBELLE_ECRAN: Record<string, string> = {
  achats: "Achats",
  devis: "Devis",
  livraisons: "Livraisons",
};

const ListeEcheances: React.FC<{ ids?: string[] }> = ({ ids }) => {
  const { echeances, aujourdhui, naviguer, fermer } = useOrg();
  const lignes = (ids ? echeances.filter((l) => ids.includes(l.id)) : echeances)
    .slice()
    .sort((a, b) => a.jour.localeCompare(b.jour));
  const ecrans = [...new Set(lignes.map((l) => l.onglet).filter(Boolean))] as string[];
  return (
    <>
      <DrawerTete
        titre="Échéances de la boutique"
        sous="Achats à régler, devis à relancer, courses prévues"
        onClose={fermer}
      />
      <DrawerCorps>
        {lignes.length === 0 ? (
          <p className="none">Rien à afficher</p>
        ) : (
          <div className="rows">
            {lignes.map((l) => (
              <button
                key={l.id}
                className="row"
                type="button"
                onClick={() => {
                  if (l.onglet) {
                    fermer();
                    naviguer(l.onglet);
                  }
                }}
              >
                <span className="pt" style={{ background: "var(--crit)" }} />
                <span className="rtxt">
                  <span className="title">{l.titre}</span>
                  <span className="meta">{l.detail}</span>
                </span>
                <span className={`when${l.jour < aujourdhui ? " crit" : ""}`}>
                  {relatif(l.jour, aujourdhui)}
                </span>
              </button>
            ))}
          </div>
        )}
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Fermer
        </button>
        {ecrans.length === 1 && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              fermer();
              naviguer(ecrans[0]);
            }}
          >
            Ouvrir {LIBELLE_ECRAN[ecrans[0]] ?? ecrans[0]}
          </button>
        )}
      </DrawerPied>
    </>
  );
};

/* ───────────────────────────── réglages ───────────────────────────── */

const Reglages: React.FC = () => {
  const { delaisRappel, droits, naviguer, fermer } = useOrg();
  return (
    <>
      <DrawerTete
        titre="Paramètres des rappels"
        sous="Réglages des alertes automatiques"
        onClose={fermer}
      />
      <DrawerCorps>
        <dl className="kv">
          <dt>Rendez-vous</dt>
          <dd>La veille à {delaisRappel.veilleHeure} h</dd>
          <dt>Le jour même</dt>
          <dd>{delaisRappel.memeJourMinutes} minutes avant</dd>
          <dt>Tâches</dt>
          <dd>Le jour de l'échéance, puis tant qu'elles sont en retard</dd>
        </dl>
        <EtatVide
          neutre
          titre="Ces délais se règlent dans Paramètres → Rappels."
          detail="Ils valent pour toute la boutique."
        />
      </DrawerCorps>
      <DrawerPied>
        <button className="btn ghost" type="button" onClick={fermer}>
          Fermer
        </button>
        {droits.proprietaire && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              fermer();
              naviguer("settings");
            }}
          >
            Ouvrir les paramètres
          </button>
        )}
      </DrawerPied>
    </>
  );
};
