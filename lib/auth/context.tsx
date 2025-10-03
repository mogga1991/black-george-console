'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { validateDomain, sanitizeRedirectUrl, clearSensitiveData, SECURITY_CONFIG } from '@/lib/security';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('🚀 AuthProvider initializing...');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      if (!supabase) {
        console.warn('Supabase not configured - using localStorage fallback');
        if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch (e) {
              console.error('Error parsing stored user:', e);
              localStorage.removeItem('user');
            }
          }
        }
        setLoading(false);
        return;
      }

      // Debug URL parameters
      if (typeof window !== 'undefined') {
        console.log('Current URL:', window.location.href);
        console.log('URL hash:', window.location.hash);
        console.log('URL search params:', window.location.search);
        
        // Check for OAuth callback parameters
        const urlParams = new URLSearchParams(window.location.search);
        const hasCode = urlParams.get('code');
        const hasError = urlParams.get('error');
        const hasState = urlParams.get('state');
        
        console.log('OAuth callback params:', {
          code: hasCode ? 'present' : 'missing',
          error: hasError,
          state: hasState ? 'present' : 'missing'
        });
      }

      try {
        console.log('Checking existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          throw error;
        }

        console.log('Session check result:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userEmail: session?.user?.email
        });

        if (session?.user) {
          console.log('Found existing session, setting user');
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0]
          });
        } else {
          console.log('No existing session found');
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    if (supabase) {
      console.log('Setting up auth state change listener...');
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('=== AUTH STATE CHANGE ===');
          console.log('Event:', event);
          console.log('Session exists:', !!session);
          console.log('User exists:', !!session?.user);
          console.log('User email:', session?.user?.email);
          console.log('User metadata:', session?.user?.user_metadata);
          console.log('Access token exists:', !!session?.access_token);
          console.log('Refresh token exists:', !!session?.refresh_token);
          console.log('========================');
          
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('✅ User signed in successfully:', session.user.email);
            console.log('Setting user state and clearing errors...');
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
            });
            setError(null);
            
            // Clear URL hash/query params after successful OAuth
            if (typeof window !== 'undefined' && (window.location.hash || window.location.search.includes('code='))) {
              console.log('Clearing OAuth callback parameters from URL...');
              window.history.replaceState(null, '', window.location.pathname);
            }
          } else if (event === 'SIGNED_OUT') {
            console.log('👋 User signed out');
            setUser(null);
            clearSensitiveData();
          } else if (event === 'TOKEN_REFRESHED') {
            console.log('🔄 Token refreshed');
            if (session?.user) {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
              });
            }
          } else if (event === 'PASSWORD_RECOVERY') {
            console.log('🔑 Password recovery initiated');
          } else if (event === 'USER_UPDATED') {
            console.log('👤 User updated');
            if (session?.user) {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
              });
            }
          } else {
            console.log('🔍 Unhandled auth event:', event);
          }
          
          console.log('Setting loading to false...');
          setLoading(false);
        }
      );

      return () => subscription.unsubscribe();
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!supabase) {
        // Fallback for when Supabase is not configured
        console.warn('Supabase not configured - using simple auth fallback');
        if (email && password) {
          const user = {
            id: '1',
            email,
            name: email.split('@')[0]
          };
          setUser(user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(user));
          }
        } else {
          throw new Error('Invalid credentials');
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0]
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    console.log('🚀 Starting Google OAuth sign in process...');
    setLoading(true);
    setError(null);
    
    try {
      if (!supabase) {
        // Fallback for when Supabase is not configured
        console.warn('Supabase not configured - simulating Google sign in');
        const user = {
          id: '2',
          email: 'user@gmail.com',
          name: 'Google User'
        };
        setUser(user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(user));
        }
        setLoading(false);
        return;
      }

      console.log('🔧 Supabase configuration check:');
      console.log('- Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('- Current domain:', typeof window !== 'undefined' ? window.location.hostname : 'server');
      console.log('- Current URL:', typeof window !== 'undefined' ? window.location.href : 'server');
      
      console.log('📋 OAuth settings:', SECURITY_CONFIG.OAUTH_SETTINGS);
      
      // Determine the correct redirect URL based on current domain
      const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://georgemogga.com';
      const redirectTo = `${currentDomain}/auth/callback`;
      
      console.log('🔗 Redirect URL:', redirectTo);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: SECURITY_CONFIG.OAUTH_SETTINGS
        }
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText
        });
        throw error;
      }
      
      console.log('✅ OAuth redirect initiated successfully');
      console.log('OAuth response data:', data);
      console.log('🔄 Waiting for auth state change to handle completion...');
      // Note: Don't set loading to false here - the auth state change will handle it
      
    } catch (err) {
      console.error('💥 Google sign in error:', err);
      setError(err instanceof Error ? err.message : 'Google sign in failed');
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      if (!supabase) {
        // Fallback for when Supabase is not configured
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user');
        }
        clearSensitiveData();
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      clearSensitiveData();
    } catch (err) {
      console.error('Sign out error:', err);
      // Force local sign out even if remote fails
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
      }
      clearSensitiveData();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}