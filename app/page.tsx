import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function Dashboard() {
  const supabase = await createClient();
  
  let leadsNew = 0;
  let oppsOpen = 0;
  let dbStatus = "Not configured";

  if (supabase) {
    try {
      // Try to fetch real data from Supabase
      const { count: newLeadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      
      const { count: openOppsCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .neq('stage', 'closed_won')
        .neq('stage', 'closed_lost');

      leadsNew = newLeadsCount || 0;
      oppsOpen = openOppsCount || 0;
      dbStatus = "Connected";
    } catch (error) {
      // Database not set up yet
      dbStatus = "Database not set up";
    }
  }

  return (
    <main className="space-y-6">
      {!supabase && (
        <div className="rounded-xl border bg-blue-50 p-5">
          <h3 className="font-semibold text-blue-900">Setup Required</h3>
          <p className="mt-1 text-sm text-blue-700">
            Configure your Supabase environment variables to enable full functionality. 
            See SETUP.md for instructions.
          </p>
        </div>
      )}
      
      {/* New Leasing Scout Feature Highlight */}
      <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-purple-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🤖 New: AI-Powered Leasing Scout</h3>
            <p className="mt-1 text-sm text-gray-600">
              Chat with AI to find properties and see results on an interactive map. 
              Natural language search meets visual discovery.
            </p>
          </div>
          <a 
            href="/leasing-scout" 
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try Leasing Scout →
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm text-gray-500">New Leads</div>
          <div className="mt-2 text-3xl font-semibold">{leadsNew}</div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm text-gray-500">Open Opportunities</div>
          <div className="mt-2 text-3xl font-semibold">{oppsOpen}</div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm text-gray-500">Database Status</div>
          <div className="mt-2">{dbStatus}</div>
        </div>
      </div>
    </main>
  );
}
