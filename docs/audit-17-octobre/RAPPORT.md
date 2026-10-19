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

## 3. Migration — appliquée en production le 18 octobre, avec accord

Appliquée sur accord explicite, version enregistrée `20261018051507`. Le
fichier porte ce numéro pour correspondre à la base. Vérifié ensuite : la
nouvelle règle est en place, l'ancienne a disparu, les droits d'exécution
sont inchangés (`authenticated` oui, `anon` non) et les 54 achats sont
intacts.

`supabase/migrations/20261018051507_delete_purchase_memes_droits_que_la_table.sql`
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
- **Verrouillage côté serveur — réglé le 18 octobre** : `create_sale`,
  `create_sale_ticket`, `add_purchase`, `add_payment`, `refund_sale`,
  `refund_order`, `create_order_with_items`, `create_product` et
  `avancer_livraison` ne vérifiaient pas `store_is_locked`. Migration
  `20261018042029_verrou_boutique_dans_les_rpc.sql` appliquée avec accord ;
  vérifié en base : le contrôle est présent dans les neuf fonctions, et le
  fichier du dépôt a la même empreinte md5 que la version enregistrée.
- **`refund_order` appelé avec un paramètre de trop — corrigé** : l'interface
  envoyait `p_idempotency_key`, absent de la fonction en base (3 paramètres),
  donc l'appel échouait. Aucun écran ne l'utilisait encore. Corrigé dans
  `useStoreData.ts`, sans migration.
- **Règle métier à trancher** : un remboursement ou un avoir ne remet jamais
  la marchandise en stock d'office (case à cocher sur l'avoir, ajustement
  manuel sinon). C'est cohérent et documenté, à confirmer comme voulu.
- **Modules non audités en profondeur cette fois** : Ventes (caisse), Devis,
  Facturation, Livraisons, Salaires, Notes de frais, Organisation, Paramètres.
  Leurs tests existants passent, mais leurs écrans n'ont pas été repris ligne
  à ligne.
- Les données d'essai d'août (§ 1) peuvent être laissées telles quelles.


---

# Second audit — 18 octobre 2026 : les modules restants

Ventes et caisse, Devis, Facturation, Livraisons (comptoir et espace
livreur), Salaires, Notes de frais, Ma paie, Paramètres. Pour chaque
écran : chargement, boutons et leur effet réel, validations, états vide,
erreur et chargement, doubles soumissions, et surtout l'égalité des
chiffres avec les autres pages. Base de production consultée **en lecture
seule** (`SELECT` uniquement). **Aucune écriture, aucune migration.**

Contrôles faits en base pour mesurer l'effet réel :

| Contrôle | Résultat |
|---|---|
| Ventes dont `total_vente` ≠ quantité × prix | 0 |
| Ventes dont `solde_du` ≠ total − payé | 0 |
| Avoirs existants | 0 |
| Devis expirés sans réponse | 0 (sur 3 devis) |
| Avances et soldes de salaire « versés » | **2 lignes, 160 000 Ar, 1 boutique** |

## 6. Anomalies corrigées

### H. Trésorerie : les salaires versés ne sortaient jamais de la caisse (critique)
- **Cause** : le module Salaires annonce « seules les lignes versées sortent
  de la caisse », mais `calculerTresorerie` ne recevait pas les
  `paiements_salaire`. Aucun déclencheur ne crée non plus de dépense.
- **Effet aujourd'hui** : une boutique affiche une trésorerie trop haute de
  **160 000 Ar**. Ce chiffre baissera dès le déploiement : c'est la correction,
  pas une perte.
- **Correction** : `src/lib/tresorerie.ts` retire les lignes au statut `versee`
  (ni les demandes, ni les approbations, ni les refus). Nouveau poste
  « Salaires versés » sur l'écran Capital et la carte Trésorerie, pour que les
  sept lignes retombent toujours sur le total.
- Fichiers : `lib/tresorerie.ts`, `types.ts` (`salairesTotal`), `BalsamaApp.tsx`,
  `CapitalView.tsx`, `CarteTresorerie.tsx`, `data/initialData.ts`.
- Tests : `lib/tresorerie.test.ts` (2), `CarteTresorerie.test.tsx` (7 postes,
  addition avec salaires).

