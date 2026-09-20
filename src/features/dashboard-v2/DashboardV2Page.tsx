import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./dashboard.css";
import { useDashboardPeriod } from "./hooks/useDashboardPeriod";
import { useDashboardPermissions, MONTANT_MASQUE } from "./hooks/useDashboardPermissions";
import { useDashboardData } from "./hooks/useDashboardData";
import { dateCourte, dateLongue, heure, montant, nombre, pluriel, pourcent } from "./lib/format";
import { MenuOption, MenuPill, Pill } from "./components/Pill";
import { Card, CardHeader } from "./components/Card";
import { CarteSquelette, EtatErreur } from "./components/States";
import { Chip, ChipRienDUrgent } from "./components/Chip";
import { BandeauAujourdhui } from "./components/BandeauAujourdhui";
import { CarteTresorerie } from "./cards/CarteTresorerie";
import { CarteVentes } from "./cards/CarteVentes";
import { CarteAgenda } from "./cards/CarteAgenda";
import { CarteStock } from "./cards/CarteStock";
import { CarteSorties } from "./cards/CarteSorties";
import { CarteTaches } from "./cards/CarteTaches";
import { CarteVendeurs } from "./cards/CarteVendeurs";
import { CarteCommandes } from "./cards/CarteCommandes";
import { CarteFilVentes } from "./cards/CarteFilVentes";
import { CarteResultat } from "./cards/CarteResultat";
import { CartePaiements } from "./cards/CartePaiements";
import { CarteClients } from "./cards/CarteClients";
import { CarteJournal } from "./cards/CarteJournal";
import { CarteRuptures } from "./cards/CarteRuptures";
import { CarteMouvements } from "./cards/CarteMouvements";
import { CarteTopProduits } from "./cards/CarteTopProduits";
import { CarteLivraisons } from "./cards/CarteLivraisons";
import { CarteFournisseurs } from "./cards/CarteFournisseurs";
import { PanneauDetail, type VueDetail } from "./components/PanneauDetail";
import { Trend } from "./components/Trend";
import { allerALaCarte } from "./lib/defilement";
import { phraseDeSynthese, syntheseCompacte } from "./lib/summary";
import {
  chiffresClients,
  chiffresCommandes,
  chiffresFlux,
  chiffresFournisseurs,
  chiffresPaiements,
  chiffresResultat,
  chiffresDuJour,
  chiffresStock,
  chiffresVentes,
  pointsDAttention,
  topProduits,
  type SourcesChiffres,
} from "./lib/chiffres";
import { lireJournal } from "./lib/journal";
import { agendaDuMois } from "./lib/agenda";
import { VUES, VUE_PAR_CLE } from "./roles";
import { CARTE_PAR_CLE, type CleCarte, type CleTuile } from "./registry";
import { dateDuJour } from "../../lib/dates";
import { useAuth } from "../../hooks/useAuth";

/**
 * LE TABLEAU DE BORD v2
 *
 * Portage de `docs/maquette/tableau-de-bord-complet.html`. Voir
 * `docs/dashboard-v2/audit.md` pour la carte des données.
 *
 * ÉTAT : phase 2. L'en-tête est complet — période et comparaison,
 * phrase de synthèse, points d'attention, vue par métier, mode focus,
 * thème. Les chiffres sont branchés sur les vraies données et se
 * relisent tous dans la table de contrôle, qui sert à les comparer à
 * l'ancien tableau de bord avant que les cartes ne les habillent aux
 * phases suivantes.
 *
 * CETTE PAGE NE DESSINE PAS LA COQUILLE. La maquette redessinait aussi
 * la barre latérale ; celle-ci existe déjà et sert vingt-cinq écrans.
 *
 * ELLE NE FAIT AUCUNE ÉCRITURE. Ni au chargement, ni au rafraîchissement.
 */

const ICONE_CALENDRIER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const ICONE_PERSONNE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const ICONE_RAFRAICHIR = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const ICONE_OEIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
  </svg>
);

const ICONE_SOLEIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const ICONE_LUNE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

/** Mémorise le mode focus, comme la maquette, sous le même préfixe. */
const CLE_FOCUS = "tantana.dash.focus";

/**
 * L'interrupteur de la table de contrôle.
 *
 * Elle liste en clair tous les chiffres des cartes, pour les
 * confronter à l'ancien tableau de bord et aux pages Ventes, Stock,
 * Bilan et Paiements. C'est un outil de recette, pas un élément du
 * tableau de bord : il n'a rien à faire sous les yeux d'un
 * commerçant, et la maquette n'en contient pas.
 *
 * Il reste néanmoins à portée, parce que la comparaison des chiffres
 * ne peut se faire que sur une vraie boutique — pas sur un banc
 * d'essai. Dans la console du navigateur :
 *
 *   localStorage.setItem('tantana.dash.controle', '1')
 */
