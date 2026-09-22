# Facturation — journal de bord

Une page « Facturation » qui rassemble tous les documents commerciaux
de la boutique. Elle s'appuie sur le module Documents (v2/v3) et ne
recrée rien de ce qui existait.

---

## Ce qu'il faut savoir en trente secondes

**La page ne possède aucune table à elle.** Elle relit `sales`,
`quotes`, `supplier_invoices` et la nouvelle table `avoirs`, et les
range en PIÈCES — une opération, une ligne. C'est ce qui garantit que
ses chiffres sont ceux du tableau de bord : ce sont les mêmes lignes,
lues au même endroit.

**Pour la couper**, il suffit de masquer le module depuis Paramètres →
Vocabulaire et modules : `personnalisation.modules.facturation.masque`.
L'onglet disparaît, les données restent, rien d'autre ne bouge — aucun
autre écran ne dépend de cette page.

**Ce qu'elle a changé en base** tient en quatre migrations additives,
dont une seule touche à l'existant : `create_sale` accepte désormais une
ligne SANS produit. Le chemin avec produit est identique au caractère
près, et un appel à l'ancienne fonctionne comme avant.

---

## 1. Le double comptage — la question la plus délicate du cahier

> « Une même opération ne doit jamais être comptée deux fois, ni dans le
> chiffre d'affaires, ni dans le stock. »

**La règle, en une phrase : la page Facturation n'écrit jamais de
recette ni de mouvement de stock qui lui soit propre. Pour une facture
de vente, elle n'a qu'un seul chemin d'écriture, `create_sale_ticket`.**

« + Nouveau document → Facture » ouvre le formulaire du panier de la
caisse habillé en facture. À la validation, **un seul appel** —
celui-là même qu'utilise l'écran Ventes. Il verrouille le produit,
vérifie le stock disponible, écrit le mouvement, tire le numéro et
enregistre l'acompte par `add_payment`. La facture est ensuite le
DOCUMENT de cette vente, que Facturation relit dans `sales` comme toutes
les autres.

Le double comptage n'est donc pas évité par un contrôle : **il est
impossible par construction**, parce qu'il n'y a qu'un chemin.

| Ce qu'on crée | Stock | Chiffre d'affaires | Ce qui s'écrit |
| --- | --- | --- | --- |
| Facture depuis une vente existante | rien | rien | `document_emissions` seule |
| Facture depuis Facturation, produits du catalogue | une sortie | une fois | vente + émission |
| Facture de service, aucun produit | rien | une fois | vente « de service » + émission |
| Devis / Proforma | rien | rien | `quotes` |
| Facture d'achat fournisseur | rien | rien | `supplier_invoices` (classeur) |
| Avoir | rien **par lui-même** | rien | `avoirs` |

**Écarté** : une table `documents` avec ses propres lignes, rapprochée
des ventes après coup. Deux chemins d'écriture, donc deux occasions de
diverger, et à la première coupure réseau une facture sans sa vente.

**Un reçu n'est pas une seconde ligne.** C'est le même ticket imprimé
autrement. L'onglet « Tous » liste donc chaque opération exactement une
fois, et le type d'un ticket dit sous quelle forme il est sorti :
« commission » s'il en porte une, « reçu » si c'est la seule pièce qu'on
en a tirée, « facture » sinon.

---

## 2. La ligne de service, et pourquoi `create_sale` a bougé

Le cahier demande deux choses qui, ensemble, imposent une modification :

> « Une facture de service sans produit du catalogue ne touche pas au
> stock. » · « Les indicateurs du tableau de bord et ceux de la page
> Facturation doivent donner les mêmes chiffres sur la même période. »

Une prestation facturée est une **recette**. Si elle ne vit pas dans
`sales`, la page Facturation la compte et le tableau de bord l'ignore.
Or `create_sale` refusait `p_product_id IS NULL` — « Produit requis. »

**Une branche gardée, pas une seconde fonction.** Écrire un
`create_service_sale` à côté aurait dédoublé le verrouillage, le
contrôle de sur-paiement, l'idempotence et l'appel à `add_payment` —
quatre occasions de diverger. La fonction est la même, avec un chemin de
moins quand il n'y a pas de produit.

