import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OnlineUser {
  user_id: string;
  email: string | null;
  full_name?: string | null;
  role: string | null;
  last_seen: string;
  is_online: boolean;
}

interface UsePresenceOptions {
  /** Heartbeat interval in ms (default 2 min). */
  heartbeatInterval?: number;
}

const sameUserId = (a: string, b: string) => a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();

export const usePresence = (options: UsePresenceOptions = {}) => {
  const { heartbeatInterval = 120_000 } = options;
  const { user, isAdmin, isModerator } = useAuth();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<number | null>(null);
  const presenceWriteOkRef = useRef(false);
  const realtimeOkRef = useRef(false);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ignore stale fetch results when multiple fetchOnlineUsers overlap. */
  const fetchSeqRef = useRef(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [hasPermission, setHasPermission] = useState(true);

  const userRole = isAdmin ? 'admin' : isModerator ? 'moderator' : 'user';

  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user || !hasPermission) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const fromMeta = meta?.full_name;
      const fullName =
        typeof fromMeta === 'string' && fromMeta.trim() ? fromMeta.trim() : null;

      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          email: user.email,
          full_name: fullName,
          role: userRole,
          last_seen: new Date().toISOString(),
          is_online: isOnline
        }, { onConflict: 'user_id' });

      if (error) {
        presenceWriteOkRef.current = false;
        if ((error as { status?: number }).status === 403 || error.code === '42501' || error.code === '23503') {
          console.log(`Presence feature silenced: ${error.code === '23503' ? 'Session identity mismatch (migration effect)' : 'Insufficient permissions'}. Please re-login to restore status indicators.`);
          setHasPermission(false);
          return;
        }
        console.warn('Presence update failed (ignored):', error.message);
      } else {
        presenceWriteOkRef.current = true;
      }
    } catch (err) {
      console.warn('Presence update error (ignored):', err);
    }
  }, [user, userRole, hasPermission]);

  const fetchOnlineUsers = useCallback(async () => {
    if (!user || !hasPermission) return;

    const seq = ++fetchSeqRef.current;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || seq !== fetchSeqRef.current) return;

      const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('user_presence')
        .select('user_id, email, full_name, role, last_seen, is_online')
        .eq('is_online', true)
        .gte('last_seen', recentCutoff)
        .order('last_seen', { ascending: false });

      if (seq !== fetchSeqRef.current) return;

      if (error) {
        console.warn('Fetching online users failed:', error.message);
        return;
      }

      let rows = (data || []) as OnlineUser[];

      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        user &&
        !rows.some((r) => sameUserId(r.user_id, user.id))
      ) {
        const meta = user.user_metadata as Record<string, unknown> | undefined;
        const fromMeta = meta?.full_name;
        const selfName = typeof fromMeta === 'string' && fromMeta.trim() ? fromMeta.trim() : null;
        rows = [
          {
            user_id: user.id,
            email: user.email,
            full_name: selfName,
            role: isAdmin ? 'admin' : isModerator ? 'moderator' : userRole,
            last_seen: new Date().toISOString(),
            is_online: true,
          },
          ...rows,
        ];
      }

      if (rows.length === 0) {
        if (seq === fetchSeqRef.current) setOnlineUsers([]);
        return;
      }

      const ids = rows.map((r) => r.user_id);
      const [{ data: profs }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', ids),
        supabase.from('user_roles').select('user_id, role').in('user_id', ids),
      ]);

      if (seq !== fetchSeqRef.current) return;

      const profileNameByUser = new Map<string, string | null>(
        (profs || []).map((p: { user_id: string; full_name: string | null }) => [
          p.user_id,
          p.full_name,
        ])
      );

      const rolesByUser = new Map<string, Set<string>>();
      (roleRows || []).forEach((row: { user_id: string; role: string }) => {
        if (!rolesByUser.has(row.user_id)) rolesByUser.set(row.user_id, new Set());
        rolesByUser.get(row.user_id)!.add(row.role);
      });

      const effectiveRole = (userId: string, presenceRole: string | null): string | null => {
        const set = rolesByUser.get(userId);
        if (set?.has('admin')) return 'admin';
        if (set?.has('moderator')) return 'moderator';
        if (presenceRole) return presenceRole;
        if (set?.has('user')) return 'user';
        return null;
      };

      if (seq !== fetchSeqRef.current) return;

      setOnlineUsers(
        rows.map((r) => ({
          ...r,
          full_name:
            (r.full_name && String(r.full_name).trim()) ||
            profileNameByUser.get(r.user_id)?.trim() ||
            null,
          role: effectiveRole(r.user_id, r.role),
        }))
      );
    } catch (err) {
      console.warn('Error fetching online users:', err);
    }
  }, [user, hasPermission, isAdmin, isModerator, userRole]);

  const fetchOnlineUsersRef = useRef(fetchOnlineUsers);
  fetchOnlineUsersRef.current = fetchOnlineUsers;

  const updatePresenceRef = useRef(updatePresence);
  updatePresenceRef.current = updatePresence;

  const scheduleFetchOnlineUsers = useCallback(() => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      void fetchOnlineUsersRef.current();
    }, 800);
  }, []);

  const startPollFallback = useCallback(() => {
    if (pollRef.current != null) return;
    pollRef.current = window.setInterval(() => {
      if (!realtimeOkRef.current) {
        void fetchOnlineUsersRef.current();
      }
    }, 60_000);
  }, []);

  const stopPollFallback = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Heartbeat: upsert only (no roster refetch on every tick).
  useEffect(() => {
    if (!user || !hasPermission) return;

    void updatePresenceRef.current(true);
    void fetchOnlineUsersRef.current();

    heartbeatRef.current = setInterval(() => {
      void updatePresenceRef.current(true);
    }, heartbeatInterval);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void updatePresenceRef.current(false);
      } else {
        void updatePresenceRef.current(true);
        scheduleFetchOnlineUsers();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, heartbeatInterval, hasPermission, scheduleFetchOnlineUsers]);

  // Realtime roster updates; poll only when Realtime is unavailable.
  useEffect(() => {
    if (!user || !hasPermission) return;

    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          scheduleFetchOnlineUsers();
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn('[presence] Realtime subscribe error:', err);
        }
        realtimeOkRef.current = status === 'SUBSCRIBED';
        if (realtimeOkRef.current) {
          stopPollFallback();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startPollFallback();
          scheduleFetchOnlineUsers();
        }
      });

    startPollFallback();

    return () => {
      stopPollFallback();
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      supabase.removeChannel(channel);
      realtimeOkRef.current = false;
    };
  }, [user, hasPermission, scheduleFetchOnlineUsers, startPollFallback, stopPollFallback]);

  return {
    onlineUsers,
    isAdmin,
    onlineCount: onlineUsers.length,
    onlineModerators: onlineUsers.filter(u => u.role === 'moderator' || u.role === 'admin')
  };
};
