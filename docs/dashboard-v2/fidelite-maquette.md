# Fidélité à la maquette

Relevé élément par élément, tenu à jour à chaque phase. La référence est
`docs/maquette/tableau-de-bord-complet.html`, ouverte côte à côte avec
l'écran réel à 1440, 1024 et 360 pixels.

Légende : ✅ conforme · ⚠️ écart assumé, avec sa raison · ⏳ pas encore
construit.

---

## Jetons, couleurs, formes

| Élément                                                 | État | Note                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Les 22 jetons de couleur, clair et sombre               | ✅   | valeurs identiques, posées sous `.dash2` au lieu de `:root`                                                                                                                                                                                                   |
| Rayon des cartes (16 px), bordure, ombre                | ✅   |                                                                                                                                                                                                                                                               |
| Fond de page, surface, filets                           | ✅   |                                                                                                                                                                                                                                                               |
| Couleur fonctionnelle (vert / orange / rouge / bleu)    | ✅   |                                                                                                                                                                                                                                                               |
| **Polices Onest + JetBrains Mono**                      | ⚠️   | polices du système, `tabular-nums` pour les chiffres. `src/styles.css` explique pourquoi les deux familles ont été retirées de l'application : deux fichiers à télécharger avant le premier texte, et une allure qui change hors connexion. Décision validée. |
| Animation d'entrée des cartes, `prefers-reduced-motion` | ✅   |                                                                                                                                                                                                                                                               |

## Coquille

| Élément                                         | État | Note                                                                                                                                                           |
| ----------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Barre latérale, en-tête « Ma Boutique »**     | ⚠️   | l'application a déjà les siens (`Sidebar.tsx`, `Header.tsx`), partagés par vingt-cinq écrans. La v2 ne remplace que le contenu. Décision validée (écart n° 1). |
| Largeur maximale 1240 px, grille de 12 colonnes | ✅   | s4 = 403, s5 = 507, s7 = 717 à 1440 px                                                                                                                         |
| Paliers 1180 / 900 / 680                        | ✅   | vérifiés au pixel                                                                                                                                              |
| Aucun défilement horizontal de la page          | ✅   | vérifié à 1440, 1024, 860 et 360                                                                                                                               |

## En-tête

| Élément                                                           | État | Note                                                                                                                                                                          |
| ----------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date longue + « Mis à jour à HH:MM » + ⟳                          | ✅   | la date passe en forme courte dès 900 px, comme la maquette                                                                                                                   |
| « Bonjour / Bonsoir, prénom »                                     | ✅   | « Bonsoir » à partir de 18 h                                                                                                                                                  |
| Sélecteur de **vue**                                              | ✅   | n'apparaît que pour le propriétaire, seul à pouvoir prévisualiser                                                                                                             |
| Sélecteur de **période** + intervalle libre                       | ✅   | Aujourd'hui / 7 jours / Ce mois / du → au, mémorisé                                                                                                                           |
| Mode focus                                                        | ✅   | masque les cartes secondaires, mémorisé                                                                                                                                       |
| Bouton thème                                                      | ✅   | pilote le thème de l'application, pas un second                                                                                                                               |
| **Pas de bouton « Nouvelle vente » dans l'en-tête**               | ✅   | retiré, comme demandé ; il vit dans la tuile « Ventes du jour »                                                                                                               |
| Phrase de synthèse                                                | ✅   | mêmes cinq tournures, mêmes seuils (×2, ±5 %)                                                                                                                                 |
| Puces d'attention, clic → défilement + clignotement               | ✅   | tâches en retard, produits à recommander, devis sans réponse                                                                                                                  |
| En-tête compact ≤ 900 px : bandeau « Ventes · période · montant » | ✅   |                                                                                                                                                                               |
| « À regarder aujourd'hui · N » + 3 cases égales                   | ✅   |                                                                                                                                                                               |
| **Focus et thème remontés dans la barre du haut ≤ 900 px**        | ⚠️   | cette barre appartient à l'application. Les deux boutons passent en icônes carrées à la suite des sélecteurs, et descendent d'une ligne à 360 px, faute de place pour quatre. |

## Bandeau « Aujourd'hui »