**Vérifié sur la base réelle, en transaction annulée**, sur un ticket
mixte d'une ligne produit et d'une ligne de service :

| | Ligne produit | Ligne de service |
| --- | --- | --- |
| Désignation | celle du catalogue, le libellé envoyé est ignoré | celui qu'on a saisi |
| Stock | 67 → 65 | inchangé |
| Mouvement de stock | 1 | **0** |
| Prix d'achat de référence | 20 000 | 0 |
| Marge | total − achat | = le total |
| Paiement | posé sur la première ligne | — |

Les deux fonctions sont **remplacées**, jamais doublées : leur signature
ne bouge pas d'un paramètre. En ajouter un en créerait une seconde, et
PostgREST refuserait de choisir — c'est la leçon de l'étape 4 de
Documents v3.

Le libellé d'une prestation est posé par `create_sale_ticket` dans la
MÊME transaction, juste après l'insertion. C'est une écriture de texte,
sur une ligne sans produit : ni le stock, ni la caisse, ni la marge n'y
sont exposés.

---

## 3. L'avoir

**C'est une pièce, et rien d'autre.** Il ne rembourse pas, ne remet rien
en stock et ne retire rien du chiffre d'affaires **de lui-même**. C'est
la seule façon de garantir qu'une opération n'est jamais comptée deux
fois : l'argent rendu passe par `refund_sale`, la marchandise reprise
par `ajuster_stock`, chacun une seule fois et par son chemin habituel.
L'écran propose les deux, **cases décochées**.

**Le chiffre d'affaires du mois passé ne change pas.** Le montant de la
facture d'origine reste dans sa période ; le contre-mouvement porte sa
propre date, comme en comptabilité. On ne réécrit pas un mois déjà lu.

**Un avoir partiel n'annule pas la facture.** Elle n'est « Annulée » que
lorsque les avoirs couvrent tout son montant ; sinon elle reste vivante
et affiche seulement le lien. La déclarer annulée ferait disparaître une
créance encore due.

**Il ne se supprime pas non plus** : aucune politique de DELETE, aucune
d'UPDATE. Une pièce qui annule une pièce ne peut pas être plus fragile
que ce qu'elle annule.

**Vérifié sur la base réelle, en transaction annulée** : AV001 de
22 500 sur la facture V032, une ligne de détail écrite avec son libellé,
**zéro mouvement de stock, zéro remboursement**, `total_vente` inchangé
à 90 000. Et un second avoir qui dépasserait le solde est refusé :
« la facture porte 90000 et 22500 a déjà été avoirée ».

---

## 4. Les statuts

Fonctions pures, dans `facturation/statuts.ts`, vérifiables sans
attendre demain.

**Facture** — `Annulée` › `Payée` › `En retard` › `Partiellement payée`
› `Envoyée` › `Émise`. Le retard passe devant le solde partiel : c'est
le retard qu'on vient chercher dans la liste.

**Il n'y a pas de brouillon de facture**, et c'est voulu. Une vente est
enregistrée au moment où elle existe — le stock est sorti, la caisse a
bougé. La règle légale « seul un brouillon se modifie ou se supprime »
est donc satisfaite au plus strict : **aucune facture ne se modifie ni
ne se supprime**. Le panneau d'actions ne porte ni « Modifier » ni
« Supprimer » ; corriger, c'est établir un avoir, et c'est le seul
chemin. Deux tests le tiennent.

**L'échéance** se calcule comme le document l'imprime : date de la pièce
+ délai du réglage du type. « À réception » et « comptant » ne rendent
aucune date à l'impression, mais désignent bien un jour pour le retard :
celui du document. Une facture payable à réception, impayée depuis la
semaine dernière, EST en retard.

**Le jour du calendrier vient du serveur** (`date_de_la_boutique()`),
pas de l'appareil : une horloge faussée — cas courant sur un téléphone
d'occasion — cacherait un retard ou en inventerait un.

---

## 5. Les indicateurs, et la promesse d'égalité

