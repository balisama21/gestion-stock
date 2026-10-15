# Organisation v2 — rapport final

Branche `feat/organisation-v2`, 7 commits (un par phase). Aucune migration, aucun SQL exécuté, aucun changement de schéma, de RLS, de calcul ou de workflow d'un autre module.

## Fichiers

**Créés** — `src/features/organisation-v2/` : `OrganisationV2Page.tsx`, `contexte.ts`, `drapeau.ts`, `vues.ts`, `organisation.css`, `INTEGRATION.md` ; `tabs/{Apercu,Taches,Agenda,Rappels}Tab.tsx` ; `components/{Drawer,Panneaux,TacheLigne,elements,icones}.tsx` ; `hooks/{useTaches,useEvenements,useRappels,useEcheances,useActivite,useOrganisationPermissions}.ts` ; `lib/{dates,occurrences,elements,personnes,activite,stats}.ts` ; tests `OrganisationV2Page.test.tsx`, `drapeau.test.ts`, `lib/occurrences.test.ts`. Docs : `docs/organisation-v2/{audit,journal,rapport-final}.md`, `docs/maquette/organisation.html` (copie de la maquette fournie).

**Modifiés** — `src/BalsamaApp.tsx` (import paresseux de la page ; lecture du drapeau ; garde `!ongletOrganisation` devant les 4 anciennes vues ; clé de remontage commune ; rangée « univers » masquée en v2 ; capture du paramètre d'adresse) ; `vitest.config.ts` (`VITE_ORGANISATION_V2: ""` dans les tests). Drapeau baissé, le rendu de `BalsamaApp` est identique à avant.

## Correspondance (§6)

| Élément | Source réelle | L/É |
|---|---|---|
| Tuile « À boucler aujourd'hui » | `taches` : `echeance = aujourd'hui`, `statut ≠ termine` | L |
| Tuile « En retard » | `taches` : `estEnRetard` (existant) | L |
| Tuile « Prochain rendez-vous » | `evenements` : prochain `debut ≥ maintenant` (30 j) | L |
| Tuile « Échéances à régler » | `echeancesMetier` (achats `date_echeance`+`solde_du`, devis `valide_jusqu_au` envoyés, livraisons `date_prevue`) ≤ 7 j | L |
| Fil de la journée / 7 prochains jours | fusion `evenements` + échéances de `taches` + occurrences `rappels` + échéances boutique (`lib/elements.ts`) | L |
| En retard | `taches` | L |
| Qui porte quoi | `taches` groupées par `assignee_id` (retard / en cours / terminées ≤ 7 j via `termine_le`) | L |
| Activité de l'organisation | `journal_activite` `entite='taches'` (créé/terminé/commencé/rouvert/assigné/reporté) | L |
| Liste + colonnes des tâches | `taches` (`statut` a_faire / en_cours / termine) | L+É |
| Terminer / rouvrir | `taches.statut`, `taches.termine_le` | É |
| Reporter à demain | `taches.echeance` | É |
| Réassigner | `taches.assignee_id` | É |
| Agenda mois/semaine/jour | mêmes sources que le fil | L+É (création d'événement) |
| Rappels + interrupteurs | `rappels` (`recurrence`, `heure`, `jour_semaine`, `jour_mois`, `declenche_le`, `actif`) | L+É |
| Prochains déclenchements | `prochaineOccurrence` (existant) | L |
| Alertes automatiques | règles codées dans `lib/activite.ts` + délais de Paramètres → Rappels + préférence navigateur `stockAlerts` | L seule |

## Fonctions d'écriture

**Réutilisées (toutes)** : `useTaches().creer / changerStatut / modifier`, `useEvenements().creer`, `useRappels().creer / basculer`.
**Créées : aucune.** Les fichiers `hooks/use*.ts` de la feature n'écrivent rien eux-mêmes : ils vérifient le droit, posent un verrou anti double-clic et affichent le message après la réponse de la base. La seule requête nouvelle est une LECTURE de `journal_activite`.

## Éléments masqués ou adaptés faute de donnée

- **Heure d'une tâche** (« pour 15:00 ») : pas de colonne → tâches = journée entière.
- **Facture client impayée** dans les échéances : pas de date d'échéance en base → absente (règle déjà documentée dans `lib/agenda.ts`).
- **Total « 2 000 Ar à payer »** de la tuile échéances : les lignes d'échéance n'exposent pas de montant agrégeable → remplacé par « N en retard ».
- **Activité** : seules les tâches sont journalisées → le fil ne parle que des tâches.
- **Modifier un rappel** (fiche rappel) : aucune fonction de modification n'existe → bouton « Activer / Désactiver » à la place.
- **Mention « exemple »** : supprimée partout ; états vides propres (« Journée libre », « Aucun retard », « Aucun rappel », « Rien de prévu »…).

## Décision « règles d'alerte automatiques »

**Section visible, en lecture seule.** Aucune table de règles n'existe ; les six règles de la maquette sont présentées comme règles fixes du système, **réécrites d'après le vrai comportement de la cloche** (ex. créance : « tant qu'une vente attend son règlement », pas « 30 jours » ; rendez-vous : délais lus dans Paramètres → Rappels). Un tag « toujours active » remplace l'interrupteur ; le stock bas affiche l'état réel de la préférence navigateur existante (« coupée sur cet appareil » le cas échéant). Une règle n'apparaît que si son module source est visible.

## Écarts avec la maquette

- Coquille (menu latéral, barre du bas, cloche, thème) : celles de l'application, pas de la maquette.
- Vert de marque sur `--primary` (marque blanche), comme le tableau de bord v2 ; autres couleurs aux valeurs exactes de la maquette ; thème sombre sur la classe `.dark` de l'app.
- Polices Onest / JetBrains Mono servies depuis les fichiers locaux déjà embarqués par les documents (pas de Google Fonts).
- Points de rupture en requêtes de conteneur (largeur du contenu, l'app ayant un menu latéral).
- Formulaire événement : case « Toute la journée » ajoutée, visibilité « Privé » par défaut (comportement de l'agenda actuel).
- Formulaire rappel : champs jour / jour de la semaine / jour du mois selon la répétition (exigés par la base).
- « Réassigner » : liste des membres au lieu d'une rotation automatique.
- Filtres de type de l'agenda : propres à l'onglet (n'affectent pas la vue d'ensemble).
- Onglet « Vue d'ensemble » : visible seulement pour qui a déjà l'entrée « Vue d'ensemble » au menu (`vue_equipe`) — aucun droit élargi.

## Vérifications (§10)

| Point | État |
|---|---|
| `tsc --noEmit`, `vite build` | ✅ |
| Lint | ✅ sur tous les fichiers touchés ; `npm run lint` global remonte 461 erreurs **préexistantes** dans des fichiers non modifiés (formatage) |
| Tests | ✅ 1052/1052 (dont 27 nouveaux) |
| Aucun SQL / migration | ✅ |
| Terminer → seulement `statut` + `termine_le` | ✅ par test (appel unique `changerStatut(id,'termine')`, dont le code n'écrit que ces 2 colonnes) |
| Reporter → seulement `echeance` | ✅ par test (`modifier(id, { echeance })`) |
| Interrupteur → seulement `actif` | ✅ par test (`basculer(id, actif)`) |
| Aucune écriture au changement d'onglet / vue / filtre | ✅ par test (compteur d'écritures à 0) |
| Occurrences quotidien / hebdo / mensuel | ✅ par test, et concordance avec `prochaineOccurrence` |
| Lecture seule sans droit d'écriture | ✅ par test |
| Boutique vide → états vides | ✅ par test |
| Échéances = celles de Ventes/Devis/Livraisons/Achats | ✅ même fonction (`echeancesMetier`) sur les mêmes données |
| « Ce qui m'est assigné » sous RLS | ✅ filtre sur `assignee_id = moi` appliqué à ce que la RLS renvoie |
| **Vérification en base** (ligne créée avec bon `store_id`/créateur, colonnes identiques avant/après) | ⏳ **à faire par vous** : l'agent ne peut ni se connecter à l'app ni exécuter de SQL. Les fonctions appelées sont celles de l'écran actuel (`createur_id = moi`, `store_id` actif posés par `useTaches().creer`). |
| Flag coupé → ancienne page à l'identique | ✅ par lecture du code (garde sur les 4 vues, test du drapeau) — à confirmer en navigateur |

## Activer / désactiver

- Sur votre appareil : ouvrir l'app avec `?organisation_v2=1` (le choix est retenu) ; revenir en arrière avec `?organisation_v2=0`.
- Pour tout le monde : `VITE_ORGANISATION_V2=1` au build.
- Recette conseillée (§8) : sur votre boutique, créer une tâche de test, la terminer, la reporter, créer un événement, basculer un rappel ; contrôler dans Supabase que seules les colonnes attendues ont bougé ; supprimer la tâche de test depuis l'ancien écran (drapeau à 0) — la v2 n'a pas de bouton supprimer, comme la maquette.