### I. Modifier une vente : quatre champs saisis puis perdus (majeur)
- **Cause** : la modale proposait la date, le vendeur, le prix unitaire et le
  montant payé. `update_sale_quantity` n'écrit que la quantité, le total et le
  client : le reste disparaissait sans message. Changer le prix envoyait un
  total = quantité × nouveau prix sans changer `prix_vente_unit`, ce qui
  aurait cassé l'invariant « total = quantité × prix » (0 cas en base
  aujourd'hui). En cas de refus (stock, total sous le déjà payé), la modale se
  fermait et seule une `alert()` restait.
- **Correction** : seuls la quantité et le client se modifient (le client par
  sa fiche, comme à la caisse). Date, vendeur, prix et déjà payé se lisent.
  Le contrôle « total ≥ déjà payé » répond avant l'appel, comme la base.
  L'erreur s'affiche dans la modale, qui reste ouverte. Le bouton est
  désactivé pendant l'envoi.
- Fichiers : `lib/ventes.ts` (`preparerModificationVente`), `VentesView.tsx`,
  `BalsamaApp.tsx` (`handleEditSale` rend l'erreur).
- Tests : `lib/ventes.test.ts`, `components/VentesView.test.tsx` (4).

### J. Caisse : une vente comptant enregistrée à crédit (majeur)
- **Cause** : le montant payé suivait le total du panier seulement tant
  qu'aucun nom de client n'était posé. Choisir le client d'abord, le geste
  normal pour un habitué, laissait le montant à 0 : toute la vente partait
  en crédit. Même chose pour un panier venu d'un devis, qui arrive avec son
  client.
- **Correction** : le montant suit le total jusqu'à ce qu'on le tape soi-même.
- Fichier : `VentesView.tsx`. Tests : `VentesView.test.tsx` (2).

### K. Devis transformé en vente : le mauvais ticket marqué « accepté » (majeur)
- **Cause** : la coquille gardait l'identifiant du devis à part du panier.
  Quitter la caisse sans vendre le laissait en attente : la vente suivante,
  quelle qu'elle soit, marquait ce devis accepté et le reliait à son ticket.
- **Correction** : le devis voyage avec le panier (`origine`) et revient avec
  la vente qui en est née. Une vente ordinaire ne rattache rien.
- Fichiers : `VentesView.tsx`, `BalsamaApp.tsx`. Tests : `VentesView.test.tsx` (2).

### L. Facturation : revalider après un demi-échec créait un doublon (majeur)
- **Cause** : quand la vente passait mais que la commission ou le lien au
  devis était refusé, le formulaire restait ouvert avec son message.
  Recliquer établissait une **seconde vente**. Même piège pour l'avoir
  (remboursement refusé : second avoir au clic suivant) et pour un
  encaissement réparti sur plusieurs lignes (la somme entière était
  reproposée après qu'une partie était déjà posée).
- **Correction** : dès que la pièce existe, le formulaire se ferme. Ce qui
  reste à reprendre s'affiche dans un bandeau sur la page. Un encaissement
  interrompu dit le montant déjà posé. Garde `enCours` sur les trois gestes.
- Fichier : `FacturationPage.tsx`. Tests : `FacturationPage.test.tsx` (3).

### M. « Devis en attente » : trois nombres pour une même question (majeur)
- **Cause** : la page Devis écartait les expirés. Le tableau de bord (pastille
  « devis sans réponse » et carte « À faire ») les comptait. Les indicateurs
  de Facturation écartaient les brouillons.
- **Correction** : une règle, `estEnAttenteDeReponse` dans `lib/devis.ts` :
  brouillon ou envoyé, et encore valable. Elle sert aux trois écrans.
- Fichiers : `lib/devis.ts`, `DevisView.tsx`, `dashboard-v2/lib/chiffres.ts`,
  `CarteTaches.tsx`, `facturation/indicateurs.ts`. Tests : `lib/devis.test.ts` (4).
- Au passage : les boutons de statut d'un devis sont verrouillés pendant
  l'appel (double clic), et « Réinitialiser » vide aussi la recherche, comme
  sur Ventes.

### N. Livraisons : « Confiée à » écrivait à chaque lettre (majeur)
- **Cause** : le champ d'une course existante appelait la base à chaque
  frappe. Taper « Rakoto » envoyait six modifications, dont cinq à des noms
  faux, chacune avec son message.
- **Correction** : la saisie reste locale et part en quittant le champ ou sur
  Entrée, seulement si le nom a changé (`ChampAvecSuggestions.onValider`).
- Fichiers : `LivraisonsView.tsx`, `shared/ChampAvecSuggestions.tsx`.
  Tests : `components/LivraisonsView.test.tsx` (3).

### O. Livraisons : l'argent de plusieurs personnes soldé d'un clic (majeur)
- **Cause** : « Argent chez les livreurs » regroupait par `livreur_id`.
  Toutes les courses confiées hors équipe (nom libre) tombaient dans un même
  paquet affiché « Non assignée ». « Argent rendu » soldait alors l'argent de
  personnes qui n'étaient pas repassées.
- **Correction** : `argentChezLesLivreurs` (`lib/livraisons.ts`) regroupe par
  compte, sinon par nom saisi.
- Le tableau de bord comptait une course **échouée** comme ouverte. La carte
  Livraisons emploie maintenant `estEnCours`, la règle de la page.
- Fichiers : `lib/livraisons.ts`, `LivraisonsView.tsx`, `CarteLivraisons.tsx`.
  Tests : `lib/livraisons.test.ts` (4).

### P. Salaires : un « reste à payer » trop bas (moyen)
- **Cause** : le total de l'en-tête additionnait les restes négatifs. Une
  avance supérieure au salaire d'un employé faisait baisser ce qu'on doit
  aux autres. L'en-tête annonçait moins que la somme des lignes en dessous.
- **Correction** : `totauxDuMois` n'additionne que ce qui reste dû. Le
  surplus continue de se reporter sur le mois suivant de l'employé.
- Fichier : `lib/salaires.ts`. Tests : `lib/salaires.test.ts` (2).

### Q. Vendeurs : un bouton « Modifier » qui ne faisait rien (mineur)
- Il renvoyait la vente telle quelle à l'enregistrement, avec un appel RPC
  inutile, sans rien ouvrir. Il est retiré. Une vente se corrige depuis Ventes.
- Fichier : `VendeursView.tsx`, `BalsamaApp.tsx`.

### R. Règles dupliquées réunies (harmonisation)
- Statut de règlement d'un ticket (Payé, Partiel, Impayé), recalculé trois
  fois dans Ventes : `statutDeReglement` / `totauxDesLignes` (`lib/ventes.ts`).
- Commission proposée par le taux de la boutique, écrite trois fois (Ventes ×2,
  Facturation) : `commissionParDefaut`. La commission saisie dans Ventes est
  désormais validée (≥ 0, ≤ total) et son bouton est verrouillé pendant
  l'envoi.
- Reste d'une facture : `solde_du` (`resteDuTicket`) au lieu de total − payé,
  la même source que Ventes, Clients et le tableau de bord. Les deux valeurs
  sont égales en base aujourd'hui (0 écart).
- « Valider la vente » est désactivé pendant l'enregistrement.

## 7. Modules relus sans anomalie bloquante

- **Espace livreur** : montant encaissé borné côté serveur
  (`avancer_livraison` refuse < 0 et > attendu). Boutons verrouillés pendant
  l'appel.
- **Notes de frais** et **Ma paie** : calculs repris de `lib/salaires.ts` et de
  la RPC `rembourser_note_de_frais`. Le remboursement passe par une dépense,
  donc par la trésorerie. Les boutons sont verrouillés.
- **Paramètres** : aucun chiffre calculé. Taux de commission borné et lu depuis
  un seul paramètre (`commission_taux`) par Ventes et Facturation.

## 8. À trancher, ou à préparer en migration (rien n'est appliqué)

- **Avoir sur une facture impayée** : tranché le 18 octobre (option B), voir § 10.
- **Prix d'une vente** : `update_sale_quantity` ne sait pas changer
  `prix_vente_unit`. Corriger un prix après coup exige une migration (nouveau
  paramètre, recalcul de la marge). En attendant, l'écran ne le propose plus.
- **Flux du tableau de bord** (carte Trésorerie, « Entrées / sorties ») : les
  sorties comptent les achats pour leur total (engagement), alors que la
  trésorerie les compte pour ce qui a été payé. Les salaires versés n'y
  figurent pas, faute de date de versement exploitable dans la période. Cette
  carte relevait du premier audit et n'a pas été changée.
- Rappel du § 5 : verrouillage `store_is_locked` incomplet côté serveur.

## 9. Tests réellement exécutés (18 octobre)

- `tsc --noEmit` : 0 erreur.
- `vitest run` : **119 fichiers, 1 203 tests, tous verts** (avant ce second
  audit : 114 / 1 179). 24 tests ajoutés : `lib/ventes.test.ts`,
  `lib/devis.test.ts`, `lib/livraisons.test.ts`, `lib/salaires.test.ts`,
  `components/VentesView.test.tsx`, `components/LivraisonsView.test.tsx`, et des
  cas ajoutés à `lib/tresorerie.test.ts`, `FacturationPage.test.tsx` et
  `CarteTresorerie.test.tsx`.
- Contre-épreuve : les tests de Ventes, Facturation et Livraisons ont été
  lancés sur les anciennes versions des écrans. Ils échouent (8 sur 8 pour
  Ventes, 3 sur 3 pour les demi-échecs de Facturation, la frappe de « Confiée
  à »), puis passent sur les nouvelles.
- `vite build` : construction de production réussie.
- ESLint sur les fichiers modifiés : aucune erreur nouvelle. Celles qui
  restent (Prettier dans `VendeursView.tsx`, `documents.ts`,
  `indicateurs.test.ts`, `react-refresh` dans `NouveauDocument.tsx`) existaient
  avant. Pas de reformatage de masse.
- Même limite qu'au § 5 : pas de test connecté de bout en bout, les écrans
  n'ont pas été vérifiés visuellement avec un compte.

---

# 10. L'avoir efface la dette — décision du 18 octobre

**Décision** (option B) : un avoir annule tout ou partie d'une facture, donc
la créance. Il efface d'abord ce que le client doit encore ; seul ce qui
dépasse cette dette est de l'argent à lui rendre. Le chiffre d'affaires est
net des avoirs, chacun à **sa** date.

Exemples sur une facture de 100 000 Ar payée 30 000 :

| Avoir | Reste dû | À rendre |
|---|---|---|
| 50 000 | 20 000 | 0 |
| 80 000 | 0 | 10 000 |
| 100 000 sur une facture impayée | 0 | 0 |

## En base — appliquée en production le 18 octobre, avec accord

Version enregistrée `20261018055411` (le fichier porte ce numéro). Juste
avant l'application, nouvelle vérification : aucun avoir en base, et les
quatre fonctions remplacées identiques à celles lues pour écrire la
migration (empreintes md5). Après : colonne et contrainte en place, 0 vente
avoirée, 0 solde hors règle, fonction interne inaccessible à `anon` et
`authenticated`, `creer_avoir` toujours ouverte aux seuls utilisateurs
connectés.

`supabase/migrations/20261018055411_avoir_efface_la_dette.sql`
(retour arrière : `supabase/retours-arriere/` du même nom)

- Colonne `sales.montant_avoire` (0 partout à la création, bornée entre 0 et
  le total). Reste dû = total − payé − avoiré.
- `recalculer_solde_vente` : la règle du solde à un seul endroit, appelée par
  le déclencheur des paiements, `creer_avoir` et `update_sale_quantity`. Non
  appelable par `anon` ni `authenticated`.
- `creer_avoir` pose l'avoir ligne par ligne dans l'ordre du ticket :
  d'abord sur ce qui reste dû, puis sur la part payée.
- On ne peut plus encaisser ce qu'un avoir a annulé, ni ramener le total
  d'une vente sous « payé + avoiré ».
- Aucune donnée existante ne change. La migration refuse de s'appliquer si
  des avoirs liés à une facture existent déjà (0 aujourd'hui).
- Les quatre fonctions remplacées ont été relues en production avant
  l'écriture. Le retour arrière les rétablit mot pour mot.
- **Banc d'essai** : `supabase/essais/avoir_efface_la_dette.mjs` rejoue la
  migration et son retour arrière dans un Postgres embarqué (PGlite), sans
  toucher à la production. 16 contrôles, tous verts.

## Dans l'application

- **Chiffre d'affaires net, à la date de l'avoir** (`lib/ventes.ts` :
  `chiffreAffairesNet`, `chiffreAffairesParJour`, `avoirsDesVentes`). Un avoir
  d'octobre sur une vente de septembre baisse octobre, pas septembre. Il est
  appliqué au tableau de bord (total, comparaison, courbe, journée), à
  l'en-tête Ventes, au « Total acheté » de la fiche client, à l'indicateur de
  Facturation et aux Rapports. Le tableau de bord et Facturation donnent le
  même chiffre (test).
- **Facturation** : une facture couverte par paiements + avoirs est soldée,
  et non plus « en retard ». La case « Rembourser » ne propose plus que
  l'excédent sur la dette (`aRembourserApresAvoir`). La fenêtre d'avoir
  annonce ce que le client devra encore.
- **Ventes** : la fiche d'une vente affiche « Annulé par avoir ».
- Le code se déploie **avant** la migration sans rien changer :
  `montant_avoire` absent se lit 0.
- Tests : `lib/avoirs.test.ts` (11).

## Limites connues

- Les répartitions **par vendeur et par produit** (Statistiques, Vendeurs,
  top produits du tableau de bord, ancien tableau de bord) restent brutes :
  un avoir partiel ne dit pas sur quel article il porte. À traiter si des
  avoirs apparaissent.
- La **marge** n'est pas diminuée par un avoir : selon que la marchandise
  revient en stock ou non, la bonne réponse diffère. Une règle reste à fixer.
- Les avoirs ne sont chargés que pour les personnes qui ont accès à la
  Facturation. Pour les autres, le chiffre reste brut (seule la Facturation
  crée des avoirs).

---

# 11. Troisième passe — 18 octobre après-midi : notifications et fiabilité

Point de départ : l'enregistrement d'écran de 12 h 35 (cloche, tableau de
bord, Produits, Achats, Ventes, Devis, Vendeurs, Historique).

## Ce que montrait la vidéo

| Constat | Cause |
|---|---|
| Pastille rouge figée sur « 9+ », même après avoir ouvert la cloche | Seul « Tout marquer lu » remettait à zéro ; ouvrir une notification ne la marquait pas ; ses propres gestes (« Vous ») comptaient |
| Un clic sur une notification ouvre une liste filtrée (« P086 », « V027 »), pas la fiche | Visée par la recherche, jamais par l'enregistrement |
| « V023 » encore dans la recherche de Ventes en y revenant par le menu | La visée était réappliquée à chaque remontage de l'écran |
| « Vente 136 500 Ar » ET « Règlement reçu 136 500 Ar » pour le même encaissement | Le paiement du comptoir était compté comme un second événement |
| « Activité aujourd'hui : Rien d'enregistré · 0 événement », puis « 5 événements » | Aucun état de chargement ; lien « Voir l'agenda » sans rapport avec le journal |
| Historique : « Achat · Fournisseur · ACH014 » | Libellé de remplacement lu comme un nom |

## Corrections

### S. Notifications (critique pour l'usage quotidien)
- **État lu / vu en base** : table `notifications_lues` (migration
  `20261018102745`, appliquée — purement additive, RLS « ses propres
  lignes, dans une boutique dont on est membre », aucune autre table
  touchée ; retour arrière dans `supabase/retours-arriere/`). Le navigateur
  anticipe la base pour un premier rendu juste, et reprend la main seul si
  la table refuse. L'ancien état local remonte une fois en base.
- **Compteur comme sur un réseau social** : ouvrir la cloche met tout ce
  qui est affiché à « vu » et la pastille retombe à zéro ; ce qui n'a pas
  été ouvert reste en gras avec un point ; cliquer une notification la met
  à « lu » ; « Tout marquer lu » ne paraît que s'il reste à lire.
- **On ne se notifie pas soi-même** : ventes, achats, dépenses, apports,
  règlements, devis, livraisons, commandes, clients et corrections portent
  leur auteur (`deMoi`) ; ils restent dans le journal, sans compter.
- **Pas de doublon** : le règlement enregistré avec la vente (même auteur,
  à deux minutes près) n'est plus annoncé une seconde fois.
- **Routage centralisé** (`lib/routageNotifications.ts`) : fiche si la
  notification désigne un enregistrement, filtre si elle parle d'un
  ensemble (rupture / sous le seuil → catalogue filtré « Alertes »),
  recherche sinon. Fiches ouvertes directement : ventes (ticket entier),
  achats, dépenses, produits, clients, devis, livraisons, commandes,
  apports. Un règlement ouvre sa vente ou sa commande.
- **Ressource supprimée ou inaccessible** : l'écran affiche « Introuvable »
  au lieu d'une liste vide (`shared/AvisIntrouvable.tsx`).
- **Visée appliquée une seule fois** (`lib/cibleRecherche.ts`) : plus de
  recherche « collée » au retour par le menu.
- **Les nouvelles notifications arrivent** : relecture discrète toutes les
  minutes onglet visible, et au retour au premier plan (données, journal,
  tâches, agenda, rappels, préalertes). Le journal des corrections se
  relit après chaque écriture (« Produit modifié » apparaissait seulement
  au rechargement).
- **Permissions** : un écran absent du menu d'un membre ne s'ouvre plus
  par un autre chemin (notification, lien, recherche).

### T. Données tronquées à 1 000 lignes (critique, latent)
`useStoreData` lisait chaque table en une requête ; PostgREST coupe en
silence à 1 000 lignes. À la 1 001ᵉ vente, chiffre d'affaires, trésorerie
et créances auraient été faux sans aucun message. Toutes les lectures
passent par `lib/lirePages.ts` (tranches de 1 000, tri final sur `id` pour
ne perdre ni dédoubler aucune ligne). Plus grosse boutique aujourd'hui :
116 mouvements, 72 produits — aucun chiffre actuel ne change.

### U. Finitions
- Erreurs affichées dans l'application (messages en haut d'écran) au lieu
  des boîtes `alert()` du navigateur, qui figeaient la page.
- Carte « Activité aujourd'hui » : état de chargement, lien « Voir
  l'historique ».
- Historique : « Fournisseur non précisé » quand l'achat n'en a pas.
- Fil des ventes : l'heure de saisie est transmise (elle manquait).

## Vérifié en production après la fusion de la PR #44 (déploiement du 18 octobre, 10 h 49)

Avec la session du propriétaire, dans le navigateur : pastille « 4 » (et non
plus « 9+ »), remise à zéro à l'ouverture, points sur les non-lues, gestes
« Vous » sans gras, plus de doublon vente / règlement ; « Vente 136 500 Ar »
ouvre la fiche V027 ; la liste Ventes revient complète après fermeture ;
« 66 produits en rupture » ouvre le catalogue filtré « Alertes (67) » ;
carte « Activité aujourd'hui » : « 5 événements · 1 vente · Voir
l'historique ». État écrit en base (4 « vu », 1 « lu »). Console sans erreur.

# 12. Fournisseurs, prestataires, vendeurs

- **Colonne « Produits / Services » toujours à « — »** (tableau de bord) :
  elle ne lisait que la fiche. Elle reprend maintenant ce qu'on a réellement
  acheté au fournisseur (achats rattachés à sa fiche, sinon saisis sous son
  nom ; trois au plus) — `dashboard-v2/lib/partenaires.ts`.
- **Bouton « … » d'une ligne** : ouvrait l'écran entier ; il ouvre la fiche
  de ce fournisseur ou de ce prestataire.
- **« Ajouter un fournisseur / prestataire »** : ouvrait la liste ; il ouvre
  le formulaire de création.
- **« Supprimer ce vendeur »** sur le propriétaire ou sur un nom venu de
  l'historique des ventes : ne faisait rien, sans le dire. Un message
  l'explique désormais. Pour un vrai membre, le geste retire son accès à la
  boutique (ses ventes restent) ; le libellé de confirmation sera précisé
  avec le remplacement des `window.confirm` (session parallèle).

## Vérifié en production après la fusion de la PR #45 (déploiement de 15 h 47 UTC)

Colonne « Produits / Services » : « Kapa » pour Tsara, « kiraro » pour
VillaD ; « — » pour les fournisseurs à qui rien n'a été acheté (contrôlé en
base). Le bouton « … » de Tsara ouvre sa fiche (ACH004, 4 000 Ar). **Défaut
trouvé** : sur téléphone, la fiche s'ouvrait sous la liste, hors de l'écran
(900 px pour 646 px visibles) — le défilement partait avant son rendu.
Corrigé : `hooks/useDefilerVers.ts` défile après le rendu (Clients,
Commandes, Fournisseurs, Prestataires), avec un test.

# 13. Fin de journée — confirmations, vendeurs, fournisseurs

- **PR #46 (modales de confirmation)**, relue et testée fusionnée avec main
  (1 255 / 1 255) avant d'être fusionnée. **PR #48** : « Retirer de
  l'équipe » au lieu de « Supprimer le vendeur ».
- **Essai en ligne sans risque pour les données** : compteurs relevés en
  base (lecture seule) — 20 ventes, 8 achats, 4 dépenses, 72 produits,
  6 clients, 9 fournisseurs, 1 prestataire, 2 devis, 1 rappel, 2 tâches,
  74 mouvements ; modale « Retirer Mamy de l'équipe » ouverte puis
  **annulée** (Mamy n'est pas membre : même confirmée, rien n'aurait été
  retiré) ; recomptage identique, aucune suppression au journal sur les
  30 dernières minutes.
- **Colonne « Produits / Services »** : quand rien n'a encore été acheté au
  fournisseur, elle reprend les produits du catalogue rattachés à lui (par
  sa fiche ou par le nom saisi sur le produit, fiches inactives exclues).
  `dashboard-v2/lib/partenaires.ts`, 2 tests.

# 14. Essais de bout en bout — boutique bac à sable

Sur accord explicite : essais d'ajout, de modification et de suppression
**uniquement** dans « Boutique de Mamy Balsama » (boutique vide du
propriétaire : 0 vente, 0 produit, 0 client, aucun membre). Tout ce qui a été
créé porte « ESSAI CLAUDE » ; seule une vente créée pour l'essai a été
supprimée. L'identifiant de la boutique active a été revérifié avant chaque
enregistrement. Aucune autre boutique, aucun compte client touché.

| Geste | Attendu | Constaté en base |
|---|---|---|
| Produit P001 (achat 1 000, vente 1 500, stock 0, seuil 5) | créé, sans mouvement | conforme |
| Achat ACH001, 10 × 1 000, comptant | stock 10, payé 10 000, solde 0 | conforme ; stock = Σ mouvements |
| Vente V001, 3 × 1 500, comptant | payé 4 500, marge 1 500, stock 7 | conforme |
| Vente V002, 2 × 1 500, à crédit | solde 3 000, « Impayé », stock 5 | conforme |
| Règlement 1 000 sur V002 | « Partiel », solde 2 000 = total − Σ paiements | conforme |
| Règlement 5 000 sur un reste de 2 000 | refusé | refusé (validation), aucun paiement créé |
| V002 passée de 2 à 3 unités | total 4 500, solde 3 500, stock 4 | conforme |
| Supprimer V001 (déjà payée) | refusé | refusé, message clair dans l'application |
| Vente V003 non payée puis supprimée | stock rendu, trace au journal | stock 4, « suppression V003 » au journal |
| Notification de V003 supprimée | « Introuvable » | conforme |

Contrôles finaux du bac à sable : 0 écart stock / mouvements, 0 écart
ventes (total, solde, paiements), 0 écart achats, aucun stock négatif.
Aucune donnée d'essai hors du bac à sable ; « Devis fournisseur » garde ses
20 ventes. Restent dans le bac à sable : P001, ACH001, V001, V002 et leurs
deux paiements (laissés, à supprimer ou garder à votre choix).

## Défauts trouvés par ces essais, corrigés

- **Nouveau produit pré-rempli** (achat 1 000, vente 1 500, **stock initial
  20**, seuil 5) : un produit enregistré sans relire entrait avec 20 unités
  fictives. Tout part de 0 désormais, et la fiche est **remise à zéro** après
  l'enregistrement (le produit suivant héritait du stock et des prix du
  précédent).
