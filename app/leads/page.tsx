import { createClient } from '@/lib/supabase/server';

export default async function LeadsPage() {
  const supabase = await createClient();
  
  // Placeholder data since Supabase isn't configured yet
  const data: any[] = [];

  return (
    <main className="rounded-xl border bg-white p-5">
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
                  No leads yet. Upload data via the Imports page to get started.
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
    </main>
  );
}