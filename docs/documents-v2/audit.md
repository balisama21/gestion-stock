# Documents v2 — Audit (phase 0)

Relevé de l'existant, avant toute modification. Aucun fichier de
l'application n'a été touché, aucune requête d'écriture n'a été émise.
Les lectures en base sont des `SELECT` sur le projet de production
`jasyacrnpimgwapcjkpr`.

---

## 1. La génération actuelle des documents

### Le moteur

Tout passe par **`src/lib/documentExport.ts`**, un seul module :

| Fonction | Rôle | Bibliothèque |
| --- | --- | --- |
| `capturer(el)` | photographie un nœud DOM en canevas, à 3× (~220 ppp sur A4) | `modern-screenshot` (`domToCanvas`), importée à la demande |
| `exporterPdf(el, paper, nom)` | pose la capture dans une page au format choisi | `jspdf`, importée à la demande |
| `exporterImage(el, nom, type)` | la même capture en PNG/JPG | — |
| `imprimerDocument(paper)` | injecte une règle `@page` puis `window.print()` | navigateur |
| `nomDeFichier(...)` | nom de fichier sans caractère interdit | — |

**Le PDF est une image, pas du texte.** C'est un choix documenté dans le
fichier : la version précédente redessinait la facture en coordonnées
jsPDF, ce qui créait une seconde mise en page qui divergeait de
l'aperçu (l'exemple cité : l'espace fine insécable `U+202F` des
milliers, tronquée en `/`, donnait « 6/500 Ar »). Le choix de la
photographie garantit la fidélité mais coûte la sélection du texte et
quelques centaines de kilooctets.

Ni `html2canvas`, ni `react-to-print` ne sont utilisés.

### Le CSS d'impression

`src/styles.css` :

- bloc `@media print` (≈ l. 540-690) : tout ce qui n'est pas
  `.app-modal-overlay` est masqué, puis à l'intérieur tout est
  `visibility: hidden` sauf `.printable-receipt` et ses descendants ;
- `thead { display: table-header-group }` et `tfoot { table-footer-group }`
  sont **déjà en place** — l'en-tête de tableau se répète ;
- `break-inside: avoid` sur les enfants directs qui ne sont pas un
  tableau, sur `tr`, `thead`, `tfoot`, `img` ;
- `.printable-receipt` (l. 1369) redéfinit les jetons de thème sur des
  valeurs « papier », pour qu'un document reste noir sur blanc en mode
  sombre.

Il n'y a **pas** de `@page` statique : la taille est injectée à la volée
par `imprimerDocument`, et retirée juste après. Raison documentée : une
page nommée provoquait une page blanche en tête.

### Les points d'appel (9 documents + 1)

| Fichier | Ligne | Document |
| --- | --- | --- |
| `src/components/VentesView.tsx` | 1530 / 1660 | reçu ticket / facture A4 |
| `src/components/AchatsView.tsx` | 1506 / 1612 | reçu d'achat / bon A4 |
| `src/components/DepensesView.tsx` | 557 / 643 | reçu de dépense / fiche A4 |
| `src/components/VendeursView.tsx` | 954 / 1111 | état vendeur ticket / A4 |
| `src/components/devis/DocumentDevis.tsx` | 137 | devis A4 |
| `src/components/produits/BonDeCommande.tsx` | 246 | bon de commande fournisseur (corrigé le 21/09) |

Tous suivent le même patron : un `useRef` sur le nœud, un `<select>` de
`PAPER_FORMATS` dans l'en-tête de `Modal`, trois boutons en pied
(Imprimer / Image / PDF), et `style={{ maxWidth: paper.previewWidth }}`
sur un bloc `w-full`.

