-- ═══════════════════════════════════════════════════════════════════
-- Le journal d'activité : qui a fait, qui a modifié, qui a supprimé.
--
-- La cloche savait déjà dire ce qui existe et par qui cela a été créé :
-- tout se déduisait des données déjà chargées. Deux choses lui
-- échappaient, et aucune déduction ne pouvait les retrouver — une ligne
-- effacée a disparu, une ligne corrigée n'a gardé que sa valeur
-- d'arrivée. Elles demandent une écriture au moment même du geste.
--
-- ── La règle qui prime sur toutes les autres ──
--
-- Le journal ne doit JAMAIS empêcher une écriture métier. Un
-- déclencheur qui lève une exception annule la transaction qui l'a
-- appelé : un journal en panne empêcherait d'enregistrer une vente,
-- c'est-à-dire de faire du commerce. Le corps du déclencheur est donc
-- enveloppé dans un gestionnaire qui avale tout. Perdre une ligne de
-- journal est un incident ; perdre une vente n'en est pas un, c'est un
-- client qui repart.
--
-- Pour la même raison les déclencheurs sont AFTER et non BEFORE : ils
-- ne peuvent pas altérer la ligne écrite, seulement l'observer.
--
-- ── Ce qui n'est pas journalisé, et pourquoi ──
--
-- Certaines colonnes bougent toutes seules. Le stock d'un produit
-- descend à chaque vente ; le montant payé d'une commande monte à
-- chaque règlement, sous l'effet d'un autre déclencheur. Ce ne sont pas
-- des gestes humains, et les journaliser noierait le vrai sous le
-- mécanique — « Commande modifiée » à chaque encaissement, « Produit
-- modifié » à chaque article vendu. Ces colonnes sont écartées de la
-- comparaison, et une modification qui ne touche qu'elles n'écrit rien
-- du tout.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.journal_activite (
  -- Un compteur plutôt qu'un identifiant aléatoire : ce journal ne fait
  -- que s'allonger, et l'ordre d'écriture est l'ordre de lecture.
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  -- Qui. Nul si le geste vient d'un travail de fond sans session.
  acteur_id uuid,
  -- Sur quoi : le nom de la table, en clair. La traduction en français
  -- se fait à l'affichage — la base n'a pas à parler une langue.
  entite text NOT NULL,
  entite_id uuid,
  action text NOT NULL CHECK (action IN ('creation', 'modification', 'suppression')),
  -- De quoi on parle : « V014 », « Savon de Marseille », « Menja »…
  etiquette text,
  montant numeric,
  -- Pour une modification : { colonne: { avant, apres } }.
  changements jsonb,
  cree_le timestamptz NOT NULL DEFAULT now()
);

-- La seule lecture qui compte : les dernières lignes d'une boutique.
CREATE INDEX IF NOT EXISTS idx_journal_activite_boutique
  ON public.journal_activite (store_id, cree_le DESC);

COMMENT ON TABLE public.journal_activite IS
  'Qui a fait quoi. Écrit par des déclencheurs, jamais par le client.';

-- ── Qui peut lire ──
--
-- Le propriétaire voit tout ce qui s'est passé chez lui. Un
-- collaborateur ne voit que ses propres gestes. C'est volontairement
-- plus strict que ce que laissent voir les tables elles-mêmes : ouvrir
-- le journal de toute l'équipe à chaque vendeur est une décision qui se
-- prend, pas un effet de bord d'une migration.
--
-- Aucune politique d'écriture n'est déclarée : personne ne peut insérer,
-- corriger ni effacer une ligne depuis l'application. Le déclencheur y
-- parvient parce qu'il est SECURITY DEFINER.
ALTER TABLE public.journal_activite ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_activite_lecture ON public.journal_activite;
CREATE POLICY journal_activite_lecture ON public.journal_activite
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = journal_activite.store_id AND s.owner_id = auth.uid()
    )
    OR acteur_id = auth.uid()
  );

-- ── Le déclencheur ──

