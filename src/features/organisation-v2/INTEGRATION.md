# Organisation v2 — intégration

Page à quatre onglets (Vue d'ensemble, Tâches, Agenda, Rappels) portée de `docs/maquette/organisation.html`, derrière le drapeau `organisation_v2`.

## Allumer / éteindre

| Moyen | Allumer | Éteindre |
|---|---|---|
| Lien (n'importe quel appareil, choix retenu) | `…/?organisation_v2=1` | `…/?organisation_v2=0` |
| Un navigateur | `localStorage.organisation_v2 = "1"` | `localStorage.removeItem("organisation_v2")` |
| Tout le monde (au build) | `VITE_ORGANISATION_V2=1` | variable absente ; `?organisation_v2=0` l'emporte quand même |

Drapeau baissé : les quatre anciens écrans (`VueEquipeView`, `TachesView`, `AgendaView`, `RappelsView`) s'affichent inchangés, et le code de la v2 n'est pas téléchargé (import paresseux).

## Branchement (`src/BalsamaApp.tsx`)

- `ongletOrganisation = organisationV2 ? ongletDeLaVue(vue) : null` : les entrées `vue_equipe / taches / agenda / rappels` du menu ouvrent la page sur leur onglet ; changer d'onglet appelle `setActiveTab` (le menu suit).
- Les quatre vues partagent une même clé de remontage : changer d'onglet ne remonte pas la page (le filtre et le jour choisi sont gardés).
- La rangée « univers » (sous-navigation) est masquée : les onglets la remplacent.
- Les données viennent des hooks déjà ouverts par l'application (`organisation`, `calendrier`, `memos`) et de `purchases / storeData.quotes / storeData.deliveries`. Aucune requête en double.

## Écritures (toutes existantes)

| Action | Fonction |
|---|---|
| Créer une tâche | `useTaches().creer` |
| Terminer / rouvrir | `useTaches().changerStatut` → `statut`, `termine_le` |
| Reporter à demain | `useTaches().modifier(id, { echeance })` |
| Réassigner | `useTaches().modifier(id, { assignee_id })` |
| Créer un événement | `useEvenements().creer` |
| Créer un rappel | `useRappels().creer` |
| Activer / désactiver | `useRappels().basculer(id, actif)` → `actif` |

Seule lecture ajoutée : `journal_activite` (`entite = 'taches'`, 30 lignes) pour le fil d'activité.

## Fichiers

- `OrganisationV2Page.tsx` — page, en-tête, onglets, contexte
- `tabs/` — un composant par onglet
- `components/` — panneau latéral (`Drawer`, `Panneaux`), ligne de tâche, pastilles, interrupteur, message
- `hooks/` — droits, actions d'écriture (enveloppes des hooks existants), échéances, activité
- `lib/` — dates FR, occurrences de rappels, fusion des éléments d'agenda, récit d'activité
- `organisation.css` — jetons et styles sous `.org2` / `.org2-portal`
- `drapeau.ts`, `vues.ts` — interrupteur et correspondance menu ↔ onglet
