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

  // Update presence in database - errors are silently logged, never thrown
  // Strategy: Try UPDATE first (works if record exists), then INSERT if no rows updated
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user) return;

    try {
      // Verify session is still valid before attempting update
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Session expired, don't attempt update
        return;
      }

      // Try UPDATE first - this works because users can update their own presence
      const { data: updateData, error: updateError } = await supabase
        .from('user_presence')
        .update({
          email: user.email,
          role: userRole,
          last_seen: new Date().toISOString(),
          is_online: isOnline
        })
        .eq('user_id', user.id)
        .select('id');

      // If update succeeded with a result, we're done
      if (!updateError && updateData && updateData.length > 0) {
        return;
      }

      // If update returned no rows (record doesn't exist), try INSERT
      if (!updateError && (!updateData || updateData.length === 0)) {
        const { error: insertError } = await supabase
          .from('user_presence')
          .insert({
            user_id: user.id,
            email: user.email,
            role: userRole,
            last_seen: new Date().toISOString(),
            is_online: isOnline
          });

        if (insertError) {
          // Conflict means another request already inserted - that's fine
          if (insertError.code === '23505') {
            // Record was inserted by another request, try update again
            await supabase
              .from('user_presence')
              .update({
                email: user.email,
                role: userRole,
                last_seen: new Date().toISOString(),
                is_online: isOnline
              })
              .eq('user_id', user.id);
          } else if (insertError.code !== '42501') {
            console.warn('Presence insert failed (ignored):', insertError.message);
          }
        }
        return;
      }

      // Log update errors only if they're not RLS related
      if (updateError && updateError.code !== '42501') {
        console.warn('Presence update failed (ignored):', updateError.message);
      }
    } catch (err) {
      // Silently catch all errors - presence is non-critical functionality
      console.warn('Presence update error (ignored):', err);
    }
  }, [user, userRole]);

  // Fetch online users (admin and moderator) - errors are silently logged
  const fetchOnlineUsers = useCallback(async () => {
    if (!user || (!isAdmin && !isModerator)) return;

    try {
      // Verify session is still valid
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get users who were online in the last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true)
        .gte('last_seen', twoMinutesAgo)
        .order('last_seen', { ascending: false });

      if (error) {
        console.warn('Fetching online users failed (ignored):', error.message);
        return;
      }
      
      setOnlineUsers(data || []);
    } catch (err) {
      console.warn('Error fetching online users (ignored):', err);
    }
  }, [user, isAdmin, isModerator]);

  // Set up heartbeat
  useEffect(() => {
    if (!user) return;

    // Initial presence update
    updatePresence(true);

    // Heartbeat
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, heartbeatInterval);

    // Handle window close/unload - mark as offline
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const payload = JSON.stringify({
          is_online: false,
          last_seen: new Date().toISOString()
        });
        
        // Use sendBeacon with proper headers
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon?.(
          `${supabaseUrl}/rest/v1/user_presence?user_id=eq.${user.id}`,
          blob
        );
      }
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

  // Subscribe to presence changes (admin and moderator)
  useEffect(() => {
    if (!user || (!isAdmin && !isModerator)) return;

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
  }, [user, isAdmin, isModerator, fetchOnlineUsers]);

  return {
    onlineUsers,
    isAdmin,
    onlineCount: onlineUsers.length,
    onlineModerators: onlineUsers.filter(u => u.role === 'moderator' || u.role === 'admin')
  };
};
