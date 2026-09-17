# Tableau de bord v2 — Audit (phase 0)

Aucune ligne de code applicatif n'a été modifiée. Ce document est le
seul livrable de la phase.

- Branche : `feat/dashboard-v2`, partie de `main` (`2863a01`).
- Maquette copiée dans le dépôt : `docs/maquette/tableau-de-bord-complet.html`
  (1 677 lignes, lues intégralement — HTML, CSS et les deux scripts).
- État de départ : `npx tsc --noEmit` passe sans erreur sur `main`.
- Aucune requête SQL n'a été exécutée. Les colonnes citées viennent
  toutes de `src/lib/database.types.ts`.

---

## 1. Route et composant du tableau de bord actuel

**Il n'y a pas de route TanStack pour le tableau de bord.** C'est le point
le plus important de cet audit, parce qu'il change le §8 du cahier des
charges.

L'application entière tient dans **une seule route** :

| Fichier                                          | Rôle                                                  |
| ------------------------------------------------ | ----------------------------------------------------- |
| [src/routes/index.tsx](src/routes/index.tsx)     | route `/` → monte `BalsamaApp`                        |
| [src/routes/\_\_root.tsx](src/routes/__root.tsx) | document HTML, métadonnées, thème de la barre système |
| [src/BalsamaApp.tsx](src/BalsamaApp.tsx)         | 2 050 lignes : la coquille complète                   |

Les autres routes sont `accept-invite`, `reset-password` — elles ne
concernent pas l'application connectée.

La navigation entre écrans est un **état React**, pas une URL :

```
const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");   // BalsamaApp.tsx:188
...
{activeTab === "dashboard" && (hasDashboardAccess
    ? <DashboardView … />                                             // BalsamaApp.tsx:1386
    : <MyActivityView variant="dashboard" … />)}
```

`DashboardView` est chargé en `lazy()` ([BalsamaApp.tsx:70](src/BalsamaApp.tsx:70)) et
**ne fait aucune requête lui-même** : il reçoit tout par props depuis
`BalsamaApp`. C'est une vue de présentation pure.

`hasDashboardAccess = hasDashboardPermission && hasCapitalAccess`
([BalsamaApp.tsx:626](src/BalsamaApp.tsx:626)) : un collaborateur sans ces droits reçoit
`MyActivityView` à la place, et ne voit jamais le tableau de bord.

**Conséquence pour le feature flag (§8).** Le drapeau ne peut pas se poser
sur une route. Il se pose sur cette branche `activeTab === "dashboard"` :
trois lignes dans `BalsamaApp.tsx`, `DashboardV2Page` en `lazy()` à côté
de `DashboardView`. C'est le seul fichier hors `src/features/dashboard-v2/**`
et `docs/**` que la mission touchera. Aucune autre page ne bouge.

