# Journal de bord — documents v2

Branche `feat/documents-v2`. Un commit par phase. Ce fichier est le
point de reprise : si une session repart de zéro, elle relit ce
fichier et continue à la première phase qui n'est pas marquée
TERMINÉE, sans refaire ce qui l'est.

**Interdits qui tiennent du début à la fin** — aucune migration,
aucun SQL, aucun changement de schéma ; aucune modification des
données, des calculs, des permissions ni des workflows existants ;
aucun `git push --force`. Une seule écriture autorisée dans toute la
mission : les réglages de documents dans `stores.personnalisation`,
en fusionnant l'objet existant.

---

## Phase 0 — Audit de l'existant — TERMINÉE

Commit `130bf02`.

- **Fait** : relevé complet de la génération actuelle des documents,
  du ticket existant, de l'écran Paramètres, du contenu réel de
  `stores.personnalisation` en production, de la numérotation, du
  regroupement des ventes par ticket, des champs client, des
  paiements et des permissions. Tableau « élément → source → existe
  ou manque ».
- **Fichiers créés** : `docs/documents-v2/audit.md`,
  `docs/documents-v2/sql-propose.sql`,
  `docs/maquette/factures-tantana.html`.
- **Fichiers modifiés** : aucun.
- **Trois trouvailles** : `lirePersonnalisation()` efface les clés
  qu'elle ne connaît pas (à corriger avant d'écrire `documents`) ;
  les commandes se numérotent en comptant leurs lignes plutôt qu'avec
  le compteur dédié (signalé dans `sql-propose.sql`, non appliqué) ;
  l'écran de réglages n'obéit pas à une permission `settings` mais à
  `isOwner`, ce qui est plus strict que ce que demandait la consigne.
- **Vérifications** : tsc OK.

## Phase 1 — Polices locales, impression, formatage — TERMINÉE

Commit `3bf290d`. Rapport : `docs/documents-v2/phase-1.md`.

- **Fait** : les trois polices de la maquette rapatriées dans le
  dépôt (six fichiers, 336 Ko — ce sont des polices variables, un
  seul fichier par famille et par sous-ensemble) ; `print.css` qui
  pose le principe « la feuille fait 210 mm, c'est l'échelle qui
  s'adapte » ; `format.ts` et `montantEnLettres.ts` avec 64 tests.
- **Fichiers créés** : `src/features/documents/` — `drapeau.ts`,
  `index.css`, `print.css`, `fonts/` (6 `.woff2`, `polices.css`,
  `LICENCES.md`), `lib/format.ts` + test, `lib/montantEnLettres.ts` +
  test.
- **Fichiers modifiés** : aucun.
- **Vérifications** : tsc OK · lint OK · build OK · 211 tests.

## Phase 2 — `buildDocument()` et le modèle Classique — TERMINÉE

Commit `f8f7540`. Rapport : `docs/documents-v2/phase-2.md`.

- **Fait** : la fonction de lecture qui transforme une vente en
  modèle d'affichage, le modèle Classique, l'aperçu avec mise à
  l'échelle, et les jeux d'essai tirés de la production.
- **Fichiers créés** : `DocumentPreview.tsx`,
  `templates/Classique.tsx`, `templates/modeles.css`,
  `parts/blocs.tsx`, `lib/buildDocument.ts` + test, `lib/reglages.ts`,
  `lib/imprimer.ts`, `lib/fixtures.ts`.
- **Fichiers modifiés** : `print.css`, `index.css`.
- **Décision prise à ma place** : la TVA est **comprise**, elle ne
  s'ajoute pas. _Raison_ : la maquette calcule `total = base + TVA`
  sur des données fictives ; appliqué à la vente V024 de la
  production, ce calcul annoncerait 360 000 Ar pour une vente
  enregistrée à 300 000 — un montant jamais payé, qui contredirait la
  page Ventes. _Revenir en arrière_ : dans `totauxDeVente`
  (`lib/buildDocument.ts`), remplacer l'extraction par une addition ;
  un test la verrouille et échouera, ce qui est voulu.
