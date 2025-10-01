import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mapCrexiLead, mapCrexiProperty, mapLeasingCSV } from '@/lib/etl/mapping';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json() as { rows: any[]; kind: string };
  const rows = body.rows || [];

  let creates = 0, merges = 0, notes: string[] = [];
  
  if (!supabase) {
    // Supabase not configured - return estimated counts
    creates = rows.length;
    notes.push('Supabase not configured - showing estimated counts');
    return NextResponse.json({ kind: body.kind, creates, merges, rowsAnalyzed: rows.length, notes });
  }
  
  try {
    if (body.kind === 'crexi_leads') {
      for (const r of rows) {
        const mapped = mapCrexiLead(r);
        if (mapped.lead.email || mapped.lead.normalized_phone) {
          // naive existence check (dry-run)
          const { count } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .or(`email.eq.${mapped.lead.email},normalized_phone.eq.${mapped.lead.normalized_phone}`);
          if ((count ?? 0) > 0) merges++; else creates++;
        } else {
          creates++;
        }
      }
    } else if (body.kind === 'crexi_inventory') {
      for (const r of rows) {
        const m = mapCrexiProperty(r).property;
        if (!m.address_key) continue;
        const { count } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('address_key', m.address_key);
        if ((count ?? 0) > 0) merges++; else creates++;
      }
    } else {
      // leasing csv
      for (const r of rows) {
        const m = mapLeasingCSV(r).lead;
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .or(`email.eq.${m.email},normalized_phone.eq.${m.normalized_phone}`);
        if ((count ?? 0) > 0) merges++; else creates++;
      }
    }
  } catch (error) {
    // Fallback to just counting creates if Supabase not configured
    creates = rows.length;
    notes.push('Supabase not configured - showing estimated counts');
  }

  return NextResponse.json({ kind: body.kind, creates, merges, rowsAnalyzed: rows.length, notes });
}