// Database integration functions for SAM.gov scheduler
import { createClient } from '@supabase/supabase-js';

export interface OpportunityRecord {
  id: string;
  solicitation_number: string;
  title: string;
  status: string;
  last_status_check: string;
  response_due_date?: string;
  award_date?: string;
  commercial_real_estate_score: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export class SAMGovDatabase {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Store new opportunities from SAM.gov
  async storeOpportunities(opportunities: any[]): Promise<{ stored: number; skipped: number; errors: string[] }> {
    const results = { stored: 0, skipped: 0, errors: [] };
    
    try {
      // Transform SAM.gov data to our schema
      const records = opportunities.map(opp => this.transformSAMGovOpportunity(opp));
      
      // Batch upsert to avoid duplicates
      const { data, error } = await this.supabase
        .from('rfp_opportunities')
        .upsert(records, { 
          onConflict: 'solicitation_number',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        results.errors.push(`Batch upsert failed: ${error.message}`);
        return results;
      }

      results.stored = data?.length || 0;
      console.log(`✅ Successfully stored ${results.stored} opportunities`);

    } catch (error) {
      results.errors.push(`Database operation failed: ${error}`);
      console.error('❌ Store opportunities error:', error);
    }

    return results;
  }

  // Get opportunities that need status updates
  async getStaleOpportunities(hoursStale: number = 24): Promise<OpportunityRecord[]> {
    try {
      const staleTime = new Date(Date.now() - hoursStale * 60 * 60 * 1000);
      
      const { data, error } = await this.supabase
        .from('rfp_opportunities')
        .select(`
          id,
          solicitation_number,
          title,
          status,
          last_status_check,
          response_due_date,
          award_date,
          commercial_real_estate_score,
          source,
          created_at,
          updated_at
        `)
        .in('status', ['open', 'draft'])
        .or(`last_status_check.is.null,last_status_check.lt.${staleTime.toISOString()}`)
        .order('last_status_check', { ascending: true, nullsFirst: true })
        .limit(100);

      if (error) {
        console.error('❌ Failed to get stale opportunities:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Get stale opportunities error:', error);
      return [];
    }
  }

  // Update opportunity status
  async updateOpportunityStatus(id: string, status: string, awardDate?: string): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        last_status_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (awardDate) {
        updateData.award_date = awardDate;
      }

      const { error } = await this.supabase
        .from('rfp_opportunities')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error(`❌ Failed to update opportunity ${id}:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Update opportunity status error:', error);
      return false;
    }
  }

  // Clean up old/expired opportunities
  async cleanupOpportunities(): Promise<{ deleted: number; errors: string[] }> {
    const results = { deleted: 0, errors: [] };
    
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Build cleanup conditions
      const cleanupConditions = [
        // Awarded opportunities older than 30 days
        `and(status.eq.awarded,award_date.lt.${thirtyDaysAgo.toISOString()})`,
        
        // Closed opportunities older than 7 days
        `and(status.eq.closed,updated_at.lt.${sevenDaysAgo.toISOString()})`,
        
        // Opportunities with past due dates (more than 30 days overdue)
        `and(status.in.(open,draft),response_due_date.lt.${thirtyDaysAgo.toISOString()})`
      ];

      let totalDeleted = 0;

      for (const condition of cleanupConditions) {
        const { data, error } = await this.supabase
          .from('rfp_opportunities')
          .delete()
          .or(condition)
          .select('id');

        if (error) {
          results.errors.push(`Cleanup condition failed: ${error.message}`);
          continue;
        }

        const deleted = data?.length || 0;
        totalDeleted += deleted;
        console.log(`🗑️ Deleted ${deleted} opportunities for condition: ${condition}`);
      }

      results.deleted = totalDeleted;
      console.log(`✅ Total cleanup: ${totalDeleted} opportunities removed`);

    } catch (error) {
      results.errors.push(`Cleanup operation failed: ${error}`);
      console.error('❌ Cleanup opportunities error:', error);
    }

    return results;
  }

  // Get sync statistics
  async getSyncStats(days: number = 7): Promise<any> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const { data: totalCount } = await this.supabase
        .from('rfp_opportunities')
        .select('*', { count: 'exact', head: true });

      const { data: recentCount } = await this.supabase
        .from('rfp_opportunities')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since.toISOString());

      const { data: statusBreakdown } = await this.supabase
        .from('rfp_opportunities')
        .select('status')
        .gte('created_at', since.toISOString());

      const statusCounts = statusBreakdown?.reduce((acc: any, row: any) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {}) || {};

      const { data: sourceBreakdown } = await this.supabase
        .from('rfp_opportunities')
        .select('source')
        .gte('created_at', since.toISOString());

      const sourceCounts = sourceBreakdown?.reduce((acc: any, row: any) => {
        acc[row.source] = (acc[row.source] || 0) + 1;
        return acc;
      }, {}) || {};

      return {
        totalOpportunities: totalCount?.length || 0,
        recentOpportunities: recentCount?.length || 0,
        statusBreakdown: statusCounts,
        sourceBreakdown: sourceCounts,
        period: `Last ${days} days`
      };

    } catch (error) {
      console.error('❌ Get sync stats error:', error);
      return null;
    }
  }

  // Transform SAM.gov opportunity to our database schema
  private transformSAMGovOpportunity(samOpp: any): any {
    const creScore = this.calculateCREScore(samOpp);
    
    return {
      id: `sam-${samOpp.opportunityId}`,
      solicitation_number: samOpp.solicitationNumber,
      title: samOpp.title,
      description: samOpp.description || '',
      synopsis: samOpp.synopsis || '',
      
      // Agency information
      issuing_agency: samOpp.fullParentPathName || 'Unknown Agency',
      agency_code: samOpp.fullParentPathCode,
      
      // Opportunity details
      rfp_type: this.mapRFPType(samOpp.type),
      status: samOpp.active === 'Yes' ? 'open' : 'closed',
      set_aside_type: samOpp.typeOfSetAside || 'none',
      
      // CRE specific
      naics_codes: samOpp.naicsCode ? [samOpp.naicsCode] : [],
      commercial_real_estate_score: creScore,
      
      // Timeline
      posted_date: samOpp.postedDate ? new Date(samOpp.postedDate).toISOString() : null,
      response_due_date: samOpp.responseDeadLine ? new Date(samOpp.responseDeadLine).toISOString() : null,
      
      // Location
      place_of_performance_state: samOpp.placeOfPerformance?.state?.code,
      place_of_performance_city: samOpp.placeOfPerformance?.city?.name,
      place_of_performance_zip: samOpp.placeOfPerformance?.zip,
      place_of_performance_country: 'USA',
      
      // Links
      sam_gov_url: samOpp.uiLink,
      
      // Data source
      source: 'sam.gov',
      source_id: samOpp.opportunityId,
      last_status_check: new Date().toISOString(),
      extraction_confidence: 0.8,
      
      // System fields
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    };
  }

  // Calculate commercial real estate relevance score
  private calculateCREScore(opp: any): number {
    let score = 0;
    
    // NAICS code analysis
    if (opp.naicsCode) {
      const naics = opp.naicsCode;
      if (naics.startsWith('236')) score += 40; // Construction
      if (naics.startsWith('531')) score += 50; // Real estate
      if (naics.startsWith('238')) score += 30; // Specialty trades
    }
    
    // Title and description keyword analysis
    const text = (opp.title + ' ' + (opp.description || '')).toLowerCase();
    const creKeywords = [
      'office', 'warehouse', 'retail', 'building', 'space', 'lease', 'rent',
      'property', 'facility', 'construction', 'renovation', 'tenant'
    ];
    
    const foundKeywords = creKeywords.filter(keyword => text.includes(keyword));
    score += foundKeywords.length * 5;
    
    // Set aside considerations (government contracting often favors small business)
    if (opp.typeOfSetAside && opp.typeOfSetAside !== 'none') {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  // Map SAM.gov opportunity type to our RFP type enum
  private mapRFPType(samType: string): string {
    if (!samType) return 'rfp';
    
    const type = samType.toLowerCase();
    if (type.includes('solicitation')) return 'rfp';
    if (type.includes('quote') || type.includes('rfq')) return 'rfq';
    if (type.includes('invitation') || type.includes('ifb')) return 'ifb';
    if (type.includes('sources')) return 'sources_sought';
    if (type.includes('presolicitation')) return 'presolicitation';
    
    return 'rfp';
  }
}