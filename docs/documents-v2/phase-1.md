# Phase 1 — Fondations : polices, impression, formatage

Rien n'est encore visible dans l'application : cette phase pose les
briques que les modèles utiliseront. Aucun écran existant n'est
touché, le drapeau `documents_v2` n'est branché nulle part.

**Contrôles** — `tsc --noEmit` : 0 erreur. `eslint src/features/documents` :
0 erreur. `prettier --check` : conforme. `vitest run` : **211 tests
passent** (147 avant, **+64**). `vite build` : sans erreur.

---

## 1. Les polices sont dans le dépôt

`src/features/documents/fonts/` — **six fichiers, 336 Ko**.

| Famille | Fichiers | Poids |
| --- | --- | --- |
| Onest | `onest-latin.woff2`, `onest-latin-ext.woff2` | 33,8 + 28,5 Ko |
| JetBrains Mono | `jetbrains-mono-latin.woff2`, `-latin-ext.woff2` | 31,4 + 11,6 Ko |
| Source Serif 4 | `source-serif-4-latin.woff2`, `-latin-ext.woff2` | 122,4 + 100,9 Ko |

**Six et non vingt-deux.** Le premier rapatriement en avait produit
vingt-deux — quatre poids × deux sous-ensembles par famille. Un
contrôle d'empreinte md5 a montré que les quatre poids d'une même
famille étaient **le même octet** : les trois familles sont des
polices *variables*, un seul fichier porte toute la plage. D'où
`font-weight: 100 900` dans les `@font-face` : une plage, pas une
valeur. 1 065 Ko sont redevenus 336.

**Deux sous-ensembles et non huit.** Google sert par défaut le
cyrillique, le grec, le vietnamien, les symboles mathématiques. On
garde « latin » et « latin-ext » : le français et le malgache
s'écrivent tous deux en alphabet latin. Les `unicode-range` sont
recopiés tels quels — c'est eux qui évitent au navigateur de
télécharger le fichier étendu pour une page qui n'en a pas besoin.

**Vérifié au build, pas supposé.** J'ai ajouté l'import de la feuille
de style dans `BalsamaApp.tsx`, lancé `vite build`, contrôlé que les
six `.woff2` atterrissent bien dans `dist/client/assets/` avec une
empreinte dans leur nom et une URL `/assets/…` correcte dans le CSS
produit, puis **retiré l'import**. Un chemin faux découvert en
phase 4 aurait coûté bien plus cher.

**Hors connexion, c'est déjà couvert.** `public/_headers` sert
`/assets/*` en `immutable`, et `public/sw.js` met en cache les
`/assets/` et les `.woff2` avec une stratégie réseau-d'abord /
cache-en-secours. Une fois la page visitée, les polices sont
disponibles sans réseau. Rien à ajouter.

**Licences** — les trois familles sont sous SIL OFL 1.1, qui autorise
explicitement l'hébergement et la redistribution.
`fonts/LICENCES.md` porte l'attribution et la procédure de mise à jour.

---

## 2. `print.css` — la feuille est une feuille

Le principe qui commande tout le fichier : **le document fait 210 mm
de large, toujours.** Ce qui s'adapte à l'écran, c'est l'échelle —
une mise à l'échelle par `transform`, qui ne remet rien en page.

C'est la réponse directe au défaut constaté sur le bon de commande :
les documents actuels sont en `width: 100%` plafonnés par une
`max-width`, donc ils se replient sur un téléphone, et comme le PDF
est une *photographie* du bloc affiché, le fichier sort avec les
colonnes écrasées. `transform` ne change pas la mise en page, seulement
sa taille apparente.

Ce que la feuille de style pose :

- `@page { size: A4; margin: 0 }` — les marges vivent **dans** la
  feuille (`.doc-pad`), jamais dans `@page` : la capture qui produit
  le PDF ne voit que l'élément, pas la page. Marges à zéro d'un côté,
  marges en millimètres de l'autre, et le PDF comme l'impression
  tombent au même endroit.
- `tr`, `thead`, `tfoot`, `img` et `.doc-insecable` : `break-inside: avoid`.
- `thead { display: table-header-group }` — l'en-tête du tableau se
  répète en haut de chaque page.
- `print-color-adjust: exact` — un bandeau de couleur porte le titre du
  document ; imprimé en blanc, le titre disparaîtrait.

### La pagination, et pourquoi elle n'est pas en CSS

Le « Page 1/2 » demandé s'écrit normalement avec les boîtes de marge
de `@page` (`@bottom-right { content: counter(page) "/" counter(pages) }`).
**Chromium ne les reconnaît pas** — donc ni Chrome, ni Edge, ni le
navigateur d'un téléphone Android, c'est-à-dire la quasi-totalité du
parc d'une boutique.

J'ai donc pris l'autre chemin : **une feuille DOM par page imprimée**,
posées à la suite, chacune portant son propre numéro écrit par le
composant qui a mesuré le contenu. `break-after: page` sur chaque
feuille, sauf la dernière — sans cette exception, tout document se
terminerait par une page blanche. Le composant qui mesure arrive en
phase 2 ; le CSS l'attend.

---

## 3. `format.ts` — les chiffres du document ne contredisent pas l'écran

C'est la règle qui commande ce module, et les deux premiers blocs de
tests ne vérifient que cela : `montant()` est comparé à
`formatCurrency()` de l'application, `dateCourte()` à
`formatDateLocale()`, sur sept montants et trois dates. Le jour où
quelqu'un touche à l'un sans l'autre, ça casse ici et non sur une
facture chez le client.

