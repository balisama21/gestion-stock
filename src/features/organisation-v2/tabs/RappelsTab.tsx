import React from "react";
import { libelleQuand, prochaineOccurrence } from "../../../lib/rappels";
import { useNotificationPrefs } from "../../../lib/notificationPrefs";
import { useOrg } from "../contexte";
import { heureMinute, jourLocal, majuscule, relatif } from "../lib/dates";
import { EtatVide, Interrupteur } from "../components/elements";
import {
  IcAgenda,
  IcAlerte,
  IcArgent,
  IcCarton,
  IcCloche,
  IcHorloge,
  IcTache,
} from "../components/icones";

/**
 * LES ALERTES AUTOMATIQUES — lecture seule
 *
 * Il n'existe en base aucune table de « règles d'alerte » : ces alertes
 * sont écrites dans le code de la cloche (`lib/activite.ts`), et seuls
 * les délais des rendez-vous se règlent (Paramètres → Rappels). La
 * maquette les montrait avec des interrupteurs ; ils les auraient fait
 * paraître réglables alors que rien ne serait enregistré. On les montre
 * donc comme ce qu'elles sont, des règles fixes du système, décrites
 * d'après leur vrai comportement, et seulement pour les modules que
 * cette personne voit.
 *
 * Exception honnête : l'alerte de stock bas peut être coupée dans les
 * Paramètres de CE navigateur (`notificationPrefs`, déjà existant). Son
 * état réel est affiché, pas modifié d'ici.
 */
interface Regle {
  cle: string;
  module: string;
  Ic: React.FC;
  titre: string;
  sous: string;
  actif?: boolean;
}

export const RappelsTab: React.FC = () => {
  const {
    rappelsPortee,
    maintenant,
    aujourdhui,
    moiId,
    nom,
    droits,
    actionsRappels,
    delaisRappel,
    ouvrir,
    erreurs,
    chargement,
  } = useOrg();
  const [prefs] = useNotificationPrefs();

  const prochains = rappelsPortee
    .filter((r) => r.actif)
    .map((r) => ({ r, quand: prochaineOccurrence(r, maintenant) }))
    .filter((x): x is { r: (typeof rappelsPortee)[number]; quand: Date } => x.quand !== null)
    .sort((a, b) => a.quand.getTime() - b.quand.getTime())
    .slice(0, 6);

  const regles: Regle[] = (
    [
      {
        cle: "rdv",
        module: "agenda",
        Ic: IcAgenda,
        titre: "Un rendez-vous qui approche",
        sous: `La veille à ${delaisRappel.veilleHeure} h, ou ${delaisRappel.memeJourMinutes} minutes avant s'il tombe aujourd'hui`,
      },
      {
        cle: "confiee",
        module: "taches",
        Ic: IcTache,
        titre: "Une tâche qu'on vous confie",
        sous: "Dès qu'un membre vous assigne une tâche, jusqu'à ce que vous la commenciez",
      },
      {
        cle: "echeance-tache",
        module: "taches",
        Ic: IcTache,
        titre: "Une tâche à échéance ou en retard",
        sous: "Le jour de l'échéance, puis chaque jour de retard",
      },
      {
        cle: "stock",
        module: "produits",
        Ic: IcCarton,
        titre: "Un stock bas",
        sous: "Quand un produit passe sous son seuil d'alerte",
        actif: prefs.stockAlerts,
      },
      {
        cle: "creance",
        module: "ventes",
        Ic: IcArgent,
        titre: "Une créance client",
        sous: "Tant qu'une vente attend son règlement",
      },
      {
        cle: "achat",
        module: "achats",
        Ic: IcArgent,
        titre: "Une échéance d'achat",
        sous: "Quand un achat fournisseur dépasse sa date d'échéance",
      },
    ] as Regle[]
  ).filter((r) => droits.voitModule(r.module));

  return (
    <div className="grid">
      <article className="card s7">
        <div className="ch">
          <h2>
            <IcCloche />
            Mes rappels
          </h2>
          {droits.creerRappel && (
            <button
              className="btn sm"
              type="button"
              onClick={() => ouvrir({ kind: "nouveau", quoi: "rappel" })}
            >
              + Nouveau rappel
            </button>
          )}
        </div>
        {erreurs.rappels ? (
          <p className="erreur">Les rappels n'ont pas pu être chargés : {erreurs.rappels}</p>
        ) : chargement.rappels && rappelsPortee.length === 0 ? (
          <p className="none">Chargement des rappels…</p>
        ) : rappelsPortee.length === 0 ? (
          <EtatVide
            neutre
            titre="Aucun rappel"
            detail="Ce que vous voulez qu'on vous redise apparaîtra ici."
          />
        ) : (
          <div>
            {rappelsPortee.map((r) => {
              const p = r.actif ? prochaineOccurrence(r, maintenant) : null;
              const pour = r.destinataire_id !== moiId ? ` · pour ${nom(r.destinataire_id)}` : "";
              return (
                <div className="rule" key={r.id}>
                  <span className="ic">
                    <IcCloche />
                  </span>
                  <button
                    className="rtxt"
                    type="button"
                    onClick={() => ouvrir({ kind: "rappel", id: r.id })}
                  >
                    <b>{r.titre}</b>
                    <small>
                      {libelleQuand(r)}
                      {pour}
                      {r.actif
                        ? p
                          ? ` · prochain ${relatif(jourLocal(p), aujourdhui)} à ${heureMinute(p)}`
                          : " · plus de déclenchement à venir"
                        : " · désactivé"}
                    </small>
                  </button>
                  <Interrupteur
                    actif={r.actif}
                    label={`Activer ${r.titre}`}
                    disabled={actionsRappels.occupe !== null}
                    onChange={() => actionsRappels.basculer(r.id, !r.actif)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </article>

      <article className="card s5">
        <div className="ch">
          <h2>
            <IcHorloge />
            Prochains déclenchements
          </h2>
        </div>
        <div>
          {prochains.length === 0 ? (
            <p className="none">Aucun rappel actif</p>
          ) : (
            prochains.map(({ r, quand }) => (
              <div className="next-fire" key={r.id}>
                <span>{r.titre}</span>
                <span className="when">
                  {majuscule(relatif(jourLocal(quand), aujourdhui))} · {heureMinute(quand)}
                </span>
              </div>
            ))
          )}
        </div>
      </article>

      {regles.length > 0 && (
        <article className="card s12">
          <div className="ch">
            <h2>
              <IcAlerte />
              Alertes automatiques
            </h2>
            <button className="link" type="button" onClick={() => ouvrir({ kind: "params" })}>
              Paramètres → Rappels
            </button>
          </div>
          <p className="intro">
            Ce que la boutique vous signale toute seule. Tout arrive dans la cloche, en haut de
            l'écran.
          </p>
          <div>
            {regles.map(({ cle, Ic, titre, sous, actif }) => (
              <div className="rule" key={cle}>
                <span className="ic">
                  <Ic />
                </span>
                <div className="rtxt">
                  <b>{titre}</b>
                  <small>{sous}</small>
                </div>
                {actif === false ? (
                  <span className="tag grey">coupée sur cet appareil</span>
                ) : (
                  <span className="tag ok">toujours active</span>
                )}
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
};
