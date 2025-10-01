import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mapCrexiLead, mapCrexiProperty, mapLeasingCSV } from '@/lib/etl/mapping';

export const runtime = 'edge';

async function upsertLead(supabase: any, mapped: ReturnType<typeof mapCrexiLead>) {
  // try by email/phone; else insert
  let leadId: string | null = null;
  if (mapped.lead.email || mapped.lead.normalized_phone) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .or(`email.eq.${mapped.lead.email},normalized_phone.eq.${mapped.lead.normalized_phone}`)
      .limit(1).maybeSingle();
    if (existing?.id) leadId = existing.id;
  }
  if (!leadId) {
    const { data, error } = await supabase.from('leads').insert({
      ...mapped.lead,
      source_lead_id: mapped.foreign.source_lead_id || null
    }).select('id').single();
    if (error) throw error;
    leadId = data.id;
  }

  // optional opportunity
  if (leadId && mapped.opportunity?.title) {
    await supabase.from('opportunities').insert({
      lead_id: leadId,
      title: mapped.opportunity.title,
      stage: mapped.opportunity.stage || 'sourcing',
      probability: mapped.opportunity.probability ?? 20
    });
  }
  return leadId;
}

async function upsertProperty(supabase: any, prop: any) {
  if (!prop?.address_key) return null;
  const { data: existing } = await supabase
    .from('properties')
    .select('id')
    .eq('address_key', prop.address_key)
    .limit(1).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.from('properties').insert(prop).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json() as { rows: any[]; kind: string };
  const rows = body.rows || [];
  let created = 0, merged = 0, errors: any[] = [];

  if (!supabase) {
    // Supabase not configured
    errors.push('Supabase not configured - cannot commit data');
    return NextResponse.json({ kind: body.kind, created, merged, errors });
  }

  try {
    if (body.kind === 'crexi_leads') {
      for (const r of rows) {
        try {
          const mapped = mapCrexiLead(r);
          const before = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .or(`email.eq.${mapped.lead.email},normalized_phone.eq.${mapped.lead.normalized_phone}`);
          const id = await upsertLead(supabase, mapped);
          if ((before.count ?? 0) > 0) merged++; else created++;
          await supabase.from('activities').insert({
            entity_type: 'lead', entity_id: id, type: 'import',
            body: 'Imported from ' + mapped.source
          });
        } catch (e: any) { errors.push(String(e?.message || e)); }
      }
    } else if (body.kind === 'crexi_inventory') {
      for (const r of rows) {
        try {
          const prop = mapCrexiProperty(r).property;
          if (!prop.address_key) continue;
          const before = await supabase
            .from('properties').select('id', { count: 'exact', head: true })
            .eq('address_key', prop.address_key);
          await upsertProperty(supabase, prop);
          if ((before.count ?? 0) > 0) merged++; else created++;
        } catch (e: any) { errors.push(String(e?.message || e)); }
      }
    } else {
      for (const r of rows) {
        try {
          const m = mapLeasingCSV(r);
          // create placeholder property first (if address present)
          const propId = await upsertProperty(supabase, {
            ...m.property,
            address_key: (m.property?.address1 && m.property?.city && m.property?.state && m.property?.postal_code)
              ? (m.property.address1.toLowerCase() + '|' + m.property.city.toLowerCase() + '|' + m.property.state.toUpperCase() + '|' + m.property.postal_code)
              : null
          });
          // upsert lead
          const mapped = {
            source: 'LeasingOffice',
            lead: m.lead,
            opportunity: propId ? { title: 'Leasing Opportunity', stage: 'sourcing' as const, probability: 20 } : null,
            foreign: { source_lead_id: null }
          };
          const before = await supabase
            .from('leads').select('id', { count: 'exact', head: true })
            .or(`email.eq.${m.lead.email},normalized_phone.eq.${m.lead.normalized_phone}`);
          const id = await upsertLead(supabase, mapped as any);
          if ((before.count ?? 0) > 0) merged++; else created++;
          await supabase.from('activities').insert({
            entity_type: 'lead', entity_id: id, type: 'import',
            body: 'Imported from LeasingOffice'
          });
        } catch (e: any) { errors.push(String(e?.message || e)); }
      }
    }
  } catch (error) {
    errors.push('Supabase not configured properly');
  }

  return NextResponse.json({ kind: body.kind, created, merged, errors });
}