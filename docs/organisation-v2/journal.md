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
