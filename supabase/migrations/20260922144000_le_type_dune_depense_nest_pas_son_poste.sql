-- Correction : `expenses.type` n'est pas le « type de depense ».
--
-- Cette colonne ne prend que trois valeurs ecrites en dur — Achat de
-- stock, Retrait d'argent, Autre depense — et le bilan repartit ses
-- totaux dessus. Elle dit la NATURE de la sortie.
--
-- Le type personnalisable du cahier, c'est le POSTE, qui existait deja
-- sous le nom `expenses.category_id`. La migration precedente avait
-- confondu les deux : on defait ses quatre valeurs et ses six
-- rattachements. `expenses.type` n'a jamais ete touchee.

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

-- Supprimees et non archivees : elles n'ont jamais rien range.
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
