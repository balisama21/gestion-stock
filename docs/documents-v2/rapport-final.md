# Documents v2 — rapport final

Branche `feat/documents-v2`, sept phases, un commit par phase.
Vingt-deux fichiers de test, **321 tests**. Aucune migration, aucun
SQL, aucun changement de schéma. Une seule écriture dans toute la
fonctionnalité : les réglages de documents, dans une colonne qui
existait déjà.

---

## 1. COMMENT TOUT COUPER, SI VOUS N'AVEZ QUE TRENTE SECONDES

**Paramètres → Documents → premier interrupteur, « Nouveaux
documents ». Décochez, Enregistrer.**

Les anciennes factures reviennent immédiatement, pour toute la
boutique, sans rien réinstaller et sans attendre un déploiement. Le
réglage se range dans `stores.personnalisation`, sous
`documents.actif` — c'est **le nom exact du réglage serveur**.

Si l'écran de réglages lui-même n'était plus atteignable, il reste un
lien à ouvrir depuis le téléphone :

```
https://tantana-suite.netlify.app/?documents_v2=0
```

Il éteint pour cet appareil, retient le choix, et nettoie l'adresse.
`?documents_v2=1` rallume.

### Les quatre interrupteurs, du plus fort au plus faible

|     | Où                                     | Portée          | Redéploiement ? |
| --- | -------------------------------------- | --------------- | --------------- |
| 1   | `?documents_v2=0` ou `1`               | l'appareil      | non             |
| 2   | `localStorage.documents_v2`            | le navigateur   | non             |
| 3   | **`personnalisation.documents.actif`** | **la boutique** | **non**         |
| 4   | `VITE_DOCUMENTS_V2` (Netlify)          | tout le monde   | oui             |

Treize tests vérifient cet ordre, parce qu'un ordre faux voudrait
dire ne plus pouvoir éteindre.

---

## 2. Les cases de la §10

### Ce que j'ai vérifié moi-même

**`tsc --noEmit`, lint, `vite build` sans erreur.** ✅ avec une
réserve entière : `npm run lint` échoue sur tout le dépôt **et
échouait déjà avant cette mission** — 20 513 erreurs, dont 16 565
retours chariot dus à `core.autocrlf`. Mesure faite : les neuf
fichiers existants que la mission modifie portaient **309 erreurs
avant**, ils en portent **306 après**, retours chariot retirés des
deux côtés. La mission n'en ajoute aucune, et les fichiers qu'elle
crée sont à zéro. Détail et remède dans `bloques.md`.

**Aucune migration, aucun SQL, aucun changement de schéma.** ✅
`git diff bb152b0..HEAD -- supabase/` ne rend aucun fichier.

**Aucune écriture pendant l'ouverture et l'impression.** ✅ Mesuré
dans un vrai navigateur, requêtes enregistrées : **0 requête POST,
PUT, PATCH ou DELETE** pendant l'affichage d'un document de trois
pages et son export en PDF. Et une recherche dans tout le dossier
`features/documents/` ne trouve aucun appel à Supabase.

**Les autres clés de `personnalisation` survivent à
l'enregistrement.** ✅ C'est le point le plus dangereux de la
mission, et il était CASSÉ avant elle : `lirePersonnalisation()` ne
recopiait que les deux clés qu'elle connaissait, si bien que toute clé
d'un autre écran disparaissait au premier enregistrement du
vocabulaire. Corrigé, puis verrouillé par six tests dont un
aller-retour complet, plus quatre tests sur l'écran lui-même.

**Les montants du document correspondent à la page Ventes.** ✅ Deux
verrous : `buildDocument` ne recalcule aucun prix — le seul calcul
permis est l'addition de lignes déjà enregistrées, celle que fait la
page Ventes ; et sept tests comparent le formatage des montants à
`formatCurrency` de l'application, trois autres celui des dates à
`formatDateLocale`.

**Montant en lettres sur les neuf valeurs demandées.** ✅
1 → un · 71 → soixante et onze · 80 → quatre-vingt**s** ·
81 → quatre-vingt-un · 100 → cent · 200 → deux cent**s** ·
1 000 → mille · 331 800 → trois cent trente et un mille huit cent**s** ·
1 500 000 → un million cinq cent mille.
Trente-six tests au total, dont le piège que la plupart des
implémentations ratent : _deux cent mille_ sans s, _deux cents
millions_ avec.

