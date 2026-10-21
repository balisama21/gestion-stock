# Faire apparaître Tantana Suite et Kinvest sur Google

Le site est prêt côté code : chaque domaine sert ses propres titre, description,
adresse canonique, image de partage, données structurées, `robots.txt` et
`sitemap.xml`. Il reste à **présenter les deux domaines à Google**, ce qui ne
peut se faire que depuis votre compte Google. Comptez une demi-heure, puis
quelques jours à quelques semaines avant d'apparaître dans les résultats.

> Faites ces étapes **après** la mise en ligne de la PR (fusion sur `main`,
> déploiement Netlify terminé).

## 0. Vérifier que tout est en ligne (2 minutes)

Ouvrez ces adresses dans le navigateur ; chacune doit afficher un petit texte :

- https://tantana-suite.com/robots.txt → se termine par
  `Sitemap: https://tantana-suite.com/sitemap.xml`
- https://tantana-suite.com/sitemap.xml
- https://mg-kinvest.com/robots.txt → se termine par
  `Sitemap: https://mg-kinvest.com/sitemap.xml`
- https://mg-kinvest.com/sitemap.xml

## 1. Google Search Console : ajouter chaque domaine

Search Console est l'outil gratuit de Google pour dire « ce site est à moi,
voici ses pages ».

1. Allez sur https://search.google.com/search-console et connectez-vous avec
   votre compte Google.
2. Cliquez sur **Ajouter une propriété**, choisissez **Domaine** (à gauche) et
   saisissez `tantana-suite.com` (sans `https://`, sans `www`).
3. Google affiche un enregistrement **TXT** du genre
   `google-site-verification=xxxxxxxx`. Copiez-le.
4. Chez **Porkbun** (là où est le DNS de tantana-suite.com) : _Domain
   Management_ → `tantana-suite.com` → **DNS** → ajoutez un enregistrement :
   - Type : `TXT`
   - Host : laissez vide (racine du domaine)
   - Answer : collez la valeur `google-site-verification=…`
5. Revenez dans Search Console et cliquez sur **Valider**. Si Google dit que
   l'enregistrement est introuvable, réessayez 10 à 30 minutes plus tard.

Recommencez pour **`mg-kinvest.com`**, en ajoutant le TXT là où est géré le DNS
de mg-kinvest.com (chez le registrar du domaine Kinvest). Si c'est le client
qui gère ce DNS, envoyez-lui la valeur TXT à ajouter.

> Autre méthode possible pour mg-kinvest.com si vous n'avez pas accès à son DNS :
> propriété de type **Préfixe d'URL** (`https://mg-kinvest.com/`) — mais elle
> demande un fichier ou une balise à poser sur le site ; le TXT est plus simple.

## 2. Soumettre le sitemap de chaque domaine

Dans Search Console, sélectionnez la propriété (en haut à gauche), puis menu
**Sitemaps** :

- pour `tantana-suite.com`, saisissez `https://tantana-suite.com/sitemap.xml` ;
- pour `mg-kinvest.com`, saisissez `https://mg-kinvest.com/sitemap.xml`.

Cliquez sur **Envoyer**. L'état passe à « Opération réussie » en quelques
minutes ou heures.

## 3. Demander l'indexation de la page d'accueil

Toujours dans Search Console, pour chaque propriété :

1. Collez l'adresse de la page d'accueil (`https://tantana-suite.com/`, puis
   `https://mg-kinvest.com/`) dans la barre **Inspecter une URL** tout en haut.
2. Cliquez sur **Tester l'URL en ligne** : vous devez voir « L'URL est
   disponible pour Google ». Dans **Afficher la page testée → Capture
   d'écran**, vérifiez que la page Kinvest montre bien Kinvest, et la page
   Tantana bien Tantana.
3. Cliquez sur **Demander une indexation**.

Ensuite, patience : la première apparition prend en général de quelques jours
à deux ou trois semaines. Pour vérifier, tapez dans Google
`site:mg-kinvest.com` ou `site:tantana-suite.com`.

## 4. (Recommandé) Fiche Google Business Profile pour K Invests

C'est ce qui fait apparaître K Invests sur **Google Maps** et dans l'encadré à
droite quand on cherche « emballage Moroni ». C'est le levier le plus fort pour
un commerce local — souvent plus que le site lui-même.

Idéalement, c'est **le client** qui crée la fiche avec son propre compte Google
(il en restera propriétaire), et vous ajoute comme gestionnaire.

1. https://business.google.com → **Gérer maintenant**.
2. Nom : `K Invests Services & Concepts` (le nom réel de l'entreprise).
3. Catégorie : « Fournisseur d'emballages » (ou « Magasin d'emballages »).
4. Adresse à Moroni (ou zone desservie si pas d'accueil du public), téléphone
   `+269 334 03 57`, site web `https://mg-kinvest.com`.
5. Google demande une **validation** (appel, SMS, vidéo ou courrier selon le
   pays) : suivez ses instructions.
6. Ajoutez des photos des produits, les horaires, et une courte description.

## 5. (Facultatif) Bing

Bing (et donc aussi DuckDuckGo et Ecosia) a son équivalent :
https://www.bing.com/webmasters → **Importer depuis Google Search Console**.
Deux clics une fois l'étape 1 faite.

## Ce qui aide ensuite

- **Des liens vers les sites** : réseaux sociaux de l'entreprise (page
  Facebook K Invests, LinkedIn Tantana…) avec l'adresse du site dans la bio,
  annuaires d'entreprises locaux, partenaires.
- **La fiche de marque Kinvest** (table `branding` dans Supabase) : son
  `page_title` et le `sousTitre` de sa page d'accueil (`landing`) sont
  exactement le titre et la description que Google affiche. `page_title` vide
  donne « Kinvest — Emballages et packaging, avec ou sans personnalisation ».
- **Tester un aperçu de partage** : collez l'adresse dans WhatsApp ou sur
  https://www.opengraph.xyz pour voir l'image et le texte qui s'affichent.

## Ce que fait le code (pour mémoire)

| Élément                | tantana-suite.com                                           | mg-kinvest.com                                   |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Titre                  | Tantana Suite — Logiciel de gestion de stock…               | Kinvest — Emballages et packaging…               |
| Description            | texte fixe (`lib/seo.ts`)                                   | accroche de la page d'accueil Kinvest            |
| Canonical              | https://tantana-suite.com/                                  | https://mg-kinvest.com/ (même depuis `www.`)     |
| Données structurées    | Organization + WebSite + SoftwareApplication                | LocalBusiness (Moroni) + WebSite, avec catalogue |
| `robots.txt` / sitemap | générés par `server.ts`, propres au domaine                 | idem                                             |
| Pages privées          | `/reset-password`, `/accept-invite` en `noindex`            | idem                                             |
| Aperçus Netlify        | `noindex` + `robots.txt` fermé, canonical vers le vrai site | —                                                |
