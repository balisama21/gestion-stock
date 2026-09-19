# Tableau de bord v2 — rapport final

Refonte de l'écran d'accueil d'après `docs/maquette/tableau-de-bord-complet.html`,
branchée sur les données réelles, derrière un drapeau.

- Branche : `feat/dashboard-v2`, partie de `main` (`2863a01`).
- Sept commits, un par phase.
- **Aucune migration, aucun SQL exécuté, aucune modification de
  `database.types.ts`** — vérifié sur le diff complet.

---

## 1. Fichiers créés et modifiés

### Créés — `src/features/dashboard-v2/` (38 fichiers, ~12 800 lignes)

|                       |                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `DashboardV2Page.tsx` | la page : en-tête, bandeau, grille, panneau                                                      |
| `dashboard.css`       | tous les jetons et styles, sous la classe `.dash2`                                               |
| `drapeau.ts`          | l'interrupteur `dashboard_v2`                                                                    |
| `registry.ts`         | les 18 cartes et 5 tuiles : largeur, module, widget, données requises                            |
| `roles.ts`            | les 6 vues par métier                                                                            |
| `hooks/`              | `useDashboardPeriod`, `useDashboardPermissions`, `useDashboardData`                              |
| `lib/`                | `format`, `chiffres`, `summary`, `tendance`, `agenda`, `journal`, `defilement`                   |
| `components/`         | `Card`, `Chip`, `Pill`, `Tag`, `Trend`, `Drawer`, `States`, `BandeauAujourdhui`, `PanneauDetail` |
| `cards/`              | une carte par fichier, quinze au total                                                           |

### Créés — `docs/`

`maquette/tableau-de-bord-complet.html` (la référence), `dashboard-v2/audit.md`,
`dashboard-v2/phase-2-donnees.md`, `dashboard-v2/fidelite-maquette.md`,
et ce rapport.

### Modifiés — deux fichiers, et pourquoi

**`src/BalsamaApp.tsx`** — le branchement du drapeau. Le diff est
**purement additif** : en ignorant l'indentation, `git diff main -w` ne
montre aucune ligne supprimée. Le bloc `<DashboardView>` est intact ;
il a seulement été décalé de deux espaces en entrant dans une
condition. Trois ajouts : l'import du drapeau, le `lazy()` de la page
v2, et deux constantes de droits (`peutEnregistrerUneVente`,
`peutTerminerUneTache`) écrites sur le modèle de celles qui existaient.

**`src/lib/activite.ts`** — `const ENTITES` devient `export const ENTITES`,
plus cinq lignes de commentaire. Aucun changement de comportement. La
raison : le tableau de bord, la cloche et l'historique doivent appeler
un geste du même nom. Deux tables de traduction pour les mêmes lignes
finiraient par diverger.

**`src/components/DashboardView.tsx` n'est pas touché** — vérifié :
`git diff main` sur ce fichier est vide.

---

## 2. Chaque carte : sa source, et son calcul

### Repris de l'application, sans recalcul

| Chiffre                       | Fonction existante                                                 |
| ----------------------------- | ------------------------------------------------------------------ |
| Trésorerie                    | `computedCapital.tresorerieGlobaleActuelle` (`BalsamaApp.tsx:795`) |
| Solde net d'un vendeur        | `seller.soldeNetEnPoche` (`BalsamaApp.tsx:491`)                    |
| Produit à recommander         | `stockActuel <= seuilAlerte` (`ProduitsView`)                      |
| Valeur du stock               | `Σ stockActuel × prixAchat` (ancien tableau de bord)               |
| Marge                         | `Σ sale.margeTotale` (page Bilan)                                  |
| Format des montants           | `formatCurrency` (`utils/formulas.ts`)                             |
| Quantités en toutes lettres   | `quantiteEnMots` (`utils/formulas.ts`)                             |
| Nom d'un produit, sans indice | `getSaleLabel` / `getProductLabel`                                 |
| Jour du calendrier local      | `dateDuJour` (`lib/dates.ts`)                                      |
| Vocabulaire du journal        | `ENTITES` (`lib/activite.ts`)                                      |
| Photo d'un produit            | `VignetteProduit` (`components/shared/`)                           |

