# Listes personnalisables — journal de la mission

Ce que le cahier des charges demandait, ce qui a été livré, et les
quatre endroits où la livraison s'écarte de la demande — dits plutôt que
tus.

## Ce qui est en place

| Point du cahier | Où ça vit |
| --- | --- |
| 0. Brique commune : le sélecteur | `src/components/shared/SelecteurListe.tsx` |
| 0. Page Paramètres → Listes | `src/components/settings/ListesSection.tsx` |
| 0. Anti-doublon, base et écran | `cle_de_liste(text)` en base, `cleDeListe` en TypeScript |
| 0. Qui peut ajouter | `peut_ajouter_une_valeur_de_liste()`, dans la politique d'insertion |
| 0. Valeurs par défaut | `installer_les_listes_par_defaut()` + déclencheur sur `stores` |
| 0. Import CSV | Listes : `ListesSection`. Fournisseurs : bouton « Importer » de l'écran Fournisseurs |
| 1. Prix calculé | `src/lib/prixAuto.ts`, `ChampPrixDeVente`, Paramètres → Prix de vente |
| 2. Catégories de produits | liste `usage = 'produit'`, taux de marge par catégorie |
| 3. Fournisseurs | `suppliers.type_id`, sélecteur dans l'achat et le produit, fiche rapide |
| 4. Dépenses | poste = `expenses.category_id`, « Effectué par » avec libellé réglable |
| 5. Personnes externes | `personnes_externes`, Paramètres → Équipe → Hors équipe |
| 6. « Confié à » | `deliveries.confie_a`, champ libre à suggestions |
| 7. « Produits libres » | `src/components/shared/LigneLibre.tsx` |

Migrations appliquées, dans l'ordre :
`20260922140000_listes_personnalisables_brique_0`,
`20260922141000_listes_fournisseurs`,
`20260922142000_personnes_externes`,
`20260922143000_prix_automatique_et_confie_a`,
`20260922144000_le_type_dune_depense_nest_pas_son_poste`.

## Les quatre écarts

### 1. Le prix d'achat ne se reporte pas tout seul après un achat

Le cahier dit : « Quand un nouvel achat change le prix d'achat, le prix
de vente est recalculé, et le client voit la liste des prix modifiés. »

Or `add_purchase` n'a **jamais** touché au prix d'achat d'un produit
déjà au catalogue : elle n'ajoute que du stock. Le prix d'achat d'un
produit ne bouge que lorsqu'on le corrige dans sa fiche.

Reporter automatiquement le prix d'un achat sur la fiche changerait
`products.prix_achat`, c'est-à-dire la référence de marge de toutes les
ventes à venir. C'est un calcul en production, et le cahier de mission
demande explicitement de ne pas y toucher sans accord.

Ce qui est livré à la place : **une case à cocher, décochée**, qui
apparaît dans le formulaire d'achat dès que le prix saisi diffère de
celui de la fiche. Elle annonce le prix de vente qui en résulterait
avant d'écrire quoi que ce soit, et la liste des prix modifiés s'affiche
après. Le recalcul automatique, lui, fonctionne là où le prix d'achat
change vraiment : dans la fiche produit, en direct.

**Si vous voulez le comportement automatique, dites-le** : il tient en
une ligne dans `add_purchase`, mais il déplacera la marge de référence
des produits existants.

### 2. `sales.vendeur` ne reçoit pas d'identifiant

Le sélecteur de vendeur d'une vente propose bien les fiches « hors
équipe », mais il n'écrit que le **nom**, dans la colonne texte, comme
avant. La raison est simple : la vente passe par `create_sale_ticket`,
que le cahier de mission met hors d'atteinte.

Conséquence pratique : renommer une personne externe ne renomme pas ses
anciennes ventes. Pour les dépenses, en revanche, le lien existe
(`expenses.personne_id`), parce que l'écriture s'y fait en direct.

### 3. Le champ « parent » des catégories reste affiché

Le cahier dit : « Prévois un champ parent pour des sous-catégories plus
tard, sans l'afficher pour l'instant. »

Il était **déjà affiché** avant cette mission, et la base fait déjà
respecter les deux niveaux par un déclencheur. Le retirer aurait enlevé
une possibilité qui fonctionne à des boutiques qui s'en servent peut-être
déjà. Il est donc resté. Un mot suffit pour qu'il disparaisse.

### 4. `expenses.type` n'a pas été rendu personnalisable

Et c'est volontaire. Cette colonne ne prend que trois valeurs écrites en
dur — « Achat de stock », « Retrait d'argent », « Autre dépense » — et le
bilan répartit ses totaux dessus. Elle dit la NATURE de la sortie.

Le « type de dépense » que le cahier veut voir personnalisable, c'est le
POSTE : loyer, transport, électricité. Il existait déjà sous le nom
`expenses.category_id`, il est maintenant pré-rempli avec les dix valeurs
du cahier, et c'est lui qui a reçu le sélecteur.

Une première migration avait confondu les deux ; elle a été défaite par
`20260922144000`.

## Deux corrections faites en passant

- **`handleAddExpense` perdait cinq colonnes.** Le formulaire de dépense
  envoyait le poste, le prestataire et le justificatif ; la fonction n'en
  recopiait que six et laissait le reste au bord de la route, sans erreur
  et sans trace. C'est pourquoi `expenses.category_id` était vide dans
  toute la base alors que l'écran proposait de le remplir.

- **`optionsCategories` ne filtrait pas sur `usage`.** Sans correction,
  la table portant désormais toutes les listes, le sélecteur de catégorie
  d'un produit aurait proposé « Loyer » et « Grossiste ».

## L'état de la reprise, vérifié en base

- 4 fiches fournisseur créées ; **plus aucun** achat ni produit ne porte
  un nom de fournisseur sans fiche.
- 2 fiches « hors équipe » créées — `bali` et `Lanto`, les deux seuls
  noms qui n'étaient ni un propriétaire ni un membre. Aucune fusion :
  « Mamy » et « Mamy Herinatenaina » sont les propriétaires de deux
  boutiques différentes, pas deux graphies d'une même personne.
- 20 boutiques ont reçu les listes par défaut (8 catégories, 8 types de
  fournisseur, 10 postes de dépense chacune).
- Les colonnes texte d'origine sont **toutes** conservées :
  `purchases.fournisseur`, `products.fournisseur`, `expenses.type`,
  `expenses.vendeur`, `sales.vendeur`, `suppliers.categorie`. Un
  `UPDATE … SET …_id = NULL` remet l'état d'avant.