**Conséquence pour la maquette.** La maquette redessine la coquille
entière : barre latérale `.side`, `.main`, `.mtop`. L'application a déjà
la sienne — [Sidebar.tsx](src/components/Sidebar.tsx), [Header.tsx](src/components/Header.tsx),
[SousNavigation.tsx](src/components/shared/SousNavigation.tsx) — partagée par vingt-cinq écrans.
**La v2 reprendra uniquement le contenu de `.wrap`** (en-tête du tableau
de bord, bandeau « Aujourd'hui », grille de cartes). Reprendre aussi la
barre latérale voudrait dire refaire la navigation de toute
l'application : hors périmètre, et « ne modifie pas les autres pages »
l'interdit. → **Écart n° 1, à valider.**

---

## 2. Session et boutique active

| Ce qu'il faut        | Où le prendre                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `user`               | `useAuth()` → `user` ([src/hooks/useAuth.tsx](src/hooks/useAuth.tsx))                        |
| `profile`            | `useAuth()` → `profile` (ligne `profiles`)                                                   |
| rôle plateforme      | `useAuth()` → `isFounder` (= `profile.role === "founder"`, useAuth.tsx:281)                  |
| prénom               | `(profile?.full_name ?? "").trim().split(/\s+/)[0]` — déjà fait dans `DashboardView.tsx:135` |
| boutique active      | `useWorkspace()` → `activeStore` (ligne `stores`)                                            |
| propriétaire ?       | `useWorkspace()` → `isOwner` (`activeStore.owner_id === user.id`)                            |
| `store_members.role` | `useWorkspace()` → `memberRole` (`string \| null`)                                           |
| permissions          | `useWorkspace()` → `memberPermissionsDetailed` (`PermissionsMap \| null`)                    |
| liste plate héritée  | `useWorkspace()` → `memberPermissions` (`string[] \| null`)                                  |
| membres de l'équipe  | `useStoreMembers(storeId)` → `members`                                                       |

`memberPermissionsDetailed` vaut `null` pour le propriétaire (il a tout)
et `{}` au minimum pour un membre.

Le rôle `livreur` est un cas à part : `BalsamaApp.tsx:172` coupe
`useStoreData` pour lui (« dix-sept requêtes pour dix-sept réponses
vides »), et il reçoit `EspaceLivreur`, pas l'application à onglets. La
**vue « Livreur » de la maquette ne pourra donc être qu'un aperçu pour
le fondateur** — un vrai livreur n'atteint jamais cet écran.

---

## 3. Système de permissions existant

[src/lib/permissions.ts](src/lib/permissions.ts), 895 lignes, en-tête daté du 21/08/2026.
Modèle à quatre couches : **rôle → modules → portée → actions → champs**.

```ts
interface ModulePermission {
  visible: boolean;
  scope?: "own" | "team" | "all";
  actions?: string[]; // sous-ensemble de ModuleDef.actions
  fields?: string[]; // champs VISIBLES ; absent = tous visibles
  widgets?: string[]; // cas spécial dashboard
}
type PermissionsMap = Record<string, ModulePermission>;
```

**23 modules** : `dashboard`, `capital`, `clients`, `fournisseurs`,
`prestataires`, `produits`, `commandes`, `devis`, `livraisons`, `ventes`,
`paiements`, `achats`, `vendeurs`, `salaires`, `depenses`,
`statistiques`, `rapports`, `historique`, `agenda`, `vue_equipe`,
`rappels`, `taches`, `settings`.

**Aides déjà écrites — à réutiliser telles quelles :**

`normalizePermissions`, `permissionsToVisibleModules`, `isModuleVisible`,
`getModuleScope`, `hasModuleAction`, `isFieldVisible`, `isWidgetVisible`,
`summarizePermissions`, `ROLE_TEMPLATES`, `ROLE_LABELS`.

**`RoleKey`** (permissions.ts:591) : `admin`, `manager`, `comptable`,
`vendeur`, `gestionnaire_stock`, `livreur`. Les six vues de la maquette
s'y superposent presque exactement — correspondance proposée au §6.

**`DASHBOARD_WIDGETS`** (permissions.ts:74) : c'est l'« ancien réglage »
du cahier des charges. 5 groupes, 21 clés :

| Groupe               | Clés                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Activité commerciale | `chiffre_affaires`, `nombre_ventes`, `commandes`, `evolution_ventes`                        |
| Finance              | `tresorerie`, `revenus`, `depenses`, `benefices`, `montants_a_recevoir`, `montants_a_payer` |
| Stock                | `stock_disponible`, `produits_rupture`, `stock_faible`, `valeur_stock`                      |
| Activité récente     | `dernieres_ventes`, `dernieres_commandes`, `derniers_paiements`, `activites_recentes`       |
| Performance          | `produits_plus_vendus`, `perf_personnelles`, `perf_equipe`                                  |

Ces 21 clés couvrent 17 des 19 cartes. Il manque un widget pour
**Agenda / À faire** et pour **Livraisons** : je les rattacherai à la
visibilité des modules `agenda`/`taches` et `livraisons`, et la table de
correspondance sera écrite noir sur blanc dans `registry.ts`.

**Deuxième couche, indépendante : la personnalisation par boutique.**
[src/lib/personnalisation.ts](src/lib/personnalisation.ts) — `moduleMasque(perso, cle)`,
20 modules désactivables depuis les Paramètres. Le tableau de bord
actuel s'en sert déjà (`const montre = (cle) => !moduleMasque(perso, cle)`,
DashboardView.tsx:148). **Une carte doit passer les DEUX filtres** :
module activé pour la boutique, et permission accordée à la personne.

