# Activer l'IA de Tantana Suite

L'infrastructure est en place et **éteinte**. Tant que les étapes ci-dessous ne
sont pas faites, aucune requête ne part chez OpenAI et chaque écran IA affiche
« IA non configurée — activation par l'administrateur requise ».

## Ce qui existe déjà

| Élément | Où | État au 16/10/2026 |
|---|---|---|
| Tables, quotas, journal, RPC | `supabase/migrations/20261016110000_ia_infrastructure.sql` | **appliquée** en production (IA désactivée) |
| Durcissement sécurité (anon) | `supabase/migrations/20261016100000_securite_fonctions_definer_hors_anon.sql` | **appliquée** en production |
| Fonction serveur | `supabase/functions/ia/` (`index.ts` + `noyau.ts`) | **à déployer** (étape 3) |
| Écrans | Menu « Assistant IA », bouton « Importer » (Produits, Clients, Fournisseurs), Paramètres › Plateforme › Intelligence artificielle | livrés |

Retours arrière : `supabase/retours-arriere/20261016*.sql`.

## Activation (une seule fois)

1. **Compte OpenAI** — sur platform.openai.com : créer un projet, ajouter un
   moyen de paiement et un crédit prépayé (Billing), puis **régler les limites
   de dépense et alertes du projet côté OpenAI** (Limits). Les limites internes
   de Tantana Suite ne remplacent pas ce plafond : seul celui d'OpenAI borne
   réellement la facture.
2. **Clé API** — créer une clé de projet (API keys) et l'enregistrer **côté
   serveur uniquement** :
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-... --project-ref jasyacrnpimgwapcjkpr
   ```
   (ou Dashboard Supabase › Edge Functions › Secrets). Jamais dans `.env`,
   jamais dans Git, jamais dans le navigateur.
3. **Déployer la fonction** :
   ```bash
   supabase functions deploy ia --project-ref jasyacrnpimgwapcjkpr
   ```
4. **Modèle, tarif, budget** — Paramètres › Plateforme › Intelligence
   artificielle (super admin) :
   - saisir le tarif du modèle choisi (USD par million de jetons d'entrée et de
     sortie, recopié de la page tarifs d'OpenAI) — sans tarif, le modèle est
     refusé ;
   - choisir ce modèle, fixer le **budget mensuel global**, le seuil d'alerte,
     la fréquence et les tailles maximales.
5. **Activer** — cocher « IA activée pour la plateforme », puis pour chaque
   boutique : activer, cocher les fonctionnalités, fixer le plafond mensuel
   (USD) et, si voulu, un quota de requêtes.
6. **Premier test payant contrôlé** — budget global à 1 $, une seule boutique
   de test avec plafond 0,50 $ et la seule fonction « Aide à la rédaction ».
   Lancer une rédaction courte dans « Assistant IA », puis vérifier dans le
   tableau de bord : 1 requête réussie, jetons et coût estimé renseignés. Comparer
   avec l'usage affiché par OpenAI le lendemain.

## Couper l'IA en urgence

- Le plus rapide (immédiat, sans toucher à la base) :
  ```bash
  supabase secrets set IA_COUPE_CIRCUIT=1 --project-ref jasyacrnpimgwapcjkpr
  ```
  (`supabase secrets unset IA_COUPE_CIRCUIT` pour rétablir).
- Ou décocher « IA activée pour la plateforme ».
- Ou révoquer la clé chez OpenAI (arrêt certain côté facturation).

## Ce que garantissent les limites internes — et ce qu'elles ne garantissent pas

- Chaque appel est **réservé** en base avant d'être envoyé, au coût maximal
  possible (entrée estimée + sortie maximale), sous verrou : deux requêtes
  simultanées ne peuvent pas dépasser ensemble le budget global ou le plafond
  d'une boutique.
- Le coût affiché est une **estimation** (jetons renvoyés × tarifs saisis). Une
  coupure réseau est comptée au coût maximal réservé, par prudence.
- La facturation réelle et le solde du compte ne sont visibles que chez OpenAI.

## Sécurité, en bref

- Clé uniquement dans les secrets Supabase ; la fonction n'indique que sa présence.
- Identité vérifiée (JWT), appartenance à la boutique et quotas vérifiés en base
  (`ia_reserver`, exécutable seulement par le serveur).
- Assistant, anomalies, réapprovisionnement : propriétaire seulement ; les
  données lues passent par les politiques RLS de l'utilisateur et sont
  agrégées (aucun nom ni coordonnée de client).
- Documents et réponses du modèle traités comme non fiables : balisage,
  échappement, validation champ par champ. L'IA ne fait que proposer ; tout
  import passe par l'aperçu et la confirmation humaine, puis par les fonctions
  métier habituelles. Décisions journalisées dans `ia_actions`.
- Aucun prompt ni document n'est stocké ; aucun fichier temporaire n'est écrit.
  `ia_purger_contenus(90)` efface les charges utiles des actions anciennes.

## Tests sans coût

`npx vitest run src/features/ia src/features/import` — le fournisseur y est un
faux `fetch` : aucun appel réseau, aucune clé.
