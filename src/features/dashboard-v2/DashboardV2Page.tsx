import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./dashboard.css";
import "./tantana.css";
import { useDashboardPeriod, decalerJours, nombreDeJours } from "./hooks/useDashboardPeriod";
import { useDashboardPermissions } from "./hooks/useDashboardPermissions";
import { useDashboardData } from "./hooks/useDashboardData";
import { dateLocale, montant, nombre, pluriel, pourcent, montantMasque } from "./lib/format";
import { MenuOption, MenuPill } from "./components/Pill";
import { Card, CardHeader } from "./components/Card";
import { EtatErreur } from "./components/States";
import { Chip } from "./components/Chip";
import { Section } from "./components/Tn";
import { HeroTableauDeBord, type PointVentes } from "./components/HeroTableauDeBord";
import { CarteTresorerie } from "./cards/CarteTresorerie";
import { CarteArgentMinis } from "./cards/CarteArgentMinis";
import { CarteMouvementsArgent } from "./cards/CarteMouvementsArgent";
import { CarteAgenda } from "./cards/CarteAgenda";
import { CarteStock } from "./cards/CarteStock";
import { CarteStockChiffres } from "./cards/CarteStockChiffres";
import { CarteTaches } from "./cards/CarteTaches";
import { CarteVendeurs } from "./cards/CarteVendeurs";
import { CarteCommandes } from "./cards/CarteCommandes";
import { CarteFilVentes } from "./cards/CarteFilVentes";
import { CarteResultat } from "./cards/CarteResultat";
import { CartePaiements } from "./cards/CartePaiements";
import { CarteClients } from "./cards/CarteClients";
import { CarteMouvements } from "./cards/CarteMouvements";
import { CarteMouvementsStock } from "./cards/CarteMouvementsStock";
import { CarteTopProduits } from "./cards/CarteTopProduits";
import { CarteLivraisons } from "./cards/CarteLivraisons";
import { CarteFournisseurs } from "./cards/CarteFournisseurs";
import {
  SectionPartenaires,
  type FicheFournisseur,
  type FichePrestataire,
  type ReglementFournisseur,
} from "./cards/SectionPartenaires";
import { PanneauDetail, type VueDetail } from "./components/PanneauDetail";
import { Trend } from "./components/Trend";
import { allerALaCarte } from "./lib/defilement";
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
import {
  banniereArgent,
  banniereFournisseurs,
  banniereOperations,
  banniereStock,
  banniereVentes,
} from "./assets/images";
import { dateDuJour } from "../../lib/dates";
import { useAuth } from "../../hooks/useAuth";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "../../lib/prealerteStock";
import { Icone } from "../../components/shared/Icone";
import { vignettesParProduit } from "../../components/shared/VignetteProduit";