**Une page pour trois lignes, plusieurs pages propres pour
vingt-cinq, en-tête de tableau répété, totaux non coupés.** ✅ Mesuré
sur les quatre modèles. Trois lignes : une page partout. Vingt-cinq
lignes : trois pages (deux pour le Compact, qui en tient 24 sur la
première). **Aucune page ne dépasse 1123 pixels**, soit 297 mm
exactement, dans aucun des douze cas. L'en-tête du tableau est
présent sur chacune des trois pages, vérifié dans le navigateur. Les
totaux ne se coupent jamais : le découpage leur réserve la place, et
un test vérifie qu'ils partent sur une page entière plutôt que de se
séparer.

**Ticket en 80 et 58 mm, rien de coupé à droite.** ✅ Mesuré :
**302 px exactement** (79,9 mm) et **219 px** (57,9 mm), et **zéro
élément ne dépasse le bord droit** dans les deux cas. Le code-barres
fait 22,7 mm sur 80 et 17,8 mm sur 58 — largement dans le papier.

**Boutique sans logo, sans NIF, sans TVA.** ✅ Capture
`verif-boutique-nue.png` : pastille d'initiales à la place du logo,
pas de ligne d'adresse, pas de NIF, pas de TVA, **zéro paragraphe
vide**, et aucun « N/A », « undefined » ni « null » dans tout le
document. La feuille fait toujours 1123 px.

**Vente sans client.** ✅ Le document s'imprime et affiche « Client
comptoir », le bloc se réduisant à cette ligne. C'est le cas de la
capture ci-dessus et de `classique-1ligne.png`.

**Bon de commande client : les montants sont ceux de la commande.**
✅ Par construction : `documentDeCommande` lit `montant_total`,
`montant_paye` et `reste_a_payer` **tels quels**, sans refaire la
soustraction, et la date de livraison vient de
`orders.date_livraison`. Réserve honnête : **il n'existe aucune
commande dans la base**, je n'ai donc pas pu le voir sur une vraie
donnée.

**Bon de commande fournisseur : imprimer ne crée rien.** ✅ Il garde
son implémentation actuelle, celle que vous avez validée le
21 septembre — voir la décision n° 7 ci-dessous. Elle ne fait aucun
appel d'écriture : elle lit les produits sous leur seuil et compose
un document.

**Un vendeur sans droit ne voit pas l'écran de réglages mais imprime
avec le bon modèle.** ✅ Par construction : l'onglet Documents est
`ownerOnly`, filtré par `isOwner` dans `SettingsLayout`, exactement
comme les huit autres réglages de boutique. Le modèle, lui, vient de
`personnalisation`, que tout le monde lit.

**Les polices s'affichent sans connexion.** ✅ Mesuré : les deux
polices chargées viennent de `localhost`, **aucune requête vers
`fonts.googleapis.com` ou `fonts.gstatic.com`** pour un document, et
`document.fonts.check()` confirme que les deux familles sont prêtes.
`public/sw.js` met les `.woff2` en cache. _Une réserve qui n'est pas
de mon fait_ : `src/styles.css` charge encore deux polices Google
pour le mot-logo du site vitrine — antérieur à cette mission, sans
rapport avec les documents.

**Flag coupé : l'ancienne facture revient à l'identique.** ✅ La
preuve tient dans le diff : sur `VentesView.tsx`, **une seule ligne
retirée** sur 60 ajoutées, et c'est
`{selectedReceiptSale && (` devenu
`{selectedReceiptSale && !documentNouveau && (`. Les trois cents
lignes de l'ancien reçu et de l'ancienne facture n'ont pas bougé d'un
caractère.

### Ce que vous seul pouvez vérifier

- **L'impression sur papier.** Les mesures sont justes au pixel ;
  seul un tirage montrera les marges réelles de votre imprimante.
- **L'imprimante thermique, en 80 et en 58 mm.** Le ticket est à la
  bonne largeur et rien ne déborde à l'écran ; reste à voir le
  rouleau.
