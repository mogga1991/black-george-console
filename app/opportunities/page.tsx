import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function OppsPage() {
  const supabase = await createClient();
  
  let data: any[] = [];
  
  if (supabase) {
    try {
      const { data: oppsData } = await supabase
        .from('opportunities')
        .select('id, title, stage, probability, expected_close_date, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100);
      data = oppsData || [];
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
            Configure Supabase and run the database schema to view opportunities data.
          </p>
        </div>
      )}
      
      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
        {data.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {!supabase 
              ? "Configure Supabase to view opportunities data" 
              : "No opportunities yet. Upload data via the Imports page to get started."}
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((o: any) => (
              <li key={o.id} className="rounded-lg border p-3">
                <div className="font-medium">{o.title}</div>
                <div className="text-sm text-gray-600">Stage: {o.stage} • Prob: {o.probability ?? '-'}%</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}