> **Défaut connu, non corrigé, présent sur les 9 premiers.** Le nœud est
> en `w-full` plafonné par `maxWidth` : sur un téléphone il est rendu à
> ~320 px, et `capturer()` le photographie à cette largeur-là. Le PDF
> sort avec les colonnes écrasées. Seul `BonDeCommande.tsx` force
> désormais la largeur papier le temps de la capture (commit `bb152b0`).
> La v2 fait disparaître le problème par construction : le document est
> une feuille `210mm` mise à l'échelle par `transform`, jamais
> reflowée.

### Comment on y arrive depuis les écrans

- **Ventes** : bouton « reçu » sur une ligne → `setSelectedReceiptSale`
  → modale. `ventesRecu` permet de passer les lignes d'un ticket qui
  vient d'être créé.
- **Commandes** : **aucune impression aujourd'hui.** `CommandesView.tsx`
  ne contient ni `Printer`, ni `exporterPdf`. Le bon de commande client
  est un document entièrement neuf.
- **Devis** : `DocumentDevis.tsx`, ouvert depuis `DevisView`.
- **Carte Stock du tableau de bord** : « Préparer la commande » ouvre le
  panneau des ruptures ; « Télécharger la liste » ouvre
  `BonDeCommande` (`BalsamaApp.tsx:1588`, `:2142`).

---

## 2. Le ticket de caisse actuel

Il existe. `src/lib/paperFormats.ts` définit cinq formats :

| id | Papier | Marge | `previewWidth` | Disposition |
| --- | --- | --- | --- | --- |
| `a4` | 210 × 297 mm | 12 | 703 px | `invoice` |
| `a5` | 148 × 210 mm | 10 | 484 px | `invoice` |
| `letter` | 216 × 279 mm | 12 | 726 px | `invoice` |
| `t80` | 80 mm × auto | 3 | 280 px | `ticket` |
| `t58` | 58 mm × auto | 2 | 204 px | `ticket` |

La hauteur d'un rouleau est `null` : `exporterPdf` fabrique alors une
page à la hauteur exacte du contenu. `paperFromLegacyFormat` traduit
l'ancienne préférence « ticket | facture » vers `t80 | a4`.

Le gabarit ticket est écrit en dur dans `VentesView.tsx` (l. 1530-1655) :
en-tête centré, séparateurs pointillés, désignation en pleine largeur
avec `qté × PU` en dessous, total, badge de statut, message de pied.
**Pas de code-barres, pas de mention « ticket non valable comme
facture »**, pas d'heure (seulement la date).

Aucune imprimante thermique n'est pilotée directement : c'est
l'impression navigateur, avec `@page { size: 80mm auto }`.

---

## 3. L'écran Paramètres

### Structure

`src/components/ParametresView.tsx` (1171 l.) rend
`src/components/settings/SettingsLayout.tsx`, qui porte un type
`SettingsTab` (union de 13 chaînes) et deux groupes :

- **Personnel** — compte, sécurité, notifications, préférences
  (`ownerOnly: false`)
- **Boutique** — boutique, **facture**, champs, catégories, vocabulaire,
  rappels, alertes-stock, équipe, paiement (`ownerOnly: true`)

Pas de route : l'application entière est une seule route, les écrans
sont commutés par `activeTab` dans `BalsamaApp.tsx`. Un onglet de
réglages est un simple état local, avec `sectionInitiale` en entrée.

L'onglet **« Reçus et factures »** existe déjà :
`src/components/settings/InvoiceSection.tsx`, adossé à
`src/lib/invoicePrefs.ts` — **stockage `localStorage`, pas la base**.
Neuf booléens (`showLogo`, `showAddress`, `showPhone`, `showEmail`,
`showNif`, `showSeller`, `showTva`, `showFooter`) plus `defaultFormat`.
Le fichier assume que ces réglages ne suivent pas d'un appareil à
l'autre.

### Comment une valeur de boutique s'enregistre aujourd'hui

Deux chemins, tous deux vers `useWorkspace.updateStore` :