- **Décision** : l'option « Remise » est retirée des réglages.
  _Raison_ : aucune colonne ne porte de remise, la ligne ne
  s'afficherait jamais, et un interrupteur sans effet fait croire que
  la fonction existe. _Revenir en arrière_ : rajouter la clé dans
  `OptionsDocuments` et la ligne dans `Totaux` — mais il faudra
  d'abord une vraie colonne, donc une migration.
- **Décision** : « Imprimer » est le bouton principal, devant
  « PDF ». _Raison_ : l'impression produit du texte réel ; le PDF est
  une photographie. _Revenir en arrière_ : échanger les classes
  `app-btn-primary` / `app-btn-secondary` dans `DocumentPreview.tsx`.
- **Vérifications** : tsc OK · lint OK · build OK · 257 tests · PDF
  produit depuis 375 px et depuis 1000 px **identiques octet pour
  octet**, flux image compris.

## Phase 3 — Pagination, modèles Bandeau, Épuré et Compact — TERMINÉE

Commit `5ac4042`. Rapport : `docs/documents-v2/phase-3.md`.

- **Fait** : le découpage en pages (une feuille du DOM par page
  imprimée), la mesure en deux rendus, les trois modèles restants, et
  l'export d'un PDF de plusieurs pages.
- **Fichiers créés** : `lib/pagination.ts` + test, `lib/exporter.ts`,
  `parts/squelette.tsx`, `templates/Bandeau.tsx`, `templates/Epure.tsx`,
  `templates/Compact.tsx`.
- **Fichiers modifiés** : `DocumentPreview.tsx`,
  `templates/Classique.tsx`, `templates/modeles.css`,
  `parts/blocs.tsx`, `print.css`, et **hors du dossier**
  `src/lib/documentExport.ts` (le mot `export` devant `capturer`, pour
  que la pagination puisse photographier plusieurs feuilles).
- **Décision prise à ma place** : la clôture respire moins que les
  grandes sections (4 mm fixes), l'intitulé « Conditions » de l'Épuré
  est retiré, et l'Épuré passe de 18 à 15 mm de marge et de 32 à
  28 points de titre. _Raison_ : l'Épuré mettait trois lignes sur deux
  pages, il manquait cinq pixels ; ces espaces ne portaient rien.
  _Revenir en arrière_ : `.doc-cloture { gap }` et le bloc
  `.m-epure .doc-pad` dans `templates/modeles.css`.
- **Décision** : l'Épuré n'a pas de tampon de paiement. _Raison_ : un
  tampon de travers dans un document sobre est un corps étranger ;
  l'information reste dans les totaux. _Revenir en arrière_ : ajouter
  `<TamponPaiement>` dans `templates/Epure.tsx`.
- **Vérifications** : tsc OK · lint OK · build OK · 275 tests ·
  douze cas mesurés (4 modèles × 1, 3 et 25 lignes), aucune page ne
  dépasse 1123 px, les 25 lignes toutes présentes · chaque feuille se
  photographie en 2382 × 3369 px, soit exactement une A4.

---

## Phase 4 — Ticket 80 mm et 58 mm — À FAIRE

## Phase 5 — Paramètres → Documents — À FAIRE

## Phase 6 — Branchement Ventes / Commandes / Devis + drapeau — À FAIRE

## Phase 7 — Vérifications, rapport final, mise en production — À FAIRE

---

## Phase 4 — Ticket 80 mm et 58 mm — TERMINÉE

- **Fait** : le modèle Ticket, un vrai code-barres Code 128 dessiné en
  SVG, l'heure de l'encaissement, la mention « Ticket non valable comme
  facture », l'impression sur rouleau (`@page { size: 80mm auto }`) et
  l'export PDF à la taille exacte du contenu.
