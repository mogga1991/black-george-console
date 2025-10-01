'use client';
import { createBrowserClient } from '@supabase/ssr';

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return null if environment variables are not configured
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}

export const supabase = createSupabaseClient();