1. **Colonnes nommées** — `handleUpdateSettings` dans
   `BalsamaApp.tsx:584` traduit `Partial<StoreSettings>` en colonnes
   (`storeName → name`, `nifStat → nif_stat`, …) puis appelle
   `workspace.updateStore(id, updates)`.
2. **`personnalisation`** — `handleSavePersonnalisation`
   (`BalsamaApp.tsx:323`) : `updateStore(id, { personnalisation: p })`.

`updateStore` (`src/hooks/useWorkspace.ts:264`) refuse d'avance si la
boutique est verrouillée, puis `supabase.from("stores").update(...)
.eq("id", storeId).select("*").single()` et met à jour l'état local.
**C'est le service à réutiliser** — pas d'appel Supabase direct depuis
la nouvelle section.

---

## 4. `stores.personnalisation`

Colonne `jsonb`, non nulle, défaut `{}`. Contenu réel en production :

| Boutique | Contenu |
| --- | --- |
| **Ma Boutique** (la vôtre) | `{"modules": {}, "rappels": {"veilleHeure": 0, "memeJourMinutes": 5}}` |
| TROPIC VISION Mangarivotra | `{}` |
| Boutique | `{}` |
| Boutique de Zomahefa | `{}` |
| Ma boutique | `{}` |

- **Lecture** : `lirePersonnalisation()` dans `src/lib/personnalisation.ts`,
  appelée une seule fois dans `BalsamaApp.tsx:318`, puis diffusée par
  `contextePersonnalisation`. Lecteurs : `Header`, `DashboardView`,
  `navigation.tsx`, `RappelsView`, `PageHeader`,
  `useDashboardPermissions`.
- **Écriture** : deux sections seulement, `VocabulaireSection.tsx` et
  `RappelsSection.tsx`. **Toutes deux fusionnent déjà**
  (`const suite = { ...personnalisation }` puis modification d'une seule
  clé) — le précédent existe, il suffit de le suivre.

⚠️ `lirePersonnalisation()` **ne recopie que `modules` et `rappels`** :
une clé `documents` ajoutée en base serait effacée à l'aller-retour
lecture → écriture. Il faudra étendre cette fonction (fichier
applicatif, pas de SQL).

---

## 5. La numérotation

`public.next_store_counter(p_store_id uuid, p_counter_type text)` :
un `INSERT … ON CONFLICT DO UPDATE SET current_value = current_value + 1
RETURNING`, sur la table `store_counters (store_id, counter_type,
current_value)`. Atomique.

Chaque table a son trigger `BEFORE INSERT` qui pose le numéro **si
`numero IS NULL`** :

| Table | Fonction | Format | Compteur |
| --- | --- | --- | --- |
| `sales` | `assign_sale_numero` | `V` + 3 chiffres → `V026` | `sale` |
| `quotes` | `assign_quote_numero` | `DEV001` | `quote` |
| `purchases` | `assign_purchase_numero` | `ACH004` | `purchase` |
| `payments` | `assign_payment_numero` | `PAY045` | `payment` |
| `products` | `assign_product_numero` | `P034` | `product` |
| `expenses` | `assign_expense_numero` | `DEP005` | `expense` |
| `deliveries` | `assign_delivery_numero` | `LIV001` | `delivery` |
| `taches` | `assign_tache_numero` | `TAC001` | `tache` |
| salaires | `tenir_le_paiement_de_salaire` | `SLD` / `AVS` | `solde_salaire` / `avance_salaire` |

**Exception : `orders`.** Le trigger `orders_set_numero` appelle
`set_order_numero`, qui **n'utilise pas le compteur** :

```sql
NEW.numero := 'CMD-' || LPAD((SELECT COUNT(*) + 1 FROM orders WHERE store_id = NEW.store_id)::TEXT, 5, '0');
```

Deux conséquences : le format diffère (`CMD-00001` sur 5 chiffres, avec
un tiret), et un comptage de lignes se répète dès qu'une commande est
supprimée. Il n'y a **aucune commande en base** aujourd'hui (0 lignes),
donc aucun dégât constaté. → proposition écrite dans
`sql-propose.sql`, **non exécutée**.

