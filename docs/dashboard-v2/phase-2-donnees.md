# Phase 2 — données, permissions, période

Ce que la phase 2 a posé, et comment vérifier que les chiffres sont
justes avant que les cartes ne les habillent.

## 1. Fichiers

| Fichier                            | Rôle                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `registry.ts`                      | les 18 cartes et 5 tuiles : titre, largeur, module, widget, données nécessaires |
| `roles.ts`                         | les 6 vues par métier, et le rôle `store_members` traduit en vue                |
| `hooks/useDashboardPermissions.ts` | les trois filtres, dans l'ordre                                                 |
| `hooks/useDashboardData.ts`        | les **deux** lectures que l'application ne fait pas encore                      |
| `lib/chiffres.ts`                  | tous les calculs, fonctions pures                                               |
| `lib/summary.ts`                   | la phrase de synthèse et son bandeau compact                                    |
| `DashboardV2Page.tsx`              | en-tête complet + table de contrôle                                             |

Dans `BalsamaApp.tsx` : la liste de props passée à `DashboardV2Page`.
Rien d'autre.

## 2. Les requêtes

### Ce qui n'est PAS redemandé

`useStoreData` charge déjà 21 tables à l'ouverture de la boutique, et le
tableau de bord les reçoit par props — **exactement comme l'ancien**. Le
nouveau n'en relit aucune. Refaire ces requêtes aurait doublé chaque
lecture sur l'écran le plus visité.

Reçues par props : `sales`, `purchases`, `expenses`, `products`,
`payments`, `orders`, `clients`, `quotes`, `deliveries`,
`supplier_payments`, `taches`, plus `computedCapital` et
`computedSellers`, qui sont des calculs et non des lectures.

### Les deux lectures propres à la v2

**1. `stock_movements`** — table alimentée par les déclencheurs, que
**aucune** requête de l'application ne lisait (constat de l'audit, § 5).

```
select  id, product_id, type_mouvement, stock_actuel_delta, created_at
from    stock_movements
where   store_id = <boutique>
  and   created_at >= <début de période, minuit heure locale>
order by created_at
range   pagination par 1 000, 10 pages au plus
```