- **La lecture du code-barres par une douchette.** Le symbole est un
  Code 128 conforme, dix-huit tests vérifient la norme jusqu'à la clé
  de contrôle. Un scan réel reste la preuve finale.
- **Le bon de commande client sur une vraie commande**, quand vous en
  aurez enregistré une.

---

## 3. Les décisions prises à votre place

Chacune suit l'ordre que vous aviez fixé : ne rien casser, puis
coller à la maquette, puis rester facile à défaire.

**1. La TVA est comprise, elle ne s'ajoute pas.** La maquette fait
`total = base + TVA` sur des données fictives. Appliqué à votre vente
V024, ce calcul annoncerait **360 000 Ar pour une vente enregistrée à
300 000** — un montant jamais payé, qui contredirait la page Ventes.
La taxe est donc extraite du total, et le hors-taxe obtenu par
soustraction pour que l'addition tombe juste à l'ariary.
_Défaire_ : `totauxDeVente` dans `lib/buildDocument.ts`.

**2. L'option « Remise » est retirée.** Aucune colonne ne porte de
remise : la ligne ne s'afficherait jamais, et un interrupteur sans
effet fait croire que la fonction existe.
_Défaire_ : il faudra d'abord une vraie colonne, donc une migration.

**3. « Imprimer » est le bouton principal, devant « PDF ».**
L'impression produit du texte réel ; le PDF est une photographie.
_Défaire_ : échanger deux classes dans `DocumentPreview.tsx`.

**4. Le code-barres est un vrai Code 128, écrit à la main.** Celui de
la maquette est un dégradé CSS : très ressemblant, et parfaitement
muet.
_Défaire_ : couper l'option, ou passer à `jsbarcode`.

**5. La mention « Ticket non valable comme facture » n'est pas
réglable.** C'est elle qui protège la boutique.
_Défaire_ : la déplacer dans `ReglagesTicket`.

**6. L'Épuré n'a pas de tampon de paiement**, et j'ai resserré ses
marges de 18 à 15 mm. Un tampon de travers dans un document sobre est
un corps étranger ; et il lui manquait cinq pixels pour tenir trois
lignes sur une page.
_Défaire_ : `templates/Epure.tsx` et `templates/modeles.css`.

**7. Le bon de commande FOURNISSEUR garde son implémentation
actuelle.** C'est l'écart le plus important de cette mission avec
votre cahier des charges, et il est délibéré. Vous aviez validé ce
document le 21 septembre, après trois allers-retours sur sa mise en
page. Le refaire au modèle v2 aurait remplacé un document que vous
avez vu et approuvé par un autre que vous n'auriez pas vu — exactement
ce que votre première règle interdit. Il ne perd rien au change : il
sort déjà en A4, sans données inventées, et n'écrit rien en base.
_Faire la v2 un jour_ : ajouter `documentDAchat` à côté de
`documentDeCommande`, qui lui ressemble à quinze lignes près, et
brancher le bouton « Préparer la commande ».

**8. Le drapeau serveur vit dans `personnalisation.documents.actif`.**
Vous demandiez un réglage coupable à distance, dans une table
existante, sans SQL. Une variable Netlify demande un redéploiement ;
il n'existe pas d'autre table de configuration ; et je n'avais pas le
droit d'écrire en base moi-même. Cette colonne existe, elle est en
jsonb, et l'écran de réglages est la seule écriture autorisée de la
mission.
_Conséquence à connaître_ : couper pour **votre** boutique ne demande
pas de redéploiement ; couper pour **toutes** les boutiques à la fois
en demande un (la variable `VITE_DOCUMENTS_V2`).

**9. Un filet de sécurité sous la v2.** Le déploiement se faisant
sans validation humaine, si un document tombe, l'écran ne doit pas
devenir blanc devant quelqu'un qui facture. Le filet retient la chute
et l'ancien document reprend sa place tout seul.
_Défaire_ : retirer `<FiletDeSecurite>` des trois écrans.

---

## 4. Trois défauts sérieux trouvés en vérifiant

Ils n'étaient visibles dans aucun test unitaire. Ils le sont devenus
en mesurant dans un vrai navigateur.

**Le ticket de 80 mm en faisait 90.** Le sélecteur universel
`.doc-ticket *` ne couvre pas l'élément lui-même : le rembourrage
s'ajoutait à la largeur. 340 pixels au lieu de 302 — un ticket
tronqué à droite sur une imprimante thermique.