- **Nouvel achat pré-rempli** (10 × 1 000) : champs vides au départ,
  quantité et prix d'au moins 1 exigés, remis à zéro après l'enregistrement.
- **Fiche de détail figée** : après la suppression d'une vente depuis sa
  fiche, la fiche restait ouverte sur la vente supprimée ; après un
  règlement, l'ancien « reste à payer » restait affiché. La fiche relit
  maintenant la ligne : à jour si elle change, fermée si elle disparaît
  (`shared/DataList.tsx`, 4 tests ; les deux tests clés échouent sur
  l'ancienne version).

# 15. Essais de bout en bout, second passage — même bac à sable

Mêmes règles qu'au § 14 (boutique « Boutique de Mamy Balsama » seule, fiches
« ESSAI CLAUDE », identifiant de boutique revérifié avant chaque écriture).
Aucune suppression dans ce passage.

| Geste | Attendu | Constaté |
|---|---|---|
| Fiche client « ESSAI CLAUDE Fiche » | créée | conforme |
| Devis DEV001, 1 × 1 500 | brouillon, stock inchangé | conforme (stock 4) |
| Devis → vente | vente liée au client, devis « accepté » et relié au ticket, payé comptant | conforme (V004) ; stock 3 |
| Commande CMD001, 2 unités | stock réservé 2, disponible 1 | conforme |
| Vente de 2 avec 1 disponible | refusée | refusée avant le panier, message clair |
| Paiement commande 3 000 | « payé », reste 0 | conforme |
| Commande livrée | stock 1, réservé 0 | conforme ; Σ mouvements = stock |
| Trésorerie après ces gestes | 0 + 7 000 + 3 000 − 10 000 = 0 | 0 Ar affiché |
| Dépense 500 | trésorerie −500 | conforme |
| Apport 20 000 | trésorerie 19 500 | conforme (en-tête et Capital) |
| Ajustement +2 « inventaire » | stock 3 | conforme ; 10 mouvements retombent sur 3 |
| Avoir 1 500 sur FAC-V002 (reste 3 500) | reste 2 000, rien à rendre, stock inchangé, remise en stock impossible (partiel) | conforme en base |

