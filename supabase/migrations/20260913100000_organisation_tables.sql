-- ═══════════════════════════════════════════════════════════════════
-- Organisation & Planification — les tables et leurs gardes.
--
-- Trois choses qui n'existaient nulle part : des tâches, des événements
-- d'agenda, des rappels. L'agenda actuel ne possède aucune donnée — il
-- relit ce que la base sait déjà dater. Ces tables lui donnent enfin
-- quelque chose à lui.
--
-- ── La garde d'écriture, et pourquoi une nouvelle ──
--
-- Toutes les tables du logiciel écrivent sous `store_allows_write`, qui
-- vérifie deux choses : appartenir au personnel, et que la boutique ne
-- soit pas verrouillée faute d'activation. Mais « appartenir au
-- personnel » s'appuie sur `is_store_member`, qui exclut délibérément
-- les livreurs — c'est ce qui les tient à l'écart de tout le reste de
-- l'application.
--
-- Or un livreur reçoit des tâches, et doit pouvoir les passer à
-- « Terminé ». Sous `store_allows_write`, il en serait incapable.
-- `boutique_ouverte_a` reprend donc la même règle mot pour mot, en
-- s'appuyant sur `est_dans_la_boutique`, qui les compte. Le verrou de la
-- boutique s'applique exactement pareil. Rien n'est retiré à la garde
-- existante : celle-ci vit à côté, et ne sert qu'à ces trois tables.
--
-- ── Ce que la portée peut, et ne peut pas ──
--
-- Un responsable dont les permissions accordent la portée « toute
-- l'entreprise » sur les tâches voit les tâches de toute l'équipe. La
-- règle se lit dans le MÊME json que l'écran consulte : une seule
-- vérité, pas deux à tenir d'accord.
--
-- Cette portée ne s'applique PAS à l'agenda, volontairement. Un
-- événement marqué privé l'est pour tout le monde, responsable compris —
-- sans quoi le mot ne veut rien dire. La vue d'ensemble du responsable
-- montrera donc les rendez-vous partagés avec l'équipe, jamais les
-- rendez-vous personnels de ses collaborateurs.
-- ═══════════════════════════════════════════════════════════════════