**Changer de document faisait planter l'aperçu.** Le découpage en
pages se remettait à zéro dans un effet, donc après le rendu : entre
les deux, le composant appliquait l'ancien découpage au nouveau
document et cherchait des lignes qui n'existent plus. En production,
**chaque seconde vente ouverte aurait vidé l'écran**.

**La première page d'une facture longue dépassait de dix-sept
pixels.** La mesure déduisait les marges de `offsetHeight`, qui ment
quand le contenu déborde — ce qui est précisément le cas de la
feuille qui sert à mesurer.

Un quatrième, trouvé par les tests avant d'atteindre personne : une
première version du découpage **perdait toutes les lignes** quand le
bloc de totaux était trop haut pour partager une page. Sur un bon de
livraison, c'est de la marchandise qui n'arrive pas.

---

## 5. Ce que contient `bloques.md`

Un seul blocage, et il est antérieur à la mission : `npm run lint`
échoue sur tout le dépôt, essentiellement à cause des retours
chariot. Le fichier donne la mesure, la preuve que c'est antérieur, et
le remède — un `.gitattributes` plus un `prettier --write` en une
fois, à commiter seul.

S'y ajoute la liste de ce qui ne peut être vérifié que par vous.

---

## 6. Ce qui a été construit

```
src/features/documents/
├── drapeau.ts + test              les quatre interrupteurs
├── DocumentPreview.tsx            mise à l'échelle, mesure, pagination
├── SortieDocument.tsx             la fenêtre partagée
├── FiletDeSecurite.tsx            le repli automatique
├── index.css · print.css
├── fonts/                         6 woff2 (336 Ko) + licences
├── lib/
│   ├── buildDocument.ts + test    vente, reçu, devis, commande
│   ├── pagination.ts + test       le découpage, sans DOM
│   ├── codeBarres.ts + test       Code 128 conforme
│   ├── montantEnLettres.ts + test
│   ├── format.ts + test
│   ├── reglages.ts · imprimer.ts · exporter.ts
│   └── fixtures.ts                données réelles de production
├── parts/                         blocs.tsx · squelette.tsx
└── templates/                     Classique · Bandeau · Épuré · Compact · Ticket
```

Plus `src/components/settings/DocumentsSection.tsx` et son test.

Fichiers existants modifiés : `BalsamaApp.tsx`, `VentesView.tsx`,
`CommandesView.tsx`, `DevisView.tsx`, `devis/DocumentDevis.tsx`,
`ParametresView.tsx`, `settings/SettingsLayout.tsx`,
`lib/personnalisation.ts`, `lib/documentExport.ts`, `.gitignore`.

Vingt captures en Chromium sans interface dans
`docs/documents-v2/captures/`.

---

## 7. La mise en production

| Quand (UTC) | Quoi |
| --- | --- |
| 21/09 12:31 | `feat/documents-v2` fusionnée dans `main`, poussée |
| 21/09 12:33 | déploiement Netlify `6ab12377` prêt |
| 21/09 12:34 | production vérifiée : **zéro erreur console**, drapeau coupé |
| 21/09 12:42 | dix minutes de stabilité écoulées |
| 21/09 12:43 | `VITE_DOCUMENTS_V2=1` posée, reconstruction, **drapeau levé** |

Le premier déploiement s’est fait **drapeau coupé** : aucune boutique
n’a vu changer quoi que ce soit pendant que la stabilité se
confirmait. Le bundle contient les six polices (328 Ko) et les cinq
modèles dans un morceau de CSS séparé, chargé seulement quand on
ouvre un document.

### Si quelque chose cloche

**Le plus rapide, sans redéploiement** : Paramètres → Documents →
décocher « Nouveaux documents ». Réglage `documents.actif` dans
`stores.personnalisation`.

**Pour toutes les boutiques à la fois** : supprimer ou mettre à `0`
la variable `VITE_DOCUMENTS_V2` du projet Netlify `tantana-suite`,
puis relancer une construction.

**Depuis un téléphone, si l’écran de réglages est inatteignable** :
ouvrir `https://tantana-suite.netlify.app/?documents_v2=0`.

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
