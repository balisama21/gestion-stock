# Phase 3 — La pagination, puis les trois autres modèles

**Contrôles** — `tsc --noEmit` : 0 erreur. `eslint` : 0 erreur, 0
avertissement. `prettier --check` : conforme. `vitest run` :
**275 tests passent** (257 avant, **+18**). `vite build` : sans erreur.

Aucun écran existant n'est modifié. Le drapeau `documents_v2` n'est lu
par personne. Une seule ligne change hors du dossier `documents/` :
`capturer` devient exportée dans `src/lib/documentExport.ts`, pour que
la pagination puisse photographier plusieurs feuilles.

---

## 1. La pagination, d'abord

Elle passe devant les trois modèles, comme annoncé : elle devait
valoir pour les quatre, et la construire après aurait voulu dire la
construire quatre fois.

### Une feuille par page, et non un long bloc découpé

Le CSS sait paginer tout seul, mais pas compter. Les boîtes de marge
de `@page`, qui écrivent « Page 2/3 », **ne sont pas reconnues par
Chromium** — donc ni par Chrome, ni par Edge, ni par le navigateur
d'un téléphone Android.

Et le PDF est une photographie : laisser le navigateur couper où il
veut donne une image tranchée au milieu d'un montant.

Le découpage se décide donc chez nous. Chaque page imprimée est une
feuille du DOM, avec son propre en-tête et son propre numéro.
Contrôlé : chaque feuille se photographie en **2382 × 3369 pixels**,
soit exactement 210 × 297 mm — une photographie, une page, aucune
coupure au hasard.

### Le calcul est pur, la mesure est à part

`lib/pagination.ts` reçoit des hauteurs et rend une répartition. Il ne
touche pas au DOM, ce qui permet de le vérifier sur dix-huit cas en
deux secondes là où mesurer un vrai document demande un navigateur.

**Un bug trouvé par ces tests, avant qu'il n'atteigne personne.** La
première version réservait la place de la clôture au fur et à mesure
du remplissage. Quand la clôture est trop haute pour partager une
page avec quoi que ce soit, chaque page rendait ses lignes à la
suivante, qui les rendait à son tour : le découpage tournait à vide et
**perdait toutes les lignes**. Sur un bon de livraison, c'est de la
marchandise qui n'arrive pas. Réécrit en deux temps — on remplit
d'abord, on case la clôture ensuite.

Les autres cas couverts : aucune ligne perdue ni répétée sur 1, 5, 12,
25 et 60 articles ; l'ordre conservé ; aucune page qui dépasse ; une
ligne plus haute qu'une page entière posée quand même plutôt que de
boucler ; et un plafond de cent pages, parce qu'une mesure fausse ne
doit pas geler le navigateur de quelqu'un qui voulait imprimer une
facture.

### La mesure, en deux rendus

Le premier pose tout le document sur une feuille unique, invisible. On
y relève ce qu'aucun calcul ne devine : la hauteur de l'en-tête une
fois l'adresse repliée, celle de **chaque** ligne selon la longueur de
sa désignation — on a mesuré 43 px pour une ligne sans référence et
66 px pour une ligne qui en porte une —, celle de la clôture selon les
options actives. Le second rend les vraies feuilles.
`useLayoutEffect` enchaîne les deux avant que le navigateur ne peigne.

Deux pièges résolus en chemin :

**L'en-tête des pages suivantes a une hauteur fixe** (18 mm, posée en
CSS). Le découpage doit la connaître avant que ces pages n'existent ;
une hauteur fixe supprime cette poule et cet œuf, et évite une
seconde passe de mesure.

**La mention de page occupe toujours sa ligne**, vide quand le
document tient sur une feuille. Une ligne qui apparaîtrait après coup
ferait déborder la page qu'on venait de mesurer.

### Une erreur de mesure, trouvée en mesurant

La première version déduisait les marges : hauteur de la feuille moins
ses trois groupes. Le raisonnement se tenait, mais **`offsetHeight`
ment quand le contenu déborde** — ce qui est exactement le cas de la
feuille de mesure, qui porte tout le document. Les marges ressortaient
négatives, donc nulles, et le découpage croyait disposer de 106 pixels
de plus qu'en réalité : **la première page d'une facture de vingt-cinq
lignes dépassait de 17 pixels.** Constaté sur la vraie feuille, pas
supposé.

Les marges se lisent maintenant sur le bloc rembourré. S'y ajoutent
deux pixels de garde : les filets se comptent en dixièmes de
millimètre, et l'Épuré sortait à 1124 pixels pour une page qui en fait
1123 — un pixel suffit à faire imprimer une page blanche de plus.

---

## 2. Les trois autres modèles

| Modèle      | Ce qui le distingue                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bandeau** | Bandeau de couleur pleine largeur, lignes alternées, barre de contact en pied. Le plus affirmé : il donne à la facture l'allure d'un document de marque. |
| **Épuré**   | Empattements, aucun aplat, filets fins. Pour les métiers où la couleur ferait tache.                                                                     |
| **Compact** | Dense, numéroté, faible hauteur de ligne. Pour les factures à beaucoup d'articles.                                                                       |

