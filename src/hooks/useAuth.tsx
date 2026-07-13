import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
// Single‑flight flag for token refresh
let isRefreshing = false;
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isAuthSessionError, isJwtExpiredError, refreshSupabaseSessionIfNeeded } from '@/lib/supabaseSession';
import { notifySessionResume } from '@/lib/sessionResume';
import { setActiveCompanyId } from '@/lib/activeCompany';
import { debugLog } from '@/lib/debugLog';
import {
  bumpSessionEpoch,
  clearSessionEpoch,
  isSessionEpochStale,
  readGlobalSessionEpoch,
  readTabSessionEpoch,
  adoptGlobalSessionEpoch,
  getOrCreateGlobalSessionEpoch,
  SESSION_EPOCH_KEY,
} from '@/lib/sessionEpoch';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  /** Witnext operator — can provision tenants / customer admins. UI only; RPCs enforce. */
  isPlatformAdmin: boolean;
  /** True after the first role check for the current user (or when logged out). */
  rolesReady: boolean;
  signOut: () => Promise<void>;
  sessionExpired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * SECURITY NOTE - IMPORTANT
 * =========================
 * 
 * The `isAdmin`, `isModerator`, and `isPlatformAdmin` flags are for UI/UX purposes ONLY.
 * They control which UI elements are displayed to the user.
 *
 * ACTUAL AUTHORIZATION is enforced at the database level through Row-Level Security (RLS) policies
 * and Edge Functions. Sensitive operations verify roles server-side (`has_role()`,
 * `is_platform_admin()`, tenant membership).
 *
 * DO NOT rely solely on these client-side flags for security decisions.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [rolesReady, setRolesReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const userRef = useRef<User | null>(null);
  const sessionExpiredRef = useRef(false);
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const authInitDoneRef = useRef(false);
  const sessionRestoredFromStorageRef = useRef(false);

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
      setActiveCompanyId(null);
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setIsModerator(false);
      setIsPlatformAdmin(false);
      setRolesReady(true);

      // Sign out globally – this revokes the refresh token on Supabase
      try {
        await supabase.auth.signOut({ scope: 'global' });
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
    sessionRestoredFromStorageRef.current = false;
    setIsLoading(true);

    adoptGlobalSessionEpoch();

    if (!sessionStorage.getItem('browser_session_active')) {
      sessionStorage.setItem('browser_session_active', 'true');
    }

    // Multi-tab: do not sign out on tab close — session is shared across tabs via
    // Supabase localStorage. Explicit logout and concurrent-login detection handle security.

    // Listen for role updates broadcasted from the server
    const roleChannel = supabase.channel('role_updates');
    roleChannel
      .on('broadcast', { event: 'role_update' }, async (payload) => {
        const updatedUserId = payload.payload?.userId as string | undefined;
        if (updatedUserId && user?.id === updatedUserId) {
          // Refresh role flags for the current user
          await checkUserRoles(updatedUserId);
          // Also refresh the JWT so role claims are up‑to‑date
          await supabase.auth.refreshSession();
        }
      })
      .subscribe();

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
        setIsPlatformAdmin(false);
        setRolesReady(true);
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
        if (shouldLoadRoles) {
          setRolesReady(false);
          await checkUserRoles(userId);
          if (!cancelled && userRef.current?.id === userId) setRolesReady(true);
        }
        if (cancelled || userRef.current?.id !== userId) return;
        if (options?.announceLogin) void setupSessionTracking(userId, true);
        else void setupSessionTracking(userId, false);
        // Permissions/company/modules load from their own user-id effects — do not
        // broadcast a global resume here (tab wake / TOKEN_REFRESHED would reset forms).
      })();
    };

    const completeInitialAuth = (nextSession: Session | null) => {
      if (cancelled) return;
      if (nextSession?.user) {
        sessionRestoredFromStorageRef.current = true;
      }
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
            // Keep previous session object when the access token is unchanged so
            // consumers depending on `session` identity do not remount the shell.
            setSession((prev) =>
              prev?.access_token === nextSession?.access_token ? prev : nextSession
            );
            setUser((prev) => {
              if (!nextSession?.user) return null;
              return prev?.id === nextSession.user.id ? prev : nextSession.user;
            });
            return;
          }

          if (event === 'SIGNED_OUT') {
            if (sessionExpiredRef.current) return;
            sessionRestoredFromStorageRef.current = false;
            syncAuthSession(null);
            finishAuthInit();
            return;
          }

        if (event === 'SIGNED_IN') {
          const isFreshLogin = !sessionRestoredFromStorageRef.current;
          if (nextSession?.user) {
            sessionRestoredFromStorageRef.current = true;
          }
          syncAuthSession(nextSession);
          finishAuthInit();
          if (nextSession?.user) {
            runDeferredAuthWork(nextSession, { announceLogin: isFreshLogin });
          }
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
        if (isRefreshing) {
          // Another refresh is already in progress – wait for it to finish
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { ok: true, refreshed: false };
        }
        isRefreshing = true;
        const ok = await refreshSupabaseSessionIfNeeded(0);
        isRefreshing = false;
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
      if (isSessionEpochStale()) {
        void handleSessionExpired('Concurrent login');
        return;
      }
      debugLog('useAuth.tsx:resumeAfterIdle', 'wake/resume triggered', {
        visibility: document.visibilityState,
      }, 'C');
      void validateOrRefreshSession().then(({ ok, refreshed }) => {
        debugLog('useAuth.tsx:resumeAfterIdle', 'validate result', { ok, refreshed }, 'A');
        // Only notify data loaders when the token was actually refreshed — not on every
        // tab/window focus, which was unmounting in-progress forms via bootstrap loading.
        if (ok && refreshed) notifySessionResume();
      });
    };

    // focus + visibilitychange + pageshow often fire together on tab return.
    let resumeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleResumeAfterIdle = () => {
      if (resumeDebounceTimer) clearTimeout(resumeDebounceTimer);
      resumeDebounceTimer = setTimeout(() => {
        resumeDebounceTimer = null;
        resumeAfterIdle();
      }, 250);
    };

    const sessionCheckInterval = setInterval(() => {
      void validateOrRefreshSession().then(({ ok, refreshed }) => {
        if (ok && refreshed) notifySessionResume();
      });
    }, 3 * 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleResumeAfterIdle();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', scheduleResumeAfterIdle);
    window.addEventListener('online', scheduleResumeAfterIdle);
    window.addEventListener('pageshow', scheduleResumeAfterIdle);

    const onSessionInvalid = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      void handleSessionExpired(reason || 'Session expirée');
    };
    window.addEventListener('app:session-invalid', onSessionInvalid);

    const onEpochStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_EPOCH_KEY || event.storageArea !== localStorage) return;
      if (event.newValue) adoptGlobalSessionEpoch();
    };
    window.addEventListener('storage', onEpochStorage);

    const epochCheckInterval = window.setInterval(() => {
      if (isSessionEpochStale()) {
        void handleSessionExpired('Concurrent login');
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
      clearInterval(epochCheckInterval);
      if (resumeDebounceTimer) clearTimeout(resumeDebounceTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', scheduleResumeAfterIdle);
      window.removeEventListener('online', scheduleResumeAfterIdle);
      window.removeEventListener('pageshow', scheduleResumeAfterIdle);
      window.removeEventListener('app:session-invalid', onSessionInvalid);
      window.removeEventListener('storage', onEpochStorage);
      roleChannel.unsubscribe();
      removeSessionChannel();
    };
  }, []);

  const setupSessionTracking = async (userId: string, isFreshLogin: boolean) => {
    const deviceId = getDeviceId();
    const channelName = `session_${userId}`;

    if (!isFreshLogin) {
      getOrCreateGlobalSessionEpoch();
      adoptGlobalSessionEpoch();
      if (isSessionEpochStale()) {
        await handleSessionExpired('Concurrent login');
        return;
      }
    }

    const sessionEpoch = isFreshLogin
      ? bumpSessionEpoch()
      : (readGlobalSessionEpoch() ?? getOrCreateGlobalSessionEpoch());

    if (!isFreshLogin) {
      adoptGlobalSessionEpoch();
    }

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
        const incomingEpoch = payload.payload?.session_epoch as string | undefined;
        const tabEpoch = readTabSessionEpoch();
        const incomingDeviceId = payload.payload?.device_id as string | undefined;

        if (incomingEpoch && tabEpoch && incomingEpoch !== tabEpoch) {
          if (incomingDeviceId === deviceId) {
            adoptGlobalSessionEpoch();
            return;
          }
          console.log('Concurrent login detected, logging out...');
          void handleSessionExpired('Concurrent login');
          return;
        }
        if (incomingDeviceId && incomingDeviceId !== deviceId && !incomingEpoch) {
          console.log('Concurrent login detected, logging out...');
          void handleSessionExpired('Concurrent login');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isFreshLogin) {
          await channel.send({
            type: 'broadcast',
            event: 'new_login',
            payload: { device_id: deviceId, session_epoch: sessionEpoch },
          });
        }
      });
  };

  const applyRoleFlags = (
    userId: string,
    admin: boolean,
    moderator: boolean,
    platformAdmin: boolean
  ) => {
    if (userRef.current?.id !== userId) return;
    setIsAdmin(admin);
    setIsModerator(moderator);
    setIsPlatformAdmin(platformAdmin);
  };

  const checkUserRoles = async (userId: string) => {
    try {
      const [{ data: platformData }, { data: adminData, error: adminError }] = await Promise.all([
        supabase.rpc('is_platform_admin'),
        supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
      ]);

      const platformAdmin = !!platformData;

      if (!adminError && adminData) {
        applyRoleFlags(userId, true, true, platformAdmin);
        return;
      }

      const { data: modData, error: modError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'moderator',
      });

      if (!modError && modData) {
        applyRoleFlags(userId, false, true, platformAdmin);
        return;
      }

      // Platform operators may not have a tenant app_role — still mark platform access.
      applyRoleFlags(userId, false, false, platformAdmin);
    } catch (error) {
      // Check if error is due to session expiration
      if (error instanceof Error && isAuthSessionError(error.message)) {
        await handleSessionExpired('Erreur d\'authentification');
      }
      applyRoleFlags(userId, false, false, false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    clearSessionEpoch();
    sessionRestoredFromStorageRef.current = false;
    setActiveCompanyId(null);
    sessionExpiredRef.current = false;
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsModerator(false);
    setIsPlatformAdmin(false);
    setRolesReady(true);
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        isModerator,
        isPlatformAdmin,
        rolesReady,
        signOut,
        sessionExpired,
      }}
    >
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