const CLE_CONTROLE = "tantana.dash.controle";

/**
 * Les mêmes props que l'ancien tableau de bord, à quelques près.
 *
 * Tout vient de `useStoreData`, déjà chargé par la coquille : le
 * tableau de bord ne redemande RIEN de ce que l'application a en main.
 * Les deux seules lectures propres à cet écran sont dans
 * `useDashboardData`, et elles portent sur des tables que personne ne
 * lisait.
 */
export interface DashboardV2PageProps {
  /** La boutique active. `null` : rien à lire. */
  storeId: string | null;
  sales: SourcesChiffres["sales"];
  purchases: SourcesChiffres["purchases"];
  expenses: SourcesChiffres["expenses"];
  products: SourcesChiffres["products"];
  payments: SourcesChiffres["payments"];
  sellers: SourcesChiffres["sellers"];
  capital: SourcesChiffres["capital"];
  orders: SourcesChiffres["orders"];
  clients: SourcesChiffres["clients"];
  quotes: SourcesChiffres["quotes"];
  /** Les livraisons, avec de quoi dresser la tournee. */
  deliveries: {
    id: string;
    destinataire: string;
    adresse?: string | null;
    statut: string;
    date_prevue?: string | null;
    montant_a_encaisser?: number;
  }[];
  /** Les tâches, avec de quoi les nommer et les cocher. */
  taches: { id: string; titre: string; statut: string; echeance: string | null }[];
  /** Les photos de produits, pour le fil des ventes. */
  productImages: { product_id: string | null; chemin: string; ordre: number }[];
  /** L'agenda de la boutique. */
  evenements: {
    id: string;
    titre: string;
    debut: string;
    journee_entiere: boolean;
  }[];
  rappels: {
    id: string;
    titre: string;
    actif: boolean;
    recurrence: string;
    heure: string | null;
    jour_mois: number | null;
    jour_semaine: number | null;
    evenement_id: string | null;
    tache_id: string | null;
  }[];
  /** Le nom de la boutique, en tête du ticket des sorties. */
  nomBoutique: string;
  /** Les règlements versés aux fournisseurs, pour la carte du même nom. */
  supplierPayments: { date: string; montant: number }[];
  /**
   * Termine une tâche, par la fonction de l'application.
   *
   * Absente quand la personne n'en a pas le droit : la case est alors
   * désactivée plutôt que d'échouer en silence.
   */
  onTerminerTache?: (id: string) => unknown;
  /** Le thème de l'application. La v2 s'y branche, elle n'en crée pas un second. */
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  /** Relance les lectures de `useStoreData`. */
  onRafraichir?: () => void;
  /**
   * Ouvrir un autre ecran de l'application.
   *
   * Le panneau de detail et les fleches des tuiles menent vers la page
   * qui sait vraiment faire le geste, plutot que de reecrire un
   * formulaire de creation : voir l'ecart n. 3 de l'audit.
   */
  onNavigateTab?: (onglet: string) => void;
  /** Faux quand la personne n'a pas le droit d'enregistrer une vente. */
  peutVendre?: boolean;
}

