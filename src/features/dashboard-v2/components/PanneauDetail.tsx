import React from "react";
import { Drawer, DrawerLigne, DrawerTotal } from "./Drawer";
import { Tag } from "./Tag";
import {
  dateLocale,
  jourEtMois,
  jourMoisChiffres,
  montant,
  nombre,
  pluriel,
  pourcent,
} from "../lib/format";
import { quantiteEnMots } from "../../../utils/formulas";
import type { Periode } from "../hooks/useDashboardPeriod";
import type {
  ChiffresClients,
  ChiffresFlux,
  ChiffresFournisseurs,
  ChiffresPaiements,
  ChiffresResultat,
  ChiffresStock,
  ChiffresVentes,
  LigneStock,
} from "../lib/chiffres";
import type { ItemAgenda } from "../lib/agenda";

/**
 * LE PANNEAU DE DÉTAIL
 *
 * Il ouvre les lignes derrière un chiffre sans quitter le tableau de
 * bord, puis son pied de page conduit vers l'écran qui sait vraiment
 * faire le geste.
 *
 * IL NE CONTIENT AUCUN FORMULAIRE DE CRÉATION. La maquette en proposait
 * — nouvelle vente, nouvelle dépense, bon de commande. Les formulaires
 * de l'application ne sont pas des composants : ils vivent à
 * l'intérieur d'écrans de mille à deux mille lignes, avec leur état et
 * leurs validations. En réécrire une copie ici, ce serait deux façons
 * d'enregistrer une vente, et deux endroits où corriger le jour où la
 * règle change. Le panneau montre, la page enregistre. Écart n° 3 de
 * l'audit, validé.
 *
 * LA SEULE EXCEPTION est la relance d'un client : elle n'écrit rien. Le
 * panneau prépare un appel, un SMS ou un message WhatsApp, et c'est la
 * personne qui appuie sur envoyer, dans son application de messages.
 */

export type VueDetail =
  | { cle: "ventes" }
  | { cle: "encaisse" }
  | { cle: "recevoir" }
  | { cle: "retard" }
  | { cle: "relancer" }
  | { cle: "client"; client: ChiffresClients["aRelancer"][number] }
  | { cle: "produit"; produit: LigneStock }
  | { cle: "ruptures" }
  | { cle: "sorties" }
  | { cle: "fournisseurs" }
  | { cle: "resultat" }
  | { cle: "agenda" };

export interface DonneesPanneau {
  periode: Periode;
  ventes: ChiffresVentes;
  flux: ChiffresFlux;
  stock: ChiffresStock;
  paiements: ChiffresPaiements;
  clients: ChiffresClients;
  fournisseurs: ChiffresFournisseurs;
  resultat: ChiffresResultat;
  agenda: ItemAgenda[];
  nomBoutique: string;
}

/** Un numéro réduit à ses chiffres, seul format que `tel:` accepte partout. */
const numero = (tel: string | null): string | null => {
  const propre = (tel ?? "").replace(/[^0-9+]/g, "");
  return propre.length >= 6 ? propre : null;
};

/**
 * Le même numéro, sous la forme internationale que WhatsApp exige.
 *
 * `wa.me` refuse un numéro local : « 034 00 000 01 » n'ouvre rien.
 * Il lui faut l'indicatif du pays et pas de zéro d'appel.
 *
 * ON SUPPOSE MADAGASCAR pour un numéro qui commence par zéro. C'est une
 * hypothèse, et elle est assumée : l'application n'est pas multi-pays —
 * `formatCurrency` écrit l'Ariary en dur pour tout le monde. Un numéro
 * déjà écrit avec son indicatif (+261, 261…) est repris tel quel, et
 * un numéro qu'on ne sait pas interpréter ne reçoit pas de lien
 * WhatsApp du tout : mieux vaut deux canaux qui marchent qu'un
 * troisième qui ouvre une page d'erreur.
 */
const INDICATIF_MADAGASCAR = "261";

const numeroInternational = (tel: string | null): string | null => {
  const propre = numero(tel);
  if (!propre) return null;
  const chiffres = propre.replace(/\D/g, "");
  if (propre.startsWith("+")) return chiffres;
  if (chiffres.startsWith(INDICATIF_MADAGASCAR)) return chiffres;
  if (chiffres.startsWith("0")) return INDICATIF_MADAGASCAR + chiffres.slice(1);
  return null;
};

