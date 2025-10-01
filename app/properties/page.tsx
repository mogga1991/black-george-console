import { createClient } from '@/lib/supabase/server';

export default async function PropertiesPage() {
  const supabase = createClient();
  
  let data: any[] = [];
  
  if (supabase) {
    try {
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id,address1,city,state,postal_code,asking_price,sqft')
        .order('created_at', { ascending: false })
        .limit(100);
      data = propertiesData || [];
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
            Configure Supabase and run the database schema to view properties data.
          </p>
        </div>
      )}
      
      <div className="rounded-xl border bg-white p-5">
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
                    {!supabase 
                      ? "Configure Supabase to view properties data" 
                      : "No properties yet. Upload data via the Imports page to get started."}
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
      </div>
    </main>
  );
}