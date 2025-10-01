import { createClient } from '@/lib/supabase/server';

export default async function LeadsPage() {
  const supabase = createClient();
  
  let data: any[] = [];
  
  if (supabase) {
    try {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, company, market, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100);
      data = leadsData || [];
    } catch (error) {
      // Database not set up yet
    }
  }

  return (
    <main className="space-y-6">
      {!supabase && (
        <div className="rounded-xl border bg-blue-50 p-5">
          <h3 className="font-semibold text-blue-900">Database Required</h3>
          <p className="mt-1 text-sm text-blue-700">
            Configure Supabase and run the database schema to view leads data.
          </p>
        </div>
      )}
      
      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-4">Leads</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left">
              <th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Company</th>
              <th className="p-2">Market</th><th className="p-2">Status</th><th className="p-2">Updated</th>
            </tr></thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    {!supabase 
                      ? "Configure Supabase to view leads data" 
                      : "No leads yet. Upload data via the Imports page to get started."}
                  </td>
                </tr>
              )}
              {data.map((l: any) => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">{l.first_name} {l.last_name}</td>
                  <td className="p-2">{l.email}</td>
                  <td className="p-2">{l.company}</td>
                  <td className="p-2">{l.market}</td>
                  <td className="p-2">{l.status}</td>
                  <td className="p-2">{new Date(l.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}