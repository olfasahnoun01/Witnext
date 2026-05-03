import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
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
    // Check if this is a new browser session (browser was closed and reopened)
    const isNewBrowserSession = !sessionStorage.getItem('browser_session_active');
    
    const initializeAuth = async () => {
      if (isNewBrowserSession) {
        sessionStorage.setItem('browser_session_active', 'true');
      }
      
      // Normal session initialization
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Handle session retrieval errors
      if (error) {
        console.error('Failed to get session:', error);
        await handleSessionExpired(error.message);
        setIsLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      sessionExpiredRef.current = false;
      setSessionExpired(false);
      setIsLoading(false);

      if (session?.user) {
        checkUserRoles(session.user.id);
        setupSessionTracking(session.user.id);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event);
      
      // Handle specific auth events
      if (event === 'TOKEN_REFRESHED') {
        sessionExpiredRef.current = false;
        setSessionExpired(false);
      }
      
      // Handle session expiration events
      if (event === 'SIGNED_OUT') {
        // Check if this was an automatic sign out (session expired)
        // vs a user-initiated sign out
        if (sessionExpiredRef.current) {
          // Already handled
          return;
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Check roles with setTimeout to avoid deadlock
      if (session?.user) {
        sessionExpiredRef.current = false;
        setSessionExpired(false);
        setTimeout(() => {
          checkUserRoles(session.user.id);
          setupSessionTracking(session.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
        setIsModerator(false);
      }
    });

    initializeAuth();

    // Set up periodic session validation (every 5 minutes)
    const sessionCheckInterval = setInterval(async () => {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session validation failed:', error);
        // Check if it's a refresh token error
        if (error.message?.includes('refresh_token') || 
            error.message?.includes('Invalid Refresh Token') ||
            error.message?.includes('session_not_found')) {
          await handleSessionExpired('Token de rafraîchissement invalide');
        }
      } else if (!currentSession && userRef.current) {
        // Session was lost unexpectedly
        await handleSessionExpired('Session perdue');
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, []);

  const setupSessionTracking = async (userId: string) => {
    const deviceId = getDeviceId();
    const channelName = `session_${userId}`;

    // Update active device in profiles (fails silently if migration not run)
    try {
      await supabase.from('profiles').update({ active_device_id: deviceId }).eq('user_id', userId);
    } catch (e) {
      console.log('Could not update active device (migration might be missing)', e);
    }

    const channel = supabase.channel(channelName);
    
    channel
      .on('broadcast', { event: 'new_login' }, (payload) => {
        if (payload.payload?.device_id && payload.payload.device_id !== deviceId) {
          console.log('Concurrent login detected, logging out...');
          handleSessionExpired('Concurrent login');
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

  const checkUserRoles = async (userId: string) => {
    try {
      // Check admin role
      const { data: adminData, error: adminError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      if (!adminError && adminData) {
        setIsAdmin(true);
        setIsModerator(true);
      } else {
        setIsAdmin(false);

        const { data: modData, error: modError } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'moderator',
        });

        if (!modError && modData) {
          setIsModerator(true);
        } else {
          const { data: userData, error: userError } = await supabase.rpc('has_role', {
            _user_id: userId,
            _role: 'user',
          });
          setIsModerator(!userError && !!userData);
        }
      }
    } catch (error) {
      // Check if error is due to session expiration
      if (error instanceof Error && 
          (error.message?.includes('JWT') || 
           error.message?.includes('token') ||
           error.message?.includes('session'))) {
        await handleSessionExpired('Erreur d\'authentification');
      }
      setIsAdmin(false);
      setIsModerator(false);
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