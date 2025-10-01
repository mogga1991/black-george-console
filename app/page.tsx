import { createClient } from '@/lib/supabase/server';

export default async function Dashboard() {
  const supabase = await createClient();
  // For now, we'll show placeholder data since Supabase isn't set up yet
  const leadsNew = 0;
  const oppsOpen = 0;

  return (
    <main className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="rounded-xl border bg-white p-5">
        <div className="text-sm text-gray-500">New Leads</div>
        <div className="mt-2 text-3xl font-semibold">{leadsNew ?? 0}</div>
      </div>
      <div className="rounded-xl border bg-white p-5">
        <div className="text-sm text-gray-500">Open Opportunities</div>
        <div className="mt-2 text-3xl font-semibold">{oppsOpen ?? 0}</div>
      </div>
      <div className="rounded-xl border bg-white p-5">
        <div className="text-sm text-gray-500">Data Source</div>
        <div className="mt-2">CREXI + Leasing Office</div>
      </div>
    </main>
  );
}
