# Organisation v2 — journal

## Phase 0 — Audit
Fait : audit écrit ; les 7 écritures nécessaires existent déjà dans `useTaches`/`useEvenements`/`useRappels`, aucune à créer.
Fichiers : docs/organisation-v2/audit.md, docs/maquette/organisation.html (copie de la maquette fournie)
Décisions prises seul : « Organisation » = 4 vues du menu (vue_equipe/taches/agenda/rappels) → la v2 remplace les 4 par une page à onglets derrière le drapeau ; pas d'heure sur une tâche (colonne absente) ; pas d'échéance de facture client (pas de date en base).
Vérifs : aucune modif de code

## Phase 1 — Coquille, jetons, drapeau
Fait : page `OrganisationV2Page` (en-tête, filtre équipe/moi, menu Nouveau, 4 onglets avec pastilles), CSS isolé `.org2`, drapeau `organisation_v2`, branchement dans `BalsamaApp` (les 4 entrées du menu ouvrent la page sur leur onglet ; drapeau baissé = ancien rendu inchangé).
Fichiers : src/features/organisation-v2/** , src/BalsamaApp.tsx (import paresseux, garde `!ongletOrganisation` sur les 4 anciennes vues, clé de remontage commune aux 4 vues, rangée d'univers masquée en v2)
Décisions prises seul : jetons recopiés du bloc `.dash2` (classe non réutilisable : ses `.btn/.tag/.card` diffèrent) avec le vert sur `--primary` comme le dashboard v2 (marque blanche) ; Onest/JetBrains Mono servies depuis les fichiers déjà embarqués des documents (pas de Google Fonts) ; ruptures responsive en requêtes de conteneur ; captures non faites (connexion réelle requise — interdite à l'agent).
Vérifs : tsc/lint/build OK

## Phase 2 — Onglet Tâches
Fait : liste groupée (retard/aujourd'hui/semaine/plus tard/sans échéance/terminées), colonnes, filtres, recherche, 4 compteurs ; panneau partagé (fiche tâche + historique tiré du journal d'activité, actions rapides, formulaires tâche/événement/rappel) ; écritures via `changerStatut`/`modifier`/`creer` existants ; tests vitest (aucune écriture à l'affichage/filtre/onglet, colonnes envoyées, validation, lecture seule).
Fichiers : components/{Panneaux,Drawer,TacheLigne}.tsx, tabs/TachesTab.tsx, lib/{activite,stats}.ts, OrganisationV2Page.test.tsx
Décisions prises seul : « Réassigner » = liste des membres (la maquette faisait tourner les noms) ; pas d'heure sur une tâche ; case à cocher désactivée sans `taches.edit` (règle `peutTerminerUneTache` existante).
Vérifs : tsc/lint/build/tests OK

## Phase 3 — Onglet Agenda
Fait : vues mois (42 cases) / semaine (7 h–20 h) / jour, navigation, « Aujourd'hui », 4 filtres de type, détail du jour, création d'événement via `useEvenements().creer` ; fusion événements + échéances de tâches + occurrences de rappels + échéances boutique (`echeancesMetier`, filtrée par module visible).
Fichiers : tabs/AgendaTab.tsx, lib/elements.ts (`panneauDe`), test complété
Décisions prises seul : filtres de type propres à l'onglet (n'altèrent pas la vue d'ensemble) ; événement « Privé » par défaut comme l'agenda actuel + case « Toute la journée » (colonne existante) ; heures hors 7 h–20 h rangées dans la première/dernière case.
Vérifs : tsc/lint/build/tests OK

## Phase 4 — Onglet Rappels
Fait : « Mes rappels » (libellé `libelleQuand`, prochain déclenchement, interrupteur → `useRappels().basculer` = colonne `actif` seule), « Prochains déclenchements » (`prochaineOccurrence`), « Alertes automatiques » ; tests des occurrences (quotidien, hebdo, mensuel 20/31, ponctuel, désactivé, concordance avec `prochaineOccurrence`).
Fichiers : tabs/RappelsTab.tsx, lib/occurrences.test.ts, test de page complété
Décisions prises seul : alertes automatiques en LECTURE SEULE (aucune table de règles) — 6 règles réécrites d'après le vrai code de la cloche (`lib/activite.ts`), délais rendez-vous lus dans Paramètres → Rappels, tag « toujours active » à la place des interrupteurs ; stock bas affiche l'état réel de la préférence navigateur existante ; règle masquée si le module source n'est pas visible ; fiche rappel : bouton « Modifier » remplacé par « Activer/Désactiver » (aucune fonction de modification de rappel n'existe).
Vérifs : tsc/lint/build/tests OK

## Phase 5 — Vue d'ensemble
Fait : 4 tuiles du jour (à boucler, en retard, prochain rendez-vous, échéances à régler), fil de la journée (8 h–19 h), 7 prochains jours avec sélection, « En retard », « Qui porte quoi » (si portée équipe), « Activité de l'organisation » (journal d'activité des tâches) ; contrôle visuel sur un rendu statique de test (bureau + téléphone) → correctif du vide sous le titre en colonne.
Fichiers : tabs/ApercuTab.tsx, organisation.css, test complété
Décisions prises seul : tuile « Échéances » sans total en Ar (les lignes d'échéance n'ont pas de montant agrégeable) → nombre en retard à la place ; « Qui porte quoi » masqué pour une portée réduite ; activité limitée aux tâches (seule table journalisée).
Vérifs : tsc/lint/build/tests OK

## Phase 6 — Portée, droits, drapeau
Fait : filtre « Toute l'équipe / Ce qui m'est assigné » (défaut selon la portée `taches`), droits repris des règles existantes (`useOrganisationPermissions`), onglets = entrées du menu visibles, drapeau testé (allumage navigateur/adresse, extinction par adresse prioritaire, indépendant du dashboard), `VITE_ORGANISATION_V2` neutralisé dans `vitest.config.ts`, INTEGRATION.md.
Fichiers : drapeau.test.ts, INTEGRATION.md, vitest.config.ts
Vérifs : tsc/lint/build OK, suite complète 1052 tests OK

## Phase 7 — Vérifications et rapport
Fait : rapport final (fichiers, correspondance, écritures réutilisées, masqués, règles d'alerte, écarts, checklist §10, activation).
Fichiers : docs/organisation-v2/rapport-final.md
Décisions prises seul : vérification en base laissée à l'utilisateur (connexion et SQL interdits à l'agent).
Vérifs : tsc/build/tests OK ; lint OK sur les fichiers touchés (erreurs globales préexistantes ailleurs)
