'use client';
import { createBrowserClient } from '@supabase/ssr';

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('🔧 Creating Supabase client...');
  console.log('Supabase URL configured:', !!supabaseUrl);
  console.log('Supabase Key configured:', !!supabaseKey);

  // Return null if environment variables are not configured
  if (!supabaseUrl || !supabaseKey || 
      supabaseUrl === 'YOUR_SUPABASE_URL' || 
      supabaseUrl === 'YOUR_SUPABASE_PROJECT_URL' ||
      supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('❌ Supabase not configured - missing or placeholder environment variables');
    return null;
  }

  const client = createBrowserClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client created successfully');
  
  // Test the connection
  if (typeof window !== 'undefined') {
    client.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('❌ Supabase connection test failed:', error);
        console.error('Error details:', error.message);
      } else {
        console.log('✅ Supabase connection test successful');
        console.log('Session data:', data);
      }
    }).catch(err => {
      console.error('❌ Failed to test Supabase connection:', err);
    });
  }
  
  return client;
}

export const supabase = createSupabaseClient();

// Export createClient for compatibility
export const createClient = (url: string, key: string) => {
  return createBrowserClient(url, key);
};