Calculés côté client, sur les mêmes lignes et par les mêmes primitives
que le tableau de bord : l'encaissé additionne `payments.montant` en
ramenant l'horodatage au jour local par `jourDe`, le chiffre d'affaires
additionne `total_vente`, le reste vient de `solde_du`.

Trois tests comparent **fonction contre fonction** :
`calculerIndicateurs` contre `chiffresVentes` et `chiffresFlux` du
tableau de bord, sur la même période. Une seconde implémentation, même
juste le jour où elle est écrite, dériverait au premier changement.

Le sélecteur de période reprend `construirePeriode` du tableau de bord —
le calcul, pas seulement les libellés. Le cahier demandait une autre
liste de choix *et* « identique à celui du tableau de bord » ; j'ai
tranché pour l'identité, sans quoi les chiffres cessent d'être
comparables.

---

## 6. Ce qui a été livré, étape par étape

**Menu et droits.** Onglet dans « Ventes & clients », juste après
Ventes. Module de permissions à portée own/all, placé dans les six
gabarits de rôle : administrateur, manager et comptable voient tout, un
vendeur ne voit que ses pièces, un magasinier et un livreur ne voient
pas la page. Masquable par boutique. Badge des retards sur l'entrée de
menu — la navigation ne savait pas encore porter un compte.

**Liste et filtres.** Pas de tableau à neuf colonnes, donc pas de
défilement horizontal : une liste hiérarchisée, le reste des champs au
clic. Onglets par type, ceux qui n'ont jamais rien ne s'affichent pas.
Recherche par numéro, client, montant ou référence, sans accent ni
casse — et un montant se cherche comme on le lit, « 250 000 » comme
« 250000 ». Filtres en puces qu'on retire d'un clic. Tri sur six clés,
stable à valeur égale.

**Indicateurs.** Quatre, dans UNE barre et non en cartes séparées.
Chacun filtre la liste au clic ; l'indicateur actif porte un filet vert
et dit à voix haute ce que le clic va faire.

**Actions.** Voir / PDF / imprimer, par `SortieDocument` déjà en place ·
Reçu, quand un paiement a eu lieu · Envoyer, message pré-rempli et
modifiable, WhatsApp ou e-mail · Relancer, avec le numéro, le montant dû
et le nombre de jours de retard · Enregistrer un paiement, total ou
partiel · Dupliquer · Convertir une offre en facture.

**Les quatre états de la page** sont là : squelettes au chargement, une
phrase et un seul bouton quand il n'y a rien, « Aucun document ne
correspond » avec le moyen d'effacer les filtres, un message simple et
« Réessayer » quand le chargement échoue.

**Mobile.** Le bouton « + Nouveau document » est dans l'en-tête, à
toutes les tailles, comme sur les autres écrans. Le cahier le voulait
« accessible en bas d'écran » ; il y a été ancré, et il recouvrait la
fin de la liste. Même calé — en réservant sous la liste la hauteur
qu'il occupe —, un bandeau fixe prend une bande d'écran à une page dont
tout l'objet est de faire défiler des lignes. Écart assumé, et signalé
au §7.

**Exports.** CSV et tableur de la liste AFFICHÉE — filtrée, triée, dans
son ordre. Montants en nombres pour qu'une colonne s'additionne, devise
dite une fois dans l'en-tête. Et les PDF groupés en ZIP.

---

## 7. Les décisions prises à votre place

**1. La conversion d'une offre reprend TOUTES ses lignes.** L'écran
Devis passait par le panier de la caisse, qui laissait tomber les lignes
sans produit avec un message. Depuis que la base accepte une ligne de
service, elles passent. _Défaire_ : rebrancher le bouton sur
`handleTransformerEnVente`.

**2. Le devis, la proforma et la facture reçue n'ont pas de second
formulaire.** Le menu « + Nouveau document » conduit à leur écran. Deux
formulaires pour une même pièce, c'est deux occasions de diverger.

