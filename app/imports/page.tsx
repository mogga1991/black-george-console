'use client';
import * as React from 'react';
import * as XLSX from 'xlsx';

type Preview = { rows: any[]; kind: 'crexi_leads'|'crexi_inventory'|'leasing_csv'|null }

export default function ImportsPage() {
  const [preview, setPreview] = React.useState<Preview>({ rows: [], kind: null });
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // rudimentary "kind" detection
    const headers = Object.keys(rows[0] || {}).map(h => h.toLowerCase());
    const kind = headers.includes('lead id') || headers.includes('inquiry id') ? 'crexi_leads'
      : headers.includes('sqft') || headers.includes('cap rate') ? 'crexi_inventory'
      : 'leasing_csv';

    setPreview({ rows: rows.slice(0, 100), kind });
  }

  async function dryRunCommit(commit = false) {
    setBusy(true);
    try {
      const res = await fetch(`/api/imports/${commit ? 'commit' : 'dry-run'}`, {
        method: 'POST',
        body: JSON.stringify(preview),
        headers: { 'content-type': 'application/json' }
      });
      const json = await res.json();
      setResult(json);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Upload CSV/XLSX</h2>
        <input type="file" accept=".csv,.xlsx" onChange={onFile} className="mt-3" />
        {preview.kind && (
          <div className="mt-4 text-sm text-gray-600">
            Detected: <b>{preview.kind}</b> • Showing first {preview.rows.length} rows
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button className="rounded-lg border px-4 py-2" disabled={!preview.kind || busy} onClick={() => dryRunCommit(false)}>Dry Run</button>
          <button className="rounded-lg border px-4 py-2" disabled={!preview.kind || busy} onClick={() => dryRunCommit(true)}>Commit Import</button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Import Result</h3>
          <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </main>
  );
}