**2. `journal_activite`** — relue **sans** le filtre `action ≠ "creation"`
que pose `useJournalActivite` (décision validée, écart n° 2 de l'audit).

```
select   id, cree_le, entite, action, etiquette, montant, acteur_id
from     journal_activite
where    store_id = <boutique>
order by cree_le desc
limit    120
```

`useJournalActivite`, celui de la cloche, **n'est pas touché** : il garde
son filtre et sa limite de 80.

### Propriétés de ces lectures

- **Uniquement des lectures.** Aucun `insert`, `update`, `upsert`,
  `delete` ni RPC d'écriture dans `src/features/dashboard-v2/**` —
  vérifié par recherche. L'onglet Réseau ne doit montrer que des GET.
- **En parallèle**, dans un seul `Promise.all`.
- **Colonnes explicites**, jamais `select("*")`.
- **Paginées par 1 000**, la limite de PostgREST.
- **Conditionnelles** : elles ne partent que si une carte autorisée en a
  besoin. Un vendeur, dont la vue ne contient ni « Entrées & sorties de
  stock » ni « Stock du jour », ne déclenche jamais la lecture des
  mouvements.
- **Une erreur par source** : une lecture refusée par la RLS n'emporte
  pas l'autre, et la carte propose « Réessayer ».
- **Rafraîchies toutes les 2 minutes**, et seulement si l'onglet est
  visible ; plus au retour au premier plan, plus le bouton ⟳.
- **Réponses obsolètes ignorées** : un changement de période pendant une
  requête lente ne laisse pas l'ancienne réponse écraser la nouvelle.

### Le défaut ancien qui reste

`useStoreData` n'appelle **ni `.range()` ni `.limit()`** : au-delà de
1 000 lignes, PostgREST tronque en silence. Ce n'est pas introduit par
cette mission et je ne l'ai pas corrigé sans votre accord. Les lectures
nouvelles, elles, paginent.

## 3. D'où vient chaque chiffre

### Repris tels quels, sans recalcul

| Chiffre                | Source                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Trésorerie             | `computedCapital.tresorerieGlobaleActuelle` (`BalsamaApp.tsx:795`) |
| Solde net d'un vendeur | `seller.soldeNetEnPoche` (`BalsamaApp.tsx:491`)                    |
| À recommander          | `stockActuel <= seuilAlerte` (`ProduitsView`, ancien dashboard)    |
| Valeur du stock        | `Σ stockActuel × prixAchat` (ancien dashboard)                     |
| Marge                  | `Σ sale.margeTotale` (page Bilan)                                  |
| Format des montants    | `formatCurrency` (`src/utils/formulas.ts`)                         |
| Jour du calendrier     | `dateDuJour` (`src/lib/dates.ts`)                                  |

### Calculés ici, parce qu'ils n'existaient pas

| Chiffre                                | Formule                                               | Pourquoi nouveau                                                                                                    |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Bénéfice**                           | `Σ marge − Σ dépenses`                                | Le Bilan calcule la marge, jamais la soustraction                                                                   |
| **Achats non déduits**                 | `Σ total_achat` de la période                         | Affiché à part : ils sont déjà dans la marge via `total_achat_ref`, les retirer compterait deux fois la marchandise |
| **À recevoir / en retard**             | solde dû de moins / plus de 30 jours                  | La page Paiements ne découpe pas                                                                                    |
| **Couverture d'un produit**            | `stockDisponible ÷ (quantités vendues sur 30 j ÷ 30)` | `—` si le produit ne s'est pas vendu ; produits `service` exclus                                                    |
| **Cumul des ventes**                   | jour par jour sur la période                          | Pour la courbe                                                                                                      |
| **Encaissements par jour**             | `payments` groupés par jour local de `created_at`     | `payments` n'a **pas** de colonne `date`                                                                            |
| **Tickets**                            | `ticket_id` distincts, `id` à défaut                  | Les ventes antérieures aux tickets comptent chacune pour une                                                        |
| **Panier moyen**                       | total ÷ tickets                                       | —                                                                                                                   |
| **Sorties par jour / part des ventes** | moyenne sur la période, et rapport aux ventes         | —                                                                                                                   |
| **Semaines d'encaissement**            | tranches de 7 jours **depuis le début de la période** | La semaine civile couperait la période en moitiés inégales                                                          |

### Une précision sur les fuseaux

Les colonnes `date` (`sales`, `purchases`, `expenses`, `taches.echeance`,
`quotes`, `supplier_payments`, `deliveries.date_prevue`) portent un jour
du calendrier : elles se comparent en chaînes, sans conversion.

Les horodatages (`payments.created_at`, `stock_movements.created_at`,
`journal_activite.cree_le`, `orders.created_at`, `clients.created_at`)
passent par `dateDuJour(new Date(...))`, qui lit le calendrier **local**.
Jamais `toISOString`, jamais `new Date("AAAA-MM-JJ")` — à Antananarivo,
cette dernière forme vaut la veille au soir.

## 4. Les permissions : trois filtres, dans cet ordre

1. **La boutique** a-t-elle gardé le module ? (`moduleMasque`,
   `src/lib/personnalisation.ts`)
2. **La personne** a-t-elle le droit de le voir ? (`isModuleVisible`,
   puis `isWidgetVisible` pour le réglage hérité)
3. **La vue** choisie retient-elle la carte ? (`roles.ts`)

Le propriétaire passe les deux premiers sans les lire :
`memberPermissionsDetailed` vaut `null` pour lui, et traiter ce `null`
comme un objet vide lui masquerait tout son tableau de bord.

**Une vue ne donne aucun droit.** Elle trie et ordonne ce que les deux
premiers filtres ont laissé passer — au pire elle montre moins que ce à
quoi on a droit, jamais plus.

### La table de correspondance des widgets

Le réglage hérité (`DASHBOARD_WIDGETS`, 21 clés) rapproché des cartes de
la maquette. Chaque rapprochement est écrit dans `registry.ts`.

| Carte            | Widget             | Carte               | Widget                 |
| ---------------- | ------------------ | ------------------- | ---------------------- |
| Trésorerie       | `tresorerie`       | Résultat            | `benefices`            |
| Ventes du mois   | `chiffre_affaires` | Paiements           | `montants_a_recevoir`  |
| Étagère de stock | `stock_disponible` | Journal             | `activites_recentes`   |
| Sorties          | `depenses`         | Ruptures            | `produits_rupture`     |
| Vendeurs         | `perf_equipe`      | Mouvements de stock | `stock_faible`         |
| Commandes        | `commandes`        | Top produits        | `produits_plus_vendus` |
| Fil des ventes   | `dernieres_ventes` | Fournisseurs        | `montants_a_payer`     |

**Quatre cartes n'ont pas de widget** : Agenda, À faire, Clients,
Livraisons. Les 21 clés ont été écrites pour l'ancien tableau de bord,
qui ne montrait ni agenda ni livraisons. Ces quatre-là ne dépendent donc
que de la visibilité de leur module (`agenda`, `taches`, `clients`,
`livraisons`) — aucune n'est créée en base.

### Champs sensibles

Un montant qu'on n'a pas le droit de voir s'affiche `••• Ar`
(`MONTANT_MASQUE`). Quand un champ est si central que la carte n'a plus
d'objet sans lui — « Fournisseurs à payer » sans le droit de voir les
prix d'achat — la carte disparaît plutôt que de montrer une colonne de
points.

## 5. Les six vues

| Vue                    | Rôle `store_members`             | Cartes |
| ---------------------- | -------------------------------- | ------ |
| Dirigeant              | `admin`, `manager`, propriétaire | toutes |
| Responsable commercial | _(aucun — prévisualisation)_     | 10     |
| Gestionnaire stock     | `gestionnaire_stock`             | 10     |
| Comptabilité           | `comptable`                      | 10     |
| Vendeur                | `vendeur`                        | 7      |
| Livreur                | `livreur`                        | 4      |

Un rôle inconnu — la colonne accepte du texte libre — retombe sur la vue
complète, dont les permissions feront le tri : mieux vaut une vue large
dont chaque carte est filtrée qu'un écran vide.

**Le livreur ne verra jamais cette page en vrai** :
`BalsamaApp.tsx:172` coupe `useStoreData` pour lui et il reçoit
`EspaceLivreur`. Sa vue n'existe que comme prévisualisation pour le
propriétaire.

## 6. Comment vérifier les chiffres

Avec le drapeau levé, le tableau de bord v2 affiche une **table de
contrôle** provisoire : tous les chiffres que les cartes montreront,
en clair, groupés par thème. Elle disparaîtra quand les cartes prendront
sa place.

Points à confronter, sur la **même période** :

| Dans la table de contrôle                  | À comparer avec                 |
| ------------------------------------------ | ------------------------------- |
| Trésorerie                                 | le montant de la barre latérale |
| Total de la période, tickets, marge        | la page Ventes                  |
| Achats, dépenses                           | les pages Achats et Dépenses    |
| Marge brute                                | la page Bilan                   |
| Valeur du stock, à recommander, en rupture | la page Produits                |
| À recevoir + en retard                     | la page Paiements à recevoir    |
| Dû aux fournisseurs                        | la page Fournisseurs            |

La ligne **« Source des mouvements »** dit si `stock_movements` a répondu
(`stock_movements`, avec le nombre de lignes lues) ou si l'écran est en
repli sur les quantités d'achats et de ventes. C'est le seul point que
je n'ai pas pu vérifier moi-même : la table n'avait jamais été lue par
l'application, donc ses règles de lecture n'ont jamais été exercées.

## 7. Ce qui n'a pas pu être vérifié ici

Le tableau de bord est derrière l'authentification et je n'ai pas de
session. `tsc`, ESLint et `vite build` passent, Vite transforme les
modules en développement, et la mise en page a été contrôlée à 1440,
860 et 360 pixels sur la feuille compilée. **Les valeurs, elles, ne
peuvent être confirmées que sur votre boutique**, et c'est ce que la
table de contrôle sert à faire.

## 8. Suite

Phase 3 : l'en-tête est fait ; reste le bandeau « Aujourd'hui » avec ses
cinq tuiles, son défilement horizontal sur téléphone et ses points de
position.
