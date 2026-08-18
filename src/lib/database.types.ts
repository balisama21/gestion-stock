export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Alias de confort réexportés pour compatibilité avec le code existant
export type UserRole = "founder" | "seller" | "collaborator" | "pending";
export type AccountStatus = "pending" | "activated" | "suspended";
export type AccessCodeStatus = "pending" | "generated" | "sent" | "used" | "expired" | "disabled";
export type InvitationStatus = "pending" | "accepted" | "cancelled" | "expired";
export type PaymentMethod = "mobile_money" | "manual" | "free";
export type ActivationType = "paid" | "manual";
export type OrderStatus = "en_attente" | "en_cours" | "livre" | "annule";
export type PaymentStatus = "impaye" | "partiel" | "paye";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          activated_at: string | null
          activation_type: Database["public"]["Enums"]["activation_type"]
          amount_paid: number | null
          code: string
          created_at: string
          expires_at: string | null
          generated_by: string | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          reason: string | null
          status: Database["public"]["Enums"]["access_code_status"]
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_type?: Database["public"]["Enums"]["activation_type"]
          amount_paid?: number | null
          code: string
          created_at?: string
          expires_at?: string | null
          generated_by?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["access_code_status"]
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_type?: Database["public"]["Enums"]["activation_type"]
          amount_paid?: number | null
          code?: string
          created_at?: string
          expires_at?: string | null
          generated_by?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["access_code_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions: {
        Row: {
          action_type: string
          created_at: string
          details: Json
          id: string
          performed_by: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json
          id?: string
          performed_by: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json
          id?: string
          performed_by?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_apports: {
        Row: {
          created_at: string
          date: string
          id: string
          montant: number
          note: string | null
          owner_id: string
          source: string
          store_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          montant?: number
          note?: string | null
          owner_id: string
          source?: string
          store_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          montant?: number
          note?: string | null
          owner_id?: string
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_apports_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_apports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          id: string
          nom: string
          note: string | null
          store_id: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          nom: string
          note?: string | null
          store_id: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          nom?: string
          note?: string | null
          store_id?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string
          role: string
          status: Database["public"]["Enums"]["invitation_status"]
          store_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          invited_email: string
          role?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          store_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          role?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          store_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_invitations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          created_at: string
          date: string
          id: string
          numero: string | null
          impact_tresorerie_globale: number
          montant: number
          note: string | null
          owner_id: string
          store_id: string
          type: string
          vendeur: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          numero?: string | null
          impact_tresorerie_globale?: number
          montant?: number
          note?: string | null
          owner_id: string
          store_id: string
          type?: string
          vendeur?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          numero?: string | null
          impact_tresorerie_globale?: number
          montant?: number
          note?: string | null
          owner_id?: string
          store_id?: string
          type?: string
          vendeur?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          designation: string
          id: string
          marge_totale: number
          order_id: string
          prix_achat_unit: number
          prix_vente_unit: number
          product_id: string | null
          quantite: number
          total_achat_ref: number
          total_vente: number
        }
        Insert: {
          created_at?: string
          designation: string
          id?: string
          marge_totale?: number
          order_id: string
          prix_achat_unit?: number
          prix_vente_unit?: number
          product_id?: string | null
          quantite?: number
          total_achat_ref?: number
          total_vente?: number
        }
        Update: {
          created_at?: string
          designation?: string
          id?: string
          marge_totale?: number
          order_id?: string
          prix_achat_unit?: number
          prix_vente_unit?: number
          product_id?: string | null
          quantite?: number
          total_achat_ref?: number
          total_vente?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string | null
          created_at: string
          date_livraison: string | null
          id: string
          idempotency_key: string | null
          montant_paye: number
          montant_rembourse: number
          montant_total: number
          note: string | null
          numero: string
          owner_id: string
          reste_a_payer: number | null
          statut_commande: Database["public"]["Enums"]["order_status"]
          statut_paiement: Database["public"]["Enums"]["payment_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          date_livraison?: string | null
          id?: string
          idempotency_key?: string | null
          montant_paye?: number
          montant_rembourse?: number
          montant_total?: number
          note?: string | null
          numero: string
          owner_id: string
          reste_a_payer?: number | null
          statut_commande?: Database["public"]["Enums"]["order_status"]
          statut_paiement?: Database["public"]["Enums"]["payment_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          date_livraison?: string | null
          id?: string
          idempotency_key?: string | null
          montant_paye?: number
          montant_rembourse?: number
          montant_total?: number
          note?: string | null
          numero?: string
          owner_id?: string
          reste_a_payer?: number | null
          statut_commande?: Database["public"]["Enums"]["order_status"]
          statut_paiement?: Database["public"]["Enums"]["payment_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          id: string
          numero: string | null
          idempotency_key: string | null
          methode: string
          montant: number
          note: string | null
          order_id: string | null
          recorded_by: string
          reference: string | null
          sale_id: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero?: string | null
          idempotency_key?: string | null
          methode?: string
          montant: number
          note?: string | null
          order_id?: string | null
          recorded_by: string
          reference?: string | null
          sale_id?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          numero?: string | null
          idempotency_key?: string | null
          methode?: string
          montant?: number
          note?: string | null
          order_id?: string | null
          recorded_by?: string
          reference?: string | null
          sale_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          designation: string
          display_name: string
          fournisseur: string
          id: string
          numero: string | null
          owner_id: string
          prix_achat: number
          prix_vente_defaut: number
          seuil_alerte: number
          stock_actuel: number
          stock_disponible: number | null
          stock_initial: number
          stock_reserve: number
          store_id: string
          updated_at: string
          variant_suffix: string
        }
        Insert: {
          created_at?: string
          designation: string
          display_name: string
          fournisseur?: string
          id?: string
          numero?: string | null
          owner_id: string
          prix_achat?: number
          prix_vente_defaut?: number
          seuil_alerte?: number
          stock_actuel?: number
          stock_disponible?: number | null
          stock_initial?: number
          stock_reserve?: number
          store_id: string
          updated_at?: string
          variant_suffix?: string
        }
        Update: {
          created_at?: string
          designation?: string
          display_name?: string
          fournisseur?: string
          id?: string
          numero?: string | null
          owner_id?: string
          prix_achat?: number
          prix_vente_defaut?: number
          seuil_alerte?: number
          stock_actuel?: number
          stock_disponible?: number | null
          stock_initial?: number
          stock_reserve?: number
          store_id?: string
          updated_at?: string
          variant_suffix?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_platform_admin: boolean
          phone: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number
          status: Database["public"]["Enums"]["account_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          phone?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes?: number
          status?: Database["public"]["Enums"]["account_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          phone?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes?: number
          status?: Database["public"]["Enums"]["account_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          date: string
          designation: string
          fournisseur: string
          id: string
          numero: string | null
          idempotency_key: string | null
          impact_tresorerie: number
          owner_id: string
          prix_achat_unit: number
          product_id: string | null
          quantite: number
          store_id: string
          total_achat: number
          totalachat: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          designation: string
          fournisseur?: string
          id?: string
          numero?: string | null
          idempotency_key?: string | null
          impact_tresorerie?: number
          owner_id: string
          prix_achat_unit?: number
          product_id?: string | null
          quantite?: number
          store_id: string
          total_achat?: number
          totalachat?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          designation?: string
          fournisseur?: string
          id?: string
          numero?: string | null
          idempotency_key?: string | null
          impact_tresorerie?: number
          owner_id?: string
          prix_achat_unit?: number
          product_id?: string | null
          quantite?: number
          store_id?: string
          total_achat?: number
          totalachat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          montant: number
          order_id: string | null
          reason: string | null
          recorded_by: string
          sale_id: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string
          montant: number
          order_id?: string | null
          reason?: string | null
          recorded_by: string
          sale_id?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          montant?: number
          order_id?: string | null
          reason?: string | null
          recorded_by?: string
          sale_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_credit: string | null
          client_id: string | null
          created_at: string
          date: string
          designation: string
          id: string
          numero: string | null
          idempotency_key: string | null
          marge_totale: number
          montant_paye: number
          montant_rembourse: number
          owner_id: string
          prix_achat_unit_ref: number
          prix_vente_unit: number
          product_id: string | null
          quantite: number
          solde_du: number
          statut_credit: string
          store_id: string
          total_achat_ref: number
          total_vente: number
          updated_at: string
          vendeur: string
        }
        Insert: {
          client_credit?: string | null
          client_id?: string | null
          created_at?: string
          date?: string
          designation: string
          id?: string
          numero?: string | null
          idempotency_key?: string | null
          marge_totale?: number
          montant_paye?: number
          montant_rembourse?: number
          owner_id: string
          prix_achat_unit_ref?: number
          prix_vente_unit?: number
          product_id?: string | null
          quantite?: number
          solde_du?: number
          statut_credit?: string
          store_id: string
          total_achat_ref?: number
          total_vente?: number
          updated_at?: string
          vendeur?: string
        }
        Update: {
          client_credit?: string | null
          client_id?: string | null
          created_at?: string
          date?: string
          designation?: string
          id?: string
          numero?: string | null
          idempotency_key?: string | null
          marge_totale?: number
          montant_paye?: number
          montant_rembourse?: number
          owner_id?: string
          prix_achat_unit_ref?: number
          prix_vente_unit?: number
          product_id?: string | null
          quantite?: number
          solde_du?: number
          statut_credit?: string
          store_id?: string
          total_achat_ref?: number
          total_vente?: number
          updated_at?: string
          vendeur?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          note: string | null
          product_id: string | null
          reference_id: string | null
          reference_type: string | null
          stock_actuel_delta: number
          stock_reserve_delta: number
          store_id: string
          type_mouvement: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          note?: string | null
          product_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          stock_actuel_delta?: number
          stock_reserve_delta?: number
          store_id: string
          type_mouvement: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          note?: string | null
          product_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          stock_actuel_delta?: number
          stock_reserve_delta?: number
          store_id?: string
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          role: string
          store_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          store_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          capital_initial: number
          created_at: string
          currency_symbol: string
          email: string | null
          enable_pin_security: boolean
          id: string
          logo_url: string | null
          name: string
          nif_stat: string | null
          owner_id: string
          phone: string | null
          receipt_footer: string | null
          seuil_alerte_tresorerie: number
          subtitle: string | null
          suppliers: string[] | null
          tva_rate: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          capital_initial?: number
          created_at?: string
          currency_symbol?: string
          email?: string | null
          enable_pin_security?: boolean
          id?: string
          logo_url?: string | null
          name: string
          nif_stat?: string | null
          owner_id: string
          phone?: string | null
          receipt_footer?: string | null
          seuil_alerte_tresorerie?: number
          subtitle?: string | null
          suppliers?: string[] | null
          tva_rate?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          capital_initial?: number
          created_at?: string
          currency_symbol?: string
          email?: string | null
          enable_pin_security?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          nif_stat?: string | null
          owner_id?: string
          phone?: string | null
          receipt_footer?: string | null
          seuil_alerte_tresorerie?: number
          subtitle?: string | null
          suppliers?: string[] | null
          tva_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_payment: {
        Args: {
          p_idempotency_key: string
          p_methode: string
          p_montant: number
          p_note: string
          p_order_id: string
          p_reference: string
          p_sale_id: string
          p_store_id: string
        }
        Returns: Json
      }
      create_product: {
        Args: {
          p_designation: string
          p_display_name: string
          p_fournisseur: string
          p_idempotency_key: string
          p_prix_achat: number
          p_prix_vente_defaut: number
          p_seuil_alerte: number
          p_stock_initial: number
          p_store_id: string
          p_variant_suffix: string
        }
        Returns: Json
      }
      add_purchase: {
        Args: {
          p_date: string
          p_fournisseur: string
          p_idempotency_key: string
          p_new_designation: string
          p_new_display_name: string
          p_new_prix_vente_defaut: number
          p_new_seuil_alerte: number
          p_new_variant_suffix: string
          p_prix_achat_unit: number
          p_product_id: string
          p_quantite: number
          p_store_id: string
        }
        Returns: Json
      }
      can_modify_in_store: {
        Args: { p_owner_id: string; p_store_id: string }
        Returns: boolean
      }
      create_order_with_items: {
        Args: {
          p_client_id: string
          p_date_livraison: string
          p_idempotency_key: string
          p_items: Json
          p_note: string
          p_store_id: string
        }
        Returns: Json
      }
      create_sale: {
        Args: {
          p_client_credit: string
          p_client_id: string
          p_date: string
          p_idempotency_key: string
          p_methode: string
          p_montant_paye_initial: number
          p_prix_vente_unit: number
          p_product_id: string
          p_quantite: number
          p_store_id: string
          p_vendeur: string
        }
        Returns: Json
      }
      delete_purchase: { Args: { p_purchase_id: string }; Returns: undefined }
      delete_sale: { Args: { p_sale_id: string }; Returns: undefined }
      generate_access_code: { Args: never; Returns: string }
      get_auth_role: { Args: never; Returns: string }
      is_store_member: { Args: { p_store_id: string }; Returns: boolean }
      is_store_owner: { Args: { p_store_id: string }; Returns: boolean }
      refund_order: {
        Args: { p_idempotency_key: string; p_montant: number; p_order_id: string; p_reason: string }
        Returns: Json
      }
      refund_sale: {
        Args: { p_idempotency_key: string; p_montant: number; p_reason: string; p_sale_id: string }
        Returns: Json
      }
      set_order_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
        }
        Returns: Json
      }
      update_sale_quantity: {
        Args: {
          p_client_credit: string
          p_client_id: string
          p_new_quantite: number
          p_new_total_vente: number
          p_sale_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      access_code_status:
        | "pending"
        | "generated"
        | "sent"
        | "used"
        | "expired"
        | "disabled"
      account_status: "pending" | "activated" | "suspended"
      activation_type: "paid" | "manual"
      invitation_status: "pending" | "accepted" | "cancelled" | "expired"
      order_status: "en_attente" | "en_cours" | "livre" | "annule"
      payment_method: "mobile_money" | "manual" | "free"
      payment_status: "impaye" | "partiel" | "paye"
      user_role: "founder" | "seller" | "collaborator" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_code_status: [
        "pending",
        "generated",
        "sent",
        "used",
        "expired",
        "disabled",
      ],
      account_status: ["pending", "activated", "suspended"],
      activation_type: ["paid", "manual"],
      invitation_status: ["pending", "accepted", "cancelled", "expired"],
      order_status: ["en_attente", "en_cours", "livre", "annule"],
      payment_method: ["mobile_money", "manual", "free"],
      payment_status: ["impaye", "partiel", "paye"],
      user_role: ["founder", "seller", "collaborator", "pending"],
    },
  },
} as const