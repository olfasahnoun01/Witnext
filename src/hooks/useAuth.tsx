import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    // Check if this is a new browser session (browser was closed and reopened)
    const isNewBrowserSession = !sessionStorage.getItem('browser_session_active');
    
    const initializeAuth = async () => {
      if (isNewBrowserSession) {
        // Mark this browser session as active
        sessionStorage.setItem('browser_session_active', 'true');
        
        // Check if there's an existing auth session from localStorage
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          // User closed browser without logging out - sign them out now
          console.log('Browser was closed without logout - signing out user');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setIsModerator(false);
          setIsLoading(false);
          return;
        }
      }
      
      // Normal session initialization
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        checkUserRoles(session.user.id);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Check roles with setTimeout to avoid deadlock
      if (session?.user) {
        setTimeout(() => {
          checkUserRoles(session.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
        setIsModerator(false);
      }
    });

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRoles = async (userId: string) => {
    try {
      // Check admin role
      const { data: adminData, error: adminError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      if (!adminError && adminData) {
        setIsAdmin(true);
        setIsModerator(true); // Admin has all moderator permissions
      } else {
        setIsAdmin(false);
        
        // Check moderator role only if not admin
        const { data: modData, error: modError } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'moderator'
        });
        
        setIsModerator(!modError && !!modData);
      }
    } catch {
      setIsAdmin(false);
      setIsModerator(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsModerator(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, isModerator, signOut }}>
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