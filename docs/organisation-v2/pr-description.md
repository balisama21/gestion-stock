## Organisation v2 — page à onglets (derrière le drapeau `organisation_v2`)

Remplace, **uniquement quand le drapeau est levé**, les quatre écrans du groupe « Organisation » (Vue d'ensemble, Tâches, Agenda, Rappels) par une seule page à onglets, d'après `docs/maquette/organisation.html`. Drapeau baissé (défaut) : rendu identique à aujourd'hui, et le code de la v2 n'est pas téléchargé.

### Ce qui change
- `src/features/organisation-v2/` : page, 4 onglets, panneau latéral partagé, formulaires, CSS isolé sous `.org2`.
- `src/BalsamaApp.tsx` : import paresseux, garde `!ongletOrganisation` sur les 4 anciennes vues, clé de remontage commune, sous-navigation masquée en v2.
- `vitest.config.ts` : `VITE_ORGANISATION_V2` neutralisé dans les tests.

### Sécurité des données
- **Aucune migration, aucun SQL, aucun changement de schéma / RLS.**
- **Aucune nouvelle fonction d'écriture** : `useTaches().creer / changerStatut / modifier`, `useEvenements().creer`, `useRappels().creer / basculer` (celles des écrans actuels).
- Seule lecture ajoutée : `journal_activite` (`entite = 'taches'`, 30 lignes).
- Droits repris des règles existantes ; échéances externes filtrées par module visible (jamais plus large).

### Points à relire
- Alertes automatiques en **lecture seule** (aucune table de règles en base).
- Pas d'heure sur les tâches, pas d'échéance de facture client (données absentes).
- Vert sur `--primary` (marque blanche), polices Onest/JetBrains servies localement.

### Vérifications
- `tsc --noEmit`, `vite build` : OK
- Tests : 1052/1052 (27 nouveaux : aucune écriture à l'affichage/filtre/onglet, colonnes envoyées par chaque action, occurrences de rappels, lecture seule, états vides, drapeau)
- Lint : OK sur les fichiers modifiés (erreurs préexistantes ailleurs)
- ⏳ À faire avant d'élargir : recette sur une vraie boutique avec `?organisation_v2=1` et contrôle en base (voir `docs/organisation-v2/rapport-final.md`).

Détails : `docs/organisation-v2/{audit,journal,rapport-final}.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