-- ── La garde d'écriture qui compte les livreurs ──
CREATE OR REPLACE FUNCTION public.boutique_ouverte_a(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.est_dans_la_boutique(p_store_id) AND NOT public.store_is_locked(p_store_id);
$function$;

COMMENT ON FUNCTION public.boutique_ouverte_a(uuid) IS
  'Ecrire dans une boutique non verrouillee, livreurs compris. Voir organisation.';

-- ── Qui voit au-dela de ses propres lignes ──
CREATE OR REPLACE FUNCTION public.voit_toute_l_organisation(p_store_id uuid, p_module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM store_members
     WHERE store_id = p_store_id
       AND user_id = auth.uid()
       AND permissions -> p_module ->> 'scope' = 'all'
  );
$function$;

COMMENT ON FUNCTION public.voit_toute_l_organisation(uuid, text) IS
  'Proprietaire, ou membre dont la portee sur ce module vaut « all ». Lit le meme json que l ecran.';

-- ═══════════════════════ LES TÂCHES ═══════════════════════

CREATE TABLE IF NOT EXISTS public.taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  numero text,
  -- Aucune clé étrangère vers les comptes, et c'est voulu : une tâche
  -- survit au départ de celui qui l'a créée comme de celui qui devait la
  -- faire. Un identifiant qui ne correspond plus à personne s'affiche
  -- sans nom, jamais en supprimant le travail.
  createur_id uuid,
  assignee_id uuid,
  titre text NOT NULL,
  description text,
  -- Une date sans heure, comme partout ailleurs dans ce logiciel.
  echeance date,
  priorite text NOT NULL DEFAULT 'moyenne'
    CHECK (priorite IN ('basse', 'moyenne', 'haute', 'urgente')),
  statut text NOT NULL DEFAULT 'a_faire'
    CHECK (statut IN ('a_faire', 'en_cours', 'termine')),
  termine_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- « En retard » ne sera jamais une colonne : c'est une comparaison entre
-- l'échéance et le jour, exacte à chaque lecture. Stockée, elle exigerait
-- un travail de nuit sur toute la base pour rester vraie.
CREATE INDEX IF NOT EXISTS idx_taches_boutique ON public.taches (store_id, statut, echeance);
CREATE INDEX IF NOT EXISTS idx_taches_assignee ON public.taches (assignee_id, statut);

-- ═══════════════════════ L'AGENDA ═══════════════════════

CREATE TABLE IF NOT EXISTS public.evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  createur_id uuid,
  titre text NOT NULL,
  description text,
  lieu text,
  -- Première fois que ce logiciel manipule une heure. `timestamptz` et
  -- non `timestamp` : Antananarivo est à UTC+3, et une saisie de nuit
  -- datée de la veille est un bug que ce projet a déjà connu.
  debut timestamptz NOT NULL,
  fin timestamptz,
  journee_entiere boolean NOT NULL DEFAULT false,
  nature text NOT NULL DEFAULT 'rendez_vous'
    CHECK (nature IN ('rendez_vous', 'reunion', 'evenement', 'autre')),
  visibilite text NOT NULL DEFAULT 'prive'
    CHECK (visibilite IN ('prive', 'equipe', 'choisis')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evenement_fin_apres_debut CHECK (fin IS NULL OR fin >= debut)
);

CREATE INDEX IF NOT EXISTS idx_evenements_boutique ON public.evenements (store_id, debut);

-- Les destinataires d'un événement partagé « avec certains ».
CREATE TABLE IF NOT EXISTS public.evenement_participants (
  evenement_id uuid NOT NULL REFERENCES public.evenements (id) ON DELETE CASCADE,
  membre_id uuid NOT NULL,
  PRIMARY KEY (evenement_id, membre_id)
);

-- ═══════════════════════ LES RAPPELS ═══════════════════════

CREATE TABLE IF NOT EXISTS public.rappels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  createur_id uuid,
  destinataire_id uuid NOT NULL,
  titre text NOT NULL,
  -- Rattaché à un événement, à une tâche, ou à rien.
  evenement_id uuid REFERENCES public.evenements (id) ON DELETE CASCADE,
  tache_id uuid REFERENCES public.taches (id) ON DELETE CASCADE,
  -- Un rappel est soit ponctuel, soit récurrent. La récurrence reste une
  -- RÈGLE : « tous les lundis » est une ligne dont on calcule les
  -- occurrences à la lecture. Les matérialiser demanderait un
  -- planificateur pour les créer et poserait la question des occurrences
  -- passées.
  declenche_le timestamptz,
  recurrence text NOT NULL DEFAULT 'aucune'
    CHECK (recurrence IN ('aucune', 'quotidien', 'hebdomadaire', 'mensuel')),
  jour_semaine smallint CHECK (jour_semaine BETWEEN 0 AND 6),
  jour_mois smallint CHECK (jour_mois BETWEEN 1 AND 31),
  heure time,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Un rappel qui ne dit pas quand se déclencher n'est pas un rappel.
  CONSTRAINT rappel_a_un_moment CHECK (
    (recurrence = 'aucune' AND declenche_le IS NOT NULL)
    OR (recurrence <> 'aucune' AND heure IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rappels_destinataire
  ON public.rappels (destinataire_id, actif);

-- ═══════════════════════ LE NUMÉRO ═══════════════════════

CREATE OR REPLACE FUNCTION public.assign_tache_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'TAC' || lpad(next_store_counter(NEW.store_id, 'tache')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_tache_numero ON public.taches;
CREATE TRIGGER trg_assign_tache_numero
  BEFORE INSERT ON public.taches
  FOR EACH ROW EXECUTE FUNCTION public.assign_tache_numero();

-- L'horodatage de modification, avec la fonction déjà utilisée partout.
DROP TRIGGER IF EXISTS trg_taches_updated_at ON public.taches;
CREATE TRIGGER trg_taches_updated_at BEFORE UPDATE ON public.taches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_evenements_updated_at ON public.evenements;
CREATE TRIGGER trg_evenements_updated_at BEFORE UPDATE ON public.evenements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_rappels_updated_at ON public.rappels;
CREATE TRIGGER trg_rappels_updated_at BEFORE UPDATE ON public.rappels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- L'historique des changements de statut, gratuitement : le journal
-- d'activité enregistre déjà l'avant et l'après de chaque colonne
-- modifiée. Une ligne de plus dans sa liste de tables surveillées, et
-- « qui a passé cette tâche en Terminé, et quand » est écrit.
DROP TRIGGER IF EXISTS trg_journal_taches ON public.taches;
CREATE TRIGGER trg_journal_taches
  AFTER INSERT OR UPDATE OR DELETE ON public.taches
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_activite();

-- ═══════════════════════ QUI VOIT QUOI ═══════════════════════

ALTER TABLE public.taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evenement_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rappels ENABLE ROW LEVEL SECURITY;

-- ── Tâches ──
-- On voit la sienne, celle qu'on a créée, et toutes si la portée le dit.
DROP POLICY IF EXISTS taches_lecture ON public.taches;
CREATE POLICY taches_lecture ON public.taches FOR SELECT TO authenticated
  USING (
    est_dans_la_boutique(store_id)
    AND (
      assignee_id = auth.uid()
      OR createur_id = auth.uid()
      OR voit_toute_l_organisation(store_id, 'taches')
    )
  );

DROP POLICY IF EXISTS taches_creation ON public.taches;
CREATE POLICY taches_creation ON public.taches FOR INSERT TO authenticated
  WITH CHECK (boutique_ouverte_a(store_id) AND createur_id = auth.uid());

-- Modifier ce qu'on peut voir. La condition WITH CHECK empêche de
-- déplacer une tâche vers une autre boutique en la modifiant.
DROP POLICY IF EXISTS taches_modification ON public.taches;
CREATE POLICY taches_modification ON public.taches FOR UPDATE TO authenticated
  USING (
    boutique_ouverte_a(store_id)
    AND (
      assignee_id = auth.uid()
      OR createur_id = auth.uid()
      OR voit_toute_l_organisation(store_id, 'taches')
    )
  )
  WITH CHECK (boutique_ouverte_a(store_id));

-- Supprimer : ce qu'on a créé, ou tout si l'on pilote.
DROP POLICY IF EXISTS taches_suppression ON public.taches;
CREATE POLICY taches_suppression ON public.taches FOR DELETE TO authenticated
  USING (
    boutique_ouverte_a(store_id)
    AND (createur_id = auth.uid() OR voit_toute_l_organisation(store_id, 'taches'))
  );

-- ── Agenda ──
--
-- ⚠ Deux fonctions, et il faut comprendre pourquoi avant d'y toucher.
--
-- La politique de lecture d'un événement doit savoir si l'on figure
-- parmi ses invités. Écrite en clair, la sous-requête interrogerait
-- `evenement_participants`, dont la politique interroge à son tour
-- `evenements` : chacune attendrait la réponse de l'autre. Et même sans
-- boucle, une sous-requête posée dans une politique subit elle aussi la
-- sécurité au niveau des lignes — la table des participants étant
-- fermée, elle ne répondrait jamais, et un événement partagé avec
-- quelqu'un resterait invisible pour lui.
--
-- C'est exactement ce qu'a montré l'essai à blanc : le vendeur voyait
-- un événement sur les deux qui lui étaient destinés.
--
-- Les deux fonctions ci-dessous sont donc SECURITY DEFINER : elles lisent
-- sous l'autorité de la base, hors sécurité au niveau des lignes, et
-- rendent un simple oui ou non. Chacune sert une seule politique, et
-- aucune ne rappelle l'autre.

-- « Suis-je invité à cet événement ? » — pour la politique des événements.
CREATE OR REPLACE FUNCTION public.est_invite_a(p_evenement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM evenement_participants
     WHERE evenement_id = p_evenement_id AND membre_id = auth.uid()
  );
$function$;

-- « Ai-je le droit de voir cet événement ? » — pour la politique des
-- participants.
CREATE OR REPLACE FUNCTION public.peut_voir_evenement(p_evenement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM evenements e
     WHERE e.id = p_evenement_id
       AND est_dans_la_boutique(e.store_id)
       AND (
         e.createur_id = auth.uid()
         OR e.visibilite = 'equipe'
         OR (e.visibilite = 'choisis' AND est_invite_a(e.id))
       )
  );
$function$;

DROP POLICY IF EXISTS evenements_lecture ON public.evenements;
CREATE POLICY evenements_lecture ON public.evenements FOR SELECT TO authenticated
  USING (
    est_dans_la_boutique(store_id)
    AND (
      createur_id = auth.uid()
      OR visibilite = 'equipe'
      OR (visibilite = 'choisis' AND est_invite_a(evenements.id))
    )
  );

DROP POLICY IF EXISTS evenements_creation ON public.evenements;
CREATE POLICY evenements_creation ON public.evenements FOR INSERT TO authenticated
  WITH CHECK (boutique_ouverte_a(store_id) AND createur_id = auth.uid());

-- Son événement est à soi. Le propriétaire peut faire le ménage sur ce
-- qui concerne la boutique, jamais sur un rendez-vous privé : il ne
-- pourrait de toute façon pas le lire, et pouvoir le modifier sans le
-- voir reviendrait à le lire par la bande.
DROP POLICY IF EXISTS evenements_modification ON public.evenements;
CREATE POLICY evenements_modification ON public.evenements FOR UPDATE TO authenticated
  USING (
    boutique_ouverte_a(store_id)
    AND (createur_id = auth.uid() OR (is_store_owner(store_id) AND visibilite <> 'prive'))
  )
  WITH CHECK (boutique_ouverte_a(store_id));

DROP POLICY IF EXISTS evenements_suppression ON public.evenements;
CREATE POLICY evenements_suppression ON public.evenements FOR DELETE TO authenticated
  USING (
    boutique_ouverte_a(store_id)
    AND (createur_id = auth.uid() OR (is_store_owner(store_id) AND visibilite <> 'prive'))
  );

-- ── Participants d'un événement ──
DROP POLICY IF EXISTS participants_lecture ON public.evenement_participants;
CREATE POLICY participants_lecture ON public.evenement_participants FOR SELECT TO authenticated
  USING (peut_voir_evenement(evenement_id));

DROP POLICY IF EXISTS participants_ecriture ON public.evenement_participants;
CREATE POLICY participants_ecriture ON public.evenement_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evenements e
       WHERE e.id = evenement_id AND e.createur_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS participants_retrait ON public.evenement_participants;
CREATE POLICY participants_retrait ON public.evenement_participants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evenements e
       WHERE e.id = evenement_id AND e.createur_id = auth.uid()
    )
  );

-- ── Rappels ──
-- Un rappel est personnel : on voit ceux qu'on reçoit et ceux qu'on a
-- posés. Aucune portée ne les ouvre — savoir de quoi un collègue a
-- besoin qu'on lui rappelle ne regarde personne.
DROP POLICY IF EXISTS rappels_lecture ON public.rappels;
CREATE POLICY rappels_lecture ON public.rappels FOR SELECT TO authenticated
  USING (
    est_dans_la_boutique(store_id)
    AND (destinataire_id = auth.uid() OR createur_id = auth.uid())
  );

DROP POLICY IF EXISTS rappels_creation ON public.rappels;
CREATE POLICY rappels_creation ON public.rappels FOR INSERT TO authenticated
  WITH CHECK (boutique_ouverte_a(store_id) AND createur_id = auth.uid());

DROP POLICY IF EXISTS rappels_modification ON public.rappels;
CREATE POLICY rappels_modification ON public.rappels FOR UPDATE TO authenticated
  USING (
    boutique_ouverte_a(store_id)
    AND (destinataire_id = auth.uid() OR createur_id = auth.uid())
  )
  WITH CHECK (boutique_ouverte_a(store_id));

DROP POLICY IF EXISTS rappels_suppression ON public.rappels;
CREATE POLICY rappels_suppression ON public.rappels FOR DELETE TO authenticated
  USING (
    boutique_ouverte_a(store_id)
    AND (destinataire_id = auth.uid() OR createur_id = auth.uid())
  );
