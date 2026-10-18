# Audit et réparations — 17 octobre 2026

Point de départ : l'enregistrement d'écran (page « Le stock », bon de commande,
panneau « Produits à recommander », Achats, tableau de bord), puis audit du code
et de la base de production **en lecture seule** (requêtes `SELECT` uniquement).

## 1. Ce qui a été vérifié dans la base (lecture seule)

Contrôles d'intégrité sur toutes les boutiques :

| Contrôle | Résultat |
|---|---|
| `stock_actuel` = somme des mouvements de stock | 0 écart |
| `stock_reserve` = somme des mouvements | 0 écart |
| `stock_disponible` = actuel − réservé | 0 écart |
| Stock négatif | 0 |
| Vente : total = quantité × prix, marge = total − coût, solde cohérent | 0 écart |
| Achat : total, payé = Σ règlements, solde = total − payé | 0 écart |
| Commande : total = Σ lignes, payé = Σ paiements, reste cohérent | 0 écart |
| Vente sans mouvement de stock | 0 |
| Vente : payé ≠ Σ paiements | 1 (V002, 9 août) |
| Achat sans mouvement de stock | 2 (ACH001, ACH004, 8–9 août) |

Les trois exceptions sont des enregistrements d'essai du 8–9 août, antérieurs à
l'historique des paiements et des mouvements, sur un produit supprimé depuis.
Elles ne faussent aucun chiffre actuel. **Rien n'a été modifié.**

Conclusion : les écritures (fonctions SQL atomiques, verrous `FOR UPDATE`, clés
d'idempotence) sont saines. Les incohérences venaient de l'interface, qui
recalculait les mêmes chiffres avec des règles différentes selon les pages.

## 2. Anomalies corrigées

### A. Stock : « 66 à recommander » au tableau de bord, 1 ligne au bon de commande (critique)
- **Cause** : la règle « sous le seuil » était recopiée à 7 endroits sous deux
  formes. La règle officielle (`etatDeStock`, et la base via `niveau_surveille`)
  ignore les produits sans seuil. Les copies (`stockActuel <= seuilAlerte`)
  comptaient « 0 ≤ 0 » comme sous le seuil, en incluant services et fiches
  archivées. La boutique de l'enregistrement a 67 produits sans seuil, dont 66 à zéro.
- **Correction** : trois règles uniques dans `src/lib/prealerteStock.ts`
  (`stockEstSuivi`, `estSousLeSeuil`, `estEnRupture`), employées par le tableau
  de bord, la cloche, la page Produits et l'ancien tableau de bord. « À
  recommander » compte désormais exactement les lignes du bon de commande.
  « Ruptures à venir », qui comptait des produits déjà à zéro, devient « En
  rupture », un compte distinct qui signale les produits sans seuil.
- L'étagère « État du stock » met d'abord les produits qui ont un seuil. Avant,
  les fiches sans seuil ni stock la remplissaient.

### B. Boutons du stock qui ne faisaient pas ce qu'ils annonçaient (majeur)
- « Voir la liste » ouvrait le bon de commande. Il ouvre maintenant la liste.
- « Préparer la commande » ouvrait un panneau dont le bouton « Préparer la
  commande » menait à la page Achats sans rien préparer. Il ouvre maintenant
  le bon de commande (impression, CSV, Excel).
- Les panneaux « Produits à recommander » et « Produits en rupture » sont séparés.

### C. Commandes annulées comptées comme argent à recevoir (majeur)
- **Cause** : l'énumération SQL vaut `annule`, mais le tableau de bord filtrait
  `"annulee"`, un statut qui n'existe pas. Le total « Impayés » et le
  « CA » de la page Commandes, ainsi que l'ancien tableau de bord, ne filtraient
  pas du tout les commandes annulées.
- **Correction** : `src/lib/commandes.ts` (`resteDuCommande`, `montantCommande`),
  employé par le tableau de bord, Commandes, Clients et Paiements à recevoir.

### D. Trésorerie : achats comptés au total au lieu de ce qui a été payé (majeur, latent)
- Les ventes entraient pour ce qui avait été encaissé, mais les achats sortaient
  pour leur **total**. Un achat à crédit faisait baisser la caisse dès l'achat,
  et son règlement ne changeait plus rien.
- **Correction** : `src/lib/tresorerie.ts`, une fonction pure testée et appelée
  par la coquille. Les achats sortent pour leur `montant_paye`. Aucun achat à
  crédit n'existe aujourd'hui en base, donc les chiffres actuels ne bougent pas.
- La ligne d'un achat affiche maintenant ce qui est réellement sorti de la caisse,
  ou « X à payer » pour un achat à crédit.

### E. Historique client : ventes attribuées à deux clients (majeur)
- Une vente liée par identifiant au client A, dont le nom saisi ressemblait au
  client B, apparaissait chez les deux, et sa dette comptait deux fois. Deux
  fiches de même nom se partageaient aussi les ventes anciennes.
- **Correction** : `src/lib/ventesClients.ts`. L'identifiant fait foi, le nom ne
  sert qu'aux ventes sans identifiant, et seulement s'il est unique.

### F. Avoir partiel qui remettait toute la facture en stock (majeur)
- Une case « Remettre en stock » cochée puis grisée (montant devenu partiel)
  restait cochée et partait à la validation : toutes les quantités revenaient en stock.
- **Correction** : `AvoirModal.tsx` ne transmet que les options encore permises.

### G. Harmonisation de l'interface
- Page Commandes : indicateurs et barre de filtres passés aux composants partagés
  `StatCol` et `FilterBar`, comme Achats, Ventes et Dépenses. Les vignettes
  maison et les couleurs codées en dur sont retirées.
- Badges de statut des commandes : plus d'émojis, classes partagées `app-badge-*`.
- Libellés corrigés : « Total des achats » (« sorti de la trésorerie » était
  faux), « Achats de stock réglés », « Stock bas : sous le seuil ou en rupture ».
- `PaiementsARecevoirView` : dépendance manquante d'un `useMemo` (la liste ne se
  rafraîchissait pas quand les produits changeaient).

