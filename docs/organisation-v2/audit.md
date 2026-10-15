# Organisation v2 — audit (phase 0)

Lecture seule : aucun fichier de code modifié, aucun SQL exécuté. Sources : `src/`, `src/lib/database.types.ts`, et les migrations déjà appliquées (`supabase/migrations/20260913100000_organisation_tables.sql`, `20260912120000_journal_activite.sql`) lues comme documentation.

## 1. Route et composant actuels

- Une seule route TanStack : `src/routes/index.tsx` → `BalsamaApp`. Les « pages » sont des vues internes choisies par `activeTab` (`useState` dans `BalsamaApp.tsx`, l. 312), résolues par `vueAffichee()`.
- « Organisation » n'est pas UNE page : c'est un **groupe du menu** (`src/components/navigation.tsx`, l. 63-77) avec quatre vues séparées :
  | Vue (`activeTab`) | Composant | Libellé menu |
  |---|---|---|
  | `vue_equipe` | `components/VueEquipeView.tsx` | Vue d'ensemble |
  | `taches` | `components/TachesView.tsx` | Tâches |
  | `agenda` | `components/AgendaView.tsx` | Agenda |
  | `rappels` | `components/RappelsView.tsx` | Rappels |
- Montage : `BalsamaApp.tsx` l. 2212-2281, `{vue === "taches" && <TachesView …/>}` etc. Les hooks de données sont instanciés une fois dans `BalsamaApp` (l. 224 `organisation = useTaches`, l. 291 `calendrier = useEvenements`, l. 292 `memos = useRappels`) et partagés avec le tableau de bord v2 et la cloche.
- Un drapeau existe déjà pour le tableau de bord v2 (`features/dashboard-v2/drapeau.ts`) et les documents v2 (`features/documents/drapeau.ts`) : même modèle à suivre.

## 2. Colonnes réelles (types générés)

**`taches`** : `id, store_id, numero (TAC…, posé par trigger), titre, description, assignee_id, createur_id, echeance (date), priorite, statut, termine_le (timestamptz), created_at, updated_at`.
- `statut` ∈ `a_faire | en_cours | termine` (CHECK) — identique à la maquette.
- `priorite` ∈ `basse | moyenne | haute | urgente` (CHECK) — identique.
- **Pas de colonne d'heure** : la maquette affiche « pour 15:00 » sur une tâche → impossible, l'heure est omise (tâches = journée entière).

**`evenements`** : `id, store_id, createur_id, titre, description, lieu, debut (timestamptz), fin (timestamptz, null), journee_entiere, nature, visibilite, created_at, updated_at` + table `evenement_participants`.
- `nature` ∈ `rendez_vous | reunion | evenement | autre` ; `visibilite` ∈ `prive | equipe | choisis`.

**`rappels`** : `id, store_id, createur_id, destinataire_id, titre, recurrence, heure (time, null), declenche_le (timestamptz, null), jour_semaine (0-6, 0 = dimanche), jour_mois (1-31), actif, evenement_id, tache_id, created_at, updated_at`.
- `recurrence` ∈ `aucune | quotidien | hebdomadaire | mensuel` ; contrainte `rappel_a_un_moment` : `heure` pour une récurrence, `declenche_le` pour un ponctuel.

## 3. Fonctions d'écriture existantes (toutes via le client Supabase, sous RLS — aucune RPC)

| Action | Fonction existante | Colonnes écrites |
|---|---|---|
| Créer une tâche | `useTaches().creer(saisie)` (`hooks/useTaches.ts`) | insert, `createur_id = moi`, `assignee_id = choisi ou moi` |
| Terminer / rouvrir | `useTaches().changerStatut(id, statut)` | `statut`, `termine_le` uniquement |
| Reporter l'échéance | `useTaches().modifier(id, { echeance })` | `echeance` uniquement |
| Réassigner | `useTaches().modifier(id, { assignee_id })` | `assignee_id` uniquement |
| Créer un événement | `useEvenements().creer(saisie)` | insert (+ participants si `choisis`) |
| Créer un rappel | `useRappels().creer(saisie)` | insert, respecte la contrainte heure/declenche_le |
| Activer/désactiver | `useRappels().basculer(id, actif)` | `actif` uniquement |

→ **Aucune nouvelle fonction d'écriture n'est nécessaire.** Après chaque écriture, ces hooks rechargent uniquement leur propre table.

## 4. Permissions