**Une seule différence, assumée et testée.** `formatCurrency` met une
espace **ordinaire** avant « Ar » ; le document met une **insécable**.
À l'écran, un « Ar » qui descend d'une ligne est un détail ; sur une
facture imprimée, un total dont la devise s'est détachée fait douter du
montant. Le test le dit explicitement au lieu de le laisser passer.

Le séparateur de milliers, lui, reprend exactement la substitution de
l'application : `Intl` en français produit U+202F, l'espace *fine*
insécable, remplacée par U+00A0 parce que la fine ne survit pas à tous
les encodages — c'est elle qui donnait « 6/500 Ar ».

Le reste : `montantOuTiret` (un prix inconnu affiche « — », jamais
« 0 Ar », qui se lirait « gratuit » sur un bon de commande),
`dateLongue` (« 1er août 2026 »), `heure`, `initiales` (« Ma
Boutique » → « MB »), et `dateEcheance`.

**L'échéance se calcule, elle ne se stocke pas.** Aucune colonne ne la
porte, et je n'en ai pas créé : une échéance n'est pas une donnée de
la vente, c'est une politique de la boutique. Effet de bord assumé et
écrit dans le code — changer le réglage change l'échéance des factures
qu'on réimprime. Le jour où un délai se négociera vente par vente, il
faudra une colonne, et ce sera une autre discussion.

### Un piège évité, signalé par `eslint`

Les espaces insécables s'étaient écrites **littéralement** dans le
code source au lieu de leurs séquences ` `. Le code fonctionnait,
les tests passaient — mais un caractère invisible dans une expression
régulière est indéfendable : personne ne peut relire ce code, et la
première correction bien intentionnée l'écraserait sans le voir.
`no-irregular-whitespace` l'a attrapé. Quinze caractères réécrits en
séquences d'échappement.

---

## 4. `montantEnLettres.ts` — la mention qui fait foi

Sur une facture contestée, c'est le montant en lettres qui tranche :
un « 1 » devient un « 7 » d'un trait de stylo, « trois cent trente et
un mille huit cents » ne se retouche pas.

### Les neuf cas demandés

| Montant | Résultat |
| --- | --- |
| 1 | un |
| 71 | soixante et onze |
| 80 | quatre-vingt**s** |
| 81 | quatre-vingt-un |
| 100 | cent |
| 200 | deux cent**s** |
| 1 000 | mille |
| 331 800 | trois cent trente et un mille huit cent**s** |
| 1 500 000 | un million cinq cent mille |

Les neuf passent. Ils sont marqués « ⚑ » dans le fichier de test.

### Les pièges que les neuf ne couvraient pas

Le cœur du module est une règle que la plupart des implémentations
ratent. « cent » et « vingt » prennent un s quand ils sont multipliés
**et qu'aucun mot de nombre ne les suit**. Or « mille » est un mot de
nombre, tandis que « million » et « milliard » sont des **noms**.
D'où :

| | |
| --- | --- |
| 200 000 | deux cent mille — **sans** s |
| 200 000 000 | deux cent**s** millions — **avec** s |
| 80 000 | quatre-vingt mille |
| 80 000 000 | quatre-vingt**s** millions |

C'est pour cela que le code transporte un drapeau `final` de tranche
en tranche plutôt que de regarder seulement la dernière.

Les autres cas couverts : 70/72/90/99 qui s'écrivent en additionnant ;
le « et » qui n'existe qu'à *soixante et onze* et pas à
*quatre-vingt-onze* (il n'y a pas de règle, c'est l'usage — le test
est là pour que personne n'« harmonise ») ; « mille » invariable et
jamais précédé de « un » ; les tranches vides
(1 000 001 → « un million un », sans trou) ; l'arrondi, aligné sur
l'affichage en chiffres ; les montants négatifs ; et le refus au-delà
du représentable — le document masque alors la mention plutôt que
d'écrire une phrase tronquée sur un papier qui engage.

`deviseEnToutesLettres` traduit le sigle en mot : « Ar » → « ariary »,
parce que « trois cents Ar » ne s'écrit pas dans une mention légale.
Une devise inconnue est recopiée telle quelle — mieux vaut un mot
inhabituel qu'un mot inventé.

---

## 5. `drapeau.ts` — l'interrupteur

Calqué sur `features/dashboard-v2/drapeau.ts`, volontairement : la
mécanique a déjà servi, elle est comprise, et deux interrupteurs qui
se ressemblent s'expliquent une seule fois.

```
?documents_v2=1                   depuis un lien, le choix reste
localStorage.documents_v2 = "1"   pour un seul navigateur
VITE_DOCUMENTS_V2 = "1"           pour tout le monde, au build
```

Rien en base : le jour où la v2 devient la seule version, il n'y aura
ni colonne ni migration à défaire. Il n'est encore lu par personne.

---

## 6. Fichiers créés

```
src/features/documents/
├── drapeau.ts
├── index.css                      (importe les deux feuilles ci-dessous)
├── print.css
├── fonts/
│   ├── polices.css
│   ├── LICENCES.md
│   └── 6 × .woff2                 336 Ko
└── lib/
    ├── format.ts        + format.test.ts            (28 tests)
    └── montantEnLettres.ts + .test.ts               (36 tests)
```

Aucun fichier existant modifié.

---

## 7. Ce que je fais en phase 2

`buildDocument()` — la fonction qui lit une vente, une commande ou un
devis et en tire un modèle d'affichage, sans jamais recalculer un
prix — puis le modèle **Classique** branché sur une vraie vente de la
boutique, avec capture et PDF à l'appui.

C'est là que le composant qui mesure et pagine apparaîtra, et que la
feuille de style deviendra vérifiable à l'écran.
