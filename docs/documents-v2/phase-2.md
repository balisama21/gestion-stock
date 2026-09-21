# Phase 2 — `buildDocument()` et le modèle Classique

**Contrôles** — `tsc --noEmit` : 0 erreur. `eslint` : 0 erreur, 0
avertissement. `prettier --check` : conforme. `vitest run` :
**257 tests passent** (211 avant, **+46**). `vite build` : sans erreur.

Aucun écran existant n'est modifié. Le drapeau `documents_v2` n'est
lu par personne : rien de tout ceci n'est encore visible chez le
client.

---

## 1. Les données d'essai viennent de la production

`lib/fixtures.ts` reprend, en lecture seule et sans les arranger, les
vraies ventes de « Ma Boutique » : V024 (300 000 Ar, client « Dimby »
en texte libre, produit disparu du catalogue donc sans référence),
V025 (le seul produit qui porte une unité), V026, la fiche client la
plus complète, et le règlement PAY045.

C'est délibéré. Un jeu d'essai propre ne prouve que la mise en page
d'une boutique imaginaire ; les cas qui cassent un document sont
précisément ceux-là — un nom mal orthographié, une unité nulle, une
référence introuvable, un client qui n'est qu'un prénom.

S'y ajoute une boutique **vide** (ni adresse, ni NIF, ni TVA), qui est
le cas de trois des cinq boutiques en base.

---

## 2. `buildDocument()` — deux règles sans exception

**Le document affiche, il ne calcule pas de prix.** Le seul calcul
permis est une addition de lignes déjà enregistrées, parce que c'est
exactement ce que fait la page Ventes pour le même ticket.

**Une donnée absente disparaît.** Les documents actuels écrivent
« Lot IVG 124, Antananarivo 101 » et « +261 34 12 345 67 » quand la
boutique n'a rien saisi : une facture part alors chez un client avec
l'adresse de personne. C'est fini.

### Le seul écart avec la maquette, et pourquoi

**La TVA est comprise, elle ne s'ajoute pas.** La maquette calcule
`total = base + TVA` sur des données fictives. Appliqué à V024, ce
calcul ferait sortir une facture à **360 000 Ar pour une vente
enregistrée à 300 000** — un montant que le client n'a jamais payé,
qui ne correspond à rien en caisse, et qui contredirait la page
Ventes.

Les prix d'une boutique malgache sont des prix payés, toutes taxes
comprises. La TVA est donc **extraite** du total : 300 000 TTC
donnent 250 000 HT et 50 000 de taxe, et le total ne bouge pas d'un
ariary. Le hors-taxe est obtenu par **soustraction** et non par une
seconde division, pour que `HT + TVA` fasse exactement le total, sans
l'ariary d'écart qu'un double arrondi produirait sous les yeux du
client. Un test le vérifie.

### Ce que la fonction corrige au passage

|                   | Avant                                       | Maintenant                                                                                                                            |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Fiche client      | jamais imprimée ; seul le nom libre sortait | entreprise, adresse, ville, téléphone                                                                                                 |
| Nom du produit    | —                                           | celui **figé sur la vente**, pas le nom actuel du catalogue : un produit renommé ne réécrit pas une facture déjà remise               |
| Mode de règlement | absent                                      | « Espèces », lu sur le dernier paiement                                                                                               |
| Échéance          | inexistante                                 | une **date** (04/10/2026), pas un délai à compter soi-même                                                                            |
| Numéro            | `V026`                                      | `FAC-V026` — le préfixe **habille** le numéro de la base, il ne le remplace pas, pour qu'il reste cherchable dans la liste des ventes |

### Deux corrections trouvées en regardant l'écran

Les tests ne les auraient jamais attrapées ; l'œil, oui.

**« Total à payer » sur une vente soldée** contredisait le tampon
« PAYÉ » posé trois centimètres au-dessus — et sur un **reçu**, qui
constate de l'argent reçu, c'était franchement faux. Le libellé suit
désormais l'état réel : « Total à payer », « Total », ou « Total
réglé ».

**« Solde 0 Ar »** ne disait rien que le tampon et la ligne « Déjà
payé » n'aient déjà dit. La ligne n'apparaît plus que lorsqu'il reste
vraiment quelque chose.

---

## 3. La feuille ne se replie plus — et c'est prouvé

C'était l'objet principal de la phase. Voici la preuve, pas la
promesse.

J'ai monté un banc **vivant** — servi par le vrai serveur de
développement, avec le vrai composant React — et pressé le bouton PDF
deux fois sur le même document : une fois dans une fenêtre de
**1000 px**, une fois dans une fenêtre de **375 px**.

```
Facture_FAC-V026.pdf          (1000 px)   377 629 octets
Facture_depuis_telephone.pdf  ( 375 px)   377 629 octets

octets différents dans le flux image : 0
octets différents en tout           : 63
  → uniquement /CreationDate (13:47:20 contre 13:48:52)
    et les décalages de la table de références qui en découlent
```