### Carte par carte

| #   | Carte                      | Source                                                                              | Calcul                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| —   | Bandeau « Aujourd'hui »    | `sales`, `payments`, `purchases`, `expenses`, `stock_movements`, `journal_activite` | **nouveau** — jour et mois en cours, indépendants du sélecteur de période |
| 1   | Trésorerie                 | `computedCapital`, flux de la période                                               | **existant** pour le solde ; part entrées/sorties nouvelle                |
| 2   | Ventes du mois             | `sales`                                                                             | **nouveau** — cumul jour par jour, et celui de la période précédente      |
| 3   | Agenda                     | `evenements`, `taches`, `deliveries`, `rappels`                                     | **nouveau** — fusion des quatre sources par jour (`lib/agenda.ts`)        |
| 4   | Étagère de stock           | `products`                                                                          | **existant** (seuil, valeur) ; jauge à dix casiers nouvelle               |
| 5   | Ticket « Sorties »         | `purchases`, `expenses`                                                             | **nouveau** — part par personne, moyenne par jour, part des ventes        |
| 6   | À faire                    | `taches`, `quotes`                                                                  | **existant** ; cocher appelle `useTaches().changerStatut`                 |
| 7   | Classement vendeurs        | `computedSellers`                                                                   | **existant**                                                              |
| 8   | Suivi des commandes        | `orders`, `deliveries`                                                              | **existant** (mêmes statuts que l'ancien tableau de bord)                 |
| 9   | Fil des ventes             | `sales`, `products`, `product_images`                                               | **existant** ; groupement par jour nouveau                                |
| 11  | Résultat                   | `sales.margeTotale`, `expenses`                                                     | **NOUVEAU** — la page Bilan calcule la marge, jamais `marge − dépenses`   |
| 12  | Paiements                  | `payments`, `sales.soldeDu`, `orders.reste_a_payer`                                 | **NOUVEAU** — découpe à 30 jours, encaissements par semaine               |
| 13  | Clients                    | `clients`, `sales`                                                                  | **nouveau** — nouveaux, actifs, à relancer                                |
| 14  | Journal d'activité         | `journal_activite`                                                                  | **nouveau** — lu **sans** le filtre qui écarte les créations              |
| 15  | Ruptures à venir           | `products`, `sales` (30 j)                                                          | **NOUVEAU** — couverture en jours                                         |
| 16  | Entrées & sorties de stock | `stock_movements`                                                                   | **NOUVEAU** — table que rien ne lisait ; repli sur achats et ventes       |
| 17  | Produits les plus vendus   | `sales` groupées par produit                                                        | **nouveau** — top 5 et ligne « Autres »                                   |
| 18  | Livraisons                 | `deliveries`                                                                        | **existant**                                                              |
| 19  | Fournisseurs à payer       | `purchases.solde_du`, `supplier_payments`                                           | **nouveau** — échéances dépassées                                         |

### Les requêtes

Le tableau de bord **ne redemande rien** de ce que `useStoreData` a déjà
chargé. Deux lectures lui sont propres, et elles portent sur des tables
que l'application ne lisait pas :

```
GET /rest/v1/stock_movements    colonnes nommées, paginé par 1 000
GET /rest/v1/journal_activite   120 lignes, créations comprises
```

**Vérifié à l'exécution** : en interceptant `fetch`, les seuls appels
sortants du tableau de bord sont ces deux `GET`. Zéro écriture, zéro
RPC.

---

## 3. Éléments masqués faute de données

### La carte « Objectif », la jauge, et les lignes d'objectif

**Rien en base.** Ni table, ni colonne `objectif`, `goal` ou `target`
dans les trente-cinq tables ; aucune trace dans le code.

Sont donc absents : la carte 10 en entier, la ligne pointillée du
graphique des ventes avec sa légende, et la barre d'objectif de la tuile
« Ventes du jour ».

**Ce qu'il faudrait — non fait** : une table d'objectifs, au minimum
`store_id`, `mois`, `montant`, et éventuellement `seller_id` pour un
objectif par vendeur ; un écran de saisie dans les Paramètres ; et
l'objectif du jour déduit du reste à vendre divisé par les jours
restants, comme la maquette le montrait. Le SQL n'a **pas** été écrit.

### Les réceptions fournisseurs

**Aucune table ne porte de date de réception prévue.** `purchases` a une
date d'achat et une date d'échéance de paiement, pas une date de
livraison attendue.

Sont donc absents : la ligne « Réception fournisseur 18/09 · 09:00 » du
pied de la tuile Stock, la ligne « Distri Tana » de la carte
Fournisseurs, et la seconde moitié du titre « Livraisons **&
réceptions** ».

**Ce qu'il faudrait — non fait** : une colonne `date_reception_prevue`
sur `purchases`, ou une table de réceptions. Additif, donc sans risque
pour les données existantes — mais ce n'est pas à moi d'en décider.

### Ce qui se dégrade proprement

- `stock_movements` illisible → repli sur les quantités d'achats et de
  ventes, **et la carte le dit**.
- Produit sans vente sur trente jours → pas de couverture en jours, le
  seuil s'affiche à la place.
- Client sans téléphone → pas de lien d'appel, un message le dit.
- Aucune échéance fournisseur → la ligne disparaît du pied de la tuile.

---

## 4. Écarts avec la maquette

Le relevé complet, élément par élément, est dans
`docs/dashboard-v2/fidelite-maquette.md`. Les huit écarts qui comptent :

| Écart                                                                                            | Raison                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La coquille reste celle de l'application** — pas la barre latérale ni l'en-tête de la maquette | Ils existent déjà et servent vingt-cinq écrans. Validé.                                                                                                                                                                      |
| **Polices du système** au lieu d'Onest et JetBrains Mono                                         | `src/styles.css` explique pourquoi ces familles ont été retirées : deux fichiers à charger avant le premier texte, et une allure qui change hors connexion. Les chiffres gardent leur alignement par `tabular-nums`. Validé. |
| **Pas de formulaire de création dans le panneau**                                                | Ceux de l'application vivent dans des écrans de mille à deux mille lignes ; en réécrire une copie donnerait deux façons d'enregistrer une vente. Le panneau montre, la page enregistre. Validé.                              |
| **Photo du produit au lieu du carré à initiale** dans le fil des ventes                          | Votre règle, valable pour tous les écrans : la vraie photo sans cadre, et rien du tout quand elle manque. Un carré à initiale est précisément ce qu'elle interdit.                                                           |
| **Échelle du graphique calée sur les données**                                                   | La maquette plafonnait à 500 000, le montant de son objectif d'exemple. Sans objectif, l'axe suit les cumuls réels, arrondis au palier rond.                                                                                 |
| **Tampon du ticket jamais rouge**                                                                | Acheter plus n'est ni bon ni mauvais : c'est du stock qui change de forme. Règle déjà appliquée ailleurs dans l'application.                                                                                                 |
| **« 0 Ar » et non « −0 Ar »**                                                                    | La maquette écrit le signe en dur. Un zéro signé n'a pas de sens.                                                                                                                                                            |
| **Rappels quotidiens écartés du calendrier**                                                     | Une pastille sur les trente jours du mois ne dit plus ce qui est prévu. Les rappels mensuels et hebdomadaires y sont ; ceux liés à un événement ou une tâche le sont déjà par eux.                                           |

Une hypothèse, à confirmer : **le lien WhatsApp présume Madagascar**
(+261) pour un numéro commençant par zéro, `wa.me` refusant un numéro
local. C'est cohérent avec une application qui écrit l'Ariary en dur,
mais ce serait faux pour un client à l'étranger.

---

## 5. Allumer le drapeau, et revenir en arrière

### Sur un seul navigateur

```js
localStorage.setItem("dashboard_v2", "1");
location.reload();
```

Pour revenir à l'ancien tableau de bord :

```js
localStorage.removeItem("dashboard_v2");
location.reload();
```

### Pour toute la boutique

Variable d'environnement au build :

```
VITE_DASHBOARD_V2=1
```

La retirer et redéployer suffit à revenir en arrière.

### Ce que le drapeau garantit

- **Baissé, la v2 n'est même pas téléchargée** : `DashboardV2Page` est un
  module à part (100 ko de code, 41 ko de style) que le `lazy()` ne va
  chercher que si le drapeau est levé.
- **Le retour en arrière est exact** : `DashboardView.tsx` n'a pas une
  ligne de changée, et le bloc qui le rend dans `BalsamaApp.tsx` non
  plus.
- **Rien n'est stocké en base** : le jour où la v2 deviendra la seule
  version, il n'y aura ni colonne ni migration à défaire.

### La table de contrôle

Outil de recette, masqué par défaut. Elle liste en clair tous les
chiffres des cartes, pour les confronter à l'ancien tableau de bord et
aux pages Ventes, Stock, Bilan et Paiements sur la même période.

```js
localStorage.setItem("tantana.dash.controle", "1");
location.reload();
```

---

## 6. Vérifications, une par une

| Point du §10                                              | État                                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                                            | ✅ sans erreur                                                                                                                          |
| ESLint sur `src/features/dashboard-v2`                    | ✅ 0 erreur, 0 avertissement                                                                                                            |
| `vite build`                                              | ✅ sans erreur                                                                                                                          |
| Aucune migration, aucun SQL, `database.types.ts` intact   | ✅ vérifié sur le diff                                                                                                                  |
| `git diff` limité au périmètre                            | ✅ deux fichiers hors périmètre, justifiés au §1                                                                                        |
| Au chargement, **que des lectures**                       | ✅ mesuré : deux `GET`, zéro écriture                                                                                                   |
| Aucune étiquette « exemple », aucune donnée fictive       | ✅ les 21 de la maquette ont disparu ; recherche `exemple\|démonstration\|factice` sans résultat                                        |
| Console sans erreur                                       | ✅                                                                                                                                      |
| État **vide**                                             | ✅ six cartes ont le leur (commandes, ruptures, fil, clients, vendeurs, fournisseurs, à faire)                                          |
| État **erreur**                                           | ✅ mesuré en forçant un 403 : les deux cartes concernées affichent « Lecture impossible » et « Réessayer », les seize autres continuent |
| État **chargement**                                       | ✅ squelettes à la forme des cartes                                                                                                     |
| Captures 360 / 768 / 1440                                 | ✅ mesures dans `fidelite-maquette.md`                                                                                                  |
| Aucun défilement horizontal                               | ✅ aux quatre largeurs ; seul le bandeau du jour défile, sur téléphone                                                                  |
| Vue fondateur et vue vendeur                              | ✅ les six vues mesurées ; le vendeur ne voit ni trésorerie, ni résultat, ni les autres vendeurs                                        |
| Désactiver le drapeau rétablit l'ancien                   | ✅ prouvé par le diff : aucune ligne supprimée                                                                                          |
| **Les chiffres correspondent à l'ancien tableau de bord** | ⏳ **à faire par vous** — voir ci-dessous                                                                                               |

### Le seul point que je n'ai pas pu vérifier

Le tableau de bord est derrière l'authentification et je n'ai pas de
session : **les valeurs ne peuvent être confrontées que sur votre
boutique**. C'est à cela que sert la table de contrôle.

À comparer, sur la même période :

| Dans la table de contrôle                  | Avec                            |
| ------------------------------------------ | ------------------------------- |
| Trésorerie                                 | le montant de la barre latérale |
| Total de la période, tickets, marge        | la page Ventes                  |
| Achats, dépenses                           | les pages Achats et Dépenses    |
| Marge brute                                | la page Bilan                   |
| Valeur du stock, à recommander, en rupture | la page Produits                |
| À recevoir + en retard                     | la page Paiements à recevoir    |
| Dû aux fournisseurs                        | la page Fournisseurs            |

Une ligne mérite une attention particulière : **« Source des
mouvements »**. Elle dit si `stock_movements` a répondu, avec le nombre
de lignes lues, ou si l'écran est retombé sur les quantités d'achats et
de ventes. Cette table n'ayant jamais été lue par l'application, ses
règles de sécurité n'ont jamais été exercées — votre boutique est le
premier endroit où on le saura.
