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

  // Determine user role string
  const userRole = isAdmin ? 'admin' : isModerator ? 'moderator' : 'user';

  // Update presence in database
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          email: user.email,
          role: userRole,
          last_seen: new Date().toISOString(),
          is_online: isOnline
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating presence:', error);
      }
    } catch (err) {
      console.error('Presence update failed:', err);
    }
  }, [user, userRole]);

  // Fetch online users (admin only)
  const fetchOnlineUsers = useCallback(async () => {
    if (!user || !isAdmin) return;

    try {
      // Get users who were online in the last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true)
        .gte('last_seen', twoMinutesAgo)
        .order('last_seen', { ascending: false });

      if (error) throw error;
      
      setOnlineUsers(data || []);
    } catch (err) {
      console.error('Error fetching online users:', err);
    }
  }, [user, isAdmin]);

  // Set up heartbeat
  useEffect(() => {
    if (!user) return;

    // Initial presence update
    updatePresence(true);

    // Heartbeat
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, heartbeatInterval);

    // Handle window close/unload
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update
      const payload = JSON.stringify({
        user_id: user.id,
        is_online: false,
        last_seen: new Date().toISOString()
      });
      
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`,
        payload
      );
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      updatePresence(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, userRole, heartbeatInterval, updatePresence]);

  // Subscribe to presence changes (admin only)
  useEffect(() => {
    if (!user || !isAdmin) return;

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

    // Also poll every 30s as backup
    const pollInterval = setInterval(fetchOnlineUsers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [user, userRole, fetchOnlineUsers]);

  return {
    onlineUsers,
    isAdmin,
    onlineCount: onlineUsers.length,
    onlineModerators: onlineUsers.filter(u => u.role === 'moderator' || u.role === 'admin')
  };
};