## 3. Migration préparée — NON appliquée, en attente d'accord

`supabase/migrations/20261017100000_delete_purchase_memes_droits_que_la_table.sql`
(retour arrière : `supabase/retours-arriere/` du même nom)

- **Problème** : `delete_purchase` (SECURITY DEFINER) ne vérifie que
  `is_store_member`. N'importe quel membre peut donc supprimer l'achat d'un
  autre, y compris dans une boutique verrouillée, alors que la politique RLS
  de la table, `modifier_achat` et `delete_sale` exigent `can_modify_in_store`.
- **Changement** : la seule ligne d'autorisation. Aucune donnée touchée.
- **Risque** : un collaborateur qui supprimait les achats d'autrui ne le pourra plus.
  C'est le comportement voulu par la table.

## 4. Tests réellement exécutés

- `tsc --noEmit` : 0 erreur (avant et après).
- `vitest run` : **113 fichiers, 1 170 tests, tous verts** (avant : 108 / 1 146).
  24 tests ajoutés : règles de stock, égalité tableau de bord ↔ bon de commande,
  boutons et panneaux du stock, commandes annulées, trésorerie, attribution des
  ventes aux clients, avoir partiel.
- `vite build` : construction de production réussie.
- Navigateur : l'application démarre sans erreur console. Les écrans connectés
  **n'ont pas été vérifiés visuellement** (voir § 5).
- ESLint sur les fichiers modifiés : 0 erreur. Sur tout le dépôt, 2 342
  problèmes préexistants, dont 2 276 de pure mise en forme Prettier. Pas de
  reformatage de masse, pour ne pas noyer les corrections.

## 5. Limites et ce qui reste

- **Pas de test de bout en bout connecté** : la seule base est la production, et
  aucun compte de test local n'existe. Pour tester sans risque, il faudrait une
  branche Supabase (payante) ou un Supabase local (`supabase start`) avec des
  données d'essai.
- **Verrouillage côté serveur incomplet** : `create_sale`, `create_sale_ticket`,
  `add_purchase`, `add_payment`, `refund_sale`, `refund_order`,
  `create_order_with_items`, `create_product` et `avancer_livraison` vérifient
  l'appartenance à la boutique mais pas `store_is_locked`. Ces fonctions
  contournent la RLS : une boutique verrouillée peut encore écrire par appel
  direct. Une migration groupée est à préparer.
- **Règle métier à trancher** : un remboursement ou un avoir ne remet jamais
  la marchandise en stock d'office (case à cocher sur l'avoir, ajustement
  manuel sinon). C'est cohérent et documenté, à confirmer comme voulu.
- **Modules non audités en profondeur cette fois** : Ventes (caisse), Devis,
  Facturation, Livraisons, Salaires, Notes de frais, Organisation, Paramètres.
  Leurs tests existants passent, mais leurs écrans n'ont pas été repris ligne
  à ligne.
- Les données d'essai d'août (§ 1) peuvent être laissées telles quelles.
