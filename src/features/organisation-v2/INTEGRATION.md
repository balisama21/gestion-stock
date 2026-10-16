# Organisation v2 — intégration

Page à quatre onglets (Vue d'ensemble, Tâches, Agenda, Rappels) portée de `docs/maquette/organisation.html`, derrière le drapeau `organisation_v2`.

## Allumer / éteindre

**Allumé par défaut pour tout le monde depuis le 16 octobre 2026.**

| Moyen | Éteindre | Rallumer |
|---|---|---|
| Tout le monde (au build, retour arrière global) | `VITE_ORGANISATION_V2=0` puis redéployer | retirer la variable |
| Un appareil (lien, choix retenu) | `…/?organisation_v2=0` | `…/?organisation_v2=1` |
| Un navigateur | `localStorage.organisation_v2 = "0"` | `localStorage.removeItem("organisation_v2")` |

Éteint : les quatre anciens écrans (`VueEquipeView`, `TachesView`, `AgendaView`, `RappelsView`) reviennent inchangés, et le code de la v2 n'est pas téléchargé (import paresseux).

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