**Ce qui sert de numéro de facture : `sales.numero`** (`V026`). Il n'y a
pas de champ « numéro de facture » distinct. Le préfixe réglable de la
maquette (`FAC-`) doit donc **habiller** ce numéro à l'affichage, pas le
remplacer — sans quoi le document ne serait plus retrouvable depuis la
liste des ventes.

---

## 6. Les données d'une vente

`sales` porte **une ligne par produit**. Les lignes passées ensemble au
comptoir partagent `sales.ticket_id` (uuid, `null` pour les ventes
enregistrées avant l'étape 6). Le regroupement est déjà fait dans
`VentesView.tsx:183` :

```ts
const ticket = selectedReceiptSale.ticketId;
if (!ticket) return [selectedReceiptSale];
const lignes = sales.filter((v) => v.ticketId === ticket);
```

et les totaux additionnés ligne à ligne (`totalVente`, `montantPaye`,
`soldeDu`) dans `totauxRecu`.

**Commande** : `orders` + `order_items` (`designation`, `quantite`,
`prix_vente_unit`, `total_vente`). Chargées ensemble dans
`useStoreData.ts:713` : `.select("*, client:clients(*), items:order_items(*)")`
— le client est **déjà joint**.

**Devis** : `quotes` + `quote_items` (`designation`, `quantite`,
`prix_unitaire`, `total`, `ordre`).

---

## 7. Le client

`clients` : `nom, prenom, entreprise, adresse, ville, pays, telephone,
email, note, type_client, statut, champs_perso (jsonb)`.

**Écart majeur avec la maquette.** La facture actuelle n'imprime que
`sale.clientCredit`, un **texte libre**, jamais la fiche liée
(`sale.clientId`). Les champs adresse, ville, entreprise, téléphone
existent en base et **ne sortent nulle part sur le papier**. Le devis
n'imprime que `quotes.client_nom`, pareil.

Sans client : `selectedReceiptSale.clientCredit || "Client comptoir"`
sur la facture, `|| "Comptoir"` sur le ticket. Le document s'imprime
normalement. La v2 garde ce comportement, en réduisant le bloc.

Les fiches clients sont déjà disponibles dans `VentesView` (prop
`clients`), il suffit de résoudre `clientId`.

---

## 8. Les paiements

Trois sources, selon le document :

| Document | Déjà payé | Reste |
| --- | --- | --- |
| Vente | somme des `sales.montant_paye` du ticket | somme des `sales.solde_du` |
| Commande | `orders.montant_paye` | `orders.reste_a_payer` |
| Achat | `purchases.montant_paye` | `purchases.solde_du` |

Le **mode de paiement** n'est pas sur la vente : il vit dans
`payments.methode`, avec `payments.sale_id` ou `payments.order_id`. La
table entière de la boutique est déjà chargée
(`useStoreData.ts:727`), donc le dernier règlement se retrouve sans
requête supplémentaire. `payments` porte aussi `montant`, `reference`,
`numero` (`PAY045`), `created_at`.

Le statut affiché aujourd'hui est recalculé à l'écran :
`du <= 0 ? "Payé" : paye > 0 ? "Partiel" : "Impayé"`. La colonne
`sales.statut_credit` existe aussi ; la v2 reprendra **le même calcul
que l'écran Ventes**, pour que les deux ne divergent pas.

---

## 9. Les permissions

Deux mécanismes distincts, et la maquette suppose le mauvais :

- **`store_members.permissions`** (jsonb) → `PermissionsMap` normalisée
  par `src/lib/permissions.ts`. Le module `settings` n'a **qu'une seule
  action : `edit_own_profile`**. Il n'y a pas de droit « settings en
  écriture ».
- **`isOwner`** = `activeStore.owner_id === user.id`
  (`useWorkspace.ts:178`). C'est **lui seul** qui ouvre les onglets
  `ownerOnly` de `SettingsLayout`.

→ **La règle applicable est donc : seul le propriétaire voit
Paramètres → Documents.** C'est aussi cohérent avec la barrière en base
(policy `proprietaire_dune_boutique_ouverte` sur `stores`) : un
collaborateur qui verrait l'écran se heurterait à un refus silencieux
au moment d'enregistrer.

Pour **imprimer**, aucun droit spécifique : qui voit une vente peut
ouvrir son reçu. La visibilité des ventes est déjà filtrée en amont
(portée `own` / `team` / `all`).

---

## 10. Élément du document → source → état

| Élément | Source | État |
| --- | --- | --- |
| Nom de la boutique | `stores.name` | ✅ |
| Sous-titre | `stores.subtitle` | ✅ (à masquer si vide) |
| Logo | `stores.logo_url` | ✅ |
| Initiales de repli | — | ❌ à calculer depuis `name` |
| Adresse / téléphone / e-mail | `stores.address/phone/email` | ✅ |
| Ville, code postal | — | ❌ **absent** : l'adresse est un seul texte libre |
| NIF | `stores.nif_stat` | ⚠️ **un seul champ pour NIF *et* STAT**, la maquette en montre deux |
| Taux de TVA | `stores.tva_rate` | ✅ (20 % chez vous, 0 ailleurs) |
| Symbole monétaire | `stores.currency_symbol` | ✅ (`Ar`) |
| Message de bas de ticket | `stores.receipt_footer` | ✅ |
| Numéro de facture | `sales.numero` | ✅ (préfixe à habiller) |
| Numéro de devis | `quotes.numero` | ✅ |
| Numéro de commande | `orders.numero` | ⚠️ format `CMD-00001`, mécanisme à part |
| Date | `sales.date` / `orders.created_at` / `quotes.date` | ✅ |
| Échéance de facture | — | ❌ **aucune colonne** → réglage de boutique, calculé à l'affichage |
| Validité du devis | `quotes.valide_jusqu_au` | ✅ |
| Livraison prévue (commande) | `orders.date_livraison` | ✅ |
| Livraison souhaitée (fournisseur) | — | ❌ saisie à l'écran, non enregistrée |
| Vendeur | `sales.vendeur` | ✅ |
| Client (nom libre) | `sales.client_credit` | ✅ |
| Client (fiche) | `sales.client_id` → `clients` | ⚠️ existe, **jamais imprimé** |
| Lignes de vente | `sales` du même `ticket_id` | ✅ |
| Lignes de commande | `order_items` | ✅ |
| Lignes de devis | `quote_items` | ✅ |
| Unité | `products.unite` | ✅ |
| Référence produit | `products.numero` | ✅ |
| Sous-total | somme des lignes | ✅ |
| Remise | — | ❌ **aucune colonne de remise** sur `sales` ni `orders` |
| TVA | `stores.tva_rate` | ✅ |
| Total | `sales.total_vente` / `orders.montant_total` | ✅ |
| Déjà payé / reste | `montant_paye` / `solde_du` / `reste_a_payer` | ✅ |
| Acompte de commande | `orders.montant_paye` | ✅ |
| Mode de paiement | `payments.methode` (dernier) | ✅ |
| Montant en lettres | — | ❌ **à écrire**, rien n'existe |
| Fournisseur (fiche) | `suppliers` | ✅ (`nom, entreprise, adresse, ville, telephone, numero_fiscal`) |
| Fournisseur (texte libre) | `purchases.fournisseur` | ✅ |
| Prix d'achat | `products.prixAchat` | ✅ |
| Code-barres du ticket | `sales.numero` | ❌ à générer (CSS ou petite lib) |
| Mentions légales | réglage | ❌ à créer dans `personnalisation.documents` |
| Polices Onest / JetBrains Mono / Source Serif 4 | — | ❌ **aucune police locale** dans le projet |

---

## 11. Ce qui manque et comment je compte le combler

Sans aucun changement de schéma :

1. **Échéance** — réglage de boutique (`a_reception`, `sous_15_jours`,
   `sous_30_jours`, `comptant`), date calculée à l'affichage depuis la
   date de vente. Rien n'est écrit.
2. **NIF et STAT séparés** — `stores.nif_stat` est un texte libre ; il
   s'affiche tel quel derrière l'étiquette « NIF/STAT », comme
   aujourd'hui. Pas de découpage deviné.
3. **Remise** — l'option de la maquette n'aura d'effet que si une
   remise existe réellement. Comme aucune colonne ne la porte, la ligne
   **ne s'affichera jamais** dans cette première version, et l'option
   restera visible mais sans effet — ou, si vous préférez, je la retire
   de l'écran de réglages. À trancher en phase 5.
4. **Ville / code postal** — l'adresse s'imprime sur une ligne, telle
   qu'elle est saisie.
5. **Polices** — à télécharger en `woff2` et à poser dans le projet
   (`src/assets/fonts/`), avec `@font-face` et des piles de repli
   système. Nécessaire pour l'impression hors connexion.
6. **Code-barres** — le dégradé CSS de la maquette est décoratif et
   illisible par un scanner. Je propose un vrai Code 128 en SVG, généré
   sans dépendance (≈ 60 lignes), ou `jsbarcode` si vous préférez une
   bibliothèque éprouvée. À trancher en phase 4.

---

## 12. Risques repérés

| # | Risque | Parade |
| --- | --- | --- |
| 1 | `lirePersonnalisation()` efface les clés inconnues → un enregistrement du vocabulaire effacerait `documents` | étendre la fonction **avant** d'écrire quoi que ce soit (phase 5, en premier) |
| 2 | Le PDF par capture d'image reste en place | la feuille v2 est en `mm` et mise à l'échelle par `transform` : la capture sort à la bonne taille quel que soit l'écran. Je signale que l'impression navigateur (texte réel) reste préférable et sera proposée en premier bouton |
| 3 | `set_order_numero` compte les lignes | signalé, non touché, proposition dans `sql-propose.sql` |
| 4 | Les 9 aperçus existants gardent le défaut de largeur | hors périmètre de cette mission ; à traiter séparément |
| 5 | Une boutique verrouillée refuse l'écriture en silence | `updateStore` traite déjà le cas et renvoie un message |

---

## 13. Ce que je propose de construire, et où

```
src/features/documents/
├── drapeau.ts                 ← calqué sur features/dashboard-v2/drapeau.ts
├── DocumentPreview.tsx
├── templates/ Classique Bandeau Epure Compact Ticket
├── parts/     Brand Emetteur Destinataire LignesTable Totaux Mentions Signature Tampon
├── settings/  DocumentsSettingsPage.tsx · useDocumentSettings.ts
├── lib/       buildDocument.ts · montantEnLettres.ts · format.ts
├── fonts/     onest-*.woff2 · jetbrains-mono-*.woff2 · source-serif-4-*.woff2
└── print.css
```

Le drapeau reprend les trois interrupteurs déjà éprouvés :
`?documents_v2=1`, `localStorage.documents_v2`, `VITE_DOCUMENTS_V2`.

---

## 14. Trois questions avant la phase 1

1. **Remise** — option affichée sans effet, ou retirée tant qu'aucune
   colonne ne la porte ?
2. **Code-barres** — vrai Code 128 maison, ou `jsbarcode` ?
3. **Bouton par défaut** — « Imprimer » (texte réel, meilleure qualité)
   avant « PDF » (capture d'image) ? Aujourd'hui le PDF est le bouton
   principal.

Je peux avancer sans les réponses en prenant : option remise retirée,
Code 128 maison, Imprimer en principal — et revenir dessus si vous
tranchez autrement.