- **Fichiers créés** : `lib/codeBarres.ts` + test (18 tests),
  `templates/Ticket.tsx`, `docs/documents-v2/captures/` (16 images).
- **Fichiers modifiés** : `lib/buildDocument.ts` (heure, message de
  ticket, valeur du code-barres), `lib/imprimer.ts` (taille de page
  rouleau), `lib/exporter.ts` (`exporterRouleauPdf`),
  `DocumentPreview.tsx` (format feuille ou rouleau),
  `templates/modeles.css`, `print.css`.

### Décisions prises à ma place

**Le code-barres est un vrai Code 128, écrit à la main.** _Raison_ :
la maquette dessine un dégradé CSS répétitif — très ressemblant, et
parfaitement muet ; une douchette n'en tire rien. `jsbarcode` ferait
quarante kilooctets pour soixante lignes, et la norme est figée
depuis 1981. _Revenir en arrière_ : couper l'option
`ticket.codeBarres` dans les réglages, ou remplacer
`dessinerCode128` par la bibliothèque.

**Il encode le numéro BRUT, pas le numéro préfixé.** _Raison_ : une
douchette doit rendre « V026 », qui se cherche dans la liste des
ventes ; « REC-V026 » ne s'y trouve pas. _Revenir en arrière_ :
`codeBarres: util(premiere?.numero)` dans `documentDeVente`.

**La mention « Ticket non valable comme facture » n'est pas
réglable.** _Raison_ : c'est elle qui protège la boutique du client
qui repart en croyant tenir une facture. _Revenir en arrière_ :
la déplacer dans `ReglagesTicket`.

**Module de 0,28 mm sur 80 mm, 0,22 mm sur 58 mm.** _Raison_ : sur le
rouleau étroit, 0,28 donnerait un symbole plus large que le papier —
tronqué, il ne se lit pas du tout. _Revenir en arrière_ :
`MODULE_MM` dans `templates/Ticket.tsx`.

### Trois défauts trouvés en vérifiant, dont deux graves

**Le ticket de 80 mm en faisait 90.** Le sélecteur universel
`.doc-ticket *` ne couvre pas l'élément lui-même : le rembourrage
s'ajoutait à la largeur. Mesuré 340 pixels au lieu de 302. Sur une
imprimante thermique, c'est un ticket tronqué à droite. Corrigé dans
`print.css`.

**La mesure ne se déclenchait pas de façon fiable.** Le tableau de
références était vidé dans un effet, alors que les callbacks de `ref`
s'exécutent AVANT les effets : la mesure ne trouvait plus rien, et la
feuille restait invisible. Le défaut ne se voyait pas dans un
navigateur ordinaire, où le redimensionnement provoque un second
rendu qui le rattrapait ; il est apparu en Chromium sans interface.

**Changer de document faisait planter l'aperçu.** Le découpage se
remettait à zéro dans un effet, donc APRÈS le rendu : entre-temps, le
composant appliquait l'ancien découpage au nouveau document et
cherchait des rangs de lignes qui n'existent plus —
`Cannot read properties of undefined (reading 'designation')`, aperçu
entier disparu. **En production, cela se serait produit chaque fois
qu'on ouvre une seconde vente sans fermer la première.** La remise à
zéro se fait maintenant pendant le rendu, avec un filet de sécurité
sur les rangs.

- **Vérifications** : tsc OK · lint OK (1 avertissement, sur le banc
  temporaire) · build OK · **293 tests** · 16 captures en Chromium sans
  interface dans `docs/documents-v2/captures/`.
  Mesuré : rouleaux à **79,9 mm** et **57,9 mm** exactement,
  code-barres de 22,7 et 17,8 mm — largement dans le papier.
- **Reste à faire** : rien pour cette phase. L'impression sur une
  vraie imprimante thermique ne peut être vérifiée que par vous.

---

