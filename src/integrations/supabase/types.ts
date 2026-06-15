export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      treasury_accounts: {
        Row: {
          actif: boolean
          banque_label: string | null
          code_comptable: string
          company_id: string
          created_at: string
          id: string
          nom: string
          rib: string | null
          solde_actuel: number
          type: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          banque_label?: string | null
          code_comptable?: string
          company_id: string
          created_at?: string
          id: string
          nom: string
          rib?: string | null
          solde_actuel?: number
          type: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          banque_label?: string | null
          code_comptable?: string
          company_id?: string
          created_at?: string
          id?: string
          nom?: string
          rib?: string | null
          solde_actuel?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      treasury_transfers: {
        Row: {
          company_id: string
          compte_destination_id: string
          compte_source_id: string
          created_at: string
          date_operation: string
          id: string
          montant: number
          motif: string
        }
        Insert: {
          company_id: string
          compte_destination_id: string
          compte_source_id: string
          created_at?: string
          date_operation?: string
          id: string
          montant: number
          motif?: string
        }
        Update: {
          company_id?: string
          compte_destination_id?: string
          compte_source_id?: string
          created_at?: string
          date_operation?: string
          id?: string
          montant?: number
          motif?: string
        }
        Relationships: []
      }
      finance_avoirs: {
        Row: {
          company_id: string
          counterparty_id: number
          counterparty_name: string
          counterparty_tax_id: string | null
          created_at: string
          credit_restant: number
          id: string
          issue_date: string
          lignes: Json
          notes: string | null
          numero: string
          status: string
          total_ht: number
          total_ttc: number
          total_tva: number
          type: string
        }
        Insert: {
          company_id: string
          counterparty_id: number
          counterparty_name: string
          counterparty_tax_id?: string | null
          created_at?: string
          credit_restant?: number
          id: string
          issue_date?: string
          lignes?: Json
          notes?: string | null
          numero: string
          status?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          type: string
        }
        Update: {
          company_id?: string
          counterparty_id?: number
          counterparty_name?: string
          counterparty_tax_id?: string | null
          created_at?: string
          credit_restant?: number
          id?: string
          issue_date?: string
          lignes?: Json
          notes?: string | null
          numero?: string
          status?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          type?: string
        }
        Relationships: []
      }
      finance_avoirs_article: {
        Row: {
          company_id: string
          counterparty_id: number
          counterparty_name: string
          counterparty_tax_id: string | null
          created_at: string
          credit_restant: number
          id: string
          invoice_id: string | null
          invoice_numero: string | null
          issue_date: string
          lignes: Json
          notes: string | null
          numero: string
          status: string
          total_ht: number
          total_ttc: number
          total_tva: number
          type: string
        }
        Insert: {
          company_id: string
          counterparty_id: number
          counterparty_name: string
          counterparty_tax_id?: string | null
          created_at?: string
          credit_restant?: number
          id: string
          invoice_id?: string | null
          invoice_numero?: string | null
          issue_date?: string
          lignes?: Json
          notes?: string | null
          numero: string
          status?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          type: string
        }
        Update: {
          company_id?: string
          counterparty_id?: number
          counterparty_name?: string
          counterparty_tax_id?: string | null
          created_at?: string
          credit_restant?: number
          id?: string
          invoice_id?: string | null
          invoice_numero?: string | null
          issue_date?: string
          lignes?: Json
          notes?: string | null
          numero?: string
          status?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          type?: string
        }
        Relationships: []
      }
      withholding_certificates: {
        Row: {
          company_id: string
          counterparty_id: number
          counterparty_name: string
          created_at: string
          id: string
          lignes: Json
          matricule_fiscal: string | null
          mode: string
          payment_id: string | null
          total_retenue: number
        }
        Insert: {
          company_id: string
          counterparty_id: number
          counterparty_name: string
          created_at?: string
          id: string
          lignes?: Json
          matricule_fiscal?: string | null
          mode: string
          payment_id?: string | null
          total_retenue?: number
        }
        Update: {
          company_id?: string
          counterparty_id?: number
          counterparty_name?: string
          created_at?: string
          id?: string
          lignes?: Json
          matricule_fiscal?: string | null
          mode?: string
          payment_id?: string | null
          total_retenue?: number
        }
        Relationships: []
      }
      bank_fee_types: {
        Row: {
          company_id: string
          created_at: string
          id: string
          label: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id: string
          label: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      bank_fees: {
        Row: {
          company_id: string
          created_at: string
          date_echeance: string | null
          date_operation: string
          fee_type_id: string
          fee_type_label: string
          id: string
          label: string
          montant_ht: number
          montant_ttc: number
          montant_tva: number
          notes: string | null
          status: string
          taux_tva: number
          treasury_account_id: string
          treasury_account_name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date_echeance?: string | null
          date_operation?: string
          fee_type_id: string
          fee_type_label?: string
          id: string
          label?: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          notes?: string | null
          status?: string
          taux_tva?: number
          treasury_account_id: string
          treasury_account_name?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date_echeance?: string | null
          date_operation?: string
          fee_type_id?: string
          fee_type_label?: string
          id?: string
          label?: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          notes?: string | null
          status?: string
          taux_tva?: number
          treasury_account_id?: string
          treasury_account_name?: string
        }
        Relationships: []
      }
      bank_statement_lines: {
        Row: {
          account_id: string
          amount_signed: number
          company_id: string
          created_at: string
          id: string
          label: string
          matched_movement_id: string | null
          matched_payment_id: string | null
          operation_date: string
          reference: string | null
          value_date: string | null
        }
        Insert: {
          account_id: string
          amount_signed?: number
          company_id: string
          created_at?: string
          id: string
          label?: string
          matched_movement_id?: string | null
          matched_payment_id?: string | null
          operation_date: string
          reference?: string | null
          value_date?: string | null
        }
        Update: {
          account_id?: string
          amount_signed?: number
          company_id?: string
          created_at?: string
          id?: string
          label?: string
          matched_movement_id?: string | null
          matched_payment_id?: string | null
          operation_date?: string
          reference?: string | null
          value_date?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          id: number
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      bons_commande: {
        Row: {
          bc_date: string
          bc_number: string
          created_at: string
          created_by: string | null
          devis_id: number | null
          id: number
          is_ttc: boolean
          items: Json
          notes: string | null
          status: string
          third_party_address: string | null
          third_party_name: string | null
          third_party_phone: string | null
          third_party_tax_id: string | null
          total_amount: number | null
          type: string
          updated_at: string
        }
        Insert: {
          bc_date?: string
          bc_number: string
          created_at?: string
          created_by?: string | null
          devis_id?: number | null
          id?: number
          is_ttc?: boolean
          items?: Json
          notes?: string | null
          status?: string
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_phone?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          bc_date?: string
          bc_number?: string
          created_at?: string
          created_by?: string | null
          devis_id?: number | null
          id?: number
          is_ttc?: boolean
          items?: Json
          notes?: string | null
          status?: string
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_phone?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bons_commande_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      category_settings: {
        Row: {
          category_name: string
          color: string | null
          created_at: string
          id: number
          is_custom: boolean
          updated_at: string
        }
        Insert: {
          category_name: string
          color?: string | null
          created_at?: string
          id?: number
          is_custom?: boolean
          updated_at?: string
        }
        Update: {
          category_name?: string
          color?: string | null
          created_at?: string
          id?: number
          is_custom?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          email: string | null
          id: number
          location: string | null
          matricule_fiscale: string | null
          nom: string
          patente_url: string | null
          phone: string | null
          registre_commerce_url: string | null
          tva_status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom: string
          patente_url?: string | null
          phone?: string | null
          registre_commerce_url?: string | null
          tva_status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom?: string
          patente_url?: string | null
          phone?: string | null
          registre_commerce_url?: string | null
          tva_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          created_at: string
          created_by: string | null
          devis_date: string
          devis_number: string
          id: number
          is_ba: boolean
          is_bc: boolean
          is_ttc: boolean
          items: Json
          notes: string | null
          source_devis_id: number | null
          status: string
          third_party_address: string | null
          third_party_name: string | null
          third_party_phone: string | null
          third_party_tax_id: string | null
          total_amount: number | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          devis_date?: string
          devis_number: string
          id?: number
          is_ba?: boolean
          is_bc?: boolean
          is_ttc?: boolean
          items?: Json
          notes?: string | null
          source_devis_id?: number | null
          status?: string
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_phone?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          devis_date?: string
          devis_number?: string
          id?: number
          is_ba?: boolean
          is_bc?: boolean
          is_ttc?: boolean
          items?: Json
          notes?: string | null
          source_devis_id?: number | null
          status?: string
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_phone?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_source_devis_id_fkey"
            columns: ["source_devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_helper_mappings: {
        Row: {
          created_at: string
          extracted_name: string
          fiche_technique_url: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_name: string
          fiche_technique_url?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_name?: string
          fiche_technique_url?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          client_id: number | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          notes: string | null
          numero: string
          parent_id: string | null
          status: Database["public"]["Enums"]["doc_status"]
          type: Database["public"]["Enums"]["doc_type"]
          updated_at: string
          updated_by: string | null
          fournisseur_id: number | null
        }
        Insert: {
          client_id?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          numero: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          type: Database["public"]["Enums"]["doc_type"]
          updated_at?: string
          updated_by?: string | null
          fournisseur_id?: number | null
        }
        Update: {
          client_id?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          numero?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          type?: Database["public"]["Enums"]["doc_type"]
          updated_at?: string
          updated_by?: string | null
          fournisseur_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_lines: {
        Row: {
          created_at: string
          description: string | null
          document_id: string
          id: string
          product_id: number | null
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_id: string
          id?: string
          product_id?: number | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_id?: string
          id?: string
          product_id?: number | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_lines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_legacy: {
        Row: {
          created_at: string
          created_by: string | null
          doc_date: string
          doc_number: string
          id: number
          items: Json
          third_party_address: string | null
          third_party_name: string | null
          third_party_tax_id: string | null
          total_amount: number | null
          transport_ref: string | null
          type: string
          updated_at: string
          validity: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number: string
          id?: number
          items?: Json
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          transport_ref?: string | null
          type: string
          updated_at?: string
          validity?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number?: string
          id?: number
          items?: Json
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          transport_ref?: string | null
          type?: string
          updated_at?: string
          validity?: string | null
        }
        Relationships: []
      }
      echantillons: {
        Row: {
          created_at: string
          devis_id: number
          id: number
          product_name: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          devis_id: number
          id?: number
          product_name: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          devis_id?: number
          id?: number
          product_name?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "echantillons_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          id: string
          user_id: string | null
          prenom: string
          nom: string
          email: string | null
          phone: string | null
          role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          prenom: string
          nom: string
          email?: string | null
          phone?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          prenom?: string
          nom?: string
          email?: string | null
          phone?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fuel_vouchers: {
        Row: {
          id: string
          num_bon: string
          date: string
          montant: number
          conducteur_id: string | null
          vehicule_id: string | null
          type_carburant: string | null
          voucher_type: string | null
          notes: string | null
          status: string | null
          proof_image_url: string | null
          km: number | null
          distance: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          num_bon: string
          date?: string
          montant?: number
          conducteur_id?: string | null
          vehicule_id?: string | null
          type_carburant?: string | null
          voucher_type?: string | null
          notes?: string | null
          status?: string | null
          proof_image_url?: string | null
          km?: number | null
          distance?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          num_bon?: string
          date?: string
          montant?: number
          conducteur_id?: string | null
          vehicule_id?: string | null
          type_carburant?: string | null
          voucher_type?: string | null
          notes?: string | null
          status?: string | null
          proof_image_url?: string | null
          km?: number | null
          distance?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_vouchers_conducteur_id_fkey"
            columns: ["conducteur_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_vouchers_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      parties_suivi: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          devis_date: string | null
          devis_number: string | null
          dernier_contact_date: string | null
          id: number
          party_type: string
          reponse: string | null
          societe: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          devis_date?: string | null
          devis_number?: string | null
          dernier_contact_date?: string | null
          id?: number
          party_type: string
          reponse?: string | null
          societe: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          devis_date?: string | null
          devis_number?: string | null
          dernier_contact_date?: string | null
          id?: number
          party_type?: string
          reponse?: string | null
          societe?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_suivi_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          id: number
          location: string | null
          matricule_fiscale: string | null
          nom: string
          patente_url: string | null
          phone: string | null
          registre_commerce_url: string | null
          specialite: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom: string
          patente_url?: string | null
          phone?: string | null
          registre_commerce_url?: string | null
          specialite: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom?: string
          patente_url?: string | null
          phone?: string | null
          registre_commerce_url?: string | null
          specialite?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_categories: {
        Row: {
          created_at: string
          id: number
          name: string
          woocommerce_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          woocommerce_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          woocommerce_id?: number | null
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          devis_fichiers: Json
          description: string | null
          fiches_techniques: Json
          id: number
          name: string
          photos: Json
          prix_achat_ttc: number | null
          prix_vente_ttc: number | null
          updated_at: string
          woocommerce_id: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          devis_fichiers?: Json
          description?: string | null
          fiches_techniques?: Json
          id?: number
          name: string
          photos?: Json
          prix_achat_ttc?: number | null
          prix_vente_ttc?: number | null
          updated_at?: string
          woocommerce_id?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          devis_fichiers?: Json
          description?: string | null
          fiches_techniques?: Json
          id?: number
          name?: string
          photos?: Json
          prix_achat_ttc?: number | null
          prix_vente_ttc?: number | null
          updated_at?: string
          woocommerce_id?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          client_description: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          id: number
          items: Json
          status: string
          total_amount: number
        }
        Insert: {
          client_description?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: number
          items: Json
          status?: string
          total_amount?: number
        }
        Update: {
          client_description?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: number
          items?: Json
          status?: string
          total_amount?: number
        }
        Relationships: []
      }
      product_group_fournisseurs: {
        Row: {
          created_at: string
          fiche_technique_url: string | null
          fournisseur_name: string
          id: number
          prix_ttc: number
          product_group_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiche_technique_url?: string | null
          fournisseur_name: string
          id?: number
          prix_ttc?: number
          product_group_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiche_technique_url?: string | null
          fournisseur_name?: string
          id?: number
          prix_ttc?: number
          product_group_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_group_fournisseurs_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          base_sku: string | null
          category: string
          created_at: string
          fournisseur: string | null
          id: number
          image: string | null
          min_stock: number
          name: string
          updated_at: string
        }
        Insert: {
          base_sku?: string | null
          category: string
          created_at?: string
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name: string
          updated_at?: string
        }
        Update: {
          base_sku?: string | null
          category?: string
          created_at?: string
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          color: string | null
          created_at: string
          fiche_technique_url: string | null
          fournisseur: string | null
          id: number
          image: string | null
          min_stock: number
          name: string
          price: number
          prix_ttc: number | null
          product_group_id: number | null
          quantity: number
          remise: number | null
          size: string | null
          sku: string
          updated_at: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          fiche_technique_url?: string | null
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name: string
          price?: number
          prix_ttc?: number | null
          product_group_id?: number | null
          quantity?: number
          remise?: number | null
          size?: string | null
          sku: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          fiche_technique_url?: string | null
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name?: string
          price?: number
          prix_ttc?: number | null
          product_group_id?: number | null
          quantity?: number
          remise?: number | null
          size?: string | null
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          active_device_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          active_device_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          active_device_id?: string | null
        }
        Relationships: []
      }
      team_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_email: string
          user_id: string
          user_role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_email: string
          user_id: string
          user_role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_email?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          date: string
          id: number
          note: string | null
          product_id: number
          product_name: string
          quantity: number
          type: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: number
          note?: string | null
          product_id: number
          product_name: string
          quantity: number
          type: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          note?: string | null
          product_id?: number
          product_name?: string
          quantity?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          email: string | null
          full_name: string | null
          id: string
          is_online: boolean
          last_seen: string
          role: string | null
          user_id: string
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string
          role?: string | null
          user_id: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_section_permissions: {
        Row: {
          created_at: string
          id: string
          section_key: string
          subsection_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          section_key: string
          subsection_key?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          section_key?: string
          subsection_key?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          code: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          invoice_type: string
          numero: string
          counterpart_name: string | null
          counterpart_tax_id: string | null
          issue_date: string
          due_date: string | null
          currency: string
          total_ht: number
          total_ttc: number
          vat_amount: number
          amount_paid: number
          status: string
          notes: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          invoice_type?: string
          numero: string
          counterpart_name?: string | null
          counterpart_tax_id?: string | null
          issue_date?: string
          due_date?: string | null
          currency?: string
          total_ht?: number
          total_ttc?: number
          vat_amount?: number
          amount_paid?: number
          status?: string
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          invoice_type?: string
          numero?: string
          counterpart_name?: string | null
          counterpart_tax_id?: string | null
          issue_date?: string
          due_date?: string | null
          currency?: string
          total_ht?: number
          total_ttc?: number
          vat_amount?: number
          amount_paid?: number
          status?: string
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          product_code: string | null
          description: string
          quantity: number
          unit_price_ht: number
          vat_rate: number
          total_ht: number
          total_tva: number
          total_ttc: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_code?: string | null
          description: string
          quantity?: number
          unit_price_ht?: number
          vat_rate?: number
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          product_code?: string | null
          description?: string
          quantity?: number
          unit_price_ht?: number
          vat_rate?: number
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          id: string
          company_id: string
          entry_date: string
          reference: string | null
          memo: string | null
          source: string
          posted: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          entry_date?: string
          reference?: string | null
          memo?: string | null
          source?: string
          posted?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          entry_date?: string
          reference?: string | null
          memo?: string | null
          source?: string
          posted?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          id: string
          journal_entry_id: string
          account_code: string
          line_memo: string | null
          debit: number
          credit: number
          vat_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          journal_entry_id: string
          account_code: string
          line_memo?: string | null
          debit?: number
          credit?: number
          vat_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          journal_entry_id?: string
          account_code?: string
          line_memo?: string | null
          debit?: number
          credit?: number
          vat_code?: string | null
          created_at?: string
        }
        Relationships: []
      }
      payment_invoice_allocations: {
        Row: {
          id: string
          payment_id: string
          invoice_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          invoice_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          invoice_id?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          company_id: string
          payment_date: string
          amount: number
          method: string
          direction: string
          counterparty_name: string | null
          reference: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          payment_date?: string
          amount: number
          method?: string
          direction: string
          counterparty_name?: string | null
          reference?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          payment_date?: string
          amount?: number
          method?: string
          direction?: string
          counterparty_name?: string | null
          reference?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_declarations: {
        Row: {
          id: string
          company_id: string
          period_start: string
          period_end: string
          vat_collected: number
          vat_deductible_purchases: number
          net_vat_due: number
          withholding_supplier: number | null
          withholding_at_source_other: number | null
          tcl_due: number | null
          status: string
          notes: string | null
          filed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          period_start: string
          period_end: string
          vat_collected?: number
          vat_deductible_purchases?: number
          net_vat_due?: number
          withholding_supplier?: number | null
          withholding_at_source_other?: number | null
          tcl_due?: number | null
          status?: string
          notes?: string | null
          filed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          period_start?: string
          period_end?: string
          vat_collected?: number
          vat_deductible_purchases?: number
          net_vat_due?: number
          withholding_supplier?: number | null
          withholding_at_source_other?: number | null
          tcl_due?: number | null
          status?: string
          notes?: string | null
          filed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      treasury_movements: {
        Row: {
          id: string
          company_id: string
          movement_date: string
          label: string
          category: string
          amount_signed: number
          linked_payment_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          movement_date?: string
          label: string
          category?: string
          amount_signed: number
          linked_payment_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          movement_date?: string
          label?: string
          category?: string
          amount_signed?: number
          linked_payment_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          user_id: string
          company_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          company_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          company_id?: string
          created_at?: string
        }
        Relationships: []
      }
      vehicle_reminders: {
        Row: {
          id: string
          vehicle_id: string
          reminder_type: string
          due_date: string
          remind_at: string
          is_done: boolean
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          reminder_type: string
          due_date: string
          remind_at: string
          is_done?: boolean
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          reminder_type?: string
          due_date?: string
          remind_at?: string
          is_done?: boolean
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          id: string
          modele: string
          matricule: string
          type: string | null
          constructeur: string | null
          type_carburant: string
          kilometrage_actuel: number
          leasing_company: string | null
          leasing_contract_number: string | null
          company_owner: string | null
          mise_en_circulation: string | null
          loyer_amount: number | null
          leasing_due_date: string | null
          leasing_remind_at: string | null
          assureur: string | null
          assurance_due_date: string | null
          assurance_remind_at: string | null
          vignette_due_date: string | null
          vignette_remind_at: string | null
          visite_technique_end_date: string | null
          visite_technique_remind_at: string | null
          contract_holder_name: string | null
          contract_document_url: string | null
          created_at: string
          conducteur_id: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          id?: string
          modele: string
          matricule: string
          type?: string | null
          constructeur?: string | null
          type_carburant?: string
          kilometrage_actuel?: number
          leasing_company?: string | null
          leasing_contract_number?: string | null
          company_owner?: string | null
          mise_en_circulation?: string | null
          loyer_amount?: number | null
          leasing_due_date?: string | null
          leasing_remind_at?: string | null
          assureur?: string | null
          assurance_due_date?: string | null
          assurance_remind_at?: string | null
          vignette_due_date?: string | null
          vignette_remind_at?: string | null
          visite_technique_end_date?: string | null
          visite_technique_remind_at?: string | null
          contract_holder_name?: string | null
          contract_document_url?: string | null
          created_at?: string
          conducteur_id?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          id?: string
          modele?: string
          matricule?: string
          type?: string | null
          constructeur?: string | null
          type_carburant?: string
          kilometrage_actuel?: number
          leasing_company?: string | null
          leasing_contract_number?: string | null
          company_owner?: string | null
          mise_en_circulation?: string | null
          loyer_amount?: number | null
          leasing_due_date?: string | null
          leasing_remind_at?: string | null
          assureur?: string | null
          assurance_due_date?: string | null
          assurance_remind_at?: string | null
          vignette_due_date?: string | null
          vignette_remind_at?: string | null
          visite_technique_end_date?: string | null
          visite_technique_remind_at?: string | null
          contract_holder_name?: string | null
          contract_document_url?: string | null
          created_at?: string
          conducteur_id?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_stats: { Args: { p_company_id?: string } | Record<PropertyKey, never>; Returns: Json }
      list_my_companies: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          code: string
          name: string
          created_at: string
        }[]
      }
      user_company_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      user_in_company: { Args: { p_company_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_product_fiche_technique: {
        Args: { _fiche_technique_url?: string; _product_id: number }
        Returns: undefined
      }
      finance_list_my_companies: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          code: string
          name: string
          created_at: string
        }[]
      }
      grosafe_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      doc_type: "DEMANDE_ACHAT" | "BC_CLIENT" | "DEVIS_FOURNISSEUR" | "BC_FOURNISSEUR" | "BL_FOURNISSEUR" | "BE" | "BS" | "BL_CLIENT" | "FACTURE"
      doc_status: "DRAFT" | "PENDING" | "VALIDATED" | "COMPLETED" | "REJECTED" | "PARTIALLY_RECEIVED"
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
      app_role: ["admin", "moderator", "user"],
      doc_type: ["DEMANDE_ACHAT", "BC_CLIENT", "DEVIS_FOURNISSEUR", "BC_FOURNISSEUR", "BL_FOURNISSEUR", "BE", "BS", "BL_CLIENT", "FACTURE"],
      doc_status: ["DRAFT", "PENDING", "VALIDATED", "COMPLETED", "REJECTED", "PARTIALLY_RECEIVED"],
    },
  },
} as const