/**
 * LE TABLEAU DE BORD v2
 *
 * Portage de `docs/maquette/tableau-de-bord-complet.html`. Voir
 * `docs/dashboard-v2/audit.md` pour la carte des données.
 *
 * ÉTAT : phase 2. L'en-tête est complet — période et comparaison,
 * phrase de synthèse, points d'attention, vue par métier. Les chiffres
 * sont branchés sur les vraies données et se relisent tous dans la
 * table de contrôle, qui sert à les comparer à l'ancien tableau de
 * bord avant que les cartes ne les habillent aux phases suivantes.
 *
 * CETTE PAGE NE DESSINE PAS LA COQUILLE. La maquette redessinait aussi
 * la barre latérale ; celle-ci existe déjà et sert vingt-cinq écrans.
 *
 * ELLE NE FAIT AUCUNE ÉCRITURE. Ni au chargement, ni au rafraîchissement.
 */

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
  supplierPayments: ReglementFournisseur[];
  /** Les deux annuaires, pour la section Fournisseurs & Prestataires. */
  suppliers?: FicheFournisseur[];
  providers?: FichePrestataire[];
  /** Le thème sombre de l'application : le ciel du bonjour passe en nuit. */
  sombre?: boolean;
  /**
   * Termine une tâche, par la fonction de l'application.
   *
   * Absente quand la personne n'en a pas le droit : la case est alors
   * désactivée plutôt que d'échouer en silence.
   */
  onTerminerTache?: (id: string) => unknown;
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
  /**
   * Ouvre le bon de commande — la liste à réapprovisionner, prête à
   * imprimer ou à télécharger.
   *
   * Il vit à la racine de l'application parce que la cloche l'ouvre
   * aussi : le tableau de bord ne fait que tirer sur la corde.
   */
  onTelechargerLaListe?: () => void;
  /**
   * Les réglages de préalerte de la boutique.
   *
   * Absents, l'étagère de stock n'a qu'un niveau — exactement ce
   * qu'elle montrait avant que la préalerte existe.
   */
  reglagesAlertes?: ReglagesAlertesStock;
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
  suppliers = [],
  providers = [],
  sombre = false,
  onTerminerTache,
  onRafraichir,
  onNavigateTab,
  onTelechargerLaListe,
  reglagesAlertes = REGLAGES_PAR_DEFAUT,
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
    const stock = chiffresStock(toutes, periode, aujourdhui, reglagesAlertes);
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
      attention: pointsDAttention(toutes, stock, aujourdhui),
    };
  }, [toutes, periode, aujourdhui, supplierPayments, reglagesAlertes]);

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

  const [controle, setControle] = useState(false);
  useEffect(() => {
    try {
      setControle(window.localStorage.getItem(CLE_CONTROLE) === "1");
    } catch {
      /* Navigation privée : le réglage repart à zéro. */
    }
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

  const vueCourante = VUE_PAR_CLE.get(droits.vue);

  /** Un montant que cette personne n'a pas le droit de voir. */
  const sous = (module: string, champ: string, valeur: number) =>
    droits.champVisible(module, champ) ? montant(valeur) : montantMasque();

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
  const voit = (cle: CleCarte) => droits.cartes.includes(cle);

  /** Les photos de produits, par identifiant, pour l'étagère de stock. */
  const vignettes = useMemo(() => vignettesParProduit(productImages), [productImages]);

  /**
   * L'aperçu des ventes : un point par jour de la période, et au moins
   * sept — une période d'un jour ne ferait pas une courbe. Au-delà de
   * soixante-deux jours, on garde les derniers.
   */
  const pointsVentes = useMemo<PointVentes[]>(() => {
    const { fin } = periode.intervalle;
    const n = nombreDeJours(periode.intervalle);
    const debut =
      n < 7 ? decalerJours(fin, -6) : n > 62 ? decalerJours(fin, -61) : periode.intervalle.debut;
    const parJour = new Map<string, number>();
    for (const v of sales) {
      if (v.date >= debut && v.date <= fin)
        parJour.set(v.date, (parJour.get(v.date) ?? 0) + v.totalVente);
    }
    const points: PointVentes[] = [];
    for (let j = debut; j <= fin; j = decalerJours(j, 1)) {
      points.push({
        jour: j,
        libelle: dateLocale(j).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        montant: parJour.get(j) ?? 0,
      });
    }
    return points;
  }, [sales, periode.intervalle]);
  const sousTitreVentes = `Évolution de vos ventes ${
    nombreDeJours(periode.intervalle) < 7 ? "sur les 7 derniers jours" : periode.phrase
  }`;

  /** La dernière opération d'argent connue, et combien aujourd'hui. */
  const derniereOperation = useMemo(() => {
    const jours = [
      ...sales.map((v) => v.date),
      ...purchases.map((a) => a.date),
      ...expenses.map((d) => d.date),
    ];
    return {
      jour: jours.length ? jours.reduce((a, b) => (a > b ? a : b)) : null,
      aujourdhui: jours.filter((j) => j === aujourdhui).length,
    };
  }, [sales, purchases, expenses, aujourdhui]);

  /** Le choix de période, posé dans l'aperçu des ventes et dans le stock. */
  const selecteurPeriode = (
    <MenuPill
      icon={<Icone nom="calendar" />}
      value={periode.nom}
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
            {erreurDates && <p className="err">La date de début doit être avant la date de fin.</p>}
            <button className="btn pri" type="submit">
              Appliquer la période
            </button>
          </form>
        </>
      )}
    </MenuPill>
  );

  /** Le choix de la vue métier, offert au propriétaire. */
  const selecteurVue =
    droits.vuesDisponibles.length > 1 ? (
      <MenuPill
        icon={<Icone nom="eye" />}
        value={vueCourante?.nom ?? "Dirigeant"}
        alignLeft
        className="vue"
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
    ) : null;

  /** Ce qui est urgent, en puces sous le bonjour. Rien quand tout va bien. */
  const puces =
    chiffres.attention.total === 0 ? null : (
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
            cible="carte-stock"
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
    );

  const aller = onNavigateTab;
  const vers = (onglet: string) => (aller ? () => aller(onglet) : undefined);

  /* ── Les sections, dans l'ordre de la maquette ── */

  const operations = (["agenda", "taches", "commandes", "livraisons"] as CleCarte[]).filter(voit);
  const ventesCartes = (["fil", "clients", "top", "vendeurs"] as CleCarte[]).filter(voit);
  const argent = {
    tresorerie: voit("tresorerie"),
    sorties: voit("sorties"),
    resultat: voit("resultat"),
    paiements: voit("paiements"),
    fournisseurs: voit("fournisseurs"),
  };
  const avecArgent = Object.values(argent).some(Boolean);
  const stockCartes = {
    stock: voit("stock"),
    ruptures: voit("ruptures"),
    mouvements: voit("mouvements"),
  };
  const avecStock = Object.values(stockCartes).some(Boolean);
  const partenaires = {
    fournisseurs: voit("annuaireFournisseurs"),
    prestataires: voit("annuairePrestataires"),
    aPayer: voit("fournisseurs"),
  };
  const avecPartenaires = partenaires.fournisseurs || partenaires.prestataires;

  const carteOperation: Record<string, React.ReactNode> = {
    agenda: (
      <CarteAgenda
        sources={{ evenements, taches, deliveries, rappels }}
        onOuvrir={() => setPanneau({ cle: "agenda" })}
      />
    ),
    taches: (
      <CarteTaches
        taches={taches}
        devis={quotes}
        onTerminer={onTerminerTache}
        onVoirTaches={vers("taches")}
        onVoirDevis={vers("devis")}
      />
    ),
    commandes: <CarteCommandes commandes={chiffres.commandes} onOuvrir={vers("commandes")} />,
    livraisons: (
      <CarteLivraisons
        livraisons={deliveries}
        visible={droits.champVisible("livraisons", "montant")}
        onOuvrir={vers("livraisons")}
      />
    ),
  };

  const carteVente: Record<string, React.ReactNode> = {
    fil: (
      <CarteFilVentes
        ventes={sales}
        produits={products}
        images={productImages}
        clients={clients}
        montantsVisibles={droits.champVisible("ventes", "montant")}
        titre={aSoi ? "Mes ventes" : "Fil des ventes"}
        onToutVoir={vers("ventes")}
      />
    ),
    clients: (
      <CarteClients
        clients={chiffres.clients}
        visible={droits.champVisible("clients", "montant")}
        onRelancer={(client) => setPanneau({ cle: "client", client })}
        onTousARelancer={() => setPanneau({ cle: "relancer" })}
        onTous={vers("clients")}
      />
    ),
    top: (
      <CarteTopProduits
        top={chiffres.top}
        totalPeriode={chiffres.ventes.total}
        periode={periode}
        visible={droits.champVisible("ventes", "montant")}
        onToutes={vers("ventes")}
      />
    ),
    vendeurs: (
      <CarteVendeurs
        vendeurs={sellers}
        montantsVisibles={droits.champVisible("vendeurs", "montant")}
        onGerer={vers("vendeurs")}
      />
    ),
  };

  const grille = (cles: CleCarte[], rendu: Record<string, React.ReactNode>) => (
    <div className="g2">
      {cles.map((c) => (
        <React.Fragment key={c}>{rendu[c]}</React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="tn">
      <HeroTableauDeBord
        prenom={prenom}
        sombre={sombre}
        chargeA={chargeA}
        onRafraichir={rafraichir}
        boutonRafraichir={boutonRafraichir}
        vue={selecteurVue}
        alertes={puces}
        tuiles={droits.tuiles}
        jour={chiffres.duJour}
        stock={chiffres.stock}
        journal={journalDuJour}
        erreurJournal={donnees.erreurs.journal}
        onReessayerJournal={donnees.recharger}
        valeurStockVisible={droits.champVisible("produits", "valeur_stock")}
        montantsAchatVisibles={droits.champVisible("achats", "prix_achat")}
        montantsVentesVisibles={droits.champVisible("ventes", "montant")}
        onOuvrir={(cle) => {
          if (cle === "activite") {
            onNavigateTab?.("historique");
            return;
          }
          setPanneau(DETAIL_TUILE[cle]);
        }}
        onNaviguer={onNavigateTab}
        graphique={
          voit("ventes") || droits.tuiles.includes("ventes")
            ? {
                points: pointsVentes,
                sousTitre: sousTitreVentes,
                selecteur: selecteurPeriode,
                onDetails: () => setPanneau({ cle: "ventes" }),
              }
            : undefined
        }
      />

      {droits.vue !== "dirigeant" && vueCourante && (
        <p className="rolenote">
          <Icone nom="eye" />
          Vue <b>{vueCourante.nom}</b> · {droits.cartes.length} cartes selon les permissions
        </p>
      )}

      {operations.length > 0 && (
        <Section id="operations" image={banniereOperations} titre="Opérations">
          {grille(operations, carteOperation)}
        </Section>
      )}

      {ventesCartes.length > 0 && (
        <Section id="ventes" image={banniereVentes} titre={aSoi ? "Mes ventes" : "Ventes"}>
          {grille(ventesCartes, carteVente)}
        </Section>
      )}

      {avecArgent && (
        <Section id="argent" image={banniereArgent} titre="L'argent">
          {argent.tresorerie && (
            <CarteTresorerie
              capital={capital}
              flux={chiffres.flux}
              periode={periode.libelle}
              /* Crédits récents et retards confondus : pour le lecteur du
                 solde, c'est le même argent — celui qui n'est pas rentré. */
              duParLesClients={chiffres.paiements.aRecevoir + chiffres.paiements.enRetard}
              montantVisible={droits.champVisible("capital", "montant")}
            />
          )}
          {(argent.tresorerie || argent.sorties) && (
            <CarteArgentMinis
              flux={chiffres.flux}
              periode={periode.libelle}
              solde={capital.tresorerieGlobaleActuelle}
              derniere={derniereOperation}
              montantVisible={droits.champVisible("capital", "montant")}
              avec={{
                entrees: argent.tresorerie,
                sorties: argent.sorties,
                solde: argent.tresorerie,
                derniere: argent.tresorerie,
              }}
              onEntrees={() => setPanneau({ cle: "encaisse" })}
              onSorties={() => setPanneau({ cle: "sorties" })}
              onSolde={vers("capital")}
              onDerniere={vers("historique")}
            />
          )}
          {(argent.resultat || argent.tresorerie) && (
            <div
              className={`g2 gap argent-bas${argent.resultat && argent.tresorerie ? "" : " une"}`}
            >
              {argent.resultat && (
                <CarteResultat
                  resultat={chiffres.resultat}
                  periode={periode}
                  visible={droits.champVisible("ventes", "marge")}
                  onDetail={() => setPanneau({ cle: "resultat" })}
                  onHistorique={vers("historique")}
                />
              )}
              {argent.tresorerie && (
                <CarteMouvementsArgent
                  ventes={sales}
                  achats={purchases}
                  depenses={expenses}
                  produits={products}
                  achatsVisibles={droits.champVisible("achats", "prix_achat")}
                  ventesVisibles={droits.champVisible("ventes", "montant")}
                  onToutVoir={vers("historique")}
                />
              )}
            </div>
          )}
          {(argent.paiements || argent.fournisseurs) && (
            <div className={`g2 gap${argent.paiements && argent.fournisseurs ? "" : " une"}`}>
              {argent.paiements && (
                <CartePaiements
                  paiements={chiffres.paiements}
                  periode={periode}
                  visible={droits.champVisible("paiements", "montant")}
                  onEncaisse={() => setPanneau({ cle: "encaisse" })}
                  onRecevoir={() => setPanneau({ cle: "recevoir" })}
                  onRetard={() => setPanneau({ cle: "retard" })}
                />
              )}
              {argent.fournisseurs && (
                <CarteFournisseurs
                  fournisseurs={chiffres.fournisseurs}
                  periode={periode}
                  onOuvrir={() => setPanneau({ cle: "fournisseurs" })}
                />
              )}
            </div>
          )}
        </Section>
      )}

      {avecStock && (
        <Section id="stock" image={banniereStock} titre="Le stock">
          {(stockCartes.stock || stockCartes.ruptures) && (
            <CarteStockChiffres
              stock={chiffres.stock}
              valeurVisible={droits.champVisible("produits", "valeur_stock")}
              avecRuptures={stockCartes.ruptures}
              onRafraichir={rafraichir}
              onVoirLaListe={onTelechargerLaListe}
              onVoirRuptures={() => setPanneau({ cle: "ruptures" })}
            />
          )}
          {(stockCartes.stock || stockCartes.mouvements) && (
            <div
              className={`g2 gap stock-milieu${stockCartes.stock && stockCartes.mouvements ? "" : " une"}`}
            >
              {stockCartes.stock && (
                <CarteStock
                  stock={chiffres.stock}
                  valeurVisible={droits.champVisible("produits", "valeur_stock")}
                  vignettes={vignettes}
                  onProduit={(produit) => setPanneau({ cle: "produit", produit })}
                  onCommander={() => setPanneau({ cle: "ruptures" })}
                  onTelecharger={onTelechargerLaListe}
                />
              )}
              {stockCartes.mouvements && (
                <CarteMouvements
                  stock={chiffres.stock}
                  periode={periode}
                  selecteur={selecteurPeriode}
                  erreur={donnees.erreurs.mouvements}
                  onReessayer={donnees.recharger}
                />
              )}
            </div>
          )}
          {stockCartes.mouvements && (
            <CarteMouvementsStock
              mouvements={donnees.mouvements}
              produits={products}
              prixVisibles={droits.champVisible("achats", "prix_achat")}
              onToutVoir={vers("produits")}
            />
          )}
        </Section>
      )}

      {avecPartenaires && (
        <Section
          id="fournisseurs"
          image={banniereFournisseurs}
          titre="Fournisseurs & Prestataires"
          sousTitre="Gérez vos fournisseurs de produits et vos prestataires de services facilement."
        >
          <SectionPartenaires
            fournisseurs={partenaires.fournisseurs ? suppliers : null}
            prestataires={partenaires.prestataires ? providers : null}
            aPayer={partenaires.aPayer ? chiffres.fournisseurs : null}
            achats={droits.champVisible("achats", "prix_achat") ? purchases : []}
            reglements={droits.champVisible("achats", "prix_achat") ? supplierPayments : []}
            onFournisseurs={vers("fournisseurs")}
            onPrestataires={vers("prestataires")}
            onAchats={vers("achats")}
            onCreerCommande={onTelechargerLaListe}
          />
        </Section>
      )}

      {controle && (
        <section className="dash2 controle-zone grid" aria-label="Outils">
          {/* ── Table de contrôle ──
            Outil de recette, pas element du tableau de bord : la
            maquette n en contient pas, et un commercant n a rien a en
            faire. Il reste a portee derriere son interrupteur, parce
            que la comparaison des chiffres ne peut se faire que sur
            une vraie boutique. Voir CLE_CONTROLE. */}
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
                <L nom="Période précédente" valeur={montant(chiffres.resultat.beneficePrecedent)} />
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
                  valeur={chiffres.stock.mouvementsEnRepli ? "achats et ventes" : "stock_movements"}
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
        </section>
      )}

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