### Les quatre partagent une ossature

Chacun rend les mêmes trois groupes — `tete`, `tableau`, `cloture` —
que la mesure sait retrouver. C'est ce qui permet de paginer une fois
pour les quatre. Le Bandeau, dont l'en-tête doit toucher les bords,
y parvient par des marges négatives plutôt qu'en sortant du bloc
rembourré : sa forme est particulière, son ossature ne l'est pas.

### Trois décisions à connaître

**L'Épuré n'a pas de tampon.** Un tampon « PAYÉ » de travers dans un
document sobre est un corps étranger. L'information reste, portée par
la ligne des totaux. C'est le seul endroit où un élément disparaît
pour une raison de style, et une boutique qui tient au tampon ne
choisira pas ce modèle.

**Le numéro de ligne du Compact compte sur le document entier**, et
non par page : c'est le rang de l'article dans la commande, pas sa
place sur la feuille. Sur une facture de trente articles, « la ligne
17 » est la seule façon de se comprendre au téléphone.

**Le Compact serre tout sauf les chiffres.** Hauteurs de ligne,
marges et corps de texte se resserrent ; les montants gardent leur
chasse fixe et leurs chiffres tabulaires. Une colonne de trente
nombres qui danse ruinerait précisément ce pour quoi on choisit ce
modèle.

### Un défaut attrapé à l'œil

Le filet de couleur de l'Épuré soulignait **« Déjà payé »** au lieu du
total. La règle visait `:last-child`, qui n'est la ligne du total que
lorsqu'aucun règlement n'est connu. La ligne porte maintenant un nom,
`.grand`, et non un rang. Le Compact avait le même défaut.

---

## 3. Ce que donne la capacité, modèle par modèle

Mesuré sur le vrai rendu, avec les vraies ventes de la boutique :

| Modèle    | 1 ligne | 3 lignes | 25 lignes                               |
| --------- | ------- | -------- | --------------------------------------- |
| Classique | 1 page  | 1 page   | **3 pages**                             |
| Bandeau   | 1 page  | 1 page   | **3 pages**                             |
| Épuré     | 1 page  | 1 page   | **3 pages**                             |
| Compact   | 1 page  | 1 page   | **2 pages** — 24 lignes sur la première |

**Aucune page ne dépasse 1123 pixels**, dans aucun des douze cas. Les
vingt-cinq lignes sont toutes présentes, dans l'ordre, dans les quatre
modèles.

### Ce que j'ai resserré pour y arriver

L'Épuré mettait trois lignes sur deux pages — il manquait **cinq
pixels**. Plutôt que de gratter au hasard, j'ai retiré ce qui ne
servait pas :

- **la clôture respire moins que les grandes sections** (4 mm au lieu
  de l'espacement du modèle). Ses blocs — totaux, mentions, signature,
  pied — se lisent ensemble ; les séparer autant que l'en-tête et le
  tableau coûtait quatre centimètres, soit deux lignes d'articles ;
- **l'intitulé « Conditions » de l'Épuré est retiré** : le texte dit
  déjà ce qu'il est, et sur un modèle aussi aéré une ligne de titre
  coûtait une ligne d'article ;
- l'Épuré passe de 18 à 15 mm de marge et son titre de 32 à 28 points.

C'est la réponse à la question laissée ouverte en fin de phase 2 :
la pagination rend la capacité de la première page moins critique,
et le peu qu'il fallait gagner s'est trouvé dans des espaces qui ne
portaient rien. **Je n'ai pas touché aux proportions que vous avez
validées** — ni aux corps de texte du Classique, ni à ses blocs.

---

## 4. Fichiers

```
src/features/documents/
├── lib/
│   ├── pagination.ts  + .test.ts        (18 tests, sans DOM)
│   └── exporter.ts                      un PDF de n pages, une photo par feuille
├── parts/
│   └── squelette.tsx                    l'ossature commune, l'en-tête de suite
└── templates/
    ├── Bandeau.tsx · Epure.tsx · Compact.tsx
    └── modeles.css                      + 300 lignes
```

Modifiés : `DocumentPreview.tsx` (mesure, découpage, rendu multi-feuilles,
choix du modèle), `Classique.tsx` (ossature commune), `parts/blocs.tsx`
(mention de page, ligne de total nommée), `print.css`.

Hors du dossier : `src/lib/documentExport.ts` — le mot `export` devant
`capturer`, et le commentaire qui dit pourquoi.

Le banc vivant a servi à tout vérifier, puis a été supprimé
(`banc-app.tsx`, `public/banc/`). Le serveur de développement du
port 3000 tourne toujours.

---

## 5. Phase 4

Le ticket de caisse, en 80 et 58 mm — avec son code-barres Code 128,
son heure, et la mention « Ticket non valable comme facture ».