**Un avertissement que le fichier porte lui-même** (permissions.ts:28) :

> tout ceci est un filtrage d'AFFICHAGE côté client. La sécurisation
> réelle au niveau des données (RLS Postgres) est l'Étape F, pas encore
> faite.

La v2 ne change rien à cela : elle lit par le client Supabase de
l'application, donc sous la RLS telle qu'elle est aujourd'hui, et filtre
l'affichage avec les mêmes aides que le reste du logiciel. Ni plus
permissif, ni moins.

---

## 4. Calculs existants à réutiliser

| Valeur                    | Où                                                                               | Forme                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Trésorerie**            | `computedCapital`, [BalsamaApp.tsx:795](src/BalsamaApp.tsx:795)                  | `tresorerieGlobaleActuelle` = capital initial + apports + encaissé ventes + encaissé commandes − achats − dépenses − remboursements |
| Seuil d'alerte trésorerie | idem → `seuilAlerteTresorerie`                                                   | `stores.seuil_alerte_tresorerie`                                                                                                    |
| **Solde net vendeurs**    | `computedSellers`, [BalsamaApp.tsx:491](src/BalsamaApp.tsx:491)                  | `soldeNetEnPoche` = encaissé − dépenses − remis − avances sur caisse                                                                |
| **Stock disponible**      | mapping `products`, [BalsamaApp.tsx:318](src/BalsamaApp.tsx:318)                 | `stock_disponible ?? stock_actuel − stock_reserve`                                                                                  |
| **À réapprovisionner**    | `DashboardView.tsx:202` et `ProduitsView.tsx:241`                                | `stockActuel <= seuilAlerte` — attention : `stockActuel`, **pas** `stockDisponible`                                                 |
| **Valeur du stock**       | `DashboardView.tsx:204`                                                          | `Σ stockActuel × prixAchat` — calcul en clair, **pas de fonction partagée**                                                         |
| **Bilan / marges**        | [RapportsView.tsx](src/components/RapportsView.tsx)                              | par mois : `ca`, `achats`, `depenses`, `marge = Σ sales.margeTotale`                                                                |
| **Paiements à recevoir**  | [PaiementsARecevoirView.tsx:61-89](src/components/PaiementsARecevoirView.tsx:61) | `sales.soldeDu > 0` + `orders.reste_a_payer > 0`                                                                                    |
| **En suspens**            | `construireEnSuspens`, [src/lib/enSuspens.ts](src/lib/enSuspens.ts)              | 7 natures, 3 rangs d'urgence — déjà exactement les « puces d'attention »                                                            |
| **Notifications**         | `construireNotifications`, [src/lib/activite.ts](src/lib/activite.ts)            | activité déduite des données chargées                                                                                               |
| **Périodes**              | [src/lib/periodes.ts](src/lib/periodes.ts)                                       | `calculerPeriode`, `filtrerParIntervalle`, `periode.precedent`, `periode.libelleComparaison`                                        |
| **Tendances**             | `buildTrend`, `DashboardView.tsx:235`                                            | refuse d'afficher un pourcentage sans base de comparaison                                                                           |
| **Montants**              | `formatCurrency`, [src/utils/formulas.ts](src/utils/formulas.ts)                 | `344 800 Ar`, espace insécable — exactement le format de la maquette                                                                |
| **Quantités**             | `quantiteEnMots`                                                                 | `20 litres`, `1 unité` — jamais `×20`                                                                                               |
| **Noms de produits**      | `getProductLabel` / `getSaleLabel`                                               | retirent l'indice gravé dans `designation` (`kiraro₅₀₀₀`)                                                                           |

### Ce qui n'existe pas et devra être écrit

1. **Bénéfice / résultat** (carte 11). `RapportsView` calcule la marge,
   jamais `marge − dépenses`. → nouveau, avec la phrase imposée par le
   cahier des charges sur les achats de stock.
