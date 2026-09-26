# Documents v3 — journal

## Étape 1 — Identité commune de la boutique (niveau 1)

**Ce qui est fait.** Une identité par boutique, saisie une fois dans
Paramètres → Documents, reprise par la facture, le devis, le reçu et le
bon de commande : contacts répétables (nom, rôle, téléphone, lieu, avec
choix de ceux qui s'impriment et de leur ordre), site web, Facebook,
WhatsApp, Instagram, coordonnées de paiement (Mobile Money répétable,
banque, RIB) et identifiants légaux libres.

**Ce qui n'y est pas, et pourquoi.** Le nom, le sous-titre, l'adresse,
le téléphone, l'e-mail, le NIF/STAT, le taux de TVA et le logo restent
dans les colonnes de `stores`, réglés depuis « Ma boutique ». Les
recopier dans l'identité en ferait deux vérités qui divergeraient au
premier changement. L'écran les rappelle en lecture seule.

**Où c'est rangé.** `stores.personnalisation.documents.identite`, en
jsonb. Aucune migration, aucune colonne, aucune écriture nouvelle :
l'enregistrement reste la fusion existante, qui recopie les autres clés.

**Le rendu ne bouge pas.** Tout est vide par défaut. Une boutique qui ne
saisit rien obtient exactement le document d'avant — vérifié, pas
supposé : les empreintes de `templates/rendu.test.tsx` ont été prises
sur le code modifié, puis rejouées sur le dépôt remisé, et elles
passent à l'identique sur les quatre modèles. Le filet a aussi été vu
tomber, en modifiant volontairement une classe du Classique.

**Où l'identité apparaît.** Les contacts, le site, les réseaux et les
identifiants s'ajoutent aux lignes de l'émetteur, APRÈS l'adresse et le
couple « téléphone · e-mail ». Passer par ces lignes plutôt que par de
nouveaux emplacements évite de toucher aux quatre modèles et au ticket :
ils affichent déjà ce qu'on leur donne. Les coordonnées de paiement,
elles, sont un bloc à part en bas de page — absent du reçu et du ticket,
qui constatent un paiement déjà fait, et absent tant que rien n'est
saisi, sans intitulé orphelin.

**Le logo.** L'import existait déjà (`compressLogo`), avec les initiales
en secours. Seul manquait le SVG : il passe désormais tel quel jusqu'à
100 Ko, au lieu d'être rastérisé à 256 pixels. Au-delà, il repasse par
le canevas — un SVG lourd contient généralement une photographie.

**Tests.** 337 → 358. Nouveaux : `lib/identite.test.ts` (16) et
`templates/rendu.test.tsx` (5, dont les quatre empreintes).

## Étape 2 — Réglages par type, et fin des valeurs codées en dur (niveau 2)

**Ce qui était écrit dans le code est devenu un réglage.** Le titre de
chaque document vivait dans une table `TITRES`, son préfixe dans une
table `PREFIXES`, et son texte de conditions dans trois constantes de
`buildDocument.ts`. Tout cela est dans `typesDocument.ts`, comme
valeurs PAR DÉFAUT d'un réglage — avec exactement les mêmes mots, de
sorte que rien ne bouge tant qu'une boutique n'y touche pas. Les quatre
empreintes de non-régression sont passées sans une modification.

**Ce que la boutique peut régler, par type** : titre imprimé, préfixe
de numérotation, échéance (facture), durée de validité (devis), modèle,
couleur, mot de fin, conditions, pied de page.

**L'héritage.** Un type absent de l'enregistrement n'a pas été
personnalisé : il suit la boutique, et le logiciel pour ce qui lui est
propre. Le bouton « Personnaliser ce document » recopie les valeurs
héritées — on part de ce qu'on voit — et « Revenir aux réglages de la
boutique » retire la clé. À partir de l'ouverture, un champ vidé veut
dire vide, et non « hérité » : sans cela on ne pourrait jamais retirer
un mot de fin. Tout l'ordre de priorité est dans `resolveur.ts`, et
nulle part ailleurs.

**Compatibilité.** `prefixeFacture`, réglé par des boutiques en
service, reste consulté avant le défaut du logiciel : une boutique qui
avait choisi « F- » le garde. Le réglage du type l'emporte quand il
existe.

**L'année dans le préfixe.** « FAC-{AAAA}- » donne « FAC-2026-V026 ».
L'année est celle **du document**, pas celle d'aujourd'hui : une
facture de décembre réimprimée en janvier garde son numéro, sinon le
client appelle avec une référence introuvable.

**Le modèle suit le type.** L'aperçu et la fenêtre d'impression
partaient du modèle de la boutique ; ils partent maintenant de celui du
type, qui reprend celui de la boutique à défaut. Une boutique peut donc
avoir ses devis en épuré et ses factures en classique.

**Trois textes figés en moins.** Les trente jours de validité d'un
devis étaient écrits dans `DevisView`. Le titre, la mention de prix et
le mot de fin du bon de commande fournisseur étaient écrits dans son
composant — qui garde son implémentation d'origine mais lit désormais
les réglages. Son mot de fin reste vide par défaut, et c'est voulu :
« Merci de votre confiance » s'adresse à un client. La boutique peut le
renverser.

**Ce qui n'est pas fait, et pourquoi.** Le « prochain numéro
modifiable » demandé au niveau 2 vit dans `store_counters`, côté
serveur. Le changer demande une fonction que la base n'expose pas, donc
du SQL, donc votre validation. Un champ qui n'écrirait nulle part
serait pire que pas de champ.

**Tests.** 358 → 385. Nouveaux : `lib/typesDocument.test.ts` (20) et
`settings/ReglagesParDocument.test.tsx` (7). Deux d'entre eux ont été
vus tomber — l'héritage du mot de fin du bon fournisseur, et le retrait
d'une clé qui ne doit pas emporter celle des autres types.

## Étape 3 — Éditeur de mise en page (niveau 3)

**Ce que la boutique règle.** Le document est découpé en six zones —
en-tête, informations, client, tableau, totaux, bas de page — et
chaque zone en éléments. Pour chacun : l'afficher ou non, lui donner
son propre mot, le déplacer dans sa zone. Le déplacement se fait au
glisser-déposer à la souris **et** aux flèches au doigt : une poignée
de glissement sur un téléphone se dispute le geste avec le défilement,
et ces réglages se font souvent depuis un téléphone.

**Le catalogue ne contient que ce qui peut s'afficher.** C'est le seul
écart assumé avec le cahier des charges, et c'est une règle que le
dépôt s'était déjà donnée : une remise par ligne, une TVA par ligne,
une miniature de produit, un objet, une référence client, un lieu de
livraison n'existent dans aucune colonne de la base. Un interrupteur
qui ne montrerait jamais rien fait croire que la fonction existe, et
on la cherche. Ces éléments entreront au catalogue avec la donnée ;
le format les accueillera sans migration, puisqu'une clé absente veut
dire « comme prévu ». Même raison pour le QR code et la note au
client. La position du logo, elle, appartient au modèle : c'est lui
qui place l'en-tête, et le changer là serait un cinquième modèle.

**Un élément en plus, qui n'existait pas** : l'unité en colonne à
part, éteinte par défaut. Elle donne à la règle « une colonne vide
partout disparaît » un sujet réel — la case ne porte que l'unité
réellement saisie, et la colonne s'efface du document dont aucune
ligne n'en a. Le réglage, lui, ne bouge pas : le document suivant
l'aura si ses lignes la remplissent.

**Les verrous.** Sur une facture, le numéro, la date, le nom de
l'émetteur et le total ne se masquent pas ; la désignation d'une
ligne et le total ne se masquent nulle part. L'éditeur pose un
cadenas, éteint l'interrupteur et dit pourquoi. Le NIF/STAT reste
allumé par défaut sur la facture, comme avant.

**Deux interrupteurs pour une même ligne, évités.** Les options de
boutique — TVA, NIF, montant en lettres, tampon, signature,
conditions — restent la valeur PAR DÉFAUT des éléments
correspondants ; la mise en page du type l'emporte quand elle dit
quelque chose. C'est la cascade, et non deux réglages qui se
contredisent.

**Un élément masqué ne laisse rien.** Pas de ligne vide, pas
d'intitulé orphelin, pas de colonne vide. La mise en page se branche
sur une règle que les modèles appliquaient déjà — ils n'affichent pas
ce qui vaut `null` — plutôt que d'ajouter des cas particuliers.
`BlocAdresse` a dû apprendre à ne pas poser une balise vide quand son
intitulé ou son nom est masqué.

**Préréglages.** « Par défaut » n'écrit rien du tout. « Minimal »
masque l'accessoire et respecte les verrous. « Complet » allume ce que
la boutique a renseigné, sans dédoubler l'unité. « Revenir au modèle
par défaut » retire la clé du type, et de lui seul.

**Non-régression.** Les quatre empreintes sont passées inchangées
après le remaniement du tableau, des totaux et de l'en-tête — seule
une différence est apparue en chemin, un attribut `class` vide sur une
cellule, corrigée plutôt qu'acceptée. Le filet a fait son travail.

**Tests.** 385 → 415. Nouveaux : `lib/miseEnPage.test.ts` (23) et
`settings/EditeurMiseEnPage.test.tsx` (7). Celui qui garde les
mentions obligatoires a été vu tomber.

## Étape 3 bis — Le SQL, validé et appliqué

Les cinq points en attente sont passés en production le 21/09/2026,
en sept migrations additives. Le détail et les raisons sont dans
`supabase/migrations/`, le récapitulatif dans `sql-propose.sql`.

**Qui règle les documents.** La politique d'écriture de `stores` était
`is_store_member(id)`, et `is_store_member` accepte tout membre dont
le rôle n'est pas « livreur » : un vendeur pouvait donc, en base,
réécrire le modèle de facture de toute la boutique. Rien dans l'écran
ne le proposait ; rien en base ne l'empêchait. Un déclencheur vise
désormais la seule clé concernée — `personnalisation -> 'documents'` —
plutôt que de restreindre l'écriture de toute la ligne, ce qui aurait
coupé tout ce que `stores` porte d'autre. Vérifié sur la base réelle :
le vendeur est refusé, le propriétaire passe.

**La numérotation.** Quatre index uniques `(store_id, numero)` — il
n'y en avait aucun, sur aucune table. Les commandes comptaient les
lignes présentes au lieu de tirer un compteur : une commande
supprimée libérait son numéro, et deux insertions simultanées
posaient le même. Corrigé, sans risque : zéro commande en base. Deux
fonctions nouvelles : tirer un numéro sans insérer de ligne (la
proforma se prévisualise avant d'exister) et reprendre une
numérotation existante — **en avant seulement**, parce que reculer un
compteur ferait ressortir des numéros déjà imprimés chez des clients.

**La proforma** est deux colonnes sur `quotes`, pas une table jumelle :
une proforma EST un devis au mot près, et une table à part aurait
dédoublé les lignes, les politiques, le compteur, l'écran et la
transformation en vente. Chaque type tire son propre compteur.

**La facture d'achat fournisseur** est une table à part, elle. Une
ligne d'achat entre en trésorerie et touche le stock ; une facture
reçue est une pièce, qui peut couvrir dix achats ou aucun. Les
mélanger aurait obligé à toucher aux calculs, ce que cette refonte
n'a pas le droit de faire. Elle n'écrit rien en trésorerie et ne bouge
aucun stock : c'est un classeur.

**La copie figée** d'un document émis vit dans `document_emissions`,
sans politique d'UPDATE ni de DELETE : figé veut dire figé. Une seule
copie par pièce, et pas de clé étrangère vers la vente — une vente
supprimée ne doit pas emporter la preuve de ce qui est parti chez le
client.

**Quatre corrections faites en chemin**, sans attendre :

- le contrôle de sécurité a signalé que les fonctions nouvelles
  étaient appelables par `anon` via l'API REST, Supabase les ouvrant
  par défaut ; les deux fonctions de déclencheur sont fermées aux deux
  rôles, les trois autres à `anon` ;
- la régénération des types TypeScript efface les alias écrits à la
  main en tête de `database.types.ts` (`OrderStatus` et sept autres) :
  recopiés, sans quoi l'application ne compilait plus ;
- deux jeux d'essai de tests ont reçu les deux nouvelles colonnes de
  `quotes` ;
- le premier essai du garde-fou concluait à tort qu'il ne servait à
  rien : `jsonb_set` sur un chemin dont le parent n'existe pas rend
  l'objet inchangé, la mise à jour d'essai ne touchait donc pas la clé
  surveillée. Corrigé l'essai, pas le garde-fou.

## Étape 4 — La facture proforma

**Elle n'a pas d'écran à elle, et c'est le point.** Une proforma est
un devis au mot près : mêmes lignes, même client, même total, même
conversion en vente. Elle vit donc dans la liste des devis, se saisit
dans le même formulaire et se transforme par le même chemin. Un
sélecteur en tête du formulaire dit laquelle des deux on établit, un
filtre sépare les deux séries dans la liste, et une mention grise
marque les proformas — pas une couleur : la couleur est au badge de
statut.

**Ce qui la distingue** tient dans ce que les niveaux 2 et 3 savaient
déjà faire : son titre (« FACTURE PROFORMA »), son préfixe (« PRO- »),
son compteur, ses conditions et sa mise en page. `documentDeDevis`
résout le type de la pièce et laisse la cascade travailler. Trois
mots seulement sont écrits en dur, parce qu'ils décrivent la nature
de la pièce et non un réglage : le bloc client s'intitule « Facturé
à » plutôt que « Devis pour », le montant en lettres dit « la présente
facture » et non « la présente offre », et le total s'annonce
« Total » plutôt que « Montant proposé » — une proforma se présente à
une banque ou à une douane, et « proposé » y affaiblirait le document.

**Convertir en facture en un clic** ne demandait rien de neuf : le
bouton « Transformer en vente » reprend déjà toutes les lignes dans le
panier de la caisse. Il s'intitule « Convertir en facture » sur une
proforma, ce qui est le même geste dit dans la langue du document.

**La durée de validité est figée sur la pièce.** La colonne
`duree_validite_jours` garde ce qui a été promis au moment où la
proforma a été établie : changer le réglage de la boutique demain ne
réécrit pas ce qu'on a annoncé hier. Changer de type en cours de
saisie recalcule la date, sauf si elle a été fixée à la main.

**Les deux fonctions de base ont été remplacées, non doublées.**
Ajouter des paramètres à une fonction PostgreSQL en crée une seconde,
et PostgREST refuse alors de choisir entre les deux. `create_quote` et
`update_quote` sont donc remplacées dans une seule transaction.
Vérifié sur la base réelle, en transaction annulée : une proforma
sort en PRO001, un devis en DEV001 puis DEV002 — deux séries
distinctes — et **un appel à l'ancienne, avec les sept arguments
d'origine, fonctionne toujours** et donne un devis. C'est ce qui
compte pour le navigateur resté ouvert chez le commerçant.

**Deux corrections faites en chemin** : trois libellés du formulaire
de saisie ne désignaient aucun champ (pas de `htmlFor`), ce qui les
rendait muets pour un lecteur d'écran — reliés ; et le nom du
destinataire s'annonçait « Nom sur le devis » même sur une proforma.

**Tests.** 415 → 427. Nouveaux : `lib/proforma.test.ts` (9) et
`DevisView.test.tsx` (3), qui vérifie que le type et la durée
atteignent vraiment la charge utile — s'ils s'arrêtaient en route, la
proforma s'imprimerait en devis sans que rien ne le signale. La
résolution du type a été vue tomber.

## Étape 5 — La facture d'achat fournisseur

**Ce que ce papier est, et ce qu'il n'est pas.** Ce n'est pas la
facture du fournisseur : c'est NOTRE relevé de celle qu'on a reçue. La
distinction n'est pas de forme. Imprimer un document à l'en-tête d'un
tiers, avec son identité et son numéro, reviendrait à fabriquer une
pièce en son nom ; le logiciel n'a pas à le faire, même pour rendre
service. L'en-tête reste donc celui de la boutique, le fournisseur
occupe le bloc d'en face avec son propre numéro fiscal, et le numéro
que portait le papier reçu s'affiche à côté du nôtre. Personne n'y
signe, et l'on n'y indique pas où NOUS payer.

**Elle ne touche à rien.** Ni trésorerie, ni stock, ni achats. Une
ligne d'achat est un mouvement ; une facture reçue est une pièce, qui
peut couvrir dix achats ou aucun, et arriver un mois plus tard. C'est
un classeur : on y range le papier, on le retrouve, on le réimprime.

**Le total est celui du papier.** Il se saisit, il ne se calcule pas :
une facture porte des frais de transport, des arrondis, une remise
négociée au téléphone. L'écran affiche la somme des lignes à côté du
total quand les deux diffèrent, propose de la reprendre d'un clic, et
laisse la personne trancher. Un écart n'est pas une erreur.

**Où il vit.** Pas dans la navigation : on y entre par un bouton de
l'écran Achats — là où l'on pense au fournisseur — et l'on en revient
par la flèche de son en-tête. C'est le même chemin que les autres
écrans secondaires de l'application, et cela évite d'ajouter un
module, ses permissions et ses six gabarits de rôle pour un classeur.
Il hérite des droits du module Achats.

**L'original** part dans le seau `documents`, déjà privé et cloisonné
par boutique. Une photo est réduite avant l'envoi — un commerçant
photographie sa facture au téléphone — un PDF part tel quel. La pièce
ne s'ouvre que par une adresse signée, valable une heure.

**La facture et ses lignes s'écrivent ensemble**, par une fonction de
la base : deux appels depuis le navigateur laisseraient, à la première
coupure de réseau, une facture sans son détail. Vérifié sur la base
réelle, en transaction annulée : FA001 puis FA002, une modification
qui passe de une à deux lignes et de 450 000 à 460 000 — tout annulé
ensuite.

**Une correction faite en chemin** : le type `SettingsTab` déclarait
`"documents"` deux fois. C'était le dernier résidu du doublon d'onglet
parti en production la séance précédente ; TypeScript le tolérait en
silence.

**Tests.** 427 → 442. Nouveaux : `lib/factureAchat.test.ts` (11) et
`FacturesAchatView.test.tsx` (4), qui tient la promesse la plus
coûteuse à casser — le total saisi n'est jamais remplacé par la somme
des lignes. Le calcul du reste a été vu tomber.

## Étape 6 — La facture de service avec commission

**Une phrase tient tout le reste : la commission est une PART du
total, pas un supplément.** `total_vente` ne bouge pas d'un ariary —
la commission est ce que la boutique garde sur ce que le client paie,
comme la TVA est une part du prix payé. Ni la caisse, ni la marge, ni
le stock ne s'en aperçoivent, et **`create_sale` n'a pas été touché**,
ce qui était la condition. Détailler la commission revient donc à
détailler un total, jamais à le refaire : la ligne « Prestation »
montre `total − commission`, la ligne « Commission » montre le reste,
et les deux se rejoignent sur le total d'avant.

**Le mode d'affichage est un réglage du type** : détaillée, ou
comprise dans le prix des lignes. Vérifié à l'écran sur les deux
modes — 262 500 + 45 000 = 307 500 d'un côté, rien de l'autre, et le
même total en bas dans les deux cas.

**Le type « commission » ne s'invite pas.** Une facture ne devient
« avec commission » que si la vente en porte une. Une boutique qui
n'en saisit jamais ne voit pas ce type exister : ses factures sortent
exactement comme avant, et les empreintes de non-régression n'ont pas
bougé. Le reçu, lui, constate un paiement et ne détaille rien.

**Où la commission se saisit.** Sur une vente déjà enregistrée, par
un bouton de l'écran Ventes — pas au moment de la vente, parce que
cela aurait demandé de toucher `create_sale`. La fonction refuse une
commission négative ou supérieure au total du ticket, et remet à zéro
les autres lignes du ticket : le document additionne, et deux lignes
porteuses la compteraient deux fois. Vérifié sur la base réelle, en
transaction annulée : total avant 80 000, après 80 000, commission
8 000, montant excessif et montant négatif refusés.

**Deux réglages, et ils ne font pas double emploi** : celui du TYPE
décide si l'on détaille, celui de la MISE EN PAGE décide quelles
lignes du détail s'affichent et sous quels mots — une boutique peut
ne montrer que sa commission, sans la part reversée.

**Une lacune comblée en chemin** : l'écran de réglages ne proposait
que cinq types. La proforma et la facture d'achat, livrées aux étapes
précédentes, n'y étaient pas — on ne pouvait donc régler ni leur
titre, ni leur préfixe. Les huit types disponibles y sont maintenant.

**Tests.** 442 → 452. Nouveau : `lib/commission.test.ts` (10), dont le
premier vérifie qu'une vente sans commission ne change rien, et le
plus important que `prestation + commission === total`.

## Après la mise en ligne — l'aperçu ne montrait qu'une facture

Signalé à l'écran : « l'aperçu direct dans la modification de facture
dans paramètres documents ne marche pas encore ». Reproduit sur un banc
qui rend l'écran réel avec une vraie vente.

**Ce qui se passait.** L'aperçu fonctionnait — le titre, les libellés
et les éléments masqués s'y répercutaient bien — mais il était posé
tout en bas de la page, APRÈS les réglages du ticket, et il montrait
toujours une FACTURE. On pouvait donc régler le devis, la proforma ou
la facture reçue sans jamais rien voir bouger : la feuille affichée
n'était pas celle qu'on réglait.

**Ce qui a été fait.** L'aperçu suit désormais le document choisi dans
« Document à régler », et il est posé juste sous ce choix, au-dessus
des champs qu'on manipule. Le type réglé est tenu par l'écran parent,
qui construit le document : c'est la seule façon pour que les deux
parlent de la même pièce.

**D'où viennent les chiffres.** Toujours de la dernière vente réelle de
la boutique, jamais d'un exemple. Pour les documents qui ne naissent
pas d'une vente — devis, proforma, bon de commande, facture reçue — ses
lignes sont REPRÉSENTÉES sous cette forme, et une phrase sous le
document le dit. C'est un changement de forme, jamais de chiffre :
un test vérifie que le total est le même sous les six formes.

**La commission ne s'invente pas.** Tant qu'aucune vente n'en porte, son
aperçu montre une facture ordinaire et l'annonce. En attribuer une
d'office afficherait une part que la boutique n'a jamais encaissée.

**Un éditeur qui n'allumait rien.** Le bon de commande fournisseur garde
l'implémentation de la v1 : il lit le titre, le préfixe et le mot de
fin, mais pas la mise en page. On lui proposait pourtant l'éditeur
complet, dont aucun réglage n'aurait eu d'effet. Il est retiré pour ce
seul type, avec la phrase qui explique pourquoi.

**Tests.** 452 → 469. Nouveau : `lib/apercuDesReglages.test.ts` (16),
mis en défaut volontairement avant d'être gardé — en faisant ignorer le
type au constructeur, 14 des 16 tombent.

## Éditeur visuel libre et cachets (cahier « éditeur visuel + cachet »)

**Mode libre.** Chaque bloc (logo, nom, repères, client, tableau, totaux,
signatures, pied…) se pose en millimètres sur l'A4, à partir des
positions d'un des quatre modèles. Rangé dans
`personnalisation.documents.libre` (`dispositions` + `parType`), sans
migration. Le mode simple reste le défaut ; une boutique sans
disposition garde un rendu identique (testé).

**Décisions.** Moteur maison sur Pointer Events (pas de bibliothèque de
canevas : le PDF photographie du HTML). Aimantation aux marges, au
milieu et aux autres blocs ; pas de grille de 1 mm, qui aurait contredit
le placement « au pixel ». Ticket en colonne (ordre des sections).
Mentions obligatoires : déplaçables, jamais masquables, au premier plan.

**Pagination libre.** Tout tient dans le cadre du tableau : une page.
Sinon la page 1 garde les blocs posés au-dessus du tableau, les
suivantes continuent le tableau, la dernière reçoit les blocs posés
dessous ; les blocs « répétés » sont sur toutes. Voir `paginationLibre.ts`.

**Cachets.** Seau privé `cachets` (dépôt réservé à ceux qui règlent les
documents, ni remplacement ni suppression). Fond retiré sur le
téléphone, dans un Web Worker, sans service externe (`fondCachet.ts`).
Un cachet placé est un bloc de plus, entre le texte et les mentions
obligatoires ; ses images sont chargées avant toute capture PDF.

**Copie figée.** Version 2 : les réglages entiers réduits à la pièce,
disposition et cachets compris, et les champs texte de la boutique.
Relue à la réimpression dans Facturation, seul écran qui enregistre les
émissions. Les copies de version 1 se relisent en mode simple, puisqu'elles
précèdent le mode libre.

**Le logo, figé sans être recopié.** Il pèse jusqu'à 2 Mo en base64 dans
`stores.logo_url` : chaque version est rangée une seule fois dans le seau
`logos`, sous `<boutique>/<empreinte SHA-256>.<ext>` (dépôt et lecture
par les membres, ni remplacement ni suppression), et la copie ne garde
que ce chemin. L'envoi part en arrière-plan après une vérification de
présence ; à la relecture, l'empreinte du fichier est contrôlée. Une
pièce émise sans logo se réimprime avec ses initiales ; une copie qui ne
dit rien du logo (antérieure, ou fichier introuvable) reprend celui du
moment.
