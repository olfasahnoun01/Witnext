import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OnlineUser {
  user_id: string;
  email: string | null;
  role: string | null;
  last_seen: string;
  is_online: boolean;
}

interface UsePresenceOptions {
  heartbeatInterval?: number; // in ms, default 30s
}

export const usePresence = (options: UsePresenceOptions = {}) => {
  const { heartbeatInterval = 30000 } = options;
  const { user, isAdmin, isModerator } = useAuth();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
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
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          email: user.email,
          role: userRole,
          last_seen: new Date().toISOString(),
          is_online: isOnline
        }, { onConflict: 'user_id' });

      if (error) {
        // Circuit breaker: if we get a permission error or foreign key violation (stale session), stop trying
        if ((error as any).status === 403 || error.code === '42501' || error.code === '23503') {
          console.log(`Presence feature silenced: ${error.code === '23503' ? 'Session identity mismatch (migration effect)' : 'Insufficient permissions'}. Please re-login to restore status indicators.`);
          setHasPermission(false);
          return;
        }
        console.warn('Presence update failed (ignored):', error.message);
      }
    } catch (err) {
      console.warn('Presence update error (ignored):', err);
    }
  }, [user, userRole, hasPermission]);

  // Fetch online users (admin and moderator)
  const fetchOnlineUsers = useCallback(async () => {
    if (!user || (!isAdmin && !isModerator) || !hasPermission) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true)
        .gte('last_seen', twoMinutesAgo)
        .order('last_seen', { ascending: false });

      if (error) {
        if ((error as any).status === 403 || error.code === '42501') {
          setHasPermission(false);
          return;
        }
        console.warn('Fetching online users failed:', error.message);
        return;
      }
      
      setOnlineUsers(data || []);
    } catch (err) {
      console.warn('Error fetching online users:', err);
    }
  }, [user, isAdmin, isModerator, hasPermission]);

  // Set up heartbeat
  useEffect(() => {
    if (!user || !hasPermission) return;

    // Initial presence update
    const timer = setTimeout(() => updatePresence(true), 100);

    // Heartbeat
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, heartbeatInterval);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      // Attempt to mark as offline on unmount
      if (hasPermission) updatePresence(false);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, heartbeatInterval, updatePresence, hasPermission]);

  // Subscribe to presence changes (admin and moderator)
  useEffect(() => {
    if (!user || (!isAdmin && !isModerator) || !hasPermission) return;

    // Initial fetch
    fetchOnlineUsers();

    // Subscribe to realtime changes
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
          fetchOnlineUsers();
        }
      )
      .subscribe();

    return () => {
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
