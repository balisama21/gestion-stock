-- ═══════════════════════════════════════════════════════════════════
-- Correction : `expenses.type` n'est pas le « type de dépense » du
-- cahier des charges.
--
-- La migration précédente a lu `expenses.type` comme une saisie libre à
-- reprendre dans la liste des postes. C'est faux, et la lecture du code
-- le montre : la colonne ne prend que trois valeurs, écrites en dur
-- dans l'écran et dans le bilan — « Achat de stock », « Retrait
-- d'argent », « Autre dépense ». Elle dit la NATURE de la sortie, celle
-- sur laquelle les totaux du bilan se répartissent.
--
-- Le « type de dépense » que le cahier veut rendre personnalisable,
-- c'est le POSTE : loyer, transport, électricité. Il existait déjà,
-- c'est `expenses.category_id` vers `categories` d'usage `depense`, et
-- il est pré-rempli depuis la brique 0 avec les valeurs du cahier.
--
-- Reprendre la nature dans les postes a donc ajouté « Autre dépense »
-- et « Retrait d'argent » à côté de « Loyer » et « Transport », et
-- rangé six dépenses sous un poste qui ne dit rien de ce à quoi
-- l'argent a servi. On défait les deux.
--
-- Rien n'est perdu : `expenses.type` n'a jamais été touchée, et les six
-- dépenses retrouvent le `category_id` qu'elles avaient — nul.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.expenses DISABLE TRIGGER trg_journal_expenses;

UPDATE public.expenses e
   SET category_id = NULL
 WHERE e.category_id IN (
         SELECT c.id FROM public.categories c
          WHERE c.usage = 'depense'
            AND c.ordre = 1000
            AND public.cle_de_liste(c.nom) IN (
                  public.cle_de_liste('Achat de stock'),
                  public.cle_de_liste('Retrait d''argent'),
                  public.cle_de_liste('Autre dépense')
                )
       );

ALTER TABLE public.expenses ENABLE TRIGGER trg_journal_expenses;

-- Supprimées et non archivées : elles n'ont jamais rien rangé, et les
-- laisser archivées encombrerait l'écran des listes d'une ligne que
-- personne n'a écrite.
DELETE FROM public.categories c
 WHERE c.usage = 'depense'
   AND c.ordre = 1000
   AND public.cle_de_liste(c.nom) IN (
         public.cle_de_liste('Achat de stock'),
         public.cle_de_liste('Retrait d''argent'),
         public.cle_de_liste('Autre dépense')
       )
   AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.category_id = c.id);

COMMENT ON COLUMN public.expenses.type IS
  'La NATURE de la sortie : Achat de stock, Retrait d argent, Autre depense. Trois valeurs fixes, sur lesquelles le bilan repartit ses totaux. A ne pas confondre avec category_id, qui dit a quoi l argent a servi et que la boutique nomme elle-meme.';

COMMENT ON COLUMN public.expenses.category_id IS
  'Le poste de depense, valeur de liste nommee par la boutique : loyer, transport, electricite. C est le « type de depense » personnalisable du cahier des charges.';