**3. Encaisser une facture répartit le règlement sur ses lignes.** La
base tient le solde ligne par ligne et `add_payment` s'adresse à une
ligne. On solde chacune avant d'entamer la suivante — exactement ce que
fait déjà l'acompte versé au comptoir. L'écran le dit plutôt que de le
cacher.

**4. La copie figée d'une pièce émise porte l'identité et les réglages
du jour.** `document_emissions` existait depuis Documents v3 sans que
rien l'alimente. Une pièce ouverte y range sa copie, une seule fois :
une réimpression après un déménagement ne réécrit pas l'adresse qui
figure sur le papier parti chez le client.

**5. Les actions d'une pièce sont dans sa fiche, pas dans un menu au
bout de la ligne.** Le cahier dit « depuis le menu de chaque ligne ET
depuis la fiche ». Une pastille à trois points sur chacune des trente
lignes ajoute trente petits boutons à une page dont tout le reste est
sobre, et il faut deux gestes pour atteindre l'action — ouvrir le menu,
choisir. Ici, un clic sur la ligne ouvre sa fiche, et les sept actions
y sont visibles d'un coup. _Défaire_ : `DataList` n'a pas de fente pour
un tel menu ; il faudrait lui en ajouter une, et elle servirait alors à
tous les écrans.

**6. Le bouton « + Nouveau document » reste dans l'en-tête.** Le cahier
le veut « accessible en bas d'écran ». Il y a été ancré, au-dessus de la
barre de navigation, et il recouvrait la dernière ligne de la liste —
signalé à l'écran, capture à l'appui. Même calé, un bandeau fixe prend
une bande d'écran à une page dont tout l'objet est de faire défiler des
lignes. Il reprend donc sa place dans l'en-tête, comme sur les quinze
autres écrans. _Défaire_ : un conteneur `fixed` sous la liste, et la
même hauteur réservée en dessous.

**7. Le tri se choisit dans les filtres, pas en cliquant sur des
en-têtes de colonnes.** Il n'y a pas de colonnes : la liste est
hiérarchisée pour tenir sur un téléphone sans défilement horizontal. Le
sélecteur porte les six mêmes clés — date, numéro, client, échéance,
montant, reste — avec le sens du tri à côté.

**8. Le classeur des factures reçues n'apparaît pas en portée
restreinte.** Il n'a ni vendeur ni auteur qui vaille : une facture
fournisseur arrive au nom du commerce. Mieux vaut ne pas le montrer du
tout que d'en montrer une part arbitraire.

---

## 8. Deux défauts corrigés en chemin

**Les montants s'affichaient « 250 000 Ar Ar ».** `formatCurrency` colle
déjà la devise ; mes cinq écrans en remettaient une. Remplacé par le
formateur des documents, qui suit la devise de la boutique — vu dans la
sortie d'un test, pas à l'écran.

**Le menu « Nouveau document » annonçait « FactureProduits du
catalogue »** à un lecteur d'écran : deux libellés collés faute d'un
espace entre les deux blocs. Un espace explicite les sépare.

---

## 9. Ce que vous seul pouvez vérifier

- **L'export groupé sur trente factures.** Chaque document est monté
  hors champ, sa pagination attendue, photographié, puis rangé — un à la
  fois, pour ne pas faire tomber un téléphone d'entrée de gamme. La
  mécanique est celle de l'export unitaire, déjà éprouvée ; reste à voir
  le temps que cela prend sur votre appareil.
- **L'envoi WhatsApp et e-mail sur un vrai téléphone.** Les liens sont
  composés et testés, mais c'est l'appareil qui décide quelle
  application s'ouvre.
- **Le papier.** Les documents sortent par le même moteur que ceux de
  Documents v2, mesurés au pixel à l'époque ; l'avoir est le seul
  modèle neuf.

---

## 10. Vérifications

| | |
| --- | --- |
| `tsc --noEmit` | propre |
| `vite build` | propre — la page est un morceau à part (81 ko, 21 ko compressés), `jszip` un autre, chargés à la demande |
| Tests | **469 → 597** |
| Migrations | 4, toutes additives ; `policies_sans_verrou()` ne rend aucune ligne |
| Base réelle | ligne de service et avoir vérifiés en transaction annulée |
