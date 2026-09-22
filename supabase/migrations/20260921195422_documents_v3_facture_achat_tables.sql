-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — LA FACTURE D'ACHAT FOURNISSEUR (1/2 : LES TABLES)
--
-- « Pour enregistrer la vraie facture reçue d'un fournisseur.
-- Champs : fournisseur, numéro de facture du fournisseur, date,
-- lignes, montants, et pièce jointe (photo ou PDF de l'original).
-- Imprimable en PDF. »
--
-- POURQUOI UNE TABLE À PART, ET NON `purchases`. Une ligne de
-- `purchases` est un ACHAT : elle entre en trésorerie, elle touche le
-- stock, elle porte un produit et une quantité. Une facture reçue est
-- une PIÈCE : elle peut couvrir dix achats, n'en couvrir aucun,
-- arriver un mois plus tard. Les mélanger obligerait à toucher aux
-- calculs de trésorerie et de stock, ce que cette refonte n'a pas le
-- droit de faire.
--
-- CE QU'ELLE NE FAIT PAS, ET C'EST VOULU. Elle n'écrit rien en
-- trésorerie, ne bouge aucun stock, ne modifie aucun achat. C'est un
-- classeur : on y range la pièce, on la retrouve, on la réimprime.
-- Le lien avec les achats qu'elle couvre viendra quand il sera
-- demandé, et il sera additif lui aussi.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- La fiche fournisseur quand il y en a une, le nom libre sinon :
  -- une facture arrive parfois d'un fournisseur pas encore enregistré.
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  fournisseur text NOT NULL DEFAULT '',
  -- Notre numéro interne, posé par le déclencheur.
  numero text,
  -- Celui que porte le papier reçu. C'est lui qu'on cherche quand le
  -- fournisseur appelle.
  numero_fournisseur text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  total numeric NOT NULL DEFAULT 0,
  montant_paye numeric NOT NULL DEFAULT 0,
  note text,
  -- Le chemin dans le seau « documents », déjà privé et cloisonné par
  -- `<store_id>/…`. Jamais une URL : un lien signé périme.
  piece_jointe text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  -- `store_id` est recopié ici, comme sur `quote_items` : la politique
  -- de lecture s'écrit alors sans jointure, et une ligne ne peut pas
  -- se retrouver orpheline d'une boutique.
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantite numeric NOT NULL DEFAULT 1,
  unite text,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  total numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_invoices_par_boutique
  ON public.supplier_invoices (store_id, date DESC);
CREATE INDEX IF NOT EXISTS supplier_invoices_par_fournisseur
  ON public.supplier_invoices (supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_numero_par_boutique
  ON public.supplier_invoices (store_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS supplier_invoice_items_par_facture
  ON public.supplier_invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS supplier_invoice_items_par_boutique
  ON public.supplier_invoice_items (store_id);
CREATE INDEX IF NOT EXISTS supplier_invoice_items_par_produit
  ON public.supplier_invoice_items (product_id);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_items ENABLE ROW LEVEL SECURITY;
