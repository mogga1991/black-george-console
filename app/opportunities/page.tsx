import { createClient } from '@/lib/supabase/server';

export default async function OppsPage() {
  const supabase = await createClient();
  
  // Placeholder data since Supabase isn't configured yet
  const data: any[] = [];

  return (
    <main className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
      {data.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          No opportunities yet. Upload data via the Imports page to get started.
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
    </main>
  );
}