2. **Découpe à 30 jours** des créances (carte 12). → nouveau.
3. **Couverture en jours** d'un produit (carte 15). → nouveau :
   `stockDisponible ÷ (quantités vendues sur 30 j ÷ 30)`, `—` si aucune vente.
4. **Cumul jour par jour** des ventes (carte 2) et **encaissements par
   jour du mois** (tuile « Entrées »). → nouveau, mais purement local à
   partir des ventes déjà chargées.
5. **Période personnalisée** (du → au). `periodes.ts` connaît
   `jour | semaine | mois | tout`, pas d'intervalle libre. → j'étends
   `useDashboardPeriod` **dans la v2**, sans toucher à `periodes.ts`, que
   quinze autres écrans utilisent.

---

## 5. Hooks et requêtes Supabase existants

### `useStoreData(storeId, userId)` — [src/hooks/useStoreData.ts](src/hooks/useStoreData.ts), 1 973 lignes

Un seul `Promise.all` (ligne 689) charge **21 tables** :

`products`, `sales`, `purchases`, `expenses`, `orders`, `clients`,
`capital_apports`, `payments`, `suppliers`, `providers`,
`provider_services`, `custom_field_definitions`, `categories`,
`product_images`, `supplier_payments`, `quotes`, `quote_items`,
`deliveries`, `remises_vendeur`, `salaires`, `paiements_salaire`.

Toutes filtrées par `.eq("store_id", storeId)`, toutes en `select("*")`.

### Hooks séparés

| Hook                             | Table                                     |
| -------------------------------- | ----------------------------------------- |
| `useJournalActivite(storeId)`    | `journal_activite`                        |
| `useTaches(storeId, userId)`     | `taches`                                  |
| `useEvenements(storeId, userId)` | `evenements` (+ `evenement_participants`) |
| `useRappels(storeId, userId)`    | `rappels`                                 |
| `useStoreMembers(storeId)`       | `store_members`                           |

### Deux constats qui pèsent sur la conception

**a) `stock_movements` n'est lu nulle part.** La table existe et est
alimentée, mais aucune requête de l'application ne la touche. Les cartes
16 (« Entrées & sorties de stock ») et la tuile « Stock du jour » en
dépendent. → nouvelle lecture à écrire dans `useDashboardData`, avec la
solution de repli prévue par le cahier des charges (quantités d'achats et
de ventes) si la lecture est refusée par la RLS.

**b) `useJournalActivite` exclut volontairement les créations :**

```ts
.neq("action", "creation")   // useJournalActivite.ts
.limit(80)
```

Le commentaire du fichier explique pourquoi (les créations se déduisent
déjà des données chargées, les reprendre les afficherait deux fois). Mais
la maquette montre, dans le journal et dans la tuile « Activité
aujourd'hui », exactement des créations : « Vente créée », « Paiement
reçu », « Nouveau client ». **Avec le hook tel quel, ces deux blocs
seraient presque toujours vides.** → **Écart n° 2, à trancher** (trois
options au §8).

**c) Aucune pagination.** `useStoreData` n'appelle ni `.range()` ni
`.limit()`. PostgREST plafonne à 1 000 lignes : au-delà, l'application
tronque déjà silencieusement. Ce n'est pas un défaut que cette mission
introduit, et je ne le corrigerai pas sans votre accord — mais les
lectures **nouvelles** de la v2 (`stock_movements` surtout) seront
paginées par 1 000 comme le cahier des charges le demande.

---

## 6. Formulaires et modales existants

| Geste              | Où                                                                                          | Réutilisable depuis le tableau de bord ? |
| ------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Nouvelle vente     | `VentesView.tsx:950` — `<Modal>` de ~330 lignes, état local `isModalOpen`                   | **Non** en l'état                        |
| Nouvelle dépense   | `DepensesView.tsx`, formulaire intégré                                                      | **Non**                                  |
| Nouvel achat       | `AchatsView.tsx`, formulaire intégré                                                        | **Non**                                  |
| Nouveau client     | `ClientsView.tsx`, formulaire intégré                                                       | **Non**                                  |
| Bon de commande    | `CommandesView.tsx`                                                                         | **Non**                                  |
| Terminer une tâche | `useTaches().changerStatut(id, statut)`                                                     | **Oui**                                  |
| Réapprovisionner   | `onReapprovisionner` → `setActiveTab("achats")` avec produit prérempli, BalsamaApp.tsx:1411 | **Oui, déjà branché**                    |