| Élément                                             | État | Note                                                                                                                       |
| --------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| Titre « AUJOURD'HUI » + date et heure               | ✅   | la date disparaît ≤ 680, comme la maquette                                                                                 |
| Grille d'une colonne par tuile affichée             | ✅   | `--n` suit le nombre de tuiles autorisées                                                                                  |
| ≤ 1180 px : six colonnes, 3 + 2, aucune case isolée | ✅   | mesuré : 3 × span 2, puis 2 × span 3                                                                                       |
| ≤ 680 px : défilement horizontal, accroche, 84 %    | ✅   | seul défilement horizontal de la page                                                                                      |
| Points de position, actif allongé                   | ✅   | comptés d'après le débordement réel, pas d'après la largeur d'écran                                                        |
| Tuile **Ventes du jour**                            | ✅   | montant, nombre de tickets, « Hier », dernier jour vendu, « + Vendre »                                                     |
| ↳ **barre d'objectif du jour**                      | ⚠️   | **aucune donnée d'objectif n'existe en base** — ni table, ni colonne. Retirée.                                             |
| Tuile **Entrées d'argent**                          | ✅   | montant du jour, barres jour par jour du mois, jour courant en pointillé, total du mois                                    |
| Tuile **Sorties d'argent**                          | ✅   | montant du jour, achats et dépenses du mois, total                                                                         |
| ↳ « Prochaine sortie : loyer, 20/09 »               | ✅   | remplacé par la prochaine **échéance fournisseur** réelle ; masqué s'il n'y en a aucune                                    |
| Tuile **Stock du jour**                             | ✅   | entrées et sorties en unités, pastille « N produits bientôt en rupture »                                                   |
| ↳ « Réception fournisseur 18/09 »                   | ⚠️   | **aucune table ne porte de date de réception prévue**. La place est reprise par la valeur du stock, qui, elle, se calcule. |
| Tuile **Activité aujourd'hui**                      | ✅   | trois derniers gestes du jour, pastille colorée par famille, « N événements · M ventes »                                   |
| **Toutes les étiquettes « exemple »**               | ✅   | les 21 ont disparu ; aucune donnée inventée                                                                                |

## Grille principale

### Cartes 1 à 9 — construites

| #   | Carte                                        | État | Note                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Trésorerie** (portefeuille)                | ✅   | dégradé, puce dorée, gros solde, barre entrées / sorties. Le solde vient de `computedCapital`, celui de la barre latérale, sans recalcul. Ajout : la mention passe en teinte d'alerte sous le seuil de trésorerie de la boutique.                                                        |
| 2   | **Ventes du mois** (courbe cumulée)          | ✅   | aire dégradée, période précédente en pointillé, zone « reste du mois », point de fin, infobulle au survol (jour + cumul)                                                                                                                                                                 |
| 2b  | ↳ ligne d'objectif orange                    | ⚠️   | aucune donnée d'objectif. L'axe se cale désormais sur le plus haut des deux cumuls, arrondi au palier rond, au lieu du plafond 500 000 de la maquette.                                                                                                                                   |
| 3   | **Agenda** (calendrier de bureau)            | ✅   | en-tête vert à anneaux, quantièmes, jour courant, pastilles d'événement, liste des trois prochains. Quatre sources réunies : événements, échéances de tâches, livraisons prévues, rappels.                                                                                               |
| 3b  | ↳ rappels **quotidiens**                     | ⚠️   | écartés : une pastille sur les trente jours du mois ne dit plus ce qui est prévu. Les rappels mensuels et hebdomadaires sont là ; ceux liés à un événement ou une tâche le sont déjà par eux.                                                                                            |
| 4   | **Étagère de stock**                         | ✅   | dix casiers par produit, rouges sous le seuil, les cinq plus proches du seuil, valeur du stock, « Préparer la commande »                                                                                                                                                                 |
| 5   | **Ticket « Sorties »**                       | ✅   | papier, bord déchiré, pointillés de conduite, part par personne, moyenne par jour, part des ventes, tampon de comparaison, code-barres                                                                                                                                                   |
| 5b  | ↳ le tampon en rouge                         | ⚠️   | il reste bleu quelle que soit la variation : acheter plus n'est ni bon ni mauvais, c'est du stock qui change de forme. Règle déjà appliquée dans l'application.                                                                                                                          |
| 6   | **À faire** + devis en attente               | ✅   | cases à cocher, étiquettes « échue », « aujourd'hui », date. **Cocher appelle la fonction de l'application** (`useTaches`) ; sans le droit, la case est désactivée.                                                                                                                      |
| 7   | **Classement vendeurs**                      | ✅   | avatar à initiale, rang, barre relative au premier, solde net. Le solde vient de `computedSellers`, sans recalcul. La couleur de l'avatar est tirée du nom : la même personne garde la sienne.                                                                                           |
| 8   | **Suivi des commandes**                      | ✅   | quatre étapes sur ligne pointillée, état vide vert quand tout est à zéro                                                                                                                                                                                                                 |
| 9   | **Fil des ventes**                           | ✅   | groupé par jour, filet vertical, quantité en toutes lettres, vendeur, montant, badge de paiement                                                                                                                                                                                         |
| 9b  | ↳ **carré de couleur à initiale** du produit | ⚠️   | remplacé par la **vraie photo**, sans cadre ni fond, et par **rien** quand il n'y en a pas — seule la place est conservée pour que les lignes restent alignées. C'est la règle demandée pour tous les écrans de l'application ; un carré à initiale est précisément ce qu'elle interdit. |
| 10  | **Objectif** (jauge)                         | ⚠️   | **carte retirée** — aucune donnée d'objectif en base                                                                                                                                                                                                                                     |

