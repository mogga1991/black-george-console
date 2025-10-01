export type LeadRow = Record<string, any>;
export type PropertyRow = Record<string, any>;

import { norm, addressKey } from './normalize';

export function mapCrexiLead(row: LeadRow) {
  const name = (row['Contact Name'] ?? '').trim();
  const [first_name, ...rest] = name.split(' ');
  const last_name = rest.join(' ');
  return {
    source: 'CREXI',
    lead: {
      first_name,
      last_name,
      email: norm.email(row['Contact Email']),
      phone: row['Contact Phone'] ? String(row['Contact Phone']) : null,
      normalized_phone: norm.phoneDigits(row['Contact Phone']),
      company: norm.str(row['Company']),
      market: norm.str(row['Market'] || row['Location']),
      budget_min: norm.money(row['Budget Min'] || row['Budget']),
      budget_max: norm.money(row['Budget Max']),
      message: norm.str(row['Message']),
      status: 'new' as const,
      priority: 'med' as const
    },
    opportunity: {
      title: norm.str(row['Listing Title'] || row['Properties Interested In'] || 'CREXI Opportunity'),
      stage: (String(row['Pipeline Stage'] || '').toLowerCase() as any) || 'sourcing',
      value: null,
      probability: 20
    },
    foreign: {
      source_lead_id: String(row['Lead ID'] || row['Inquiry ID'] || '')
    }
  };
}

export function mapCrexiProperty(row: PropertyRow) {
  const state = norm.upperState(row['State']);
  const addr1 = norm.str(row['Address']);
  const city = norm.str(row['City']);
  const zip = norm.str(row['ZIP'] || row['Postal Code']);
  return {
    property: {
      address1: addr1,
      address2: norm.str(row['Address2']),
      city,
      state,
      postal_code: zip,
      county: norm.str(row['County']),
      msa: norm.str(row['MSA']),
      sqft: norm.money(row['SqFt']),
      units: Number(row['Units'] ?? 0) || null,
      lat: row['Latitude'] ? Number(row['Latitude']) : null,
      lng: row['Longitude'] ? Number(row['Longitude']) : null,
      asking_price: norm.money(row['Asking Price']),
      noi: norm.money(row['NOI']),
      cap_rate: row['Cap Rate'] ? Number(String(row['Cap Rate']).replace('%','')) : null,
      price_sqft: norm.money(row['Price/SqFt']),
      price_acre: norm.money(row['Price/Acre']),
      days_on_market: row['Days on Market'] ? Number(row['Days on Market']) : null,
      opportunity_zone: String(row['Opportunity Zone']||'').toLowerCase() === 'yes',
      address_key: addressKey(addr1, city, state || undefined, zip)
    }
  };
}

export function mapLeasingCSV(row: Record<string, any>) {
  const name = (row['Name'] || '').trim();
  const [first_name, ...rest] = name.split(' ');
  const last_name = rest.join(' ');
  const state = norm.upperState(row['State']);
  return {
    lead: {
      first_name, last_name,
      email: norm.email(row['Email']),
      phone: row['Phone'] ? String(row['Phone']) : null,
      normalized_phone: norm.phoneDigits(row['Phone']),
      company: norm.str(row['Company']),
      market: norm.str(row['City']),
      message: norm.str(row['Notes'] || ''),
      status: 'new' as const
    },
    property: {
      address1: norm.str(row['Address1'] || row['Address']),
      address2: norm.str(row['Address2']),
      city: norm.str(row['City']),
      state,
      postal_code: norm.str(row['Zip'])
    }
  };
}