Les formulaires ne sont pas des composants : ce sont des blocs de JSX
avec leur état local, à l'intérieur de fichiers de 1 000 à 1 900 lignes.
Les extraire serait une refonte de ces écrans — donc interdit par le §1.

**En revanche les mutations, elles, sont propres et déjà exposées** :
`addSaleTicket` (RPC `create_sale_ticket`), `addExpense`, `addPurchase`,
`addClient`, `createOrder` (RPC `create_order_with_items`)… toutes
appelées depuis `useStoreData`.

**Ce que je propose** : le panneau de détail **ne contient aucun
formulaire de création**. Son bouton de pied de page navigue vers
l'écran existant, qui ouvre son formulaire — exactement comme
`onReapprovisionner` le fait déjà aujourd'hui. Les seules actions faites
sur place sont celles qui ont déjà une fonction partagée : cocher une
tâche, et les liens `tel:` / `sms:` / WhatsApp pour relancer un client.
→ **Écart n° 3, à valider.**

---

## 7. Objectifs de vente

**Il n'en existe aucun.** Vérifié sur les deux sources :

- `src/lib/database.types.ts` : aucune table, aucune colonne
  `objectif`, `goal` ou `target` dans les 35 tables.
- `grep -ri "objectif|goal|target_month"` sur `src/` : une seule
  occurrence, le mot « Objectif » dans un commentaire de
  `src/components/settings/primitives.tsx`.

**Sont donc retirées de toutes les vues :**

- carte **10 — Objectif de septembre** (la jauge entière) ;
- la ligne d'objectif pointillée orange du graphique de la carte 2, sa
  légende, et le plafond `MAX = 500 000` qui lui servait d'échelle — l'axe
  se calera sur le maximum réel de la période ;
- la barre d'objectif de la tuile « Ventes du jour », et le
  « Objectif du jour 11 086 Ar ».

Rien n'est créé en base. Ce qu'il faudrait pour les rallumer est décrit
dans le rapport final, sans être fait.

---

## 8. Colonnes réelles des quatre tables demandées

Depuis `src/lib/database.types.ts`, sans SQL.

### `stock_movements` (ligne 2031)

```
id, store_id, product_id, created_by, created_at, idempotency_key,
type_mouvement (text), stock_actuel_delta (number), stock_reserve_delta (number),
reference_type, reference_id, note
```

→ **Pas de colonne `date`** : le seul horodatage est `created_at`
(timestamp). Le découpage par jour se fera en heure locale côté client.
Les entrées sont `stock_actuel_delta > 0`, les sorties `< 0`.

### `deliveries` (ligne 443)

```
id, store_id, order_id, sale_ticket_id, client_id, livreur_id, created_by,
numero, destinataire, telephone, adresse, precisions, contenu (Json),
date_prevue (date | null), statut (text), montant_a_encaisser, montant_encaisse,
prise_en_charge_le, remise_le, argent_remis_a, argent_remis_le, motif_echec,
note, created_at, updated_at
```

→ `date_prevue` et `statut` existent : la carte 18 est réalisable.

### `quotes` (ligne 1596)

```
id, store_id, client_id, client_nom, created_by, numero, date (date),
valide_jusqu_au (date | null), statut (text), total (number), note,
vente_ticket_id, created_at, updated_at
```

→ `statut` et `date` existent : « devis sans réponse » est réalisable.

### `supplier_payments` (ligne 2262)

```
id, store_id, purchase_id, recorded_by, date (date), montant (number),
methode (text), reference, note, created_at
```

→ « déjà payé ce mois » est réalisable. **Pas de `supplier_id`** : le
fournisseur se retrouve par `purchase_id` → `purchases.fournisseur`.

### Deux vérifications faites au passage

**`purchases` porte bien `date_echeance` (date | null)** ainsi que
`solde_du`, `statut_paiement`, `fournisseur` et `supplier_id` : la carte
19 « Fournisseurs à payer » est réalisable telle quelle, échéance
dépassée comprise.

