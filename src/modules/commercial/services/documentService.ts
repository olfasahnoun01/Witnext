import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId, requireActiveCompanyId } from '@/lib/activeCompany';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import {
  notifyPurchaseRequestCreated,
  notifyPurchaseRequestForwardedToAchat,
} from '@/services/notificationService';
import { 
  UnifiedDocument, 
  UnifiedDocumentType, 
  UnifiedDocumentStatus, 
  UnifiedDocumentLine 
} from '@/types';
import { toast } from 'sonner';
import { formatAppDateTime } from '@/lib/formatAppDate';

/** Prefer parent document company, else active company (required). */
function resolveDocumentCompanyId(parent?: { company_id?: string | null } | null): string {
  if (parent?.company_id) return parent.company_id;
  return requireActiveCompanyId();
}

/**
 * Service for the new Unified Document Engine (v2)
 */
export const documentService = {
  /**
   * Generates a sequential number for a specific document type.
   * Format: [PREFIX]-[YEAR]-[SEQ] (e.g., DF-2024-001)
   */
  async generateNextNumber(type: UnifiedDocumentType): Promise<string> {
    const prefixMap: Record<UnifiedDocumentType, string> = {
      'DEMANDE_ACHAT': 'DA',
      'BC_CLIENT': 'BCC',
      'DEVIS_FOURNISSEUR': 'DF',
      'BC_FOURNISSEUR': 'BCF',
      'BL_FOURNISSEUR': 'BLF',
      'BE': 'BE',
      'BS': 'BS',
      'BL_CLIENT': 'BLC',
      'FACTURE': 'FACT'
    };

    const prefix = prefixMap[type];
    const year = new Date().getFullYear();
    
    // Count existing documents of this type in the current year (per company).
    const companyId = getActiveCompanyId();
    let countQuery = supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('type', type)
      .filter('numero', 'ilike', `${prefix}-${year}-%`);
    if (companyId) countQuery = filterByCompanyId(countQuery, companyId);
    const { count, error } = await countQuery;

    if (error) {
      console.error('Error generating number:', error);
      // Never fabricate a random number: that silently creates duplicate/
      // out-of-sequence document numbers. Fail loudly so the caller aborts.
      throw new Error(`Numérotation indisponible (${prefix}): ${error.message}`);
    }

    const nextSeq = (count || 0) + 1;
    return `${prefix}-${year}-${nextSeq.toString().padStart(3, '0')}`;
  },

  /**
   * Helper to ensure a document exists in the modern 'documents' table.
   * Promotes legacy (numeric ID) documents if necessary.
   */
  async ensureModernDocument(sourceDoc: UnifiedDocument): Promise<string> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceDoc.id);
    if (isUUID) return sourceDoc.id;

    // Try to find if already promoted
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .filter('metadata->>legacy_id', 'eq', sourceDoc.id)
      .maybeSingle();

    if (existing) return existing.id;

    // Promote legacy BC to modern documents table
    const companyId = resolveDocumentCompanyId(sourceDoc);
    const { data: newDoc, error: promoError } = await supabase
      .from('documents')
      .insert({
        numero: sourceDoc.numero,
        type: sourceDoc.type,
        status: (sourceDoc as any).status === 'accepté' || (sourceDoc as any).status === 'confirmé' ? 'VALIDATED' : 'PENDING' as any,
        client_id: sourceDoc.client_id,
        fournisseur_id: sourceDoc.fournisseur_id,
        notes: sourceDoc.notes,
        company_id: companyId,
        metadata: {
          ...(sourceDoc.metadata || {}),
          legacy_id: sourceDoc.id,
          promoted_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (promoError) throw promoError;

    // Also promote lines for visibility in pipeline
    if (sourceDoc.lines && sourceDoc.lines.length > 0) {
      const promoLines = sourceDoc.lines.map(l => ({
        document_id: newDoc.id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total_price: l.total_price,
        description: l.description
      }));
      await supabase.from('document_lines').insert(promoLines);
    }

    return newDoc.id;
  },

  /** True if this legacy devis (numeric id) already has supplier devis/BC children under its promoted parent document. */
  async hasLegacyClientBcProcurementFollowups(legacyIdStr: string): Promise<boolean> {
    if (!/^[0-9]+$/.test(legacyIdStr)) return false;
    const { data: parent } = await supabase
      .from('documents')
      .select('id')
      .eq('metadata->>legacy_id', legacyIdStr)
      .maybeSingle();
    if (!parent?.id) return false;
    const { count, error } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parent.id)
      .in('type', ['BC_FOURNISSEUR', 'DEVIS_FOURNISSEUR']);
    if (error) return false;
    return (count ?? 0) > 0;
  },

  /**
   * After procurement from a BC client (legacy `devis` row): set type to achat when still vente,
   * append an audit line to notes.
   */
  async markLegacyClientBcConvertedToFournisseur(
    legacyIdStr: string,
    kind: 'DEVIS_FOURNISSEUR' | 'BC_FOURNISSEUR'
  ): Promise<void> {
    const id = parseInt(legacyIdStr, 10);
    if (Number.isNaN(id)) return;
    const { data: row, error: fetchErr } = await supabase
      .from('devis')
      .select('notes, type')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !row) return;
    const stamp = formatAppDateTime(new Date());
    const actionNote =
      kind === 'BC_FOURNISSEUR'
        ? `[${stamp}] Converti en BC fournisseur (approvisionnement).`
        : `[${stamp}] Converti en devis fournisseur (approvisionnement).`;
    const prevNotes = (row.notes || '').trim();
    const nextNotes = prevNotes ? `${prevNotes}\n${actionNote}` : actionNote;
    await supabase.from('devis').update({ notes: nextNotes }).eq('id', id);
  },

  /** Append an audit line on a legacy `devis` row without changing status or type. */
  async appendLegacyDevisNote(legacyId: number, noteLine: string): Promise<void> {
    const { data: row, error: fetchErr } = await supabase
      .from('devis')
      .select('notes')
      .eq('id', legacyId)
      .maybeSingle();
    if (fetchErr || !row) return;
    const prevNotes = (row.notes || '').trim();
    const nextNotes = prevNotes ? `${prevNotes}\n${noteLine}` : noteLine;
    await supabase.from('devis').update({ notes: nextNotes }).eq('id', legacyId);
  },

  /**
   * Fetches a document with its lines and product info (for edit forms).
   */
  async getDocument(id: string): Promise<UnifiedDocument | null> {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_lines (
          *,
          products ( name, sku )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    const lines = (data.document_lines ?? []).map((line: Record<string, unknown>) => {
      const products = line.products as { name?: string; sku?: string } | null;
      return {
        ...line,
        product_name: products?.name,
        product_sku: products?.sku,
      };
    });
    return {
      ...data,
      lines,
    } as UnifiedDocument;
  },

  /** BL ids that already have a linked FACTURE child document. */
  async fetchBlIdsWithInvoice(blIds: string[]): Promise<Set<string>> {
    if (blIds.length === 0) return new Set();
    const { data, error } = await supabase
      .from('documents')
      .select('parent_id')
      .eq('type', 'FACTURE')
      .in('parent_id', blIds);
    if (error) {
      console.warn('[documentService] fetchBlIdsWithInvoice:', error.message);
      return new Set();
    }
    return new Set((data ?? []).map((r) => r.parent_id).filter(Boolean) as string[]);
  },

  /**
   * Creates multiple DEVIS_FOURNISSEUR from a parent BC_CLIENT
   * Handles legacy BCs by promoting them to the documents table first.
   */
  async createSupplierQuotesFromSource(
    sourceDoc: UnifiedDocument, 
    allocations: Array<{ 
      fournisseur_id: number, 
      items: Array<{ 
        product_id: number, 
        quantity: number, 
        unit_price: number,
        description?: string 
      }>
    }>
  ) {
    try {
      const results = [];
      const parentId = await this.ensureModernDocument(sourceDoc);

      const existingSource = await this.getDocument(parentId);

      if (existingSource) {
        await supabase
          .from('documents')
          .update({
            metadata: {
              ...(existingSource.metadata || {}),
              workflow_stage: 'supplier_quotes_requested',
              supplier_sourcing_started_at: new Date().toISOString(),
            },
          })
          .eq('id', parentId);
      }

      // 2. Create the Supplier Quotes linked to the modern parentId
      const companyId = resolveDocumentCompanyId(existingSource);
      for (const allocation of allocations) {
        const numero = await this.generateNextNumber('DEVIS_FOURNISSEUR');
        
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert({
            numero,
            type: 'DEVIS_FOURNISSEUR',
            status: 'PENDING',
            fournisseur_id: allocation.fournisseur_id,
            parent_id: parentId,
            company_id: companyId,
          })
          .select()
          .single();

        if (docError) throw docError;

        const linesToInsert = allocation.items.map(item => ({
          document_id: doc.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          description: item.description
        }));

        const { error: linesError } = await supabase
          .from('document_lines')
          .insert(linesToInsert);

        if (linesError) throw linesError;
        
        results.push(doc);
      }

      if (/^[0-9]+$/.test(sourceDoc.id) && sourceDoc.metadata?.legacy_devis_type === 'vente') {
        await this.markLegacyClientBcConvertedToFournisseur(sourceDoc.id, 'DEVIS_FOURNISSEUR');
      }

      return { success: true, documents: results };
    } catch (error: any) {
      console.error('Error in createSupplierQuotesFromSource:', error);
      return { success: false, error: error.message };
    }
  },

  async createSupplierQuotesFromBC(
    sourceDoc: UnifiedDocument,
    allocations: Array<{
      fournisseur_id: number,
      items: Array<{
        product_id: number,
        quantity: number,
        unit_price: number,
        description?: string
      }>
    }>
  ) {
    return this.createSupplierQuotesFromSource(sourceDoc, allocations);
  },

  /**
   * Creates multiple BC_FOURNISSEUR directly from a parent BC_CLIENT
   * (used when the team wants to skip supplier quote requests).
   */
  async createSupplierPurchaseOrdersFromSource(
    sourceDoc: UnifiedDocument,
    allocations: Array<{
      fournisseur_id: number,
      fournisseur_name?: string,
      items: Array<{
        product_id: number,
        quantity: number,
        unit_price: number,
        description?: string
      }>
    }>
  ) {
    try {
      const results = [];
      const parentId = await this.ensureModernDocument(sourceDoc);

      const clientLabel =
        sourceDoc.client_name?.trim() ||
        (typeof sourceDoc.metadata?.source_bc_client_name === 'string'
          ? sourceDoc.metadata.source_bc_client_name.trim()
          : '') ||
        (typeof sourceDoc.metadata?.client_name === 'string'
          ? sourceDoc.metadata.client_name.trim()
          : '') ||
        null;

      for (const allocation of allocations) {
        const numero = await this.generateNextNumber('BC_FOURNISSEUR');
        const fournisseurLabel = allocation.fournisseur_name?.trim() || undefined;
        const companyId = resolveDocumentCompanyId(sourceDoc);

        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert({
            numero,
            type: 'BC_FOURNISSEUR',
            status: 'PENDING',
            fournisseur_id: allocation.fournisseur_id,
            parent_id: parentId,
            company_id: companyId,
            metadata: {
              source_bc_client_name: clientLabel || undefined,
              source_fournisseur_name: fournisseurLabel,
              fournisseur_name: fournisseurLabel,
              source_bc_numero: sourceDoc.numero,
              legacy_parent_id: sourceDoc.id,
            },
          })
          .select()
          .single();

        if (docError) throw docError;

        const linesToInsert = allocation.items.map(item => ({
          document_id: doc.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          description: item.description
        }));

        const { error: linesError } = await supabase
          .from('document_lines')
          .insert(linesToInsert);

        if (linesError) throw linesError;
        results.push(doc);
      }

      if (/^[0-9]+$/.test(sourceDoc.id) && sourceDoc.metadata?.legacy_devis_type === 'vente') {
        await this.markLegacyClientBcConvertedToFournisseur(sourceDoc.id, 'BC_FOURNISSEUR');
      }

      return { success: true, documents: results };
    } catch (error: any) {
      console.error('Error in createSupplierPurchaseOrdersFromSource:', error);
      return { success: false, error: error.message };
    }
  },

  async createPurchaseRequest(params: {
    notes?: string;
    requesterName?: string;
    requesterRole?: string;
    targetRole?: 'responsable_stock' | 'responsable_achat';
    attachment_urls?: Array<{ url: string; name: string; mime: string; path?: string }>;
    items: Array<{
      product_id?: number | null;
      quantity: number;
      description?: string;
      custom_name?: string;
      supplier_name?: string;
    }>;
  }) {
    try {
      let companyId: string;
      try {
        companyId = requireActiveCompanyId();
      } catch {
        return {
          success: false,
          error: 'Aucune société active sélectionnée. Choisissez une société avant de créer la demande d\'achat.',
        };
      }

      const numero = await this.generateNextNumber('DEMANDE_ACHAT');
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          numero,
          type: 'DEMANDE_ACHAT',
          status: 'PENDING',
          notes: params.notes || null,
          created_by: user?.id ?? null,
          company_id: companyId,
          metadata: {
            workflow_stage: params.targetRole === 'responsable_achat' ? 'sent_to_purchasing' : 'submitted',
            stock_review: params.targetRole === 'responsable_achat' ? 'bypassed' : 'pending',
            requester_name: params.requesterName || null,
            requester_role: params.requesterRole || 'agent_commercial',
            target_role: params.targetRole || 'responsable_stock',
            attachment_urls: params.attachment_urls || [],
          },
        })
        .select()
        .single();

      if (docError) throw docError;

      if (params.items.length > 0) {
        const lines = params.items.map((item) => ({
          document_id: doc.id,
          product_id: item.product_id ?? null,
          quantity: item.quantity,
          unit_price: 0,
          total_price: 0,
          description: [
            item.custom_name?.trim(),
            item.supplier_name?.trim() ? `Fournisseur: ${item.supplier_name.trim()}` : '',
            item.description?.trim(),
          ]
            .filter(Boolean)
            .join(' | ') || null,
        }));

        const { error: linesError } = await supabase.from('document_lines').insert(lines);
        if (linesError) throw linesError;
      }

      const targetRole = params.targetRole || 'responsable_stock';
      void notifyPurchaseRequestCreated({
        documentId: doc.id,
        numero: doc.numero,
        requesterName: params.requesterName,
        targetRole,
      }).catch((e) => console.warn('[createPurchaseRequest] notify:', e));

      return { success: true, document: doc };
    } catch (error: any) {
      console.error('Error in createPurchaseRequest:', error);
      return { success: false, error: error.message };
    }
  },

  async reviewPurchaseRequest(
    requestId: string,
    decision: 'available' | 'purchase_required',
    comment?: string
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: current, error: loadError } = await supabase
        .from('documents')
        .select('metadata, numero')
        .eq('id', requestId)
        .single();

      if (loadError) throw loadError;

      const metadata = {
        ...(current.metadata as Record<string, unknown>),
        workflow_stage: 'sent_to_purchasing',
        stock_review: decision,
        stock_review_comment: comment || null,
        stock_reviewed_at: new Date().toISOString(),
        stock_reviewed_by: user?.id ?? null,
      };

      const nextStatus: UnifiedDocumentStatus =
        decision === 'available' ? 'COMPLETED' : 'VALIDATED';

      const { error } = await supabase
        .from('documents')
        .update({
          status: nextStatus,
          metadata,
        })
        .eq('id', requestId);

      if (error) throw error;

      if (decision === 'purchase_required') {
        void notifyPurchaseRequestForwardedToAchat({
          documentId: requestId,
          numero: current.numero || requestId,
        }).catch((e) => console.warn('[reviewPurchaseRequest] notify:', e));
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error in reviewPurchaseRequest:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Calculates the remaining quantity to receive for each product of a BC_FOURNISSEUR
   */
  async getReceptionBacklog(sourceBC: UnifiedDocument) {
    // 1. Ensure modern ID
    const bcId = await this.ensureModernDocument(sourceBC);
    const bc = await this.getDocument(bcId);
    if (!bc) return null;

    // 2. Get all existing BE (Bon d'Entrée) linked to this parent
    const { data: receipts } = await supabase
      .from('documents')
      .select('*, document_lines(*)')
      .eq('parent_id', bcId)
      .eq('type', 'BE')
      .eq('status', 'VALIDATED');

    const receivedMap: Record<number, number> = {};
    receipts?.forEach(r => {
      r.document_lines?.forEach((l: any) => {
        if (l.product_id) {
          receivedMap[l.product_id] = (receivedMap[l.product_id] || 0) + l.quantity;
        }
      });
    });

    return bc.lines?.map(line => ({
      ...line,
      ordered_qty: line.quantity,
      already_received: receivedMap[line.product_id || 0] || 0,
      remaining_qty: Math.max(0, line.quantity - (receivedMap[line.product_id || 0] || 0))
    }));
  },

  /**
   * Creates BL_FOURNISSEUR and BE (PENDING) from a BC_FOURNISSEUR
   */
  async createReception(
    sourceBC: UnifiedDocument, 
    receptions: Array<{ product_id: number, quantity: number, unit_price: number }>
  ) {
    try {
      const bcId = await this.ensureModernDocument(sourceBC);
      const bc = await this.getDocument(bcId);
      if (!bc) throw new Error('BC non trouvé');
      const companyId = resolveDocumentCompanyId(bc);

      // 1. Create BL_FOURNISSEUR
      const blNumero = await this.generateNextNumber('BL_FOURNISSEUR');
      const { data: bl, error: blError } = await supabase
        .from('documents')
        .insert({
          numero: blNumero,
          type: 'BL_FOURNISSEUR',
          status: 'VALIDATED', // BL is just a reference
          fournisseur_id: bc.fournisseur_id,
          parent_id: bcId,
          company_id: companyId,
        })
        .select().single();
      if (blError) throw blError;

      // 2. Create BE (Bon d'Entrée) in PENDING status
      const beNumero = await this.generateNextNumber('BE');
      const { data: be, error: beError } = await supabase
        .from('documents')
        .insert({
          numero: beNumero,
          type: 'BE',
          status: 'PENDING',
          fournisseur_id: bc.fournisseur_id,
          parent_id: bcId,
          company_id: companyId,
        })
        .select().single();
      if (beError) throw beError;

      // 3. Create Lines for BE
      const lines = receptions.map(r => ({
        document_id: be.id,
        product_id: r.product_id,
        quantity: r.quantity,
        unit_price: r.unit_price,
        total_price: r.quantity * r.unit_price
      }));
      const { error: linesError } = await supabase.from('document_lines').insert(lines);
      if (linesError) throw linesError;

      // 4. Update Parent BC Status
      const backlog = await this.getReceptionBacklog(bc);
      const allReceived = backlog?.every(item => item.remaining_qty <= 0);
      
      const newBcStatus = allReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
      await supabase.from('documents').update({ status: newBcStatus }).eq('id', bcId);

      return { success: true, be_id: be.id };
    } catch (error: any) {
      console.error('Error in createReception:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Final validation of a BE: PostgreSQL trigger applies stock (skips when linked to manual transaction).
   */
  async validateBE(beId: string) {
    try {
      const { data: updated, error } = await supabase
        .from('documents')
        .update({ status: 'VALIDATED' })
        .eq('id', beId)
        .eq('status', 'PENDING')
        .select('id');

      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('Ce bon d’entrée est déjà validé (ou introuvable).');
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error in validateBE:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Checks if all items in a BC have sufficient stock
   */
  async checkStockForBC(bcId: string) {
    const { data: lines, error } = await supabase
      .from('document_lines')
      .select('product_id, quantity, products(name, quantity)')
      .eq('document_id', bcId);

    if (error || !lines) return { success: false, error: "Impossible de vérifier le stock." };

    const shortages = lines
      .filter((l) => l.product_id != null && l.products)
      .filter((l) => (l.products as { quantity: number }).quantity < l.quantity)
      .map((l) => ({
        name: (l.products as { name: string }).name,
        needed: l.quantity,
        available: (l.products as { quantity: number }).quantity,
      }));

    return {
      success: shortages.length === 0,
      shortages
    };
  },

  /**
   * Validates a Client BC: Checks stock, creates BS and BLC
   */
  async validateClientBC(bcId: string) {
    try {
      const bc = await this.getDocument(bcId);
      if (!bc) throw new Error('BC non trouvé');

      // 0. Idempotency: refuse if this BC has already produced a BL/BS.
      const { data: existingChildren, error: childErr } = await supabase
        .from('documents')
        .select('id')
        .eq('parent_id', bcId)
        .in('type', ['BL_CLIENT', 'BS'])
        .limit(1);
      if (childErr) throw childErr;
      if (existingChildren && existingChildren.length > 0) {
        throw new Error('Ce BC client a déjà été validé (BL/BS existants).');
      }

      // 1. Stock Check
      const stockCheck = await this.checkStockForBC(bcId);
      if (!stockCheck.success) {
        const list = stockCheck.shortages?.map(s => `${s.name} (Besoin: ${s.needed}, Dispo: ${s.available})`).join(', ');
        throw new Error(`Stock insuffisant pour: ${list}`);
      }

      // 2. Create BL_CLIENT (Status: VALIDATED)
      const companyId = resolveDocumentCompanyId(bc);
      const blNumero = await this.generateNextNumber('BL_CLIENT');
      const { data: bl, error: blError } = await supabase
        .from('documents')
        .insert({
          numero: blNumero,
          type: 'BL_CLIENT',
          status: 'VALIDATED',
          client_id: bc.client_id,
          parent_id: bcId,
          company_id: companyId,
        })
        .select().single();
      if (blError) throw blError;

      // 3. Create BS (Bon de Sortie) in PENDING status
      const bsNumero = await this.generateNextNumber('BS');
      const { data: bs, error: bsError } = await supabase
        .from('documents')
        .insert({
          numero: bsNumero,
          type: 'BS',
          status: 'PENDING',
          client_id: bc.client_id,
          parent_id: bcId,
          company_id: companyId,
        })
        .select().single();
      if (bsError) throw bsError;

      // 4. Clone Lines for both BL and BS
      if (bc.lines && bc.lines.length > 0) {
        const linesToClone = bc.lines.map(l => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total_price: l.total_price,
          description: l.description
        }));

        await supabase.from('document_lines').insert(linesToClone.map(l => ({ ...l, document_id: bl.id })));
        await supabase.from('document_lines').insert(linesToClone.map(l => ({ ...l, document_id: bs.id })));
      }

      // 5. Set BC_CLIENT to COMPLETED
      await supabase.from('documents').update({ status: 'COMPLETED' }).eq('id', bcId);

      return { success: true, bs_id: bs.id, bl_id: bl.id };
    } catch (error: any) {
      console.error('Error in validateClientBC:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Final validation of a BS: PostgreSQL trigger decrements stock (skips when linked to manual transaction).
   */
  /**
   * Validates an outbound BL_FOURNISSEUR (envoi façonnage): marks BL VALIDATED
   * and creates a PENDING BS so stock can be decremented via existing BS validation.
   */
  async validateOutboundSupplierBL(blId: string) {
    try {
      const bl = await this.getDocument(blId);
      if (!bl || bl.type !== 'BL_FOURNISSEUR') {
        throw new Error('BL fournisseur introuvable');
      }
      if ((bl.metadata as Record<string, unknown> | undefined)?.bl_purpose !== 'envoi_faconnage') {
        throw new Error("Ce BL fournisseur n'est pas un envoi façonnage magasin.");
      }
      if (bl.status !== 'PENDING') {
        throw new Error('Ce BL fournisseur est déjà traité.');
      }

      const { data: existingBs, error: childErr } = await supabase
        .from('documents')
        .select('id')
        .eq('parent_id', blId)
        .eq('type', 'BS')
        .limit(1);
      if (childErr) throw childErr;
      if (existingBs && existingBs.length > 0) {
        throw new Error('Une sortie de stock existe déjà pour ce BL fournisseur.');
      }

      const stockCheck = await this.checkStockForBC(blId);
      if (!stockCheck.success) {
        const list = stockCheck.shortages
          ?.map((s) => `${s.name} (Besoin: ${s.needed}, Dispo: ${s.available})`)
          .join(', ');
        throw new Error(`Stock insuffisant pour: ${list}`);
      }

      const companyId = resolveDocumentCompanyId(bl);
      const bsNumero = await this.generateNextNumber('BS');
      const { data: bs, error: bsError } = await supabase
        .from('documents')
        .insert({
          numero: bsNumero,
          type: 'BS',
          status: 'PENDING',
          fournisseur_id: bl.fournisseur_id,
          parent_id: blId,
          company_id: companyId,
          notes: bl.notes,
          metadata: {
            origin: 'bl_fournisseur_envoi',
            source_bl_numero: bl.numero,
            third_party_name:
              bl.fournisseur_name ||
              (bl.metadata as Record<string, unknown> | undefined)?.third_party_name ||
              '',
            service_motif: (bl.metadata as Record<string, unknown> | undefined)?.service_motif,
            service_motif_label: (bl.metadata as Record<string, unknown> | undefined)
              ?.service_motif_label,
          },
        })
        .select()
        .single();
      if (bsError) throw bsError;

      if (bl.lines && bl.lines.length > 0) {
        await supabase.from('document_lines').insert(
          bl.lines.map((l) => ({
            document_id: bs.id,
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            total_price: l.total_price,
            description: l.description,
          }))
        );
      }

      const { data: updated, error: updErr } = await supabase
        .from('documents')
        .update({ status: 'VALIDATED' })
        .eq('id', blId)
        .eq('status', 'PENDING')
        .select('id');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        throw new Error('Ce BL fournisseur a déjà été validé.');
      }

      return { success: true, bsId: bs.id, bsNumero: bs.numero };
    } catch (error: any) {
      console.error('Error in validateOutboundSupplierBL:', error);
      return { success: false, error: error.message };
    }
  },

  async validateBS(bsId: string) {
    try {
      const { data: updated, error } = await supabase
        .from('documents')
        .update({ status: 'VALIDATED' })
        .eq('id', bsId)
        .eq('status', 'PENDING')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('Ce bon de sortie est déjà validé (ou introuvable).');
      }
      return { success: true };
    } catch (error: any) {
      console.error('Error in validateBS:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Generates a FACTURE from a BL_CLIENT
   */
  async createInvoiceFromBL(blId: string) {
    try {
      // 1. Get BL and its lines
      const bl = await this.getDocument(blId);
      if (!bl || bl.type !== 'BL_CLIENT') throw new Error('BL non trouvé');

      // 1b. Idempotency: refuse to invoice the same BL twice.
      const { data: existingInvoice, error: dupErr } = await supabase
        .from('documents')
        .select('id, numero')
        .eq('parent_id', bl.id)
        .eq('type', 'FACTURE')
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (existingInvoice) {
        throw new Error(`Une facture existe déjà pour ce BL (${existingInvoice.numero}).`);
      }

      // 2. Generate Facture Number
      const factureNumero = await this.generateNextNumber('FACTURE');

      // 3. Create FACTURE (Status: PENDING)
      const { data: fact, error: factError } = await supabase
        .from('documents')
        .insert({
          numero: factureNumero,
          type: 'FACTURE',
          status: 'PENDING',
          client_id: bl.client_id,
          parent_id: bl.id,
          company_id: resolveDocumentCompanyId(bl),
          metadata: bl.metadata
        })
        .select().single();
      if (factError) throw factError;

      // 4. Clone Lines
      if (bl.lines && bl.lines.length > 0) {
        const factLines = bl.lines.map(l => ({
          document_id: fact.id,
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total_price: l.total_price,
          description: l.description
        }));
        const { error: linesError } = await supabase.from('document_lines').insert(factLines);
        if (linesError) throw linesError;
      }

      // 5. Ensure Parent BC (Grandparent of Invoice) is Completed
      if (bl.parent_id) {
        await supabase.from('documents').update({ status: 'COMPLETED' }).eq('id', bl.parent_id);
      }

      return { success: true, facture_id: fact.id };
    } catch (error: any) {
      console.error('Error in createInvoiceFromBL:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Accepts a Supplier Quote: 
   * 1. VALIDATED status for quote
   * 2. REJECTED for siblings
   * 3. Create BC_FOURNISSEUR
   */
  async acceptSupplierQuote(quoteId: string) {
    try {
      // 1. Get the quote and its parent/lines
      const quote = await this.getDocument(quoteId);
      if (!quote) throw new Error('Quote not found');
      if (!quote.parent_id) throw new Error('Quote has no parent BC_CLIENT');

      // 1b. Idempotency: only a still-pending quote can be accepted, and the
      // parent must not already have an accepted quote / generated BC.
      if ((quote as any).status === 'VALIDATED' || (quote as any).status === 'REJECTED') {
        throw new Error('Ce devis fournisseur a déjà été traité.');
      }
      const { data: existingBc, error: existingBcErr } = await supabase
        .from('documents')
        .select('id, numero')
        .eq('parent_id', quote.parent_id)
        .eq('type', 'BC_FOURNISSEUR')
        .maybeSingle();
      if (existingBcErr) throw existingBcErr;
      if (existingBc) {
        throw new Error(`Un BC fournisseur existe déjà pour cette demande (${existingBc.numero}).`);
      }

      // 2. VALIDATE the chosen quote
      const { error: updateError } = await supabase
        .from('documents')
        .update({ status: 'VALIDATED' as UnifiedDocumentStatus })
        .eq('id', quoteId);
      if (updateError) throw updateError;

      // 3. REJECT siblings (other DEVIS_FOURNISSEUR of the same parent)
      const { error: rejectError } = await supabase
        .from('documents')
        .update({ status: 'REJECTED' as UnifiedDocumentStatus })
        .eq('parent_id', quote.parent_id)
        .eq('type', 'DEVIS_FOURNISSEUR' as UnifiedDocumentType)
        .neq('id', quoteId);
      if (rejectError) throw rejectError;

      // 4. Generate BC_FOURNISSEUR
      const bcNumero = await this.generateNextNumber('BC_FOURNISSEUR');
      const { data: bc, error: bcError } = await supabase
        .from('documents')
        .insert({
          numero: bcNumero,
          type: 'BC_FOURNISSEUR' as UnifiedDocumentType,
          status: 'PENDING' as UnifiedDocumentStatus,
          fournisseur_id: quote.fournisseur_id,
          parent_id: quote.parent_id,
          company_id: resolveDocumentCompanyId(quote),
          metadata: { ...quote.metadata, accepted_quote_id: quoteId }
        })
        .select()
        .single();
      if (bcError) throw bcError;

      // 5. Clone lines to BC
      if (quote.lines && quote.lines.length > 0) {
        const bcLines = quote.lines.map(l => ({
          document_id: bc.id,
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total_price: l.total_price,
          description: l.description
        }));
        const { error: bcLinesError } = await supabase
          .from('document_lines')
          .insert(bcLines);
        if (bcLinesError) throw bcLinesError;
      }

      return { success: true, bc_id: bc.id };
    } catch (error: any) {
      console.error('Error in acceptSupplierQuote:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Deletes a document and its lines
   */
  async deleteDocument(id: string) {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteDocument:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Updates a warehouse document header and replaces its lines.
   * BL_CLIENT cannot be edited once a FACTURE child exists.
   */
  async updateDocument(
    id: string,
    params: {
      clientId?: number | null;
      fournisseurId?: number | null;
      notes?: string;
      metadata?: Record<string, unknown>;
      lines: Array<{
        product_id: number | null;
        quantity: number;
        unit_price: number;
        description?: string;
      }>;
    }
  ) {
    try {
      const existing = await this.getDocument(id);
      if (!existing) {
        return { success: false, error: 'Document introuvable.' };
      }

      if (existing.type === 'BL_CLIENT') {
        const invoiced = await this.fetchBlIdsWithInvoice([id]);
        if (invoiced.has(id)) {
          return {
            success: false,
            error: 'Ce bon de livraison est déjà facturé et ne peut plus être modifié.',
          };
        }
      }

      if (existing.type === 'BL_FOURNISSEUR' && existing.status !== 'PENDING') {
        return {
          success: false,
          error: 'Ce BL fournisseur est déjà validé et ne peut plus être modifié.',
        };
      }

      const { error: docError } = await supabase
        .from('documents')
        .update({
          client_id: params.clientId ?? null,
          fournisseur_id: params.fournisseurId ?? null,
          notes: params.notes ?? null,
          metadata: params.metadata ?? {},
        })
        .eq('id', id);

      if (docError) throw docError;

      const { error: deleteLinesError } = await supabase
        .from('document_lines')
        .delete()
        .eq('document_id', id);

      if (deleteLinesError) throw deleteLinesError;

      if (params.lines.length > 0) {
        const linesToInsert = params.lines.map((line) => ({
          document_id: id,
          product_id: line.product_id ?? null,
          quantity: line.quantity,
          unit_price: line.unit_price,
          total_price: line.quantity * line.unit_price,
          description: line.description || null,
        }));

        const { error: linesError } = await supabase
          .from('document_lines')
          .insert(linesToInsert);

        if (linesError) throw linesError;
      }

      const updated = await this.getDocument(id);
      return { success: true, document: updated };
    } catch (error: any) {
      console.error('Error in updateDocument:', error);
      return { success: false, error: error.message };
    }
  },
  async createDocument(params: {
    type: UnifiedDocumentType;
    status?: UnifiedDocumentStatus;
    clientId?: number;
    fournisseurId?: number;
    notes?: string;
    metadata?: any;
    lines: Array<{
      product_id: number | null;
      quantity: number;
      unit_price: number;
      description?: string;
    }>;
  }) {
    try {
      let companyId: string;
      try {
        companyId = requireActiveCompanyId();
      } catch {
        return {
          success: false,
          error: 'Aucune société active sélectionnée. Choisissez une société avant de créer le document.',
        };
      }

      const numero = await this.generateNextNumber(params.type);
      const { data: { user } } = await supabase.auth.getUser();

      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          numero,
          type: params.type,
          status: params.status || 'PENDING',
          client_id: params.clientId || null,
          fournisseur_id: params.fournisseurId || null,
          notes: params.notes || null,
          created_by: user?.id ?? null,
          company_id: companyId,
          metadata: params.metadata || {},
        })
        .select()
        .single();

      if (docError) throw docError;

      const linesToInsert = params.lines.map(line => ({
        document_id: doc.id,
        product_id: line.product_id ?? null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        total_price: line.quantity * line.unit_price,
        description: line.description || null
      }));

      const { error: linesError } = await supabase
        .from('document_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      return { success: true, document: doc };
    } catch (error: any) {
      console.error('Error in createDocument:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Creates a BC_FOURNISSEUR (documents v2) from a legacy vente `devis` row (client quote).
   * Lines use product_id when present; otherwise description-only lines (product_id null).
   */
  async createBCFournisseurFromVenteDevis(
    devis: { id: number; devis_number: string; third_party_name: string | null; notes: string | null; items: Array<{ designation: string; description?: string; product_id?: number; quantity: number; prix_ttc: number; remise?: number }> },
    fournisseurId: number
  ) {
    if (!devis.items?.length) {
      return { success: false as const, error: 'Aucune ligne sur ce devis.' };
    }
    const lines = devis.items.map((item) => {
      const descParts = [item.designation, item.description].filter(Boolean);
      return {
        product_id: item.product_id ?? null,
        quantity: Math.max(1, item.quantity),
        unit_price: Math.max(0, item.prix_ttc),
        description: descParts.join(' — ') || undefined,
      };
    });
    const result = await this.createDocument({
      type: 'BC_FOURNISSEUR',
      status: 'PENDING',
      fournisseurId,
      notes: devis.notes || null,
      metadata: {
        source: 'vente_devis',
        vente_devis_id: devis.id,
        vente_devis_number: devis.devis_number,
        client_name: devis.third_party_name,
      },
      lines,
    });
    if (result.success && result.document) {
      const stamp = formatAppDateTime(new Date());
      const numero = (result.document as { numero?: string }).numero || '';
      await this.appendLegacyDevisNote(
        devis.id,
        `[${stamp}] BC fournisseur créé : ${numero} (devis client ${devis.devis_number} conservé dans la liste).`
      );
    }
    return result;
  },
};