CREATE OR REPLACE FUNCTION public.journaliser_activite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ligne   jsonb;
  v_avant   jsonb;
  v_store   uuid;
  v_action  text;
  v_diff    jsonb := NULL;
  v_ignores text[] := ARRAY['updated_at', 'created_at'];
  v_cle     text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ligne := to_jsonb(OLD);
    v_action := 'suppression';
  ELSIF TG_OP = 'UPDATE' THEN
    v_ligne := to_jsonb(NEW);
    v_avant := to_jsonb(OLD);
    v_action := 'modification';
  ELSE
    v_ligne := to_jsonb(NEW);
    v_action := 'creation';
  END IF;

  v_store := NULLIF(v_ligne ->> 'store_id', '')::uuid;
  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  -- Les colonnes que d'autres déclencheurs font bouger toutes seules.
  IF TG_TABLE_NAME = 'products' THEN
    v_ignores := v_ignores || ARRAY['stock_actuel', 'stock_reserve', 'stock_disponible'];
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_ignores := v_ignores
      || ARRAY['montant_paye', 'montant_rembourse', 'reste_a_payer', 'statut_paiement'];
  ELSIF TG_TABLE_NAME = 'sales' THEN
    v_ignores := v_ignores
      || ARRAY['montant_paye', 'montant_rembourse', 'solde_du', 'statut_credit'];
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_ignores := v_ignores || ARRAY['montant_paye', 'solde_du', 'statut_paiement'];
  END IF;

  IF v_action = 'modification' THEN
    v_diff := '{}'::jsonb;
    FOR v_cle IN SELECT jsonb_object_keys(v_ligne) LOOP
      CONTINUE WHEN v_cle = ANY (v_ignores);
      -- IS DISTINCT FROM et non <> : deux valeurs nulles sont égales
      -- ici, et une valeur qui devient nulle est bien un changement.
      IF (v_ligne -> v_cle) IS DISTINCT FROM (v_avant -> v_cle) THEN
        v_diff := v_diff || jsonb_build_object(
          v_cle, jsonb_build_object('avant', v_avant -> v_cle, 'apres', v_ligne -> v_cle)
        );
      END IF;
    END LOOP;
    -- Rien de lisible n'a changé : il n'y a rien à raconter.
    IF v_diff = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.journal_activite (
    store_id, acteur_id, entite, entite_id, action, etiquette, montant, changements
  )
  VALUES (
    v_store,
    auth.uid(),
    TG_TABLE_NAME,
    NULLIF(v_ligne ->> 'id', '')::uuid,
    v_action,
    COALESCE(
      v_ligne ->> 'numero',
      v_ligne ->> 'designation',
      v_ligne ->> 'nom',
      v_ligne ->> 'destinataire',
      v_ligne ->> 'client_nom',
      v_ligne ->> 'source'
    ),
    COALESCE(
      (v_ligne ->> 'total_vente')::numeric,
      (v_ligne ->> 'total_achat')::numeric,
      (v_ligne ->> 'montant')::numeric,
      (v_ligne ->> 'montant_total')::numeric,
      (v_ligne ->> 'total')::numeric
    ),
    v_diff
  );

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Voir l'en-tête du fichier : perdre une ligne de journal est un
    -- incident, perdre une vente est un client qui repart.
    RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.journaliser_activite() IS
  'Écrit une ligne de journal. N''échoue jamais : une panne ici ne doit pas bloquer une vente.';

-- ── Les tables observées ──
--
-- Un déclencheur AFTER par table. Ils ne peuvent rien changer, seulement
-- constater.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales', 'purchases', 'expenses', 'capital_apports',
    'quotes', 'deliveries', 'clients', 'orders', 'payments', 'products'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_journal_%1$s ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_journal_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.journaliser_activite()', t
    );
  END LOOP;
END;
$$;

-- La fonction n'a aucune raison d'être appelable depuis l'API. C'est une
-- fonction de déclencheur : Postgres la lance lui-même au moment d'une
-- écriture, sans regarder les droits EXECUTE de la personne qui écrit.
-- La retirer de la surface exposée ne change donc rien au
-- fonctionnement — vérifié après coup par une écriture réelle — et
-- retire une porte inutile.
REVOKE ALL ON FUNCTION public.journaliser_activite() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.journaliser_activite() FROM anon;
REVOKE ALL ON FUNCTION public.journaliser_activite() FROM authenticated;