**`payments` n'a PAS de colonne `date`** (ligne 1013). Ses colonnes sont
`id, store_id, sale_id, order_id, recorded_by, numero, montant, methode,
reference, note, idempotency_key, created_at`. Le seul horodatage est
`created_at`, un `timestamptz`. Le cahier des charges écrit
« Σ `payments.montant` du jour » : ce jour se déduira de `created_at`
ramené en heure locale, comme pour `stock_movements`. Cela concerne la
tuile « Entrées d'argent » et les « encaissements par semaine » de la
carte 12.

---

## 9. Fuseau horaire

**Un helper existe déjà et il est correct** : [src/lib/dates.ts](src/lib/dates.ts).

```ts
export const dateDuJour = (maintenant = new Date()): string  // AAAA-MM-JJ, calendrier LOCAL
export const dateDansNJours = (n: number, maintenant = new Date()): string
```

Son en-tête documente précisément le défaut qu'il corrige :
`toISOString()` rendait la date en temps universel, et à Antananarivo
(UTC+3) toute saisie entre minuit et 3 h du matin était datée de la
veille — constaté en direct à 01 h 47 le 8 septembre.

`src/lib/periodes.ts` construit ses bornes à partir de `dateDuJour()` et
de `Date` locales, jamais par `new Date("AAAA-MM-JJ")` (qui vaut minuit
UTC, donc la veille au soir sur place).

**La v2 emploiera exclusivement ces deux fichiers.** Distinction à tenir :

| Type                | Colonnes                                                                                                                              | Traitement                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `date` (sans heure) | `sales.date`, `purchases.date`, `expenses.date`, `taches.echeance`, `deliveries.date_prevue`, `quotes.date`, `supplier_payments.date` | comparaison de chaînes, aucun fuseau                |
| `timestamptz`       | `created_at`, `journal_activite.cree_le`, `evenements.debut`, `stock_movements.created_at`                                            | conversion en heure locale avant de décider du jour |

---

## 10. Maquette → données : les 24 éléments

Légende du risque : 🟢 sans risque · 🟡 calcul nouveau, données présentes ·
🔴 donnée absente ou insuffisante.

### En-tête

| Élément                       | Source                                               | Calcul                                | Risque          |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------- | --------------- |
| Date + « Mis à jour à » + ⟳   | horloge locale ; `useStoreData.fetchAll`             | existant                              | 🟢              |
| « Bonjour / Bonsoir, prénom » | `profile.full_name`                                  | existant (DashboardView:135)          | 🟢              |
| Sélecteur de vue (rôle)       | `memberRole`, `memberPermissionsDetailed`, `isOwner` | nouveau (registre)                    | 🟢              |
| Sélecteur de période          | `periodes.ts`                                        | existant + intervalle libre nouveau   | 🟡              |
| Mode focus, thème             | localStorage ; thème existant de l'app               | existant                              | 🟡 voir écart 4 |
| Phrase de synthèse            | ventes période vs période précédente                 | nouveau (portage de `renderSummary`)  | 🟢              |
| Puces d'attention             | `taches`, `products`, `quotes`                       | **`construireEnSuspens` existe déjà** | 🟢              |
| En-tête compact ≤ 900 px      | —                                                    | nouveau (portage)                     | 🟢              |

### Bandeau « Aujourd'hui »

| Tuile                     | Source                                          | Calcul                                                 | Risque                    |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------ | ------------------------- |
| Ventes du jour            | `sales` du jour, `ticket_id` distinct           | nouveau, local                                         | 🟢                        |
| ↳ barre d'objectif        | —                                               | **aucune donnée d'objectif**                           | 🔴 retirée                |
| Entrées d'argent          | `payments.montant`, jour déduit de `created_at` | nouveau, local                                         | 🟡 définition à confirmer |
| Sorties d'argent          | `purchases.total_achat` + `expenses.montant`    | nouveau, local                                         | 🟢                        |
| ↳ prochaine sortie prévue | `rappels`, `purchases.date_echeance`            | nouveau                                                | 🟡 masquée si vide        |
| Stock du jour             | `stock_movements` du jour                       | **table jamais lue** — repli : quantités achats/ventes | 🟡                        |
| Activité aujourd'hui      | `journal_activite`                              | **créations exclues** — voir écart 2                   | 🔴                        |

