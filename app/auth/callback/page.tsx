'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('🔄 Processing OAuth callback...');
      console.log('Current URL:', window.location.href);
      console.log('URL hash:', window.location.hash);
      console.log('URL search:', window.location.search);

      try {
        if (!supabase) {
          console.error('❌ Supabase client not available');
          router.push('/login?error=no_supabase');
          return;
        }

        // Get the current session after OAuth callback
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Session error:', error);
          router.push('/login?error=session_failed');
          return;
        }

        if (session && session.user) {
          console.log('✅ OAuth callback successful!');
          console.log('User:', session.user.email);
          console.log('Redirecting to home page...');
          router.push('/');
        } else {
          console.log('❌ No session found after callback');
          router.push('/login?error=no_session');
        }
      } catch (err) {
        console.error('💥 Callback processing error:', err);
        router.push('/login?error=callback_failed');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-white text-lg">Completing sign in...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait while we finish setting up your account</p>
      </div>
    </div>
  );
}