export const DashboardV2Page: React.FC<DashboardV2PageProps> = ({
  storeId,
  sales,
  purchases,
  expenses,
  products,
  payments,
  sellers,
  capital,
  orders,
  clients,
  quotes,
  deliveries,
  taches,
  productImages,
  evenements,
  rappels,
  nomBoutique,
  supplierPayments,
  onTerminerTache,
  theme,
  setTheme,
  onRafraichir,
  onNavigateTab,
  peutVendre = true,
}) => {
  /**
   * Le prénom, pour dire bonjour à quelqu'un plutôt qu'à un écran.
   *
   * Le premier mot du nom complet, et rien d'autre : « Bonjour, Mamy »
   * se dit, « Bonjour, Maminirina Rakotoarisoa » se lit comme une
   * convocation. Un compte sans nom — le champ est facultatif à
   * l'inscription — garde un accueil qui fonctionne, sans virgule
   * orpheline. Même lecture que dans l'ancien tableau de bord.
   */
  const { profile } = useAuth();
  const prenom = (profile?.full_name ?? "").trim().split(/\s+/)[0] || "";

  const aujourdhui = dateDuJour();
  const { periode, choisir, choisirIntervalle, apercus, intervalleLibre } =
    useDashboardPeriod(aujourdhui);
  const droits = useDashboardPermissions();

  // Les deux lectures que l'application ne fait pas encore, et
  // seulement si une carte autorisée en a besoin.
  const donnees = useDashboardData(storeId, periode.intervalle, droits.besoins);

  const toutes: SourcesChiffres = useMemo(
    () => ({
      sales,
      purchases,
      expenses,
      products,
      payments,
      sellers,
      capital,
      orders,
      clients,
      quotes,
      deliveries,
      taches,
      mouvements: donnees.mouvements,
    }),
    [
      sales,
      purchases,
      expenses,
      products,
      payments,
      sellers,
      capital,
      orders,
      clients,
      quotes,
      deliveries,
      taches,
      donnees.mouvements,
    ],
  );

  const chiffres = useMemo(() => {
    const ventes = chiffresVentes(toutes, periode);
    const flux = chiffresFlux(toutes, periode, ventes);
    const stock = chiffresStock(toutes, periode, aujourdhui);
    return {
      ventes,
      flux,
      stock,
      resultat: chiffresResultat(toutes, periode),
      paiements: chiffresPaiements(toutes, periode, flux, aujourdhui),
      clients: chiffresClients(toutes, periode, aujourdhui),
      commandes: chiffresCommandes(toutes),
      fournisseurs: chiffresFournisseurs(toutes, periode, supplierPayments, aujourdhui),
      duJour: chiffresDuJour(toutes, aujourdhui),
      top: topProduits(toutes, periode),
      attention: pointsDAttention(toutes, chiffresStock(toutes, periode, aujourdhui), aujourdhui),
    };
  }, [toutes, periode, aujourdhui, supplierPayments]);

  /** Tout le journal, dit en francais. */
  const lignesJournal = useMemo(() => lireJournal(donnees.journal), [donnees.journal]);

  /** Les lignes du journal d'aujourd'hui, dites en francais. */
  const journalDuJour = useMemo(
    () => lignesJournal.filter((e) => e.jour === aujourdhui),
    [lignesJournal, aujourdhui],
  );

  /**
   * Ou mene la fleche de chaque tuile.
   *
   * Vers l'ecran qui sait vraiment faire le geste. Le panneau de detail
   * arrive en phase 5 ; d'ici la, la fleche conduit deja quelque part
   * plutot que de ne rien faire.
   */
  const DETAIL_TUILE: Record<CleTuile, VueDetail> = {
    ventes: { cle: "ventes" },
    entrees: { cle: "encaisse" },
    sorties: { cle: "sorties" },
    stock: { cle: "ruptures" },
    activite: { cle: "ventes" },
  };

  const synthese = useMemo(
    () => phraseDeSynthese(chiffres.ventes, periode, chiffres.attention),
    [chiffres.ventes, chiffres.attention, periode],
  );
  const compacte = useMemo(
    () => syntheseCompacte(chiffres.ventes, periode),
    [chiffres.ventes, periode],
  );

  /**
   * L'heure du dernier chargement.
   *
   * Posée après le premier rendu, jamais pendant : le serveur et le
   * navigateur n'ont pas la même horloge, et deux heures différentes
   * pour le même écran feraient diverger l'hydratation.
   */
  const [chargeA, setChargeA] = useState<Date | null>(null);
  useEffect(() => setChargeA(new Date()), []);
  useEffect(() => {
    if (donnees.luA) setChargeA(donnees.luA);
  }, [donnees.luA]);

  const [focus, setFocus] = useState(false);
  const [controle, setControle] = useState(false);
  useEffect(() => {
    try {
      setFocus(window.localStorage.getItem(CLE_FOCUS) === "true");
      setControle(window.localStorage.getItem(CLE_CONTROLE) === "1");
    } catch {
      /* Navigation privée : les deux réglages repartent à zéro. */
    }
  }, []);

  const basculerFocus = useCallback(() => {
    setFocus((f) => {
      const suivant = !f;
      try {
        window.localStorage.setItem(CLE_FOCUS, String(suivant));
      } catch {
        /* sans mémoire, le réglage vaut pour cette visite */
      }
      return suivant;
    });
  }, []);

  const boutonRafraichir = useRef<HTMLButtonElement>(null);
  const rafraichir = useCallback(() => {
    const b = boutonRafraichir.current;
    if (b) {
      b.classList.remove("spin");
      void b.offsetWidth;
      b.classList.add("spin");
    }
    setChargeA(new Date());
    donnees.recharger();
    onRafraichir?.();
  }, [donnees, onRafraichir]);

  // Les deux champs de l'intervalle libre, tant qu'ils ne sont pas validés.
  const [du, setDu] = useState(intervalleLibre.debut);
  const [au, setAu] = useState(intervalleLibre.fin);
  const [erreurDates, setErreurDates] = useState(false);
  useEffect(() => {
    setDu(intervalleLibre.debut);
    setAu(intervalleLibre.fin);
  }, [intervalleLibre.debut, intervalleLibre.fin]);

  const [panneau, setPanneau] = useState<VueDetail | null>(null);

  /**
   * Ce qui est prevu ce mois-ci, pour le panneau de l'agenda.
   *
   * Calcule ici plutot que dans la carte : le panneau doit pouvoir
   * l'ouvrir meme quand la carte Agenda n'est pas dans la vue.
   */
  const agendaDuMoisCourant = useMemo(() => {
    const d = new Date();
    const table = agendaDuMois(
      { evenements, taches, deliveries, rappels },
      d.getFullYear(),
      d.getMonth(),
      aujourdhui,
    );
    return [...table.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, items]) => items);
  }, [evenements, taches, deliveries, rappels, aujourdhui]);

  const heureLocale = chargeA ? chargeA.getHours() : 12;
  const salutation = heureLocale >= 18 || heureLocale < 4 ? "Bonsoir" : "Bonjour";
  const jour = new Date();
  const sombre = theme === "dark";
  const vueCourante = VUE_PAR_CLE.get(droits.vue);

  /** Un montant que cette personne n'a pas le droit de voir. */
  const sous = (module: string, champ: string, valeur: number) =>
    droits.champVisible(module, champ) ? montant(valeur) : MONTANT_MASQUE;

  /**
   * Chaque carte construite, rangée par sa clé.
   *
   * La VUE décide de l'ordre et de la présence ; ce tableau ne fait que
   * fournir le contenu. Une clé absente d'ici garde son squelette : la
   * grille n'a pas à savoir où en est le chantier.
   *
   * La navigation remplace le panneau de détail tant qu'il n'est pas
   * construit — chaque lien conduit déjà quelque part.
   */
  /**
   * La portée du module Ventes, qui renomme deux cartes.
   *
   * Une personne en portée « mes données » ne reçoit que ses propres
   * lignes : lui écrire « Ventes du mois » lui ferait croire qu'elle
   * lit le chiffre de la boutique. « Mes ventes » dit ce qu'elle lit.
   */
  const portee = droits.portee("ventes");
  const aSoi = portee === "own";
  const cartes: Partial<Record<CleCarte, React.ReactNode>> = {
    tresorerie: (
      <CarteTresorerie
        capital={capital}
        flux={chiffres.flux}
        periode={periode.libelle}
        montantVisible={droits.champVisible("capital", "montant")}
      />
    ),
    ventes: (
      <CarteVentes
        ventes={chiffres.ventes}
        periode={periode}
        titre={aSoi ? `Mes ventes · ${periode.libelle}` : undefined}
        montantVisible={droits.champVisible("ventes", "montant")}
        onDetails={() => setPanneau({ cle: "ventes" })}
      />
    ),
    agenda: (
      <CarteAgenda
        sources={{ evenements, taches, deliveries, rappels }}
        onOuvrir={() => setPanneau({ cle: "agenda" })}
      />
    ),
    stock: (
      <CarteStock
        stock={chiffres.stock}
        valeurVisible={droits.champVisible("produits", "valeur_stock")}
        onProduit={(produit) => setPanneau({ cle: "produit", produit })}
        onCommander={() => setPanneau({ cle: "ruptures" })}
      />
    ),
    sorties: (
      <CarteSorties
        flux={chiffres.flux}
        periode={periode}
        achatsVisibles={droits.champVisible("achats", "prix_achat")}
      />
    ),
    taches: (
      <CarteTaches
        taches={taches}
        devis={quotes}
        onTerminer={onTerminerTache}
        onVoirTaches={onNavigateTab ? () => onNavigateTab("taches") : undefined}
        onVoirDevis={onNavigateTab ? () => onNavigateTab("devis") : undefined}
      />
    ),
    vendeurs: (
      <CarteVendeurs
        vendeurs={sellers}
        montantsVisibles={droits.champVisible("vendeurs", "montant")}
        onGerer={onNavigateTab ? () => onNavigateTab("vendeurs") : undefined}
      />
    ),
    commandes: (
      <CarteCommandes
        commandes={chiffres.commandes}
        onOuvrir={onNavigateTab ? () => onNavigateTab("commandes") : undefined}
      />
    ),
    resultat: (
      <CarteResultat
        resultat={chiffres.resultat}
        periode={periode}
        visible={droits.champVisible("ventes", "marge")}
        onDetail={() => setPanneau({ cle: "resultat" })}
      />
    ),
    paiements: (
      <CartePaiements
        paiements={chiffres.paiements}
        periode={periode}
        visible={droits.champVisible("paiements", "montant")}
        onEncaisse={() => setPanneau({ cle: "encaisse" })}
        onRecevoir={() => setPanneau({ cle: "recevoir" })}
        onRetard={() => setPanneau({ cle: "retard" })}
      />
    ),
    clients: (
      <CarteClients
        clients={chiffres.clients}
        visible={droits.champVisible("clients", "montant")}
        onRelancer={(client) => setPanneau({ cle: "client", client })}
        onTous={onNavigateTab ? () => onNavigateTab("clients") : undefined}
      />
    ),
    journal: (
      <CarteJournal
        journal={lignesJournal}
        montantsVisibles={droits.champVisible("historique", "montant")}
        erreur={donnees.erreurs.journal}
        onReessayer={donnees.recharger}
        onHistorique={onNavigateTab ? () => onNavigateTab("historique") : undefined}
      />
    ),
    ruptures: (
      <CarteRuptures
        stock={chiffres.stock}
        onProduit={(produit) => setPanneau({ cle: "produit", produit })}
      />
    ),
    mouvements: (
      <CarteMouvements
        stock={chiffres.stock}
        periode={periode}
        erreur={donnees.erreurs.mouvements}
        onReessayer={donnees.recharger}
      />
    ),
    top: (
      <CarteTopProduits
        top={chiffres.top}
        totalPeriode={chiffres.ventes.total}
        periode={periode}
        visible={droits.champVisible("ventes", "montant")}
        onToutes={onNavigateTab ? () => onNavigateTab("ventes") : undefined}
      />
    ),
    livraisons: (
      <CarteLivraisons
        livraisons={deliveries}
        visible={droits.champVisible("livraisons", "montant")}
        onOuvrir={onNavigateTab ? () => onNavigateTab("livraisons") : undefined}
      />
    ),
    fournisseurs: (
      <CarteFournisseurs
        fournisseurs={chiffres.fournisseurs}
        periode={periode}
        onOuvrir={() => setPanneau({ cle: "fournisseurs" })}
      />
    ),
    fil: (
      <CarteFilVentes
        ventes={sales}
        produits={products}
        images={productImages}
        montantsVisibles={droits.champVisible("ventes", "montant")}
        titre={aSoi ? "Mes ventes" : "Fil des ventes"}
        onToutVoir={onNavigateTab ? () => onNavigateTab("ventes") : undefined}
      />
    ),
  };

  return (
    <div className={`dash2${focus ? " calm" : ""}`}>
      <div className="dash2-wrap">
        <header className="top">
          <div className="hello">
            <div className="eyebrow">
              {/* La date longue sur ordinateur, courte dès la tablette :
                  « Mercredi 16 septembre 2026 » mange toute la ligne. */}
              <span className="date-longue">{dateLongue(jour)}</span>
              <span className="date-courte">{dateCourte(jour)}</span>
              <span className="fresh">
                <i aria-hidden="true" />
                <span>{chargeA ? `Mis à jour à ${heure(chargeA)}` : "Chargement…"}</span>
                <button
                  ref={boutonRafraichir}
                  className="icon-btn"
                  type="button"
                  onClick={rafraichir}
                  aria-label="Actualiser les données"
                >
                  {ICONE_RAFRAICHIR}
                </button>
              </span>
            </div>
            <h1>
              {salutation}
              {prenom ? `, ${prenom}` : ""}
            </h1>
          </div>

          <div className="tools">
            {droits.vuesDisponibles.length > 1 && (
              <MenuPill
                icon={ICONE_PERSONNE}
                label="Vue"
                value={vueCourante?.nom ?? "Dirigeant"}
                alignLeft
                ariaLabel={`Vue : ${vueCourante?.nom ?? "Dirigeant"}`}
              >
                {(fermer) =>
                  VUES.filter((v) => droits.vuesDisponibles.includes(v.cle)).map((v) => (
                    <MenuOption
                      key={v.cle}
                      checked={droits.vue === v.cle}
                      onClick={() => {
                        droits.changerDeVue(v.cle);
                        fermer();
                      }}
                    >
                      <span className="two-lines">
                        {v.nom}
                        <small>{v.resume}</small>
                      </span>
                    </MenuOption>
                  ))
                }
              </MenuPill>
            )}

            <MenuPill
              icon={ICONE_CALENDRIER}
              label={periode.nom}
              value={periode.libelle}
              ariaLabel={`Période : ${periode.nom}, ${periode.libelle}`}
            >
              {(fermer) => (
                <>
                  {apercus.map((a) => (
                    <MenuOption
                      key={a.cle}
                      checked={periode.cle === a.cle}
                      hint={a.libelle}
                      onClick={() => {
                        choisir(a.cle);
                        fermer();
                      }}
                    >
                      {a.nom}
                    </MenuOption>
                  ))}
                  <form
                    className="custom"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!du || !au || du > au) {
                        setErreurDates(true);
                        return;
                      }
                      setErreurDates(false);
                      choisirIntervalle(du, au);
                      fermer();
                    }}
                  >
                    <label>
                      Du
                      <input
                        type="date"
                        value={du}
                        max={aujourdhui}
                        onChange={(e) => setDu(e.target.value)}
                      />
                    </label>
                    <label>
                      Au
                      <input
                        type="date"
                        value={au}
                        max={aujourdhui}
                        onChange={(e) => setAu(e.target.value)}
                      />
                    </label>
                    {erreurDates && (
                      <p className="err">La date de début doit être avant la date de fin.</p>
                    )}
                    <button className="btn" type="submit">
                      Appliquer la période
                    </button>
                  </form>
                </>
              )}
            </MenuPill>

            <Pill onClick={basculerFocus} pressed={focus} title="Masquer les cartes secondaires">
              {ICONE_OEIL}
              <span className="pill-label">Mode focus</span>
            </Pill>

            <Pill
              square
              onClick={() => setTheme(sombre ? "light" : "dark")}
              ariaLabel={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {sombre ? ICONE_SOLEIL : ICONE_LUNE}
            </Pill>
          </div>

          <div className="brief">
            <p className="synthese" aria-live="polite">
              {synthese.map((m, i) =>
                m.fort ? (
                  <b key={i}>{m.texte}</b>
                ) : (
                  <React.Fragment key={i}>{m.texte}</React.Fragment>
                ),
              )}
            </p>

            {/* Sous neuf cents pixels, la phrase cède la place au bandeau :
                le montant, la comparaison, la période de référence. */}
            <div className="pulse" aria-live="polite">
              <div className="pulse-main">
                <small>Ventes · {periode.libelle}</small>
                <b className="num">{compacte.montant}</b>
              </div>
              {(compacte.comparaison || compacte.reference) && (
                <div className="pulse-cmp">
                  {compacte.comparaison && (
                    <span className={`trend ${compacte.ton}`}>{compacte.comparaison}</span>
                  )}
                  {compacte.reference && <small>{compacte.reference}</small>}
                </div>
              )}
            </div>

            <div className="attn-label">
              {chiffres.attention.total > 0
                ? `À regarder aujourd'hui · ${chiffres.attention.total}`
                : "Aujourd'hui"}
            </div>
            <div className="attn" aria-label="Points d'attention">
              {chiffres.attention.total === 0 ? (
                <ChipRienDUrgent />
              ) : (
                <>
                  {chiffres.attention.tachesEnRetard > 0 && (
                    <Chip
                      nombre={chiffres.attention.tachesEnRetard}
                      singulier="tâche en retard"
                      pluriel="tâches en retard"
                      ton="crit"
                      cible="carte-taches"
                      onAller={allerALaCarte}
                    />
                  )}
                  {chiffres.attention.produitsARecommander > 0 && (
                    <Chip
                      nombre={chiffres.attention.produitsARecommander}
                      singulier="produit à recommander"
                      pluriel="produits à recommander"
                      ton="warn"
                      cible="carte-ruptures"
                      onAller={allerALaCarte}
                    />
                  )}
                  {chiffres.attention.devisSansReponse > 0 && (
                    <Chip
                      nombre={chiffres.attention.devisSansReponse}
                      singulier="devis sans réponse"
                      pluriel="devis sans réponse"
                      ton="info"
                      cible="carte-taches"
                      onAller={allerALaCarte}
                    />
                  )}
                </>
              )}
            </div>

            {droits.vue !== "dirigeant" && vueCourante && (
              <div className="rolenote">
                {ICONE_OEIL}
                Vue <b>{vueCourante.nom}</b> · {droits.cartes.length} cartes selon les permissions
              </div>
            )}
          </div>
        </header>

        <BandeauAujourdhui
          tuiles={droits.tuiles}
          jour={chiffres.duJour}
          stock={chiffres.stock}
          journal={journalDuJour}
          valeurStockVisible={droits.champVisible("produits", "valeur_stock")}
          montantsAchatVisibles={droits.champVisible("achats", "prix_achat")}
          onOuvrir={(cle) => {
            if (cle === "activite") {
              onNavigateTab?.("historique");
              return;
            }
            setPanneau(DETAIL_TUILE[cle]);
          }}
          onVendre={peutVendre && onNavigateTab ? () => onNavigateTab("ventes") : undefined}
        />

        <section
          className={`grid${droits.vue !== "dirigeant" ? " dense" : ""}`}
          aria-label="Tableau de bord"
        >
          {/* Chaque carte dans l'ordre que la vue a decide. Celles qui
              restent a construire gardent leur squelette : la place est
              deja reservee, rien ne sautera quand le contenu arrivera. */}
          {droits.cartes.map((cle) => {
            const rendue = cartes[cle];
            if (rendue) return <React.Fragment key={cle}>{rendue}</React.Fragment>;
            const def = CARTE_PAR_CLE.get(cle);
            return (
              <CarteSquelette key={cle} span={def?.span ?? 4} lignes={def?.span === 8 ? 5 : 3} />
            );
          })}

          {/* ── Table de contrôle ──
              Outil de recette, pas element du tableau de bord : la
              maquette n en contient pas, et un commercant n a rien a en
              faire. Il reste a portee derriere son interrupteur, parce
              que la comparaison des chiffres ne peut se faire que sur
              une vraie boutique. Voir CLE_CONTROLE. */}
          {controle && (
            <Card span={12} id="carte-controle">
              <CardHeader
                title="Table de contrôle"
                action={<span className="tag neutre">provisoire</span>}
              />
              <p style={{ margin: 0, color: "var(--ink-2)" }}>
                Les chiffres ci-dessous sont ceux que les cartes afficheront. Comparez-les à
                l&apos;ancien tableau de bord et aux pages Ventes, Stock, Bilan et Paiements sur la
                même période&nbsp;: ils doivent coïncider.
              </p>

              {(donnees.erreurs.mouvements || donnees.erreurs.journal) && (
                <EtatErreur
                  message={
                    donnees.erreurs.mouvements
                      ? `Mouvements de stock : ${donnees.erreurs.mouvements}`
                      : `Journal : ${donnees.erreurs.journal}`
                  }
                  onReessayer={donnees.recharger}
                />
              )}

              <div className="controle">
                <Bloc titre="Ventes">
                  <L
                    nom="Total de la période"
                    valeur={sous("ventes", "montant", chiffres.ventes.total)}
                  />
                  <L
                    nom="Période précédente"
                    valeur={sous("ventes", "montant", chiffres.ventes.totalPrecedent)}
                  />
                  <L nom="Tickets" valeur={nombre(chiffres.ventes.tickets)} />
                  <L nom="Lignes de vente" valeur={nombre(chiffres.ventes.lignes)} />
                  <L
                    nom="Panier moyen"
                    valeur={sous("ventes", "montant", chiffres.ventes.panierMoyen)}
                  />
                  <L nom="Marge brute" valeur={sous("ventes", "marge", chiffres.ventes.marge)} />
                  <L
                    nom="Évolution"
                    valeur={
                      <Trend
                        data={{
                          valeur: chiffres.ventes.total,
                          reference: chiffres.ventes.totalPrecedent,
                        }}
                      />
                    }
                  />
                </Bloc>

                <Bloc titre="Trésorerie et flux">
                  <L
                    nom="Trésorerie (calcul existant)"
                    valeur={sous("capital", "montant", capital.tresorerieGlobaleActuelle)}
                  />
                  <L nom="Encaissé sur la période" valeur={montant(chiffres.flux.encaisse)} />
                  <L nom="Achats" valeur={sous("achats", "prix_achat", chiffres.flux.achats)} />
                  <L nom="Dépenses" valeur={montant(chiffres.flux.depenses)} />
                  <L nom="Sorties totales" valeur={montant(chiffres.flux.sorties)} />
                  <L nom="Sorties par jour" valeur={montant(chiffres.flux.sortiesParJour)} />
                  <L nom="Part des ventes" valeur={pourcent(chiffres.flux.partDesVentes)} />
                </Bloc>

                <Bloc titre="Résultat (nouveau)">
                  <L nom="Marge brute" valeur={montant(chiffres.resultat.marge)} />
                  <L nom="− Dépenses" valeur={montant(chiffres.resultat.depenses)} />
                  <L nom="= Bénéfice" valeur={montant(chiffres.resultat.benefice)} />
                  <L
                    nom="Période précédente"
                    valeur={montant(chiffres.resultat.beneficePrecedent)}
                  />
                  <L
                    nom="Achats non déduits"
                    valeur={montant(chiffres.resultat.achatsNonDeduits)}
                    note="Ils deviennent un coût quand les produits se vendent"
                  />
                </Bloc>

                <Bloc titre="Stock">
                  <L
                    nom="Valeur du stock"
                    valeur={sous("produits", "valeur_stock", chiffres.stock.valeur)}
                  />
                  <L nom="À recommander" valeur={nombre(chiffres.stock.aRecommander.length)} />
                  <L nom="En rupture" valeur={nombre(chiffres.stock.enRupture.length)} />
                  <L nom="Entrées du jour" valeur={`${nombre(chiffres.stock.entreesDuJour)} u.`} />
                  <L nom="Sorties du jour" valeur={`${nombre(chiffres.stock.sortiesDuJour)} u.`} />
                  <L
                    nom="Source des mouvements"
                    valeur={
                      chiffres.stock.mouvementsEnRepli ? "achats et ventes" : "stock_movements"
                    }
                    note={
                      chiffres.stock.mouvementsEnRepli
                        ? "La table n'a rien rendu : repli sur les quantités"
                        : `${donnees.mouvements.length} lignes lues`
                    }
                  />
                </Bloc>

                <Bloc titre="Paiements">
                  <L nom="Encaissé" valeur={montant(chiffres.paiements.encaisse)} />
                  <L
                    nom="À recevoir (moins de 30 j)"
                    valeur={montant(chiffres.paiements.aRecevoir)}
                    note={pluriel(chiffres.paiements.aRecevoirClients, "client")}
                  />
                  <L
                    nom="En retard (plus de 30 j)"
                    valeur={montant(chiffres.paiements.enRetard)}
                    note={pluriel(chiffres.paiements.enRetardClients, "client")}
                  />
                </Bloc>

                <Bloc titre="Clients, commandes, fournisseurs">
                  <L nom="Nouveaux clients" valeur={nombre(chiffres.clients.nouveaux)} />
                  <L nom="Clients actifs" valeur={nombre(chiffres.clients.actifs)} />
                  <L nom="À relancer" valeur={nombre(chiffres.clients.aRelancer.length)} />
                  <L nom="Commandes reçues" valeur={nombre(chiffres.commandes.recues)} />
                  <L nom="En préparation" valeur={nombre(chiffres.commandes.enPreparation)} />
                  <L nom="En livraison" valeur={nombre(chiffres.commandes.enLivraison)} />
                  <L nom="À encaisser" valeur={nombre(chiffres.commandes.aEncaisser)} />
                  <L nom="Dû aux fournisseurs" valeur={montant(chiffres.fournisseurs.totalDu)} />
                  <L
                    nom="Échéances dépassées"
                    valeur={nombre(chiffres.fournisseurs.echeancesDepassees)}
                  />
                  <L
                    nom="Payé sur la période"
                    valeur={montant(chiffres.fournisseurs.payeSurLaPeriode)}
                  />
                </Bloc>

                <Bloc titre="Produits les plus vendus">
                  {chiffres.top.length === 0 ? (
                    <L nom="Aucune vente sur la période" valeur="—" />
                  ) : (
                    chiffres.top.map((p) => (
                      <L
                        key={p.id}
                        nom={p.nom}
                        valeur={montant(p.montant)}
                        note={`${pourcent(p.part)} · ${nombre(p.quantite)} ${p.unite ?? "unité"}`}
                      />
                    ))
                  )}
                </Bloc>

                <Bloc titre="Lectures et permissions">
                  <L nom="Vue" valeur={vueCourante?.nom ?? "—"} />
                  <L
                    nom="Cartes retenues"
                    valeur={nombre(droits.cartes.length)}
                    note={droits.cartes.map((c) => CARTE_PAR_CLE.get(c)?.titre ?? c).join(" · ")}
                  />
                  <L nom="Tuiles retenues" valeur={nombre(droits.tuiles.length)} />
                  <L
                    nom="Sources demandées"
                    valeur={nombre(droits.besoins.size)}
                    note={[...droits.besoins].sort().join(", ")}
                  />
                  <L
                    nom="Lignes de journal"
                    valeur={nombre(donnees.journal.length)}
                    note="Créations comprises, contrairement à la cloche"
                  />
                  <L nom="Lecture en cours" valeur={donnees.chargement ? "oui" : "non"} />
                </Bloc>
              </div>

              <div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setPanneau({ cle: "resultat" })}
                >
                  Voir le détail du calcul du résultat
                </button>
              </div>
            </Card>
          )}
        </section>
      </div>

      <PanneauDetail
        vue={panneau}
        onFermer={() => setPanneau(null)}
        onNaviguer={onNavigateTab}
        donnees={{
          periode,
          ventes: chiffres.ventes,
          flux: chiffres.flux,
          stock: chiffres.stock,
          paiements: chiffres.paiements,
          clients: chiffres.clients,
          fournisseurs: chiffres.fournisseurs,
          resultat: chiffres.resultat,
          agenda: agendaDuMoisCourant,
          nomBoutique,
        }}
      />
    </div>
  );
};

/* ─── deux petites briques, propres à la table de contrôle ─── */

const Bloc: React.FC<{ titre: string; children: React.ReactNode }> = ({ titre, children }) => (
  <div className="controle-bloc">
    <div className="controle-titre">{titre}</div>
    {children}
  </div>
);

const L: React.FC<{ nom: string; valeur: React.ReactNode; note?: string }> = ({
  nom,
  valeur,
  note,
}) => (
  <div className="controle-ligne">
    <span>
      {nom}
      {note && <small>{note}</small>}
    </span>
    <b className="num">{valeur}</b>
  </div>
);

export default DashboardV2Page;
