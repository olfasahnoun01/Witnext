import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isAuthSessionError, isJwtExpiredError, refreshSupabaseSessionIfNeeded } from '@/lib/supabaseSession';
import { notifySessionResume } from '@/lib/sessionResume';
import { debugLog } from '@/lib/debugLog';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  signOut: () => Promise<void>;
  sessionExpired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * SECURITY NOTE - IMPORTANT
 * =========================
 * 
 * The `isAdmin` and `isModerator` flags in this hook are for UI/UX purposes ONLY.
 * They control which UI elements are displayed to the user.
 * 
 * ACTUAL AUTHORIZATION is enforced at the database level through Row-Level Security (RLS) policies.
 * All sensitive operations (INSERT, UPDATE, DELETE) are protected by RLS policies that verify
 * the user's role server-side using the `has_role()` database function.
 * 
 * DO NOT rely solely on these client-side flags for security decisions.
 * Any attempt to manipulate these values client-side will result in RLS policy violations
 * when trying to perform unauthorized database operations.
 * 
 * The security model:
 * 1. Client-side: isAdmin/isModerator → Controls UI visibility (shows/hides buttons)
 * 2. Server-side: RLS policies → Enforces actual permissions (blocks unauthorized operations)
 * 
 * If a user manipulates the client-side flags, they will see admin UI elements but:
 * - Database operations will fail with "permission denied" errors
 * - The user cannot actually modify protected data
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const userRef = useRef<User | null>(null);
  const sessionExpiredRef = useRef(false);
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const authInitDoneRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    sessionExpiredRef.current = sessionExpired;
  }, [sessionExpired]);

  // Device ID for tracking concurrent logins
  const getDeviceId = () => {
    let id = localStorage.getItem('grosafe_device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('grosafe_device_id', id);
    }
    return id;
  };

  // Handle session expiration with user-friendly message
  const handleSessionExpired = async (reason: string = 'Session expirée') => {
    sessionExpiredRef.current = true;
    setSessionExpired(true);
    
    // Clear local auth state
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsModerator(false);
    
    // Sign out to clear any stale tokens
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore errors during cleanup
    }
    
    // Clear any stale session markers
    sessionStorage.removeItem('browser_session_active');
    
    // Show toast notification
    toast({
      title: '🔒 Session expirée',
      description: reason === 'Concurrent login' 
        ? 'Quelqu\'un s\'est connecté à votre compte depuis un autre appareil. Vous avez été déconnecté.'
        : 'Votre session a expiré. Veuillez vous reconnecter pour continuer.',
      variant: 'destructive',
      duration: 8000,
    });
  };

  useEffect(() => {
    authInitDoneRef.current = false;
    setIsLoading(true);

    if (!sessionStorage.getItem('browser_session_active')) {
      sessionStorage.setItem('browser_session_active', 'true');
    }

    let cancelled = false;
    let deferredRolesUserId: string | null = null;

    const finishAuthInit = () => {
      authInitDoneRef.current = true;
      setIsLoading(false);
    };

    const removeSessionChannel = () => {
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
    };

    // Sync only — never await RPC/network inside onAuthStateChange (blocks JWT attachment).
    const syncAuthSession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        deferredRolesUserId = null;
        setIsAdmin(false);
        setIsModerator(false);
        removeSessionChannel();
        return;
      }

      sessionExpiredRef.current = false;
      setSessionExpired(false);
    };

    const runDeferredAuthWork = (
      nextSession: Session,
      options?: { announceLogin?: boolean }
    ) => {
      const userId = nextSession.user.id;
      const shouldLoadRoles = deferredRolesUserId !== userId;
      if (shouldLoadRoles) deferredRolesUserId = userId;

      void (async () => {
        if (cancelled) return;
        if (shouldLoadRoles) await checkUserRoles(userId);
        if (cancelled || userRef.current?.id !== userId) return;
        if (options?.announceLogin) void setupSessionTracking(userId);
        // Roles + JWT are stable — reload permissions, dashboard, company context.
        notifySessionResume();
      })();
    };

    const completeInitialAuth = (nextSession: Session | null) => {
      if (cancelled) return;
      syncAuthSession(nextSession);
      if (!authInitDoneRef.current) {
        finishAuthInit();
      }
      if (nextSession?.user) {
        runDeferredAuthWork(nextSession);
      }
    };

    // INITIAL_SESSION can fire only once per client; Strict Mode remounts may miss it.
    void supabase.auth.getSession().then(({ data: { session: stored }, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('[Auth] getSession failed:', error);
        if (!authInitDoneRef.current) finishAuthInit();
        return;
      }
      completeInitialAuth(stored);
    });

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled && !authInitDoneRef.current) {
        if (import.meta.env.DEV) {
          console.warn('[Auth] Initialization timeout — releasing UI');
        }
        finishAuthInit();
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (import.meta.env.DEV && event !== 'INITIAL_SESSION') {
        console.log('Auth state change:', event);
      }

      try {
        if (event === 'INITIAL_SESSION') {
          completeInitialAuth(nextSession);
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          debugLog('useAuth.tsx:TOKEN_REFRESHED', 'auth event', {
            expiresAt: nextSession?.expires_at ?? null,
            userId: nextSession?.user?.id?.slice(0, 8) ?? null,
          }, 'D');
          sessionExpiredRef.current = false;
          setSessionExpired(false);
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          notifySessionResume();
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (sessionExpiredRef.current) return;
          syncAuthSession(null);
          finishAuthInit();
          return;
        }

        if (event === 'SIGNED_IN') {
          syncAuthSession(nextSession);
          finishAuthInit();
          if (nextSession?.user) runDeferredAuthWork(nextSession, { announceLogin: true });
          return;
        }

        syncAuthSession(nextSession);
        finishAuthInit();
        if (nextSession?.user) runDeferredAuthWork(nextSession);
      } catch (err) {
        console.error('[Auth] onAuthStateChange error:', err);
        finishAuthInit();
      }
    });

    const validateOrRefreshSession = async (): Promise<{ ok: boolean; refreshed: boolean }> => {
      if (!userRef.current) return { ok: false, refreshed: false };

      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session validation failed:', error);
        if (isAuthSessionError(error.message)) {
          await handleSessionExpired('Token de rafraîchissement invalide');
        }
        return { ok: false, refreshed: false };
      }

      if (!currentSession) {
        await handleSessionExpired('Session perdue');
        return { ok: false, refreshed: false };
      }

      const expiresAt = currentSession.expires_at ?? 0;
      const nowSec = Math.floor(Date.now() / 1000);
      if (expiresAt - nowSec <= 120) {
        const ok = await refreshSupabaseSessionIfNeeded(0);
        if (!ok) {
          debugLog('useAuth.tsx:validate', 'refresh failed, signing out', {
            secsToExpiry: expiresAt - nowSec,
          }, 'A');
          await handleSessionExpired('Session expirée');
          return { ok: false, refreshed: false };
        }
        debugLog('useAuth.tsx:validate', 'refresh succeeded on wake', {
          secsToExpiry: expiresAt - nowSec,
        }, 'A');
        return { ok: true, refreshed: true };
      }

      debugLog('useAuth.tsx:validate', 'session valid, no refresh needed', {
        secsToExpiry: expiresAt - nowSec,
      }, 'D');
      return { ok: true, refreshed: false };
    };

    const resumeAfterIdle = () => {
      if (!userRef.current) return;
      debugLog('useAuth.tsx:resumeAfterIdle', 'wake/resume triggered', {
        visibility: document.visibilityState,
      }, 'C');
      void validateOrRefreshSession().then(({ ok, refreshed }) => {
        debugLog('useAuth.tsx:resumeAfterIdle', 'validate result', { ok, refreshed }, 'A');
        if (ok) notifySessionResume();
      });
    };

    const sessionCheckInterval = setInterval(() => {
      void validateOrRefreshSession().then(({ ok, refreshed }) => {
        if (ok && refreshed) notifySessionResume();
      });
    }, 3 * 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resumeAfterIdle();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', resumeAfterIdle);
    window.addEventListener('online', resumeAfterIdle);
    window.addEventListener('pageshow', resumeAfterIdle);

    const onSessionInvalid = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      void handleSessionExpired(reason || 'Session expirée');
    };
    window.addEventListener('app:session-invalid', onSessionInvalid);

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', resumeAfterIdle);
      window.removeEventListener('online', resumeAfterIdle);
      window.removeEventListener('pageshow', resumeAfterIdle);
      window.removeEventListener('app:session-invalid', onSessionInvalid);
      removeSessionChannel();
    };
  }, []);

  const setupSessionTracking = async (userId: string) => {
    const deviceId = getDeviceId();
    const channelName = `session_${userId}`;

    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
      sessionChannelRef.current = null;
    }

    try {
      await supabase.from('profiles').update({ active_device_id: deviceId }).eq('user_id', userId);
    } catch (e) {
      console.log('Could not update active device (migration might be missing)', e);
    }

    const channel = supabase.channel(channelName);
    sessionChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'new_login' }, (payload) => {
        if (payload.payload?.device_id && payload.payload.device_id !== deviceId) {
          console.log('Concurrent login detected, logging out...');
          void handleSessionExpired('Concurrent login');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'new_login',
            payload: { device_id: deviceId },
          });
        }
      });
  };

  const applyRoleFlags = (userId: string, admin: boolean, moderator: boolean) => {
    if (userRef.current?.id !== userId) return;
    setIsAdmin(admin);
    setIsModerator(moderator);
  };

  const checkUserRoles = async (userId: string) => {
    try {
      const { data: adminData, error: adminError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });

      if (!adminError && adminData) {
        applyRoleFlags(userId, true, true);
        return;
      }

      const { data: modData, error: modError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'moderator',
      });

      if (!modError && modData) {
        applyRoleFlags(userId, false, true);
        return;
      }

      applyRoleFlags(userId, false, false);
    } catch (error) {
      // Check if error is due to session expiration
      if (error instanceof Error && isAuthSessionError(error.message)) {
        await handleSessionExpired('Erreur d\'authentification');
      }
      applyRoleFlags(userId, false, false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionExpiredRef.current = false;
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsModerator(false);
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, isModerator, signOut, sessionExpired }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};