### Cartes 11 à 19 — construites

| #   | Carte                                | État | Note                                                                                                                                    |
| --- | ------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | **Résultat du mois**                 | ✅   | équation à pointillés, bloc vert du bénéfice, comparaison en barres, et la phrase sur les achats de stock                               |
| 12  | **Paiements**                        | ✅   | barre empilée encaissé / à recevoir / en retard, trois lignes cliquables, encaissements par semaine                                     |
| 13  | **Clients**                          | ✅   | nouveaux, actifs, à relancer, puis la liste avec avatar et bouton                                                                       |
| 14  | **Journal d'activité**               | ✅   | groupé par jour, pastille colorée par famille, six filtres. Il montre les **créations**, que la cloche écarte.                          |
| 15  | **Ruptures à venir**                 | ✅   | en rupture puis bientôt, couverture en jours, barre de couverture                                                                       |
| 16  | **Entrées & sorties de stock**       | ✅   | barres de part et d'autre de zéro, infobulle au survol, mention du repli quand `stock_movements` ne rend rien                           |
| 17  | **Produits les plus vendus**         | ✅   | top 5, barre relative au premier, part des ventes, et la ligne « Autres »                                                               |
| 18  | **Livraisons**                       | ✅   | celles du jour, puis celles à venir                                                                                                     |
| 18b | ↳ « **& réceptions** » dans le titre | ⚠️   | **aucune table ne porte de date de réception prévue**. Le titre a perdu sa seconde moitié plutôt que d'annoncer une donnée inexistante. |
| 19  | **Fournisseurs à payer**             | ✅   | soldes dus, échéances dépassées en rouge, déjà payé sur la période. La carte disparaît sans le droit de voir les prix d'achat.          |

### Panneau de détail

| Élément                                                                                                                                                 | État | Note                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colonne de 460 px à droite, feuille du bas ≤ 680 px                                                                                                     | ✅   | mesuré : 460 px                                                                                                                                                                                                                                                    |
| Échap, ✕, clic à côté ; focus rendu à l'origine                                                                                                         | ✅   | tabulation piégée à l'intérieur tant qu'il est ouvert                                                                                                                                                                                                              |
| Douze vues : ventes, encaissements, à recevoir, en retard, clients à relancer, un client, un produit, ruptures, sorties, fournisseurs, résultat, agenda | ✅   | lignes réelles, total, puis un bouton qui mène à la page                                                                                                                                                                                                           |
| **Formulaires de création** (vente, dépense, achat, bon de commande)                                                                                    | ⚠️   | absents. Les formulaires de l'application ne sont pas des composants réutilisables ; le panneau montre, la page enregistre. Écart n° 3, validé.                                                                                                                    |
| Relance d'un client : appel, SMS, WhatsApp pré-remplis                                                                                                  | ✅   | **rien n'est envoyé** : les liens ouvrent l'application de messages du téléphone                                                                                                                                                                                   |
| ↳ numéro WhatsApp                                                                                                                                       | ⚠️   | `wa.me` refuse un numéro local. Un numéro commençant par zéro est présumé **malgache** (+261) — hypothèse assumée, l'application écrivant déjà l'Ariary en dur pour tout le monde. Un numéro non interprétable perd son lien WhatsApp, et garde l'appel et le SMS. |

### Table de contrôle

Provisoire, en bas de grille, et destinée à disparaître : elle affiche
en clair tous les chiffres des cartes pour les confronter à l'ancien
tableau de bord. Elle n'existe pas dans la maquette.

## Comportements de la maquette volontairement écartés

| Comportement                                      | Raison                                                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formulaires de création dans le panneau de détail | Les formulaires de l'application ne sont pas des composants réutilisables : ils vivent à l'intérieur d'écrans de 1 000 à 1 900 lignes. Le panneau navigue vers l'écran qui sait faire le geste. Décision validée (écart n° 3). |
| « −0 Ar » quand il n'y a aucune sortie            | La maquette écrit le signe en dur. Un zéro signé n'a pas de sens ; l'écran affiche « 0 Ar ».                                                                                                                                   |
| Sélecteur de vue pour un collaborateur            | Une vue ne donne aucun droit, mais laisser un membre changer de vue laisserait croire le contraire. Seul le propriétaire prévisualise.                                                                                         |