## Phase 5 — Paramètres → Documents — TERMINÉE

- **Fait** : l'écran de réglages complet, l'enregistrement fusionnant
  dans `stores.personnalisation.documents`, l'aperçu en direct sur une
  vraie vente, et **l'interrupteur serveur** qui coupe les nouveaux
  documents sans redéployer.
- **Fichiers créés** : `src/components/settings/DocumentsSection.tsx`
  - test (9 tests), `src/lib/personnalisation.test.ts` (6 tests),
    `docs/documents-v2/bloques.md`,
    `docs/documents-v2/captures/parametres-documents.png`.
- **Fichiers modifiés** : `src/lib/personnalisation.ts` (les clés
  inconnues sont enfin préservées), `src/components/ParametresView.tsx`,
  `src/components/settings/SettingsLayout.tsx`,
  `src/features/documents/lib/reglages.ts` (le réglage `actif`),
  `src/features/documents/drapeau.ts` (quatre interrupteurs),
  `src/BalsamaApp.tsx` (les ventes et produits passés à l'écran de
  réglages, en lecture seule).

### La correction que l'audit réclamait, faite en premier

`lirePersonnalisation()` ne recopiait que `modules` et `rappels`.
Comme tous les écrans de réglages relisent puis réenregistrent l'objet
entier, **toute clé ajoutée par un autre écran disparaissait au
premier enregistrement du vocabulaire** — sans message, et sans moyen
de la retrouver. Corrigé avant d'écrire la moindre donnée, et
verrouillé par six tests dont un aller-retour complet.

### Décisions prises à ma place

**Le drapeau serveur vit dans `stores.personnalisation.documents.actif`.**
_Raison_ : la consigne demande un réglage coupable à distance depuis un
téléphone, sans redéployer, dans une table existante et sans SQL. Une
variable d'environnement Netlify demande un redéploiement ; il n'existe
aucune autre table de configuration ; et je n'ai pas le droit d'écrire
en base moi-même. La colonne `personnalisation` existe, elle est en
jsonb, deux sections s'en servent déjà, et l'écran de réglages est la
seule écriture autorisée de toute la mission — c'est le seul endroit
qui satisfait toutes les contraintes à la fois.
_Revenir en arrière_ : retirer la clé `actif`, le drapeau retombe sur
`VITE_DOCUMENTS_V2`.

**Trois états et non deux** (`null`, `true`, `false`). _Raison_ : sans
le troisième, une boutique qui n'a jamais touché au réglage serait
comptée comme l'ayant refusé, et l'activation générale n'atteindrait
personne. _Revenir en arrière_ : `lireReglagesDocuments`, clé `actif`.

**L'interrupteur est le premier réglage de l'écran.** _Raison_ : c'est
celui qu'on vient chercher en urgence ; il ne doit pas être au fond.
_Revenir en arrière_ : déplacer le bloc dans `DocumentsSection.tsx`.

**L'aperçu montre la dernière vente réelle, jamais un exemple.**
_Raison_ : la consigne interdit les données de la maquette dans
l'application, et on règle mieux un document en le voyant tel qu'il
sortira. Sans aucune vente, l'aperçu le dit et s'efface.
_Revenir en arrière_ : `DocumentsSection.tsx`, bloc « Aperçu ».

- **Vérifications** : tsc OK · lint OK **sur les fichiers de la
  mission** (voir `bloques.md` : le dépôt entier échouait déjà avant,
  20 513 erreurs de retours chariot) · build OK · **308 tests** ·
  capture `parametres-documents.png`.
- **Reste à faire** : rien pour cette phase.

---

## Phase 6 — Branchement Ventes / Devis / Commandes + drapeau — TERMINÉE

- **Fait** : `documentDeDevis` et `documentDeCommande`, une fenêtre de
  sortie partagée par les cinq documents, un filet qui rattrape une
  erreur de la v2, et le branchement des trois écrans derrière le
  drapeau.