`store_members.permissions` (`lib/permissions.ts`) a des clés dédiées : `taches` (portée + actions `create/assign/edit/delete`), `agenda` (portée, pas d'action), `rappels` (pas de portée, action `create`), `vue_equipe` (visibilité seule). Propriétaire : `memberPermissions === null` → tout.
- Règles déjà utilisées par l'app : voir toute l'équipe = `scope('taches') === 'all'` ; cocher une tâche = `isOwner || taches.edit` (`peutTerminerUneTache`, l. 996) ; attribuer = `taches.assign`.
- RLS : tâches visibles si assignée/créée par moi ou portée « toute l'organisation » ; rappels **toujours personnels** (destinataire ou créateur, même pour le propriétaire) ; événements privés jamais visibles par un collègue.

## 5. Échéances externes

Déjà calculées par `echeancesMetier()` (`lib/evenements.ts`), utilisée par l'ancien Agenda et la Vue d'équipe, à partir de données déjà chargées dans `BalsamaApp` (aucune requête de plus) :
- achat à crédit : `purchases.date_echeance` si `solde_du > 0` ;
- devis : `quotes.valide_jusqu_au` si `statut = 'envoye'` ;
- livraison : `deliveries.date_prevue` si ni `livree` ni `echouee`.
- **Factures clients impayées : pas de date d'échéance en base** (le commentaire de `lib/agenda.ts` l'explique). La « Facture Bazar Be dépassée » de la maquette ne peut pas exister → absente.
- Filtrage ajouté côté v2 : une échéance n'apparaît que si le module source (`achats`, `devis`, `livraisons`) est visible pour le membre (§5 du cahier des charges ; plus strict que l'ancien agenda, jamais plus large).

## 6. Fuseau horaire

Pas de helper « Madagascar » codé en dur : l'app raisonne en **heure locale du navigateur** (`lib/dates.ts` : `dateDuJour`, `dateDansNJours` ; `lib/evenements.ts` : `jourLocal`, `jourDe`, `heureDe`, `lundiDe`, `grilleDuMois`…). Le tableau de bord v2 réutilise les mêmes. On les réutilise tels quels. Rappels : `prochaineOccurrence`, `libelleQuand` existent dans `lib/rappels.ts` ; il manque seulement « toutes les occurrences sur une période » → `features/organisation-v2/lib/occurrences.ts` (calcul pur, sans écriture).

## 7. Activité

`journal_activite` reçoit, par trigger, chaque création/modification/suppression de **`taches`** (pas d'`evenements` ni de `rappels`), avec `changements` (avant/après par colonne) et `etiquette = numero`. RLS : propriétaire = tout ; collaborateur = ses propres gestes. → Section « Activité de l'organisation » branchée en **lecture** sur `journal_activite` filtré `entite = 'taches'`, 30 dernières lignes.

## 8. Correspondance élément → source

| Élément maquette | Source | L/É | Fonction | Risque |
|---|---|---|---|---|
| Tuile « À boucler aujourd'hui » | `taches` (echeance = aujourd'hui, ≠ termine) | L | `estPourAujourdhui` | nul |
| Tuile « En retard » | `taches` | L | `estEnRetard` | nul |
| Tuile « Prochain rendez-vous » | `evenements` | L | `jourDe/heureDe` | nul |
| Tuile « Échéances à régler » | `echeancesMetier` (achats/devis/livraisons) | L | existante | nul |
| Fil de la journée / 7 prochains jours | taches + evenements + occurrences rappels + échéances | L | fusion v2 | nul |
| En retard | `taches` | L | `estEnRetard` | nul |
| Qui porte quoi | `taches` groupées par `assignee_id` | L | v2 | nul (RLS) |
| Activité de l'organisation | `journal_activite` (`entite='taches'`) | L | lecture v2 | nul |
| Liste/kanban des tâches | `taches` | L+É | `creer`, `changerStatut`, `modifier` | faible (colonnes ciblées) |
| Marquer terminée / reporter | `taches.statut/termine_le`, `taches.echeance` | É | `changerStatut`, `modifier` | faible |
| Agenda mois/semaine/jour | evenements + taches + rappels + échéances | L+É | `useEvenements().creer` | faible |
| Rappels + interrupteurs | `rappels` | L+É | `creer`, `basculer` | faible |
| Prochains déclenchements | `prochaineOccurrence` | L | existante | nul |
| Alertes automatiques | **aucune table de règles** ; règles codées dans `lib/activite.ts` + délais dans Paramètres → Rappels | L | lecture seule | nul |

Aucun risque grave au sens du §1 : on enchaîne.