**Zéro octet d'écart sur l'image.** Le PDF produit depuis un
téléphone est le même fichier que celui produit depuis un ordinateur.
Le défaut qui sortait « PRO / DUI / T » en en-tête n'existe plus,
par construction.

Le PDF lui-même : `%PDF-1.3`, **MediaBox 595,2756 × 841,8898 pt**,
c'est-à-dire A4 exact au centième de point, une seule page, image
posée bord à bord — les marges sont dans la feuille, pas dans la
page.

---

## 4. Ce que j'ai trouvé en mesurant, et qui demande votre avis

En mesurant la feuille produite, j'ai découvert un problème que la
maquette ne pouvait pas révéler : **elle ne montrait que trois
lignes, et trois lignes remplissent exactement une A4.**

Mesures relevées sur le document réel, en millimètres sur 297 :

| Bloc                                   | Hauteur  |
| -------------------------------------- | -------- |
| En-tête (logo, titre, repères, tampon) | 44,7     |
| Émetteur + destinataire                | 37,8     |
| Montant en lettres, mentions, totaux   | 34,9     |
| Signatures, mot de fin, pied           | 20,9     |
| Marges haut et bas                     | 32,0     |
| **Espaces entre les huit blocs**       | **56,0** |
| Reste pour le tableau                  | ~52      |

Les 56 mm d'air entre les blocs étaient le poste le plus lourd. Je
les ai ramenés à 42 mm (`gap` de 8 à 6 mm) et les marges de 32 à
28 mm, ce qui ne change rien à la respiration du document et lui rend
18 mm. J'ai aussi retiré 10 mm de marge au-dessus du mot de fin, qui
s'ajoutaient à un vide déjà poussé par l'espace extensible — et qui
faisaient déborder d'une page la facture de trois lignes (mesuré :
303 mm pour une feuille de 297).

**Résultat mesuré après resserrage : la feuille fait exactement
297,1 mm, et elle tient quatre lignes d'articles.** Pas quinze.

Continuer à gratter ne mènerait nulle part : le mobilier de la
première page coûte 245 mm, c'est la nature du modèle que vous avez
validé. La vraie réponse est la **pagination** : la première page
porte le mobilier et quatre lignes, les suivantes portent un en-tête
léger et une vingtaine de lignes chacune. C'est ainsi que fonctionne
une facture professionnelle, et c'est ce que je prévois en phase 3.

**Si vous préférez que la première page en tienne davantage**, il
faut resserrer le mobilier lui-même — titre plus petit, repères sur
une ligne, blocs d'adresse compactés. Cela s'écarterait des
proportions de la maquette, d'où la question plutôt que la décision.

---

## 5. Ce qui a été décidé, en l'absence de réponse

Comme annoncé en fin de phase 0, j'ai avancé avec :

**La remise est retirée.** Aucune colonne de la base n'en porte, ni
sur `sales`, ni sur `orders` : la ligne ne s'afficherait jamais, et
un interrupteur sans effet est pire que pas d'interrupteur — il fait
croire que la fonction existe. Le jour où une remise sera une vraie
donnée, elle changera aussi le total et la marge : ce sera un
chantier, pas une case à cocher.

**« Imprimer » est le bouton principal**, devant « PDF ». L'impression
produit du texte réel, sélectionnable et net à toute taille ; le PDF
est une photographie, fidèle mais lourde et non sélectionnable. Le
bouton qui donne le meilleur résultat doit être celui qu'on atteint
sans réfléchir.

Le code-barres attend la phase du ticket.

---

## 6. Fichiers créés

```
src/features/documents/
├── DocumentPreview.tsx            l'aperçu, la mise à l'échelle, les trois sorties
├── templates/
│   ├── Classique.tsx
│   └── modeles.css
├── parts/
│   └── blocs.tsx                  Marque, BlocAdresse, Reperes, Tampon,
│                                  TableauLignes, Totaux, MontantEnLettres,
│                                  Mentions, Signature
└── lib/
    ├── buildDocument.ts  + .test.ts   (46 tests)
    ├── reglages.ts                    lecture de personnalisation.documents
    ├── imprimer.ts
    └── fixtures.ts                    les vraies données de production
```

Modifiés : `print.css` et `index.css` (marges et import du CSS des
modèles).

Les huit blocs sont dans un seul fichier plutôt que huit de vingt
lignes : ils se lisent ensemble, partagent les mêmes règles, et les
éparpiller obligerait à ouvrir huit onglets pour comprendre une
en-tête.

**Tous les fichiers de banc ont été supprimés** — `banc.tsx`,
`banc.html`, `banc-app.tsx` et le dossier `public/banc/`. Le serveur
de développement que j'ai démarré sur le port 3000 tourne toujours ;
il sert l'application normalement.

---

## 7. Phase 3

Les modèles Bandeau, Épuré et Compact — et, en premier, la
**pagination**, maintenant qu'on sait qu'elle n'est pas un raffinement
mais une nécessité. Elle doit valoir pour les quatre modèles, ce qui
est exactement la raison de la construire une fois qu'ils existent
tous.