interface Contenu {
  titre: string;
  sous?: string;
  corps: React.ReactNode;
  /** Le bouton du pied : où il mène, et sous quel nom. */
  pied?: { libelle: string; onglet: string };
}

function construire(v: VueDetail, d: DonneesPanneau): Contenu {
  const p = d.periode;

  switch (v.cle) {
    case "ventes": {
      const jours = d.ventes.cumul.filter((c) => c.duJour > 0).reverse();
      return {
        titre: `Ventes · ${p.libelle}`,
        sous: `${pluriel(jours.length, "jour")} avec ventes · ${pluriel(d.ventes.tickets, "ticket")}`,
        corps: (
          <>
            {jours.map((c) => (
              <DrawerLigne
                key={c.jour}
                titre={jourEtMois(dateLocale(c.jour))}
                valeur={montant(c.duJour)}
              />
            ))}
            <DrawerTotal libelle="Total" valeur={montant(d.ventes.total)} />
          </>
        ),
        pied: { libelle: "Ouvrir la page Ventes", onglet: "ventes" },
      };
    }

    case "encaisse":
      return {
        titre: `Encaissements · ${p.libelle}`,
        sous: "Règlements reçus, semaine par semaine",
        corps: (
          <>
            {d.paiements.parSemaine.map((s) => (
              <DrawerLigne
                key={s.libelle}
                titre={`Jours ${s.libelle}`}
                valeur={montant(s.montant)}
              />
            ))}
            <DrawerTotal libelle="Total" valeur={montant(d.paiements.encaisse)} />
          </>
        ),
        pied: { libelle: "Voir l'historique", onglet: "historique" },
      };

    case "recevoir":
    case "retard": {
      const retard = v.cle === "retard";
      const limite = retard ? (c: number) => c > 30 : (c: number) => c <= 30;
      const lignes = d.clients.aRelancer.filter((c) => limite(c.depuis));
      return {
        titre: retard ? "Paiements en retard" : "Paiements à recevoir",
        sous: retard ? "Plus de 30 jours" : "Moins de 30 jours",
        corps:
          lignes.length === 0 ? (
            <p className="note">Rien à ce titre pour l&apos;instant.</p>
          ) : (
            <>
              {lignes.map((c) => (
                <DrawerLigne
                  key={c.id ?? c.nom}
                  titre={c.nom}
                  detail={`Depuis ${pluriel(c.depuis, "jour")}`}
                  valeur={montant(c.du)}
                />
              ))}
              <DrawerTotal
                libelle="Total"
                valeur={montant(retard ? d.paiements.enRetard : d.paiements.aRecevoir)}
              />
            </>
          ),
        pied: { libelle: "Ouvrir Paiements à recevoir", onglet: "paiements" },
      };
    }

    case "relancer":
      return {
        titre: "Clients à relancer",
        sous: "Ceux dont une vente reste impayée",
        corps:
          d.clients.aRelancer.length === 0 ? (
            <p className="note">Toutes les ventes à crédit ont été réglées.</p>
          ) : (
            <>
              {d.clients.aRelancer.map((c) => (
                <DrawerLigne
                  key={c.id ?? c.nom}
                  titre={c.nom}
                  detail={`${c.telephone ?? "Sans téléphone"} · depuis ${nombre(c.depuis)} j`}
                  valeur={montant(c.du)}
                />
              ))}
              <DrawerTotal
                libelle="Total dû"
                valeur={montant(d.clients.aRelancer.reduce((a, c) => a + c.du, 0))}
              />
            </>
          ),
        pied: { libelle: "Ouvrir les clients", onglet: "clients" },
      };

    case "client": {
      const c = v.client;
      const tel = numero(c.telephone);
      const wa = numeroInternational(c.telephone);
      const message = `Bonjour ${c.nom.split(" ")[0]}, petit rappel : il reste ${montant(c.du)} à régler chez ${d.nomBoutique}. Merci !`;
      return {
        titre: `Relancer ${c.nom}`,
        sous: `Doit ${montant(c.du)} depuis ${pluriel(c.depuis, "jour")}`,
        corps: (
          <div className="form">
            {tel ? (
              <div className="canaux">
                <a href={`tel:${tel}`}>Appeler</a>
                <a href={`sms:${tel}?body=${encodeURIComponent(message)}`}>SMS</a>
                {wa && (
                  <a
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <p className="note">
                Aucun numéro sur la fiche de ce client. Ajoutez-le depuis la page Clients pour
                pouvoir le relancer d&apos;ici.
              </p>
            )}
            <label>
              Message préparé
              <textarea
                rows={4}
                defaultValue={message}
                style={{
                  font: "inherit",
                  fontSize: 14,
                  padding: "9px 10px",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "var(--surface-2)",
                  color: "var(--ink)",
                  resize: "vertical",
                }}
              />
            </label>
            <p className="note">
              Rien n&apos;est envoyé d&apos;ici : le bouton ouvre votre application de messages,
              avec le texte déjà rempli.
            </p>
          </div>
        ),
        pied: { libelle: "Ouvrir les clients", onglet: "clients" },
      };
    }

    case "produit": {
      const pr = v.produit;
      const aCommander = Math.max(0, pr.seuil - pr.disponible);
      return {
        titre: pr.nom,
        sous: `En stock ${nombre(pr.disponible)} / seuil ${nombre(pr.seuil)}`,
        corps: (
          <>
            <DrawerLigne
              titre="Quantité disponible"
              detail="Après réservations"
              valeur={quantiteEnMots(pr.disponible, pr.unite)}
            />
            <DrawerLigne
              titre="Couverture estimée"
              detail="Au rythme des 30 derniers jours"
              valeur={
                pr.couverture === null ? (
                  <Tag ton="neutre">pas de vente récente</Tag>
                ) : (
                  <Tag ton={pr.couverture < 3 ? "crit" : pr.couverture < 10 ? "warn" : "ok"}>
                    ≈ {pluriel(Math.round(pr.couverture), "jour")}
                  </Tag>
                )
              }
            />
            <DrawerLigne
              titre="Quantité à commander"
              detail="Pour revenir au seuil"
              valeur={quantiteEnMots(aCommander, pr.unite)}
            />
          </>
        ),
        pied: { libelle: "Ouvrir les achats", onglet: "achats" },
      };
    }

    case "ruptures": {
      const lignes = [...d.stock.enRupture, ...d.stock.aRecommander];
      return {
        titre: "Produits à recommander",
        sous: `${nombre(d.stock.enRupture.length)} en rupture · ${nombre(d.stock.aRecommander.length)} sous le seuil`,
        corps:
          lignes.length === 0 ? (
            <p className="note">Tous les produits sont au-dessus de leur seuil.</p>
          ) : (
            lignes.map((pr) => (
              <DrawerLigne
                key={pr.id}
                titre={pr.nom}
                detail={`${quantiteEnMots(pr.disponible, pr.unite)} en stock · seuil ${nombre(pr.seuil)}`}
                valeur={
                  pr.enRupture ? (
                    <Tag ton="crit">en rupture</Tag>
                  ) : pr.couverture === null ? (
                    <Tag ton="warn">sous le seuil</Tag>
                  ) : (
                    <Tag ton={pr.couverture < 3 ? "crit" : "warn"}>
                      ≈ {Math.round(pr.couverture)} j
                    </Tag>
                  )
                }
              />
            ))
          ),
        pied: { libelle: "Préparer la commande", onglet: "achats" },
      };
    }

    case "sorties":
      return {
        titre: `Sorties d'argent · ${p.libelle}`,
        sous: "Achats de stock et dépenses",
        corps: (
          <>
            <DrawerLigne
              titre="Achats de stock"
              detail="Marchandise entrée en stock"
              valeur={montant(d.flux.achats)}
            />
            <DrawerLigne
              titre="Dépenses"
              detail="Frais de fonctionnement"
              valeur={montant(d.flux.depenses)}
            />
            {d.flux.depensesParPersonne.map((x) => (
              <DrawerLigne key={x.nom} titre={`dont ${x.nom}`} valeur={montant(x.montant)} />
            ))}
            <DrawerLigne titre="Moyenne par jour" valeur={montant(d.flux.sortiesParJour)} />
            <DrawerLigne titre="Part des ventes" valeur={pourcent(d.flux.partDesVentes)} />
            <DrawerTotal libelle="Total" valeur={montant(d.flux.sorties)} />
          </>
        ),
        pied: { libelle: "Ouvrir les dépenses", onglet: "depenses" },
      };

    case "fournisseurs":
      return {
        titre: "Fournisseurs à payer",
        sous: `${pluriel(d.fournisseurs.echeancesDepassees, "échéance")} ${d.fournisseurs.echeancesDepassees > 1 ? "dépassées" : "dépassée"}`,
        corps:
          d.fournisseurs.aPayer.length === 0 ? (
            <p className="note">Tous les achats enregistrés sont réglés.</p>
          ) : (
            <>
              {d.fournisseurs.aPayer.map((f, i) => (
                <DrawerLigne
                  key={`${f.nom}-${i}`}
                  titre={`${f.nom} · ${f.designation}`}
                  detail={
                    f.echeance
                      ? f.retard > 0
                        ? `Échéance ${jourMoisChiffres(dateLocale(f.echeance))}, dépassée de ${nombre(f.retard)} j`
                        : `Échéance ${jourMoisChiffres(dateLocale(f.echeance))}`
                      : "Sans échéance"
                  }
                  valeur={montant(f.du)}
                />
              ))}
              <DrawerTotal libelle="Total dû" valeur={montant(d.fournisseurs.totalDu)} />
            </>
          ),
        pied: { libelle: "Ouvrir les fournisseurs", onglet: "fournisseurs" },
      };

    case "resultat":
      return {
        titre: "Comment le résultat est calculé",
        sous: p.libelle,
        corps: (
          <>
            <DrawerLigne
              titre="Ventes"
              detail="Chiffre d'affaires de la période"
              valeur={montant(d.ventes.total)}
            />
            <DrawerLigne
              titre="− Coût d'achat des produits vendus"
              detail="Prix d'achat figé sur chaque vente"
              valeur={montant(d.ventes.total - d.resultat.marge)}
            />
            <DrawerLigne
              titre="= Marge brute"
              detail={
                d.ventes.total > 0
                  ? `${pourcent((d.resultat.marge / d.ventes.total) * 100)} des ventes`
                  : undefined
              }
              valeur={montant(d.resultat.marge)}
            />
            <DrawerLigne titre="− Dépenses" valeur={montant(d.resultat.depenses)} />
            <DrawerTotal
              libelle={d.resultat.benefice < 0 ? "= Perte" : "= Bénéfice"}
              valeur={montant(d.resultat.benefice)}
            />
            <p className="note">
              Les achats de stock ({montant(d.resultat.achatsNonDeduits)}) ne sont pas retirés : ils
              deviennent un coût seulement quand les produits sont vendus.
            </p>
          </>
        ),
        pied: { libelle: "Ouvrir le Bilan", onglet: "rapports" },
      };

    case "agenda":
      return {
        titre: "Ce qui est prévu",
        sous: "Événements, échéances, livraisons et rappels",
        corps:
          d.agenda.length === 0 ? (
            <p className="note">Rien de prévu ce mois-ci.</p>
          ) : (
            d.agenda.map((it) => (
              <DrawerLigne
                key={it.id}
                titre={`${jourEtMois(dateLocale(it.jour))} · ${it.titre}`}
                detail={it.precision}
                valeur={<Tag ton={it.nature === "tache" ? "warn" : "ok"}>{it.nature}</Tag>}
              />
            ))
          ),
        pied: { libelle: "Ouvrir l'agenda", onglet: "agenda" },
      };
  }
}

export const PanneauDetail: React.FC<{
  vue: VueDetail | null;
  donnees: DonneesPanneau;
  onFermer: () => void;
  onNaviguer?: (onglet: string) => void;
}> = ({ vue, donnees, onFermer, onNaviguer }) => {
  // Le contenu reste affiché pendant la fermeture : le vider tout de
  // suite ferait disparaître le texte avant que le panneau ait glissé.
  const dernier = React.useRef<VueDetail | null>(null);
  if (vue) dernier.current = vue;
  const courante = vue ?? dernier.current;
  if (!courante) return null;

  const c = construire(courante, donnees);

  return (
    <Drawer
      open={vue !== null}
      onClose={onFermer}
      title={c.titre}
      subtitle={c.sous}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onFermer}>
            Fermer
          </button>
          {c.pied && onNaviguer && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                onFermer();
                onNaviguer(c.pied!.onglet);
              }}
            >
              {c.pied.libelle}
            </button>
          )}
        </>
      }
    >
      {c.corps}
    </Drawer>
  );
};