### Grille principale

| #   | Carte                      | Source                                                                     | Calcul                                              | Risque               |
| --- | -------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | -------------------- |
| 1   | Trésorerie                 | `computedCapital`                                                          | **existant, sans recalcul**                         | 🟢                   |
| 2   | Ventes du mois (courbe)    | `sales`                                                                    | cumul nouveau, local                                | 🟢                   |
| 2b  | ↳ ligne d'objectif         | —                                                                          | aucune donnée                                       | 🔴 retirée           |
| 3   | Agenda                     | `evenements.debut`, `taches.echeance`, `rappels`, `deliveries.date_prevue` | nouveau (fusion)                                    | 🟢                   |
| 4   | Étagère de stock           | `products`                                                                 | existant (`stockActuel <= seuilAlerte`)             | 🟢                   |
| 4b  | ↳ Valeur du stock          | `products`                                                                 | existant (DashboardView:204) + droit `valeur_stock` | 🟢                   |
| 5   | Ticket « Sorties »         | `purchases`, `expenses`                                                    | nouveau, local                                      | 🟢                   |
| 6   | À faire                    | `taches`                                                                   | existant ; `changerStatut` pour cocher              | 🟢                   |
| 6b  | ↳ Devis en attente         | `quotes.statut in (brouillon, envoye)`                                     | existant via `enSuspens`                            | 🟢                   |
| 7   | Classement vendeurs        | `computedSellers`                                                          | **existant, sans recalcul**                         | 🟢                   |
| 8   | Suivi des commandes        | `orders.statut_commande`, `deliveries.statut`, `orders.reste_a_payer`      | existant (DashboardView:218)                        | 🟢                   |
| 9   | Fil des ventes             | `sales` groupées par jour                                                  | existant (le bloc actuel fait déjà cela)            | 🟢                   |
| 10  | Objectif (jauge)           | —                                                                          | aucune donnée                                       | 🔴 **carte retirée** |
| 11  | Résultat du mois           | `sales.margeTotale`, `expenses.montant`                                    | **nouveau** (le Bilan ne calcule pas le bénéfice)   | 🟡                   |
| 12  | Paiements                  | `payments`, `sales.soldeDu`, `orders.reste_a_payer`                        | découpe 30 j **nouvelle**                           | 🟡                   |
| 13  | Clients                    | `clients.created_at`, `sales.client_id`, soldes dus                        | nouveau, local                                      | 🟢                   |
| 14  | Journal d'activité         | `journal_activite`                                                         | **créations exclues** — écart 2                     | 🔴                   |
| 15  | Ruptures à venir           | `products` + ventes 30 j                                                   | couverture en jours **nouvelle**                    | 🟡                   |
| 16  | Entrées & sorties de stock | `stock_movements`                                                          | **table jamais lue** ; repli prévu                  | 🟡                   |
| 17  | Produits les plus vendus   | `sales` groupées par `product_id`                                          | nouveau, local                                      | 🟢                   |
| 18  | Livraisons & réceptions    | `deliveries`                                                               | existant                                            | 🟢                   |
| 18b | ↳ réceptions fournisseurs  | —                                                                          | **aucune date de réception en base**                | 🔴 masquée           |
| 19  | Fournisseurs à payer       | `purchases.solde_du`, `purchases.date_echeance`, `supplier_payments`       | nouveau, local                                      | 🟢                   |

### Ce qui disparaît de la maquette, faute de donnée

1. La carte **Objectif** en entier.
2. La ligne et la légende **objectif** du graphique des ventes, et la
   barre d'objectif de la tuile « Ventes du jour ».
3. La **réception fournisseur du 18/09** (tuile Stock, carte Livraisons,
   ligne « Distri Tana » de la carte Fournisseurs) : aucune table ne
   porte de date de réception prévue.
4. Toutes les étiquettes `exemple` — il y en a **21** dans la maquette.
   Aucune ne subsistera.

---

## Les cinq points qui demandent votre décision

