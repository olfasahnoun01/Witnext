import { supabase } from '@/integrations/supabase/client';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { posteMatches } from '@/lib/userPositions';
import { localDateIso } from '@/lib/vehicleReminders';

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link_tab: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type DirectoryUser = { user_id: string; full_name: string; user_position: string };

async function getDirectory(): Promise<DirectoryUser[]> {
  const { data, error } = await supabase.rpc('get_notification_directory');
  if (error) {
    console.warn('[notifications] directory:', error.message);
    return [];
  }
  return ((data || []) as { user_id: string; full_name: string; user_position?: string; position?: string }[]).map(
    (row) => ({
      user_id: row.user_id,
      full_name: row.full_name,
      user_position: row.user_position ?? row.position ?? '',
    })
  );
}

export async function resolveUserIdsByPoste(targetPosteKeys: string[]): Promise<string[]> {
  const directory = await getDirectory();
  const ids = directory
    .filter((u) => posteMatches(u.user_position, targetPosteKeys))
    .map((u) => u.user_id);
  return [...new Set(ids)];
}

export async function resolveUserIdsWithSectionAccess(sectionKey: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_user_ids_with_section_access', {
    p_section_key: sectionKey,
  });
  if (error) {
    console.warn('[notifications] section access:', error.message);
    return [];
  }
  return [...new Set((data as string[]) || [])];
}

async function dispatch(
  recipientIds: string[],
  payload: {
    type: string;
    title: string;
    body?: string;
    link_tab?: string;
    entity_type?: string;
    entity_id?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  if (unique.length === 0) return;

  const { error } = await supabase.rpc('dispatch_notifications', {
    p_recipient_user_ids: unique,
    p_type: payload.type,
    p_title: payload.title,
    p_body: payload.body ?? null,
    p_link_tab: payload.link_tab ?? null,
    p_entity_type: payload.entity_type ?? null,
    p_entity_id: payload.entity_id ?? null,
    p_metadata: payload.metadata ?? {},
  });
  if (error) console.warn('[notifications] dispatch:', error.message);
}

/** Nouvelle demande d'achat : notifier magasin ou achats selon la cible. */
export async function notifyPurchaseRequestCreated(params: {
  documentId: string;
  numero: string;
  requesterName?: string | null;
  targetRole: 'responsable_stock' | 'responsable_achat';
}) {
  const requester = params.requesterName?.trim() || 'Un agent commercial';
  const isStock = params.targetRole === 'responsable_stock';

  const recipientIds = await resolveUserIdsByPoste(
    isStock ? ['responsable magazin'] : ['responsable achat']
  );

  await dispatch(recipientIds, {
    type: 'demande_achat_new',
    title: isStock ? 'Nouvelle demande d\'achat (magasin)' : 'Nouvelle demande d\'achat (achats)',
    body: `${requester} a envoyé la demande ${params.numero}.`,
    link_tab: isStock ? 'demande-achat-magasin' : 'demande-achat',
    entity_type: 'DEMANDE_ACHAT',
    entity_id: params.documentId,
    metadata: { numero: params.numero, target_role: params.targetRole, requester_name: requester },
  });
}

/** Magasin transfère la demande vers le responsable achat. */
export async function notifyPurchaseRequestForwardedToAchat(params: {
  documentId: string;
  numero: string;
  reviewerName?: string | null;
}) {
  const reviewer = params.reviewerName?.trim() || 'Responsable magasin';
  const recipientIds = await resolveUserIdsByPoste(['responsable achat']);

  await dispatch(recipientIds, {
    type: 'demande_achat_forwarded',
    title: 'Demande d\'achat à traiter',
    body: `${reviewer} a transmis la demande ${params.numero} pour consultation fournisseurs.`,
    link_tab: 'demande-achat',
    entity_type: 'DEMANDE_ACHAT',
    entity_id: params.documentId,
    metadata: { numero: params.numero },
  });
}

const REMINDER_LABELS: Record<string, string> = {
  vignette: 'Vignette',
  assurance: 'Assurance',
  leasing: 'Leasing',
  visite_technique: 'Visite technique',
};

/** Rappels véhicules dus : notifier tous les comptes avec accès section Véhicules (+ admins). */
export async function syncVehicleReminderNotifications() {
  const today = localDateIso();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: reminders, error: rErr }, sectionRecipientIds] = await Promise.all([
    supabase
      .from('vehicle_reminders')
      .select('id, reminder_type, due_date, remind_at, vehicle:vehicles(modele, matricule)')
      .eq('is_done', false)
      .lte('remind_at', today),
    resolveUserIdsWithSectionAccess('vehicules'),
  ]);

  const recipientIds = [
    ...new Set([...sectionRecipientIds, ...(user?.id ? [user.id] : [])]),
  ];

  if (rErr) {
    console.warn('[notifications] vehicle reminders:', rErr.message);
    return;
  }
  if (!reminders?.length || recipientIds.length === 0) return;

  for (const row of reminders) {
    const v = row.vehicle as { modele?: string; matricule?: string } | null;
    const label = REMINDER_LABELS[row.reminder_type] || row.reminder_type;
    const vehLabel = `${v?.modele || 'Véhicule'} (${v?.matricule || '-'})`;
    const due = formatAppDate(row.due_date);

    await dispatch(recipientIds, {
      type: 'vehicle_reminder',
      title: `Rappel ${label}`,
      body: `${vehLabel} — échéance le ${due}.`,
      link_tab: 'flotte',
      entity_type: 'vehicle_reminder',
      entity_id: row.id,
      metadata: {
        reminder_type: row.reminder_type,
        due_date: row.due_date,
        remind_at: row.remind_at,
      },
    });
  }
}

export async function fetchMyNotifications(limit = 40): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[notifications] fetch:', error.message);
    return [];
  }
  return (data || []).map((n) => ({
    ...n,
    metadata: (n.metadata as Record<string, unknown>) || {},
  })) as AppNotification[];
}

export async function markNotificationRead(id: string) {
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
}

export async function markAllNotificationsRead() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
}
