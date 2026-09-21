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
  s'ajoute pas. *Raison* : la maquette calcule `total = base + TVA`
  sur des données fictives ; appliqué à la vente V024 de la
  production, ce calcul annoncerait 360 000 Ar pour une vente
  enregistrée à 300 000 — un montant jamais payé, qui contredirait la
  page Ventes. *Revenir en arrière* : dans `totauxDeVente`
  (`lib/buildDocument.ts`), remplacer l'extraction par une addition ;
  un test la verrouille et échouera, ce qui est voulu.
- **Décision** : l'option « Remise » est retirée des réglages.
  *Raison* : aucune colonne ne porte de remise, la ligne ne
  s'afficherait jamais, et un interrupteur sans effet fait croire que
  la fonction existe. *Revenir en arrière* : rajouter la clé dans
  `OptionsDocuments` et la ligne dans `Totaux` — mais il faudra
  d'abord une vraie colonne, donc une migration.
- **Décision** : « Imprimer » est le bouton principal, devant
  « PDF ». *Raison* : l'impression produit du texte réel ; le PDF est
  une photographie. *Revenir en arrière* : échanger les classes
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
  28 points de titre. *Raison* : l'Épuré mettait trois lignes sur deux
  pages, il manquait cinq pixels ; ces espaces ne portaient rien.
  *Revenir en arrière* : `.doc-cloture { gap }` et le bloc
  `.m-epure .doc-pad` dans `templates/modeles.css`.
- **Décision** : l'Épuré n'a pas de tampon de paiement. *Raison* : un
  tampon de travers dans un document sobre est un corps étranger ;
  l'information reste dans les totaux. *Revenir en arrière* : ajouter
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
