# Import de données

Bouton **Importer** dans Produits, Clients, Fournisseurs et Achats. Un même
fichier peut alimenter plusieurs modules : chaque feuille Excel (ou tableau
Word) reçoit sa propre destination.

## Ce qui est reconnu

| Contenu détecté | Module | Écriture |
|---|---|---|
| Produits (désignation + prix ou quantité) | Produits et stock | `create_product` — la quantité devient le stock initial (mouvement « stock initial ») |
| Clients | Clients | insertion par lots |
| Fournisseurs | Fournisseurs | insertion par lots |
| Achats (date, produit, quantité, prix d'achat) | Achats et stock | `add_purchase` — entrée en stock + règlement (comptant sans « montant payé ») ; confirmation obligatoire |
| Ventes passées | — | **refusées** : elles modifieraient le stock et la trésorerie d'aujourd'hui |

Détection sans IA : en-têtes (synonymes, accents et casse ignorés), nom de la
feuille et du fichier. Si deux destinations restent possibles, l'écran
demande. Les colonnes sont rapprochées automatiquement et restent
corrigeables.

## Doublons et reprises

- Doublons dans le fichier : ignorés.
- Déjà en base : ignorés, ou **mis à jour** au choix (une case vide n'efface
  rien). Produits existants : le stock n'est réaligné sur le fichier que si
  l'option est cochée, par un ajustement d'inventaire journalisé.
- Relancer le même fichier ne recrée rien (clés d'idempotence).
- Fournisseurs cités par des produits ou des achats : créés au passage
  (option, cochée par défaut).

## Résultat

Bilan par module (ajoutés, mis à jour, ignorés, rejetés), rejets
téléchargeables, historique dans « Imports récents » (table
`imports_donnees`, migration `20261016120000`, appliquée).

## Vérification manuelle (à faire une fois, connecté)

1. Produits › Importer › `docs/import/essai-produits.xlsx`.
2. Destination « Produits et stock » détectée, 3 nouveaux → Confirmer.
3. Les 3 produits « ESSAI … » apparaissent avec 40, 6 et 120 en stock ; le
   fournisseur « ESSAI Emballages » apparaît dans Fournisseurs.
4. Recharger la page : tout est toujours là. Relancer l'import : 3 « Existe déjà ».
5. Supprimer ensuite les produits et le fournisseur d'essai.
