import { createClient } from '@/lib/supabase/server';

export default async function PropertiesPage() {
  const supabase = await createClient();
  
  // Placeholder data since Supabase isn't configured yet
  const data: any[] = [];

  return (
    <main className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left">
            <th className="p-2">Address</th><th className="p-2">City</th><th className="p-2">State</th>
            <th className="p-2">ZIP</th><th className="p-2">Asking</th><th className="p-2">SqFt</th>
          </tr></thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No properties yet. Upload data via the Imports page to get started.
                </td>
              </tr>
            )}
            {data.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.address1}</td>
                <td className="p-2">{p.city}</td>
                <td className="p-2">{p.state}</td>
                <td className="p-2">{p.postal_code}</td>
                <td className="p-2">{p.asking_price ?? '-'}</td>
                <td className="p-2">{p.sqft ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}