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
  heartbeatInterval?: number; // in ms, default 30s
}

const sameUserId = (a: string, b: string) => a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();

export const usePresence = (options: UsePresenceOptions = {}) => {
  const { heartbeatInterval = 30000 } = options;
  const { user, isAdmin, isModerator } = useAuth();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const presenceWriteOkRef = useRef(false);
  /** Ignore stale fetch results when multiple fetchOnlineUsers overlap (poll + realtime + post-upsert). */
  const fetchSeqRef = useRef(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [hasPermission, setHasPermission] = useState(true);

  // Determine user role string
  const userRole = isAdmin ? 'admin' : isModerator ? 'moderator' : 'user';

  // Update presence in database - errors are silently handled
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user || !hasPermission) return;

    try {
      // Verify session is still valid
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Use atomic upsert to avoid 409 Conflict errors
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
        // Circuit breaker: if we get a permission error or foreign key violation (stale session), stop trying
        if ((error as any).status === 403 || error.code === '42501' || error.code === '23503') {
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

  // Fetch online users (admin and moderator)
  const fetchOnlineUsers = useCallback(async () => {
    if (!user || (!isAdmin && !isModerator) || !hasPermission) return;

    const seq = ++fetchSeqRef.current;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || seq !== fetchSeqRef.current) return;

      const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true)
        .gte('last_seen', recentCutoff)
        .order('last_seen', { ascending: false });

      if (seq !== fetchSeqRef.current) return;

      if (error) {
        // Do not disable heartbeats on read errors (RLS misconfig / transient); upsert path owns circuit-breaker.
        console.warn('Fetching online users failed:', error.message);
        return;
      }

      let rows = (data || []) as OnlineUser[];

      // If the roster SELECT misses you (race before upsert, RLS timing, or silent upsert issues), still show
      // yourself while the tab is visible so "Utilisateurs connectés" is not stuck at 0.
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        user &&
        (isAdmin || isModerator) &&
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
  }, [user, isAdmin, isModerator, hasPermission, userRole]);

  const fetchOnlineUsersRef = useRef(fetchOnlineUsers);
  fetchOnlineUsersRef.current = fetchOnlineUsers;

  const updatePresenceRef = useRef(updatePresence);
  updatePresenceRef.current = updatePresence;

  // Wrap upsert so staff refresh the roster as soon as their row is written (avoids racing fetch before upsert).
  const updatePresenceAndRefreshStaffList = useCallback(async (isOnline: boolean) => {
    await updatePresenceRef.current(isOnline);
    if (isOnline && (isAdmin || isModerator)) {
      void fetchOnlineUsersRef.current();
    }
  }, [isAdmin, isModerator]);

  // Set up heartbeat
  useEffect(() => {
    if (!user || !hasPermission) return;

    void updatePresenceAndRefreshStaffList(true);

    heartbeatRef.current = setInterval(() => {
      void updatePresenceAndRefreshStaffList(true);
    }, heartbeatInterval);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void updatePresenceRef.current(false);
      } else {
        void updatePresenceAndRefreshStaffList(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // Do not call updatePresence(false) here: this effect re-runs when userRole flips after
      // roles load (user → admin). Cleanup would mark you offline right before fetchOnlineUsers,
      // so "Utilisateurs connectés" stays empty until the next poll.
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, heartbeatInterval, updatePresenceAndRefreshStaffList, hasPermission]);

  // Subscribe to presence changes (admin and moderator), with polling fallback
  useEffect(() => {
    if (!user || (!isAdmin && !isModerator) || !hasPermission) return;

    void fetchOnlineUsers();

    const pollMs = 20000;
    const pollId = window.setInterval(() => {
      void fetchOnlineUsers();
    }, pollMs);

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
          void fetchOnlineUsers();
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn('[presence] Realtime subscribe error:', err);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void fetchOnlineUsers();
        }
      });

    return () => {
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, isModerator, fetchOnlineUsers, hasPermission]);

  return {
    onlineUsers,
    isAdmin,
    onlineCount: onlineUsers.length,
    onlineModerators: onlineUsers.filter(u => u.role === 'moderator' || u.role === 'admin')
  };
};