- **Fichiers créés** : `features/documents/SortieDocument.tsx`,
  `features/documents/FiletDeSecurite.tsx`,
  `features/documents/drapeau.test.ts` (13 tests).
- **Fichiers modifiés** : `lib/buildDocument.ts` (+ devis, + commande),
  `VentesView.tsx`, `CommandesView.tsx`, `DevisView.tsx`,
  `devis/DocumentDevis.tsx`, `BalsamaApp.tsx`, `.gitignore`.

### Comment le drapeau se lit, du plus fort au plus faible

1. `?documents_v2=0` ou `1` dans l'adresse — vaut pour l'appareil, se
   retient, et nettoie la barre. **C'est le secours de dernier
   recours**, celui qui marche même si l'écran de réglages n'est plus
   atteignable.
2. `localStorage.documents_v2` — un navigateur, pour essayer.
3. **`personnalisation.documents.actif`** — la boutique, en base.
   C'est celui qui se coupe depuis un téléphone, sans redéployer, par
   Paramètres → Documents.
4. `VITE_DOCUMENTS_V2` — tout le monde, décidé au déploiement.

Treize tests vérifient surtout **qui l'emporte sur qui** : un ordre
faux, et l'on ne peut plus éteindre.

### Décisions prises à ma place

**Un filet de sécurité sous la v2.** _Raison_ : le déploiement se fait
sans validation humaine ; si un document tombe, l'écran ne doit pas
devenir blanc devant quelqu'un qui facture. Le filet retient la chute,
l'écran cesse de demander la v2, et l'ancien document reprend sa place
tout seul. _Revenir en arrière_ : retirer `<FiletDeSecurite>` des trois
écrans.

**L'ancienne modale de Ventes n'est pas déplacée d'une ligne.** _Raison_ :
la réécrire pour la réutiliser comme secours aurait touché trois cents
lignes de JSX qui marchent. Elle est simplement rendue conditionnelle
— `!documentNouveau` — et c'est elle qui revient quand la v2 est
absente ou tombée. _Revenir en arrière_ : retirer la condition.

**Le bon de commande client est une nouveauté entière.** L'écran
Commandes n'avait aucune impression. Drapeau baissé, le bouton
n'apparaît pas ; il n'y a donc rien à casser.

**Le choix de modèle sur un document précis ne s'enregistre pas.**
_Raison_ : c'est la consigne, et c'est juste — un vendeur ne redéfinit
pas l'identité de la boutique en imprimant une facture.

### La mesure qui compte

Les neuf fichiers existants modifiés par la mission ont été comparés à
leur version d'avant (`bb152b0`), retours chariot retirés des deux
côtés : **309 erreurs eslint avant, 306 après**. La mission n'en
ajoute aucune. Détail dans `bloques.md`.

- **Vérifications** : tsc OK · lint OK sur les fichiers de la mission ·
  build OK · **321 tests**.
- **Reste à faire** : rien pour cette phase.

---

## Phase 7 — Vérifications, rapport final, mise en production — TERMINÉE

- **Fait** : les quinze cases de la §10 passées une par une, quatre
  vérifications menées dans un vrai navigateur, le rapport final, puis
  le merge dans `main` et le déploiement.
- **Fichiers créés** : `docs/documents-v2/rapport-final.md`,
  quatre captures de vérification.
- **Fichiers modifiés** : `docs/documents-v2/bloques.md`.

### Ce qui a été mesuré, et non supposé

