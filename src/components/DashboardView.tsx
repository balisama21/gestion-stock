import React, { useMemo, useState } from "react";
import { Product, Sale, Expense, Seller, Purchase, CapitalSummary, LocaleSetting } from "../types";
import {
  Wallet,
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  TrendingUp,
  Package,
  ArrowDownRight,
  CheckCircle2,
  ArrowRightLeft,
  ShoppingBag,
  Clock,
  CreditCard,
  Truck,
  ChevronRight,
} from "lucide-react";
import {
  formatCurrency,
  formatDateLocale,
  getProductLabel,
  getProductVariant,
  getSaleLabel,
  getSaleVariant,
} from "../utils/formulas";
import { VariantBadge } from "./shared/VariantBadge";
import { BarreIndicateurs } from "./shared/StatBar";
import { moduleMasque, usePersonnalisation } from "../lib/personnalisation";
import { construireEnSuspens } from "../lib/enSuspens";
import {
  LIBELLE_DUREE,
  PERIODE_PAR_DEFAUT,
  calculerPeriode,
  filtrerParIntervalle,
  type ClePeriode,
} from "../lib/periodes";
import { DataList } from "./shared/DataList";
import { dateDuJour } from "../lib/dates";
import { SelecteurPeriode } from "./shared/SelecteurPeriode";
import { VignetteProduit, vignettesParProduit } from "./shared/VignetteProduit";
import { useAuth } from "../hooks/useAuth";
import { useNotificationPrefs } from "../lib/notificationPrefs";
import type { Database } from "../lib/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Database["public"]["Tables"]["clients"]["Row"] | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};
type Client = Database["public"]["Tables"]["clients"]["Row"];

