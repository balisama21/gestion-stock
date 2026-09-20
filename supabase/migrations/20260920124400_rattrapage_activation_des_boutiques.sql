-- ═══════════════════════════════════════════════════════════════════
-- RATTRAPAGE DES BOUTIQUES DÉJÀ CRÉÉES PAR UN COMPTE RÉGLÉ
-- ═══════════════════════════════════════════════════════════════════
--
-- Le fichier 01 change la règle pour l'avenir. Celui-ci remet les
-- données déjà en base d'accord avec elle, et rien d'autre.
--
-- ── Ce qu'il fait, en deux temps ──
--
--   1. tout compte possédant au moins une boutique 'active' reçoit son
--      activation de compte. La date retenue est celle de sa PREMIÈRE
--      activation, et le compte est à vie dès qu'UNE de ses boutiques
--      l'est — on ne retire jamais un droit déjà payé ;
--   2. les autres boutiques de ces comptes passent 'active' aux mêmes
--      conditions.
--
-- ── Ce qu'il ne fait PAS, et c'est délibéré ──
--
-- Il ne lit pas `profiles.status = 'activated'`. Cette colonne est
-- posée par `accept_invitation_by_code()` sur tout invité : la lire
-- offrirait l'activation à vie à chaque collaborateur. Seul
-- `stores.activation_status = 'active'` prouve un paiement.
--
-- ── Effet mesuré sur la base du 20/09/2026 ──
--
-- Répétition à blanc en lecture seule : 4 comptes reçoivent une
-- activation, tous à vie, et aucun autre —
--   balisamamamy2003, balisamamamy2110,
--   matthiastantely18092006, mielarabearimanana.
--
-- 3 boutiques changent d'état, sur 2 comptes ; 11 restent inchangées :
--   balisamamamy2003 · Boutique de Mamy ......... verrouillée → ouverte
--   balisamamamy2110 · boutique B ............... verrouillée → ouverte
--   balisamamamy2110 · Boutique de DG Balsama ... essai       → ouverte
--
-- Aucune autre boutique ne change d'état. En particulier
-- lastrichie2003, invité chez balisamamamy2003 mais jamais payeur,
-- garde ses deux boutiques verrouillées : c'est la règle 4.

-- ── 1. L'activation de compte, déduite des boutiques déjà payées ──

INSERT INTO public.activations_de_compte (user_id, active_le, abonnement_jusqu_au)
SELECT s.owner_id,
       coalesce(min(s.activated_at), min(s.created_at), now()),
       -- Une seule boutique à vie suffit à rendre le compte à vie.
       CASE WHEN bool_or(s.abonnement_jusqu_au IS NULL) THEN NULL
            ELSE max(s.abonnement_jusqu_au) END
FROM public.stores s
WHERE s.activation_status = 'active'
GROUP BY s.owner_id
ON CONFLICT (user_id) DO NOTHING;

-- ── 2. Les boutiques du compte suivent ──

SELECT set_config('app.bypass_activation_guard', 'on', true);

UPDATE public.stores s
SET activation_status = 'active',
    activated_at = coalesce(s.activated_at, a.active_le),
    abonnement_jusqu_au = a.abonnement_jusqu_au
FROM public.activations_de_compte a
WHERE a.user_id = s.owner_id
  AND s.activation_status <> 'active';

-- ── 3. Relevé de contrôle passé juste après, en lecture seule ──
--
-- Aucune ligne, comme attendu : plus une seule boutique fermée chez un
-- compte réglé.
--
--   SELECT p.email, s.name, s.activation_status
--   FROM public.stores s
--   JOIN public.activations_de_compte a ON a.user_id = s.owner_id
--   JOIN public.profiles p ON p.id = s.owner_id
--   WHERE s.activation_status <> 'active';
--
-- Et l'état obtenu, quatre comptes à vie, zéro boutique verrouillée :
--
--   balisamamamy2003 ......... 18/08 · a vie · 3 boutiques · 0 fermee
--   balisamamamy2110 ......... 31/08 · a vie · 3 boutiques · 0 fermee
--   matthiastantely18092006 .. 18/08 · a vie · 1 boutique  · 0 fermee
--   mielarabearimanana ....... 18/08 · a vie · 1 boutique  · 0 fermee