| Vérification                                 | Résultat                                      |
| -------------------------------------------- | --------------------------------------------- |
| Écritures pendant l'affichage et l'export    | **0** requête POST/PUT/PATCH/DELETE           |
| Polices hors du domaine, pour un document    | **0**                                         |
| En-tête de tableau sur chaque page (3 pages) | présent sur les trois                         |
| Hauteur des pages, 12 cas                    | **1123 px** partout, jamais plus              |
| Ticket 80 mm                                 | **302 px**, 0 élément qui déborde             |
| Ticket 58 mm                                 | **219 px**, 0 élément qui déborde             |
| Boutique sans rien                           | 0 paragraphe vide, 0 « N/A »                  |
| Diff de `VentesView`                         | **1 ligne retirée**, la condition d'ouverture |
| eslint sur les fichiers modifiés             | 309 avant → **306 après**                     |

### Décision prise à ma place

**Le bon de commande fournisseur garde son implémentation actuelle.**
_Raison_ : vous l'aviez validé le 21 septembre après trois
allers-retours sur sa mise en page. Le refaire au modèle v2 aurait
remplacé un document approuvé par un autre que vous n'auriez pas vu —
ce que la première règle interdit. Il sort déjà en A4, sans données
inventées, et n'écrit rien en base.
_Revenir dessus_ : ajouter `documentDAchat` à côté de
`documentDeCommande`, qui lui ressemble à quinze lignes près, et
brancher le bouton « Préparer la commande » de la carte Stock.

- **Vérifications** : tsc OK · lint OK sur les fichiers de la mission ·
  build OK · **321 tests** · 20 captures.

---

## Mise en production

| Quand | Quoi |
| --- | --- |
| 21/09/2026 12:31 UTC | `feat/documents-v2` fusionnee dans `main`, poussee |
| 21/09/2026 ~12:33 UTC | deploiement Netlify `6ab123776e9b2600089d0bba` pret |
| 21/09/2026 12:34 UTC | production verifiee, **zero erreur console**, drapeau coupe |
| 21/09/2026 12:42 UTC | dix minutes de stabilite ecoulees |

Le drapeau a ete laisse coupe pendant le premier deploiement : aucune
boutique n a vu changer quoi que ce soit. L activation generale se
fait ensuite par la variable `VITE_DOCUMENTS_V2` du projet Netlify
`tantana-suite`, qui demande une reconstruction.

### Activation confirmee

| Quand (UTC) | Quoi |
| --- | --- |
| 21/09 12:43 | `VITE_DOCUMENTS_V2=1` posee sur le projet Netlify |
| 21/09 12:44 | reconstruction poussee (`8f02939`) |
| 21/09 12:46 | deploiement `6ab12693` pret |
| 21/09 12:47 | **drapeau leve, verifie dans le paquet livre** |

La verification ne se contente pas de supposer : le module compile
de `routes-CcgGGRaL.js`, telecharge depuis la production, contient
`OUI.has(`1`)` — la variable a bien ete lue au build. Et la page
chargee ne produit **aucune erreur de console**.

---

## Correctif apres deploiement — onglet « Documents » en double

**Signale par vous, le 21/09 en fin de journee**, en regardant les
Parametres : le mot « Documents » apparaissait deux fois dans la
navigation.

**Cause** : le script qui a branche l onglet dans `SettingsLayout`
a ete relance apres un echec partiel, et a insere le bloc une
seconde fois. Les deux blocs etaient identiques et consecutifs —
a la relecture, ils se lisent comme un seul.

**Consequence** : deux onglets identiques dans la barre laterale et
dans la bande du telephone, et deux cles React identiques. Aucune
donnee en jeu, aucun document affecte.

**Corrige** : le second bloc retire, et un test ajoute qui compte
les libelles d onglet. Une premiere version de ce test ne voyait
rien — elle comptait le texte des boutons, alors que la barre
laterale y ajoute le sous-titre. Corrigee, puis **verifiee en
reintroduisant le doublon expres** : le test tombe (4 au lieu de 2),
et repasse une fois le doublon retire.

La lecon a retenir : un script de correction relance apres un echec
partiel doit etre idempotent, ou verifie apres coup. Les autres
insertions de la mission ont ete recomptees a cette occasion — une
seule occurrence chacune.
