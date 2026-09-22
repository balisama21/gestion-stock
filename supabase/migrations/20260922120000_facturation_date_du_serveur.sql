-- ════════════════════════════════════════════════════════════════════
-- FACTURATION — LE JOUR OÙ L'ON EST, DIT PAR LE SERVEUR
--
-- « Le passage au statut "En retard" se calcule automatiquement à
-- partir de l'échéance, côté serveur. »
--
-- Le calcul lui-même reste une fonction pure du navigateur, et c'est
-- voulu : le tableau de bord et la page Facturation doivent donner les
-- mêmes chiffres, donc ils doivent additionner les mêmes lignes de la
-- même façon. Une seconde implémentation en SQL dériverait de la
-- première au premier changement.
--
-- Ce qui ne peut PAS venir du navigateur, c'est la date du jour : une
-- horloge d'appareil faussée — cas courant sur un téléphone d'occasion
-- — cacherait un retard ou en inventerait un. Elle est donc demandée
-- ici, dans le fuseau des boutiques, une fois par session.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.date_de_la_boutique()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT (now() AT TIME ZONE public.fuseau_des_boutiques())::date;
$function$;

COMMENT ON FUNCTION public.date_de_la_boutique() IS
  'Le jour du calendrier la ou sont les boutiques. Sert au calcul des retards, pour qu une horloge d appareil faussee ne puisse pas cacher une echeance depassee.';

REVOKE ALL ON FUNCTION public.date_de_la_boutique() FROM public;
GRANT EXECUTE ON FUNCTION public.date_de_la_boutique() TO authenticated;