## Défauts trouvés, corrigés

- **Après un avoir, l'interface gardait l'ancien reste dû** (3 500 au lieu
  de 2 000 dans Ventes et Paiements à recevoir) jusqu'au rechargement : seule
  la liste des avoirs était relue. Les données de la boutique sont relues après
  chaque avoir enregistré (`BalsamaApp.tsx`).
- **Bilan : « Marge nette » n'était que la marge brute** — les dépenses n'en
  étaient jamais retirées — et s'affichait toujours en vert avec « + », même
  négative (« +-800 »). Deux lignes désormais : « Marge brute des ventes » et
  « Résultat (marge − dépenses) », avec leur vrai signe. 2 tests.
- **Nouvelle dépense pré-remplie à 5 000 Ar** : champ vide, au moins 1 exigé,
  remis à zéro après l'enregistrement.

## À trancher (non modifié)

- **Les commandes livrées n'entrent pas dans le chiffre d'affaires** du Bilan
  ni des Ventes (3 000 Ar ici), alors que leur paiement entre bien en
  trésorerie. Faut-il les y compter ? Il faudrait alors aussi leur marge
  (prix d'achat des lignes).

# 16. Les commandes livrées entrent dans le chiffre d'affaires — décision du 18 octobre

**Règle** : une commande fait du chiffre d'affaires **le jour de sa
livraison**, payée ou non — comme une vente à crédit au comptoir. En attente
ou en cours, elle ne fait que réserver du stock ; annulée, elle ne compte pas.

- **Date** : l'instant du mouvement de stock « commande_livraison » que
  `set_order_status` écrit, ramené au jour local (chargé par `useStoreData`,
  `livraisonsCommandes`). `orders.updated_at` ne convient pas : un paiement
  reçu après la livraison le déplace. Repli sur `updated_at` pour une commande
  sans article suivi en stock.
- **Règle unique** : `lignesDesCommandesLivrees` (`lib/commandes.ts`) traduit
  chaque commande livrée en lignes de vente pour les calculs (total, marge,
  produit, client), sans créance — ce que la commande doit se lit sur la
  commande, jamais deux fois.
- **Appliquée à** : tableau de bord (chiffre, comparaison, courbe, journée,
  marge, résultat, meilleurs produits, sorties de stock, clients actifs),
  Bilan, en-tête Ventes, Statistiques. La liste des ventes et le fil des
  ventes ne montrent que les ventes.
- **`montantCommande`** ne compte plus que les commandes livrées : la page
  Commandes (« Chiffre d'affaires ») et le « Total acheté » d'un client
  comptaient jusque-là aussi les commandes en attente.
- Un collaborateur limité à ses propres ventes ne voit pas les commandes dans
  son chiffre.
- Effet en production aujourd'hui : une seule commande livrée, l'essai CMD001
  (3 000 Ar) dans le bac à sable. Aucun chiffre d'une vraie boutique ne bouge.
- **Facturation** : la page n'affiche aucun chiffre d'affaires (ses quatre
  indicateurs sont À encaisser, En retard, Encaissé, Devis en attente ;
  « Encaissé » compte déjà les paiements de commandes). L'indicateur interne
  « facturé » reste celui des factures — une commande n'en émet pas — et sa
  documentation le dit désormais. Aucun écart visible.
- **Ancien tableau de bord** (désactivé en production, utilisé si le nouveau
  l'est) : même règle pour son total, sa marge et sa tendance ; sa liste des
  dernières ventes ne montre que les ventes.
- Tests : `lib/commandes.test.ts` (5 ajoutés).