### Écart n° 1 — La coquille reste celle de l'application

La v2 remplace le **contenu** du tableau de bord, pas la barre latérale
ni l'en-tête de l'application. Reprendre aussi la coquille de la maquette
reviendrait à refaire la navigation des vingt-cinq écrans.
→ **Je propose de garder la coquille actuelle.**

### Écart n° 2 — Le journal d'activité ne montre pas les créations

`useJournalActivite` filtre `action ≠ "creation"` et plafonne à 80
lignes ; la maquette montre surtout des créations. Trois options :

|                                                                                                  | Ce que ça donne                                       | Coût                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| **a)** lire `journal_activite` sans le filtre, dans la v2 seulement                              | le journal de la maquette, à l'identique              | une requête de plus ; risque de doublon avec l'activité déduite |
| **b)** reconstruire l'activité depuis les données chargées, comme `lib/activite.ts` le fait déjà | aucune requête de plus, aucun doublon                 | pas d'heure exacte pour les gestes anciens                      |
| **c)** garder le hook tel quel                                                                   | carte 14 et tuile « Activité » presque toujours vides | nul                                                             |
| → **Je propose (a)**, c'est une lecture, elle ne change rien à l'existant.                       |

### Écart n° 3 — Le panneau de détail ne contient pas de formulaire

Les formulaires de création ne sont pas des composants réutilisables. Le
panneau naviguera vers l'écran existant au lieu d'embarquer un
formulaire — ce que fait déjà `onReapprovisionner`.
→ **Je propose de naviguer.**

### Écart n° 4 — Deux polices contre une décision documentée

La maquette demande **Onest** et **JetBrains Mono** depuis Google Fonts.
`src/styles.css` s'ouvre sur un bloc qui explique pourquoi ces polices
ont été **retirées** : deux fichiers à télécharger avant le premier
texte, et une application qui change d'allure hors connexion. Seules huit
lettres du mot-symbole sont restées.

Charger deux familles complètes pour un seul écran défait cette décision
pour toute l'application (les polices sont globales).

|                                                                                   |                                                                      |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **a)** polices du système, `font-variant-numeric: tabular-nums` pour les chiffres | rien à télécharger ; l'allure diffère légèrement de la maquette      |
| **b)** Onest + JetBrains Mono chargées, `font-display: swap`                      | fidèle à la maquette ; ~60 ko, et l'écran change d'allure hors ligne |
| **c)** JetBrains Mono seule, pour les chiffres                                    | compromis ; ~15 ko                                                   |
| → **Je propose (a)** et je m'aligne sur votre choix.                              |

### Écart n° 5 — Le thème, et la palette

**Le thème.** L'application a déjà son bouton, dans `Header.tsx` : état
`theme` dans `BalsamaApp`, classe `.light` / `.dark` sur `<html>`,
mémorisé sous `balsama-theme`, et [src/lib/couleurDeBarre.ts](src/lib/couleurDeBarre.ts) surveille
cette classe pour peindre la barre système du téléphone. La maquette
emploie `data-theme`.
→ **Je me branche sur le système existant** et **je ne remets pas de
bouton thème dans l'en-tête du tableau de bord** : il y en aurait deux.

**La palette.** Vous m'aviez demandé, pour l'ensemble de l'application,
une seule couleur d'accent et la couleur réservée aux badges de statut.
La maquette, elle, emploie des pastilles colorées, un portefeuille en
dégradé et un ticket sur fond papier. Vous me demandez cette maquette à
l'identique : je l'applique, et les tokens vivront **sous une classe
racine propre à la v2**, sans toucher au style des autres écrans. Je le
signale seulement pour que ce soit dit, pas pour rouvrir la question.

---

## Ce que je ferai en phase 1, après votre feu vert

Tokens et CSS isolés sous `.dash-v2`, composants de base (Card, Chip,
Pill, Tag, Trend, Drawer, squelettes), helpers de format et de période,
feature flag `dashboard_v2`, et la page branchée sur `BalsamaApp` —
c'est-à-dire un écran vide avec son en-tête, et l'ancien tableau de bord
intact derrière le drapeau.

**Je m'arrête ici et j'attends votre validation.**
