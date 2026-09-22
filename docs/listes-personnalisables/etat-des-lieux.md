# Listes personnalisables — état des lieux et schéma retenu

Relevé fait le 22 septembre 2026 sur la base de production
(`jasyacrnpimgwapcjkpr`), avant toute écriture.

## 1. Comment chaque champ est stocké aujourd'hui

| Champ | Stockage | Ce qu'il y a en base |
| --- | --- | --- |
| Catégorie d'un produit | `products.category_id` → `categories` | table `categories` **vide** : 0 ligne, pour 19 boutiques |
| Poste de dépense | `expenses.type` **texte libre** ; `expenses.category_id` existe mais n'est jamais rempli | « Autre dépense » ×4, « Retrait d'argent » ×2 |
| Fournisseur d'un achat | `purchases.fournisseur` **texte** ; `purchases.supplier_id` existe, rempli 3 fois sur 14 | « » ×8, « Chine » ×3, Mdparfum, VillaD, Tsara |
| Fournisseur d'un produit | `products.fournisseur` **texte** ; `supplier_id` rempli 1 fois sur 50 | « Chine » ×33, « » ×15, « Grossiste M », « Mdparfum » |
| Type de fournisseur | `suppliers.categorie` **texte libre, nullable** | 3 fiches, toutes à `NULL` |
| Annuaire fournisseurs | vraie table `suppliers` (19 colonnes) | 3 fiches |
| Reliquat | `stores.suppliers text[]` — tableau hérité, vide partout | — |
| Vendeur d'une vente | `sales.vendeur` **texte**, écrit par `create_sale_ticket` | 8 noms ; « Mamy » et « Mamy Herinatenaina » se ressemblent |
| « Vendeur » d'une dépense | `expenses.vendeur` **texte** | 5 noms, mêmes ambiguïtés |
| « Confié à » | n'existe pas sous ce nom : c'est le « Confiée à » des livraisons, `deliveries.livreur_id` → un **membre de l'équipe ayant le rôle livreur**, rien d'autre | 1 livraison |
| « Produits libres » | aucun champ : c'est l'option vide des sélecteurs de produit — « Produit libre » (Commandes), « Ligne libre » (Devis), « Hors catalogue » (Factures d'achat), « Prestation — hors catalogue » (Facturation) | — |
| Prix de vente | `products.prix_vente_defaut`, saisi à la main, sans aucun lien avec `prix_achat` | 50 produits |
| Réglages par boutique | `stores.personnalisation` jsonb, déjà partagé par plusieurs écrans (`lirePersonnalisation` recopie ce qu'elle ne connaît pas) | — |

Deux constats qui commandent la suite :

- **Les identifiants sont déjà là, ce sont les données qui manquent.**
  `products.category_id`, `expenses.category_id`, `purchases.supplier_id`,
  `products.supplier_id` existent tous, avec leur clé étrangère et leur
  `ON DELETE SET NULL`. Le travail n'est donc pas d'ajouter des colonnes,
  mais de remplir celles qui dorment et de brancher les formulaires
  dessus.
- **`categories` est déjà une table de listes générique qui s'ignore.**
  Elle porte `store_id`, `nom`, `parent_id`, `ordre`, `actif`, `created_by`,
  et surtout une colonne `usage` avec un `CHECK (usage IN ('produit',
  'depense'))`. C'est mot pour mot la brique 0 du cahier des charges,
  écrite pour deux listes au lieu de toutes.

Manque aujourd'hui : aucune contrainte d'unicité sur `(store_id, nom)`,
donc rien n'empêche « Grossiste » et « grossiste » de coexister.

## 2. Le schéma retenu

**Une table générique, et c'est `categories` — pas une nouvelle.**

Le cahier laisse le choix entre une table générique et des tables
séparées. Les deux ont été pesées ; c'est une troisième voie qui est
retenue, parce qu'elle est la seule à ne rien déplacer en production :

- créer `listes_valeurs` à côté obligerait soit à **déménager
  `products.category_id` et `expenses.category_id`** vers la nouvelle
  table — une migration qui touche des clés étrangères déjà en service —,
  soit à laisser **deux mécanismes** de liste dans le logiciel, l'un pour
  les catégories, l'autre pour tout le reste. Le sélecteur unique de la
  brique 0 aurait alors deux adaptateurs au lieu d'un ;
- des tables séparées (`types_fournisseur`, `types_depense`, …)
  multiplieraient par cinq le nombre de tables, de politiques RLS, de
  déclencheurs de verrou et d'écrans de réglage, pour cinq listes qui ont
  exactement la même forme ;
- élargir `categories` ne coûte qu'un `CHECK` remplacé. Aucune donnée
  n'est déplacée, aucune clé étrangère n'est touchée, et la table est
  vide pour l'usage « produit ».

Le nom de la table reste `categories` : la renommer casserait le code qui
tourne chez le client aujourd'hui, pour un gain purement cosmétique. Un
commentaire de table dit ce qu'elle est devenue.

### Ce que la brique 0 ajoute

- `categories.usage` accepte désormais `produit`, `depense`,
  `type_fournisseur` — et la liste s'allongera sans migration de données.
- `categories.taux_marge numeric NULL` : le taux par défaut d'une
  catégorie (point 1 du cahier).
- `cle_de_liste(text)`, fonction `IMMUTABLE` : minuscules, accents
  retirés, espaces réduits. Elle sert à l'anti-doublon et à la recherche.
  Écrite à la main plutôt qu'avec `unaccent`, qui n'est pas installé et
  dont la fonction n'est pas `IMMUTABLE`, donc inutilisable dans un index.
- un index unique sur `(store_id, usage, cle_de_liste(nom))` : « Grossiste »
  et « grossiste » ne peuvent plus coexister, côté base et pas seulement
  côté écran.
- l'archivage se fait avec la colonne `actif` qui existe déjà. Rien n'est
  jamais supprimé.

### Ce qui n'est pas une liste

- **Les fournisseurs** restent la table `suppliers` : une fiche porte un
  téléphone, une adresse, des conditions de paiement. Ce n'est pas une
  valeur de liste, c'est un annuaire. Seul son *type* devient une liste
  (`suppliers.type_id` → `categories` d'usage `type_fournisseur`).
- **Les personnes externes** deviennent une table à elles,
  `personnes_externes` : nom, téléphone, rôle, commission, notes, et un
  lien facultatif vers un compte si la personne rejoint l'équipe plus
  tard.

### Ce qui reste en texte, et pourquoi

Chaque texte libre migré **est conservé**. `purchases.fournisseur`,
`products.fournisseur`, `expenses.type`, `expenses.vendeur`,
`sales.vendeur` gardent leur valeur d'origine à côté du nouvel
identifiant. C'est le filet demandé par le cahier : si la migration a mal
rattaché quelque chose, la donnée d'avant est toujours là, et un simple
`UPDATE … SET …_id = NULL` remet tout en place.

`sales.vendeur` en particulier n'est **pas** doublé d'un identifiant :
la vente est écrite par `create_sale_ticket`, fonction de production que
cette mission n'a pas le droit de toucher. Le sélecteur de vendeur
proposera les personnes externes, mais écrira leur nom dans la colonne
texte, exactement comme aujourd'hui.

### Les réglages par boutique

Tout ce qui se règle par boutique va dans `stores.personnalisation`, sous
des clés à elles, parce que cette colonne est déjà le lieu prévu pour ça
et que `lirePersonnalisation` recopie ce qu'elle ne connaît pas :

```
listes: { ajoutDepuisFormulaire: "tous" | "responsables" }
libelles: { effectuePar: "Effectué par" }
prixAuto: { actif, taux, tauxRapides: number[], arrondi }
```

Le réglage « qui peut ajouter une valeur » est vérifié **côté serveur**,
dans la politique d'insertion de `categories`, pas seulement à l'écran.

## 3. Ce que « Produits libres » veut dire

Ce n'est pas une notion de la base : c'est l'option vide du sélecteur de
produit, dans une commande, un devis ou une facture. La choisir veut
dire : *cette ligne ne correspond à aucun produit du catalogue ; je tape
moi-même sa désignation et son prix.* Conséquence concrète, et c'est tout
ce qui compte pour le commerçant : **la ligne ne touche pas au stock**, et
elle n'a pas de prix d'achat, donc pas de marge calculée.

D'où le libellé retenu : **« Ligne libre — hors catalogue »**, avec une
aide au survol et au clavier qui dit la conséquence plutôt que la
mécanique.

## 4. « Confié à »

Le champ existe, c'est le « Confiée à » d'une livraison, et il est
aujourd'hui **fermé** : une liste déroulante des seuls membres de
l'équipe ayant le rôle livreur. Le client confie manifestement des
courses à des gens qui ne sont pas dans son équipe.

`deliveries.confie_a text` est donc ajouté à côté de `livreur_id`, sans le
remplacer. Choisir un membre de l'équipe continue d'écrire `livreur_id`
— sans quoi l'espace livreur cesserait de fonctionner ; taper un nom
libre n'écrit que `confie_a`. Les suggestions viennent des livreurs de
l'équipe, des personnes externes, et des valeurs déjà tapées.