interface DashboardViewProps {
  capital: CapitalSummary;
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  sellers: Seller[];
  orders: Order[];
  clients: Client[];
  /** Les devis, pour dire combien attendent encore une réponse. */
  quotes: { statut: string; total: number; valide_jusqu_au: string | null }[];
  /** Les courses, pour dire ce que les livreurs n'ont pas encore rendu. */
  deliveries: { statut: string; montant_encaisse: number; argent_remis_le: string | null }[];
  /**
   * Les photos des produits, pour que les listes montrent l'article
   * plutôt que son seul nom. Absentes : le carré à initiale prend la
   * place, et l'alignement des lignes ne change pas.
   */
  productImages?: { product_id: string | null; chemin: string; ordre: number }[];
  /**
   * Les catégories de produits, pour l'étiquette portée par chaque
   * ligne de vente. Facultatives, et souvent absentes : une boutique
   * qui n'en a créé aucune ne voit simplement pas d'étiquette.
   */
  categories?: { id: string; nom: string; usage: string }[];
  /** Les tâches, pour dire lesquelles ont dépassé leur échéance. */
  taches?: { statut: string; echeance: string | null }[];
  /** Les demandes d'avance sur salaire qui attendent une décision. */
  avancesEnAttente?: { montant: number }[];
  locale: LocaleSetting;
  /**
   * Faux quand l'utilisateur n'a pas le droit de voir les prix d'achat :
   * le badge de variante disparaît alors, plutôt que de révéler un prix
   * négocié dans un simple aperçu de tableau de bord.
   */
  showPrixAchat?: boolean;
  onNavigateTab: (tab: any) => void;
  /**
   * Ouvrir les Achats sur un formulaire déjà rempli pour ce produit.
   *
   * Absent quand l'utilisateur n'a pas le droit d'enregistrer un achat :
   * la ligne redevient alors une simple ligne d'information, sans
   * chevron ni clic — inutile de proposer un geste qui sera refusé.
   */
  onReapprovisionner?: (produit: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  capital,
  products,
  sales,
  purchases,
  expenses,
  sellers,
  orders = [],
  quotes = [],
  deliveries = [],
  clients = [],
  categories = [],
  taches = [],
  avancesEnAttente = [],
  productImages = [],
  locale,
  showPrixAchat = true,
  onNavigateTab,
  onReapprovisionner,
}) => {
  // Réglage « Alertes de trésorerie » (Paramètres → Notifications).
  const [notificationPrefs] = useNotificationPrefs();

  /**
   * Le prénom, pour dire bonjour à quelqu'un plutôt qu'à un écran.
   *
   * Le premier mot du nom complet, et rien d'autre : « Bonjour,
   * Maminirina » se dit, « Bonjour, Maminirina Rakotoarisoa » se lit
   * comme une convocation. Un compte créé sans nom — cela arrive, le
   * champ est facultatif à l'inscription — garde un accueil qui
   * fonctionne, sans trou ni virgule orpheline.
   */
  const { profile } = useAuth();
  const prenom = (profile?.full_name ?? "").trim().split(/\s+/)[0] || "";

  /**
   * Les modules que cette boutique a retirés.
   *
   * Masquer l'onglet ne suffisait pas : une boutique qui vend
   * uniquement au comptoir voyait toujours une tuile « Commandes » à
   * zéro sur son tableau de bord, et un raccourci vers un écran
   * devenu inaccessible. Un module retiré doit disparaître partout,
   * sinon il n'est pas retiré — il est seulement caché du menu.
   */
  const perso = usePersonnalisation();
  const montre = (cle: string) => !moduleMasque(perso, cle);

  /** Quelle photo represente chaque produit, calculee une fois. */
  const vignettes = useMemo(() => vignettesParProduit(productImages), [productImages]);

  /**
   * La période regardée.
   *
   * Elle ne porte QUE sur les flux — ventes, achats, dépenses et les
   * listes récentes. La trésorerie, le stock, les commandes en cours et
   * « En suspens » sont des soldes : ils décrivent l'instant présent et
   * n'ont pas de durée.
   *
   * Les indicateurs tenant désormais sur une seule barre, ce partage ne
   * se voit plus par leur place : chaque colonne porte donc son horizon
   * sous son chiffre. C'est la mention « argent disponible » ou « ce
   * mois-ci » qui dit, colonne par colonne, ce que le sélecteur touche
   * — et elle doit rester, sans quoi rien ne le dirait plus.
   */
  const [clePeriode, setClePeriode] = useState<ClePeriode>(PERIODE_PAR_DEFAUT);
  const periode = useMemo(() => calculerPeriode(clePeriode), [clePeriode]);

  /**
   * Ce qui n'est pas encore rentré, ce qui n'est pas encore sorti, et ce
   * qui attend une décision.
   *
   * Un commerçant ouvre son logiciel le soir pour deux questions : ce
   * que la journée a donné, et ce qui reste en suspens. La première a
   * ses indicateurs depuis longtemps ; la seconde était éparpillée dans
   * sept écrans qu'il fallait ouvrir un par un.
   *
   * Le calcul et le classement vivent dans `lib/enSuspens.ts` : à sept
   * natures et trois rangs d'urgence, cela ne se raisonne plus au milieu
   * d'un composant.
   *
   * Une ligne à zéro ne s'affiche pas : un tableau de bord qui annonce
   * « 0 Ar à recevoir » occupe la place sans rien apprendre. Et si tout
   * est à zéro, le bloc entier disparaît — c'est la bonne nouvelle.
   */
  const enSuspens = useMemo(
    () =>
      construireEnSuspens({
        sales,
        purchases,
        deliveries,
        quotes,
        orders,
        taches,
        avancesEnAttente,
        masque: (cle) => moduleMasque(perso, cle),
      }),
    [sales, purchases, deliveries, quotes, orders, taches, avancesEnAttente, perso],
  );

  const lowStockProducts = products
    .filter((p) => p.stockActuel <= p.seuilAlerte)
    .sort((a, b) => a.stockActuel - b.stockActuel);
  const totalStockValue = products.reduce((acc, p) => acc + p.stockActuel * p.prixAchat, 0);
  // ── Les flux, ramenés à la période choisie ──
  //
  // Avant, ces quatre totaux couvraient TOUT l'historique et portaient
  // pourtant un pourcentage « vs mois dernier » : le chiffre et son
  // évolution ne parlaient pas du même intervalle. Ils parlent
  // maintenant du même, celui que le sélecteur désigne.
  const ventesPeriode = filtrerParIntervalle(sales, (v) => v.date, periode.intervalle);
  const achatsPeriode = filtrerParIntervalle(purchases, (a) => a.date, periode.intervalle);
  const depensesPeriode = filtrerParIntervalle(expenses, (d) => d.date, periode.intervalle);

  const totalSalesAmount = ventesPeriode.reduce((acc, s) => acc + s.totalVente, 0);
  const totalMarginAmount = ventesPeriode.reduce((acc, s) => acc + s.margeTotale, 0);
  const totalExpensesAmount = depensesPeriode.reduce((acc, e) => acc + e.montant, 0);
  const totalPurchasesAmount = achatsPeriode.reduce((acc, p) => acc + p.totalAchat, 0);
  const pendingOrders = orders.filter(
    (o) => o.statut_commande === "en_attente" || o.statut_commande === "en_cours",
  );
  const unpaidOrders = orders.filter((o) => (o.reste_a_payer ?? 0) > 0);
  const isTresorerieNegative = capital.tresorerieGlobaleActuelle < 0;
  const isTresorerieLow = capital.tresorerieGlobaleActuelle < capital.seuilAlerteTresorerie;

  // ── Tendances : la période choisie contre la précédente ──
  //
  // Calcul purement local à partir des données déjà chargées, aucune
  // requête supplémentaire. Les colonnes qui portent un SOLDE
  // (Trésorerie, Commandes, Stock) n'ont pas de tendance : mieux vaut
  // pas d'indicateur qu'un indicateur faux.
  const sommeSur = <T,>(
    lignes: T[],
    date: (r: T) => string,
    montant: (r: T) => number,
    i: { debut: string; fin: string } | null,
  ) => filtrerParIntervalle(lignes, date, i).reduce((acc, r) => acc + montant(r), 0);

  const buildTrend = (
    current: number,
    previous: number,
    goodDirection: "up" | "down" | "neutre",
  ) => {
    // Sans intervalle précédent (« Tout ») ou sans rien à quoi se
    // comparer, on n'affiche AUCUN pourcentage. Un « -100 % » né d'un
    // mois précédent vide est une fausse alerte, pas une information.
    if (!periode.precedent || previous === 0) {
      return { percent: 0, label: periode.libelleComparaison, noBaseline: true, goodDirection };
    }
    return {
      percent: ((current - previous) / Math.abs(previous)) * 100,
      label: periode.libelleComparaison,
      goodDirection,
    };
  };

  const salesTrend = buildTrend(
    totalSalesAmount,
    sommeSur(
      sales,
      (s) => s.date,
      (s) => s.totalVente,
      periode.precedent,
    ),
    "up",
  );
  // Les achats ne se colorent pas : réapprovisionner n'est pas une
  // perte, c'est du stock qui change de forme. La hausse peut être une
  // bonne nouvelle (on prépare une saison) comme une mauvaise (on
  // achète trop cher) — la donnée seule ne permet pas de trancher, et
  // une couleur qui se trompe une fois sur deux ne s'écoute plus.
  const purchasesTrend = buildTrend(
    totalPurchasesAmount,
    sommeSur(
      purchases,
      (p) => p.date,
      (p) => p.totalAchat,
      periode.precedent,
    ),
    "neutre",
  );
  const expensesTrend = buildTrend(
    totalExpensesAmount,
    sommeSur(
      expenses,
      (e) => e.date,
      (e) => e.montant,
      periode.precedent,
    ),
    "down",
  );

  /** Le nom de la catégorie d'un produit, quand il en a une. */
  const nomCategorie = (produit?: Product): string | null => {
    if (!produit?.categoryId) return null;
    return categories.find((c) => c.id === produit.categoryId)?.nom ?? null;
  };

  /**
   * L'heure d'une vente — et le silence quand elle serait fausse.
   *
   * `saisieLe` est l'instant où la ligne a été écrite, `date` le jour
   * COMMERCIAL de la vente. Ils coïncident presque toujours. Presque :
   * sur les trente ventes de la boutique, trois portent la date du 14
   * et ont été saisies entre une heure et deux heures du matin le 15 —
   * un commerce qui ferme après minuit et enregistre sa journée une
   * fois la porte close.
   *
   * Afficher « 14/08 à 01:12 » daterait la vente de sa saisie. Quand
   * les deux jours divergent, on ne dit donc pas d'heure du tout :
   * mieux vaut une information en moins qu'une information fausse, et
   * les vingt-sept autres gardent la leur.
   */
  /**
   * La date d'une vente recente, sans son annee quand c'est celle qui
   * court.
   *
   * « 13/09/2026 a 10:24 » ne tient pas dans la ligne grise d'un
   * telephone : c'est l'heure, l'information neuve, qui se faisait
   * couper. L'annee est celle qu'on devine — ces ventes sont les six
   * dernieres — et elle revient des qu'elle cesse d'aller de soi. Le
   * decoupage se fait par la fin, ce qui vaut pour les deux formats :
   * l'annee est en derniere position en FR comme en US.
   */
  const anneeCourante = new Date().getFullYear();
  const dateDeLaVente = (jour: string): string => {
    const complet = formatDateLocale(jour, locale);
    return jour.slice(0, 4) === String(anneeCourante) ? complet.slice(0, 5) : complet;
  };

  const heureDeLaVente = (vente: Sale): string | null => {
    if (!vente.saisieLe) return null;
    const instant = new Date(vente.saisieLe);
    if (Number.isNaN(instant.getTime())) return null;
    if (dateDuJour(instant) !== vente.date) return null;
    return `${String(instant.getHours()).padStart(2, "0")}:${String(instant.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* ── L'accueil ──
          Texte libre posé sur le fond de page, sans carte autour.

          C'est le seul en-tête de l'application à ne pas porter la
          carte blanche des autres vues, et c'est voulu : les onze
          autres pages ouvrent sur une liste ou un formulaire, que
          l'en-tête doit annoncer. L'accueil, lui, ouvre sur une
          conversation — on y salue quelqu'un. Une salutation encadrée
          d'un filet se lit comme un avis affiché.

          À droite, le sélecteur de période : c'est la seule commande de
          cet écran, et le haut de page est l'endroit où on la cherche. */}
      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            <span className="truncate">Bonjour{prenom ? `, ${prenom}` : ""} !</span>
            <span aria-hidden="true" className="shrink-0">
              👋
            </span>
          </h1>
          {/* La phrase suit la période choisie. Annoncer « votre
              activité aujourd'hui » à côté d'un bouton qui affiche
              « Ce mois » ferait mentir l'une des deux. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Voici un aperçu de votre activité {LIBELLE_DUREE[clePeriode]}.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <SelecteurPeriode periode={periode} onChange={setClePeriode} />
        </div>
      </div>

      {/* ── Alert Banners ── */}
      {/* Bandeaux d'alerte : carte blanche avec un simple filet coloré à
          gauche. Un aplat de couleur pleine largeur attire l'œil bien
          au-delà de son importance réelle et fatigue à l'usage. */}
      {notificationPrefs.treasuryAlerts && isTresorerieNegative && (
        <div className="app-card flex items-center gap-3 overflow-hidden border-l-2 border-l-danger p-3.5 sm:gap-4">
          <AlertTriangle className="h-4 w-4 shrink-0 t-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Trésorerie négative — {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Les dépenses dépassent le capital. Injectez un apport ou enregistrez des ventes.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("capital")}
            className="app-btn-secondary shrink-0 text-xs"
          >
            Ajuster
          </button>
        </div>
      )}
      {notificationPrefs.treasuryAlerts && isTresorerieLow && !isTresorerieNegative && (
        <div className="app-card flex items-center gap-3 overflow-hidden border-l-2 border-l-warning p-3.5 sm:gap-4">
          <AlertTriangle className="h-4 w-4 shrink-0 t-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Trésorerie sous le seuil de {formatCurrency(capital.seuilAlerteTresorerie)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Solde actuel : {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </p>
          </div>
        </div>
      )}

      {/* ── Barre d'indicateurs ──
          Une seule bande compacte plutôt que six cartes colorées : à
          cette densité de chiffres, le fond de couleur et la pastille
          d'icône fatiguent plus qu'ils n'orientent. */}
      {/* ── Les indicateurs, sur une seule ligne ──
          Trésorerie, ventes, achats, dépenses et stock dans UNE carte,
          en colonnes de même largeur séparées d'un filet — et non une
          carte par chiffre. Six cadres alignés se lisent comme six
          objets sans rapport ; une bande unique se lit comme ce
          qu'elle est, le résumé d'une seule activité.

          CE QUE CE REGROUPEMENT DOIT COMPENSER. La trésorerie et le
          stock sont des SOLDES : ils décrivent l'instant présent. Les
          ventes, les achats et les dépenses sont des FLUX : ils
          n'existent que rapportés à une durée, et le sélecteur de
          période ne gouverne qu'eux. Deux blocs titrés le disaient
          jusqu'ici — « Activité » d'un côté, « En ce moment » de
          l'autre. Sur une ligne unique, ce regroupement disparaît :
          c'est donc chaque carte qui porte son horizon sous son
          chiffre, « argent disponible » ici, « ce mois-ci » là. Sans
          cette mention, on croirait le sélecteur maître des cinq
          cartes, et l'on lirait une trésorerie du mois dernier. */}
      <BarreIndicateurs
        items={[
          {
            key: "tresorerie",
            label: "Trésorerie",
            value: formatCurrency(capital.tresorerieGlobaleActuelle),
            hint: isTresorerieNegative
              ? "solde négatif"
              : isTresorerieLow
                ? "sous le seuil"
                : "argent disponible",
            // Le mot passe en orange quand la caisse est basse ou
            // négative : la couleur ne touche que lui, jamais le fond
            // ni la colonne entière.
            alert: isTresorerieNegative || isTresorerieLow,
            icon: <Wallet className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("capital"),
          },
          {
            key: "ventes",
            label: "Ventes",
            value: formatCurrency(totalSalesAmount),
            trend: salesTrend,
            hint: LIBELLE_DUREE[clePeriode],
            icon: <DollarSign className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("ventes"),
          },
          {
            key: "achats",
            label: "Achats",
            value: formatCurrency(totalPurchasesAmount),
            trend: purchasesTrend,
            hint: LIBELLE_DUREE[clePeriode],
            icon: <ShoppingCart className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("achats"),
          },
          {
            key: "depenses",
            label: "Dépenses",
            value: formatCurrency(totalExpensesAmount),
            trend: expensesTrend,
            hint: LIBELLE_DUREE[clePeriode],
            icon: <ArrowDownRight className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("depenses"),
          },
          {
            key: "stock",
            label: "Stock",
            value: formatCurrency(totalStockValue),
            hint:
              lowStockProducts.length > 0
                ? `${lowStockProducts.length} à réapprovisionner`
                : `${products.length} référence${products.length > 1 ? "s" : ""}`,
            alert: lowStockProducts.length > 0,
            icon: <Package className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("produits"),
          },
          ...(montre("commandes")
            ? [
                {
                  key: "commandes",
                  label: "Commandes",
                  value: `${orders.length}`,
                  hint:
                    pendingOrders.length > 0
                      ? `${pendingOrders.length} en cours`
                      : "aucune en cours",
                  alert: pendingOrders.length > 0,
                  icon: <ShoppingBag className="h-3.5 w-3.5" />,
                  onClick: () => onNavigateTab("commandes"),
                },
              ]
            : []),
        ]}
      />

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* ── En suspens ──
              Première carte de la colonne, avant les soldes vendeurs :
              c'est la seule liste de l'écran sur laquelle on a quelque
              chose à FAIRE. Elle occupait toute la largeur ; en colonne
              elle laisse la place aux ventes récentes, qui sont ce que
              l'on vient lire, et la page tient enfin en deux colonnes
              de hauteur comparable. */}
          {enSuspens.length > 0 && (
            <section className="app-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="app-section-title">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  En suspens
                </h2>
              </div>
              <div className="app-list">
                {enSuspens.map((l) => (
                  <button
                    key={l.cle}
                    type="button"
                    onClick={() => onNavigateTab(l.onglet)}
                    className="app-list-row w-full justify-between gap-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="app-list-primary block">{l.libelle}</span>
                      {/* La couleur ne porte que sur les mots qui disent le
                          retard, jamais sur la ligne entière ni sur une
                          pastille qui les répéterait. */}
                      <span className="app-list-secondary block">
                        {l.detail}
                        {l.alerte && (
                          <>
                            {l.detail && ", "}
                            <span className="t-warning">{l.alerte}</span>
                          </>
                        )}
                      </span>
                    </span>
                    {/* Une tâche en retard ne se chiffre pas : plutôt que
                        d'écrire « 0 Ar » à sa droite, on n'écrit rien. */}
                    {l.montant !== null && (
                      <span className="app-list-amount">{formatCurrency(l.montant)}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
          {/* ── Solde net vendeurs ──
              Ce bloc répond à une seule question : « combien d'argent
              encaissé une personne détient-elle encore, et n'a pas
              rendu à la caisse ? » Il n'a donc de sens qu'à partir de
              DEUX vendeurs.

              Seul dans sa boutique, le commerçant est à la fois celui
              qui encaisse et celui qui garde la caisse : sa poche et sa
              trésorerie sont le même tas d'argent. Lui montrer un
              second chiffre qui prétend dire autre chose sans le dire
              l'induit en erreur — il croit lire un solde disponible et
              lit un cumul de ses ventes, qui ne redescend jamais.

              Le calcul n'est pas modifié, et l'écran Vendeurs reste
              accessible : c'est l'affichage qui se tait tant que la
              question ne se pose pas. */}
          {sellers.length > 1 && (
            <div className="app-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="app-section-title">
                  <Users className="h-3.5 w-3.5" /> Solde net vendeurs
                </h3>
                <button
                  onClick={() => onNavigateTab("vendeurs")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Gérer
                </button>
              </div>
              <div className="app-list">
                {sellers.map((v) => (
                  <div key={v.id} className="app-list-row justify-between">
                    <div className="min-w-0">
                      <div className="app-list-primary">{v.nom}</div>
                      <div className="app-list-secondary">
                        Ventes {formatCurrency(v.totalVentesMontant)} · Dépenses{" "}
                        {formatCurrency(v.totalDepenses)}
                      </div>
                    </div>
                    <div className="app-list-amount">{formatCurrency(v.soldeNetEnPoche)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertes de stock — la couleur ne sert qu'au badge de statut */}
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="app-section-title">
                <AlertTriangle className="h-3.5 w-3.5" /> Alertes stock
                {lowStockProducts.length > 0 && (
                  <span className="text-muted-foreground">({lowStockProducts.length})</span>
                )}
              </h3>
              <button
                onClick={() => onNavigateTab("produits")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Voir tout
              </button>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 t-success" />
                Stock suffisant sur tous les produits.
              </p>
            ) : (
              <div className="app-list">
                {/* ── La ligne entière réapprovisionne ──
                    Plutôt qu'un bouton « Réapprovisionner » de plus : sur
                    un téléphone, il écraserait le nom du produit, qui est
                    justement ce qu'on vient lire ici. Le chevron dit que
                    la ligne mène quelque part, comme partout ailleurs
                    dans l'application.

                    Elle ouvre les Achats sur un formulaire déjà rempli —
                    désignation, prix d'achat et fournisseur repris de la
                    fiche. Il ne reste que la quantité. Envoyer vers la
                    fiche produit ne servirait à rien : on n'y
                    réapprovisionne pas. */}
                {lowStockProducts.map((p) => {
                  const isOut = p.stockActuel <= 0;
                  const contenu = (
                    <>
                      <VignetteProduit
                        nom={p.designation}
                        chemin={vignettes.get(p.id)}
                        taille={32}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="app-list-primary flex min-w-0 items-center gap-2">
                          <span className="truncate">{getProductLabel(p, products)}</span>
                          <VariantBadge
                            prix={getProductVariant(p, products)}
                            autorise={showPrixAchat}
                          />
                        </span>
                        <span className="app-list-secondary block">
                          {onReapprovisionner
                            ? "seuil " + p.seuilAlerte + " · réapprovisionner"
                            : "seuil " + p.seuilAlerte}
                        </span>
                      </span>
                      <span
                        className={`app-badge shrink-0 ${isOut ? "app-badge-danger" : "app-badge-warning"}`}
                      >
                        {isOut ? "Rupture" : `${p.stockActuel} restant`}
                      </span>
                      {onReapprovisionner && (
                        <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" />
                      )}
                    </>
                  );
                  return onReapprovisionner ? (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onReapprovisionner(p)}
                      className="app-list-row w-full justify-between text-left"
                      title={`Réapprovisionner ${getProductLabel(p, products)}`}
                    >
                      {contenu}
                    </button>
                  ) : (
                    <div key={p.id} className="app-list-row justify-between">
                      {contenu}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Orders */}
          {montre("commandes") && pendingOrders.length > 0 && (
            <div className="app-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="app-section-title">
                  <Truck className="h-3.5 w-3.5" /> Commandes en cours
                  <span className="text-muted-foreground">({pendingOrders.length})</span>
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ouvrir
                </button>
              </div>
              <div className="app-list">
                {pendingOrders.slice(0, 3).map((o) => (
                  <div key={o.id} className="app-list-row justify-between">
                    <div className="min-w-0">
                      <div className="app-list-primary font-mono">{o.numero}</div>
                      <div className="app-list-secondary">{o.client?.nom ?? "Sans client"}</div>
                    </div>
                    <span className="app-list-amount">{formatCurrency(o.montant_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unpaid Orders */}
          {montre("commandes") && unpaidOrders.length > 0 && (
            <div className="app-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="app-section-title">
                  <CreditCard className="h-3.5 w-3.5" /> Paiements en attente
                  <span className="text-muted-foreground">({unpaidOrders.length})</span>
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ouvrir
                </button>
              </div>
              <div className="app-list">
                {unpaidOrders.slice(0, 3).map((o) => (
                  <div key={o.id} className="app-list-row justify-between">
                    <div className="min-w-0">
                      <div className="app-list-primary font-mono">{o.numero}</div>
                      <div className="app-list-secondary">{o.client?.nom ?? "Sans client"}</div>
                    </div>
                    <span className="app-list-amount t-danger">
                      {formatCurrency(o.reste_a_payer ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recent Sales */}
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="app-section-title">
                <TrendingUp className="h-3.5 w-3.5" /> Ventes récentes — {LIBELLE_DUREE[clePeriode]}
              </h3>
              <button
                onClick={() => onNavigateTab("ventes")}
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Tout voir
              </button>
            </div>

            {/* ── Une ligne qui occupe sa largeur ──
                Ce bloc ne passe pas par DataList, et c'est la seule
                exception de l'écran. La liste commune empile tout à
                gauche — nom sur une ligne, puis quantité, vendeur et
                date entassés sur la ligne grise en dessous — ce qui
                laissait ici un vide de plusieurs centaines de pixels au
                milieu pendant que les informations se serraient sur le
                bord. Dans la colonne large de l'accueil, ce vide ne se
                justifie pas.

                Les zones sont donc posées à largeur fixe : c'est ce qui
                les fait s'aligner d'une ligne à l'autre. Des colonnes
                dimensionnées par leur contenu danseraient d'une ligne à
                la suivante, et l'œil ne pourrait plus descendre une
                colonne du regard.

                LE SEUIL SE MESURE SUR LE BLOC, PAS SUR L'ÉCRAN, et
                c'est tout l'intérêt de `@container` ici : à 1024 pixels
                de large, l'accueil passe en deux colonnes et ce bloc
                n'en fait plus que 623 — moins large qu'à 768, où il
                occupe toute la page. Une règle en `md:` montrait donc
                les zones précisément là où la place manquait, et le nom
                du produit tombait à 73 pixels. Sous 672 pixels de bloc,
                tout revient à la forme hiérarchisée de l'application —
                le nom, puis une seule ligne grise. */}
            {ventesPeriode.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune vente récente.
              </p>
            ) : (
              <div className="app-list @container">
                {ventesPeriode.slice(0, 6).map((s) => {
                  const prod = products.find((p) => p.id === s.productId);
                  const categorie = nomCategorie(prod);
                  const heure = heureDeLaVente(s);
                  const quand = heure
                    ? `${dateDeLaVente(s.date)} à ${heure}`
                    : dateDeLaVente(s.date);
                  return (
                    <div key={s.id} className="app-list-row gap-3 py-3">
                      <VignetteProduit
                        nom={s.designation}
                        chemin={s.productId ? vignettes.get(s.productId) : null}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="app-list-primary">
                            {prod ? getProductLabel(prod, products) : getSaleLabel(s, products)}
                          </span>
                          <VariantBadge
                            prix={getSaleVariant(s, products)}
                            autorise={showPrixAchat}
                          />
                          {/* Rien tant qu'aucune catégorie n'est
                              renseignée. Réservée aux grands écrans :
                              plus bas, la place va au nom du produit et
                              aux trois zones alignées. */}
                          {categorie && (
                            <span className="app-badge app-badge-neutral hidden shrink-0 @3xl:inline-flex">
                              {categorie}
                            </span>
                          )}
                        </div>
                        {/* La forme repliée, sous 768 px. */}
                        <span className="app-list-secondary block @2xl:hidden">
                          ×{s.quantite} · {s.vendeur} · {quand}
                        </span>
                      </div>

                      <span className="hidden w-12 shrink-0 text-center text-sm tabular-nums text-muted-foreground @2xl:block">
                        ×{s.quantite}
                      </span>
                      {/* 128 px, mesures a l'appui : « Mamy Herinatenaina »
                          — un vrai vendeur de la boutique — demande 128
                          pixels exactement, et se faisait couper a 96. */}
                      <span className="hidden w-32 shrink-0 truncate text-sm text-muted-foreground @2xl:block">
                        {s.vendeur}
                      </span>
                      <span className="hidden w-28 shrink-0 text-sm tabular-nums text-muted-foreground @2xl:block">
                        {quand}
                      </span>

                      <span className="app-list-amount">{formatCurrency(s.totalVente)}</span>
                      <span
                        className={`app-badge shrink-0 ${
                          s.statutCredit === "Payé"
                            ? "app-badge-success"
                            : s.statutCredit === "Partiel"
                              ? "app-badge-warning"
                              : "app-badge-danger"
                        }`}
                      >
                        {s.statutCredit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Achats & Dépenses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="app-card p-4">
              <h3 className="app-section-title mb-3">
                <ShoppingCart className="w-4 h-4 t-warning" /> Derniers Achats
              </h3>
              <div className="space-y-3">
                {achatsPeriode.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center gap-3 text-sm border-b border-border/50 pb-3.5 last:border-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <VignetteProduit
                        nom={p.designation}
                        chemin={p.productId ? vignettes.get(p.productId) : null}
                        taille={32}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">
                          {(() => {
                            const linkedProduct = products.find((prod) => prod.id === p.productId);
                            return linkedProduct
                              ? getProductLabel(linkedProduct, products)
                              : p.designation;
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateLocale(p.date, locale)}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-bold t-warning whitespace-nowrap">
                      {formatCurrency(p.totalAchat)}
                    </div>
                  </div>
                ))}
                {purchases.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Aucun achat enregistré.
                  </div>
                )}
              </div>
            </div>

            <div className="app-card p-4">
              <h3 className="app-section-title mb-3">
                <ArrowRightLeft className="w-4 h-4 t-danger" /> Dernières Dépenses
              </h3>
              <div className="space-y-3">
                {depensesPeriode.slice(0, 4).map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between items-center gap-3 text-sm border-b border-border/50 pb-3.5 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{e.vendeur}</div>
                      <div className="text-xs text-muted-foreground">{e.type}</div>
                    </div>
                    <div className="font-mono font-bold t-danger whitespace-nowrap">
                      {formatCurrency(e.montant)}
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Aucune dépense enregistrée.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
