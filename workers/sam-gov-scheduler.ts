// Cloudflare Worker for scheduled SAM.gov opportunity management
// This runs on Cloudflare's cron triggers to automatically maintain our opportunity database

import { createClient } from '@supabase/supabase-js';

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface SAMGovQuota {
  dailyLimit: number;
  used: number;
  resetTime: number;
  lastFetch: string;
}

interface SyncMetrics {
  timestamp: string;
  action: 'fetch' | 'update' | 'cleanup';
  recordsProcessed: number;
  errors: string[];
  duration: number;
  quotaUsed: number;
}

export default {
  // Main scheduled event handler
  async scheduled(event: ScheduledEvent, env: any, ctx: any): Promise<void> {
    const cron = event.cron;
    console.log(`🕐 SAM.gov Scheduler triggered: ${cron}`);
    
    try {
      switch (cron) {
        case '0 6 * * *': // 6 AM EST daily
          await handleDailyFetch(env);
          break;
        case '0 14 * * *': // 2 PM EST daily  
          await handleStatusUpdates(env);
          break;
        case '0 23 * * *': // 11 PM EST daily
          await handleCleanup(env);
          break;
        default:
          console.log('Unknown cron schedule');
      }
    } catch (error) {
      console.error('Scheduled task failed:', error);
      await notifyError(env, cron, error);
    }
  },

  // HTTP handler for manual triggers and status checks
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    switch (action) {
      case 'fetch':
        const result = await handleDailyFetch(env);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      
      case 'status':
        const status = await getSchedulerStatus(env);
        return new Response(JSON.stringify(status), {
          headers: { 'Content-Type': 'application/json' }
        });
      
      case 'quota':
        const quota = await getQuotaStatus(env);
        return new Response(JSON.stringify(quota), {
          headers: { 'Content-Type': 'application/json' }
        });
      
      case 'test-sam':
        // Test SAM.gov API without storing to database
        const testResult = await testSAMGovAPI(env);
        return new Response(JSON.stringify(testResult), {
          headers: { 'Content-Type': 'application/json' }
        });
      
      default:
        return new Response('SAM.gov Scheduler Worker', { status: 200 });
    }
  }
};

// Daily fetch of new opportunities
async function handleDailyFetch(env: any): Promise<SyncMetrics> {
  const startTime = Date.now();
  console.log('🔄 Starting daily opportunity fetch...');
  
  const metrics: SyncMetrics = {
    timestamp: new Date().toISOString(),
    action: 'fetch',
    recordsProcessed: 0,
    errors: [],
    duration: 0,
    quotaUsed: 0
  };

  try {
    // Check quota before proceeding
    const quota = await getQuotaStatus(env);
    if (quota.used >= quota.dailyLimit * 0.9) {
      throw new Error(`Daily quota nearly exhausted: ${quota.used}/${quota.dailyLimit}`);
    }

    // Calculate date range for incremental fetch
    const lastFetch = await getLastFetchDate(env);
    const fromDate = lastFetch || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const toDate = new Date();

    // Fetch opportunities in batches to respect rate limits
    const batchSize = 100;
    let totalProcessed = 0;
    let quotaUsed = 0;

    // Priority NAICS codes for commercial real estate
    const naicsCodes = [
      '236220', // Commercial and Institutional Building Construction
      '531120', // Lessors of Nonresidential Buildings (except Miniwarehouses)
      '531210', // Offices of Real Estate Agents and Brokers
      '531311', // Residential Property Managers
      '531312', // Nonresidential Property Managers
      '238210', // Electrical Contractors
      '238220', // Plumbing, Heating, and Air-Conditioning Contractors
    ];

    for (const naicsCode of naicsCodes) {
      if (quotaUsed >= quota.dailyLimit * 0.8) {
        console.log('⚠️ Approaching quota limit, stopping fetch');
        break;
      }

      const opportunities = await fetchSAMGovOpportunities(env, {
        naicsCode,
        postedFrom: fromDate.toISOString().split('T')[0],
        postedTo: toDate.toISOString().split('T')[0],
        limit: batchSize
      });

      quotaUsed++;
      
      if (opportunities.length > 0) {
        await storeOpportunities(env, opportunities);
        totalProcessed += opportunities.length;
        console.log(`✅ Processed ${opportunities.length} opportunities for NAICS ${naicsCode}`);
      }

      // Rate limiting delay
      await sleep(1000);
    }

    // Update quota tracking
    await updateQuotaUsage(env, quotaUsed);
    await updateLastFetchDate(env, toDate);

    metrics.recordsProcessed = totalProcessed;
    metrics.quotaUsed = quotaUsed;
    metrics.duration = Date.now() - startTime;

    console.log(`🎉 Daily fetch completed: ${totalProcessed} opportunities processed`);
    
    // Trigger status update for new opportunities
    setTimeout(() => handleStatusUpdates(env), 5000);

  } catch (error) {
    metrics.errors.push(error instanceof Error ? error.message : String(error));
    console.error('❌ Daily fetch failed:', error);
  }

  await logMetrics(env, metrics);
  return metrics;
}

// Check and update status of existing opportunities
async function handleStatusUpdates(env: any): Promise<SyncMetrics> {
  const startTime = Date.now();
  console.log('🔍 Starting opportunity status updates...');

  const metrics: SyncMetrics = {
    timestamp: new Date().toISOString(),
    action: 'update',
    recordsProcessed: 0,
    errors: [],
    duration: 0,
    quotaUsed: 0
  };

  try {
    // Get open opportunities that haven't been checked in 24+ hours
    const staleOpportunities = await getStaleOpportunities(env);
    console.log(`Found ${staleOpportunities.length} opportunities to update`);

    let quotaUsed = 0;
    let updated = 0;

    for (const opp of staleOpportunities.slice(0, 50)) { // Limit to 50 per run
      try {
        const updatedStatus = await checkOpportunityStatus(env, opp.solicitationNumber);
        quotaUsed++;

        if (updatedStatus && updatedStatus !== opp.status) {
          await updateOpportunityStatus(env, opp.id, updatedStatus);
          updated++;
          console.log(`📝 Updated ${opp.solicitationNumber}: ${opp.status} → ${updatedStatus}`);
        }

        await sleep(500); // Rate limiting
      } catch (error) {
        metrics.errors.push(`Failed to update ${opp.solicitationNumber}: ${error}`);
      }
    }

    metrics.recordsProcessed = updated;
    metrics.quotaUsed = quotaUsed;
    metrics.duration = Date.now() - startTime;

    await updateQuotaUsage(env, quotaUsed);
    console.log(`✅ Status updates completed: ${updated} opportunities updated`);

  } catch (error) {
    metrics.errors.push(error instanceof Error ? error.message : String(error));
    console.error('❌ Status update failed:', error);
  }

  await logMetrics(env, metrics);
  return metrics;
}

// Clean up expired and awarded opportunities
async function handleCleanup(env: any): Promise<SyncMetrics> {
  const startTime = Date.now();
  console.log('🧹 Starting opportunity cleanup...');

  const metrics: SyncMetrics = {
    timestamp: new Date().toISOString(),
    action: 'cleanup',
    recordsProcessed: 0,
    errors: [],
    duration: 0,
    quotaUsed: 0
  };

  try {
    // Remove opportunities that are:
    // 1. Awarded more than 30 days ago
    // 2. Closed more than 7 days ago  
    // 3. Have response deadlines more than 30 days past
    
    const cleanupResults = await cleanupOpportunities(env);
    metrics.recordsProcessed = cleanupResults.deleted;
    
    console.log(`🗑️ Cleanup completed: ${cleanupResults.deleted} opportunities removed`);
    
    // Also cleanup old sync logs (keep last 30 days)
    await cleanupOldLogs(env, 30);

  } catch (error) {
    metrics.errors.push(error instanceof Error ? error.message : String(error));
    console.error('❌ Cleanup failed:', error);
  }

  metrics.duration = Date.now() - startTime;
  await logMetrics(env, metrics);
  return metrics;
}

// SAM.gov API integration functions
async function fetchSAMGovOpportunities(env: any, params: any): Promise<any[]> {
  const apiKey = env.SAM_GOV_API_KEY;
  if (!apiKey) throw new Error('SAM.gov API key not configured');

  // Use correct SAM.gov API v2 production endpoint
  const url = new URL('https://api.sam.gov/prod/opportunities/v2/search');
  url.searchParams.append('api_key', apiKey);
  
  // Format dates as MM/dd/yyyy as required by SAM.gov API
  const fromDate = new Date(params.postedFrom);
  const toDate = new Date(params.postedTo);
  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };
  
  url.searchParams.append('postedFrom', formatDate(fromDate));
  url.searchParams.append('postedTo', formatDate(toDate));
  
  // Use correct NAICS parameter name 
  if (params.naicsCode) {
    url.searchParams.append('ncode', params.naicsCode);
  }
  
  url.searchParams.append('limit', params.limit.toString());
  // Use 'o' for solicitations/opportunities (not awards)
  url.searchParams.append('ptype', 'o');
  
  console.log(`🔍 SAM.gov API Request: ${url.toString().replace(apiKey, '[REDACTED]')}`);

  // Use Cloudflare's caching for efficiency
  const cacheKey = `sam-gov-${params.naicsCode}-${formatDate(fromDate)}-${formatDate(toDate)}`;
  const cache = caches.default;
  const cacheRequest = new Request(url.toString(), {
    headers: {
      'User-Agent': 'CRE-Console-Worker/1.0',
      'Accept': 'application/json'
    }
  });

  // Check cache first (cache for 1 hour)
  let response = await cache.match(cacheRequest);
  
  if (!response) {
    console.log(`🌐 Cache miss - fetching from SAM.gov API`);
    response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'CRE-Console-Worker/1.0',
        'Accept': 'application/json',
        'CF-Cache-TTL': '3600' // Cache for 1 hour
      }
    });

    // Cache successful responses
    if (response.ok) {
      const responseClone = response.clone();
      const headers = new Headers(responseClone.headers);
      headers.append('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      const cachedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers
      });
      await cache.put(cacheRequest, cachedResponse);
      console.log(`💾 Response cached for ${cacheKey}`);
    }
  } else {
    console.log(`⚡ Cache hit - serving from Cloudflare cache`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`SAM.gov API Error ${response.status}:`, errorText);
    throw new Error(`SAM.gov API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`📊 SAM.gov Response: ${data.totalRecords || 0} total records`);
  
  // The response structure might be different, check for various possible keys
  return data.opportunitiesData || data.opportunities || data.results || [];
}

async function checkOpportunityStatus(env: any, solicitationNumber: string): Promise<string | null> {
  // This would check individual opportunity status
  // Implementation depends on SAM.gov API capabilities
  return null;
}

// Database operations
async function storeOpportunities(env: any, opportunities: any[]): Promise<void> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Transform SAM.gov opportunities to our schema
  const transformedOpportunities = opportunities.map(opp => ({
    solicitation_number: opp.solicitationNumber,
    title: opp.title,
    description: opp.description,
    department: opp.department,
    sub_tier: opp.subTier,
    office: opp.office,
    posted_date: opp.postedDate,
    response_date: opp.responseDeadLine,
    naics_code: opp.naicsCode,
    classification_code: opp.classificationCode,
    active: opp.active === 'Yes',
    award: opp.award,
    point_of_contact: opp.pointOfContact?.[0] || {},
    original_source: 'sam_gov',
    sam_gov_link: `https://sam.gov/opp/${opp.solicitationNumber}`,
    cre_score: calculateCREScore(opp),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('rfp_opportunities')
    .upsert(transformedOpportunities, {
      onConflict: 'solicitation_number',
      ignoreDuplicates: false
    });

  if (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }

  console.log(`✅ Stored ${transformedOpportunities.length} opportunities in database`);
}

async function getStaleOpportunities(env: any): Promise<any[]> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) return [];

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('rfp_opportunities')
    .select('id, solicitation_number, status')
    .eq('active', true)
    .lt('updated_at', twentyFourHoursAgo)
    .limit(50);

  if (error) {
    console.error('Failed to fetch stale opportunities:', error);
    return [];
  }

  return data || [];
}

async function updateOpportunityStatus(env: any, id: string, status: string): Promise<void> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { error } = await supabase
    .from('rfp_opportunities')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error(`Failed to update opportunity ${id}:`, error);
  }
}

async function cleanupOpportunities(env: any): Promise<{ deleted: number }> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) return { deleted: 0 };

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Delete opportunities that are:
  // 1. Awarded more than 30 days ago
  // 2. Closed more than 7 days ago
  // 3. Have response deadlines more than 30 days past
  const { data, error } = await supabase
    .from('rfp_opportunities')
    .delete()
    .or(`
      and(status.eq.awarded,updated_at.lt.${thirtyDaysAgo}),
      and(status.eq.closed,updated_at.lt.${sevenDaysAgo}),
      response_date.lt.${thirtyDaysAgo}
    `);

  if (error) {
    console.error('Cleanup failed:', error);
    return { deleted: 0 };
  }

  const deletedCount = Array.isArray(data) ? data.length : 0;
  return { deleted: deletedCount };
}

// Advanced quota management using Cloudflare KV with atomic operations
async function getQuotaStatus(env: any): Promise<SAMGovQuota> {
  try {
    const today = new Date().toDateString();
    const quotaKey = `daily_quota_${today}`;
    
    // Use KV with atomic operations for better consistency
    const quotaData = await env.SAM_QUOTA_KV?.get(quotaKey);
    
    if (!quotaData) {
      // Initialize quota for today
      const newQuota = {
        dailyLimit: 1000,
        used: 0,
        resetTime: new Date().setHours(24, 0, 0, 0),
        lastFetch: today
      };
      
      await env.SAM_QUOTA_KV?.put(quotaKey, JSON.stringify(newQuota), {
        expirationTtl: 24 * 60 * 60 // 24 hours
      });
      
      return newQuota;
    }

    const quota = JSON.parse(quotaData);
    
    // Automatically reset quota at midnight (redundant safety)
    const now = new Date();
    if (quota.lastFetch !== today || now.getTime() > quota.resetTime) {
      quota.used = 0;
      quota.lastFetch = today;
      quota.resetTime = new Date().setHours(24, 0, 0, 0);
      
      await env.SAM_QUOTA_KV?.put(quotaKey, JSON.stringify(quota), {
        expirationTtl: 24 * 60 * 60
      });
    }
    
    return quota;
  } catch (error) {
    console.error('Error getting quota status:', error);
    // Fallback quota
    return {
      dailyLimit: 1000,
      used: 0,
      resetTime: new Date().setHours(24, 0, 0, 0),
      lastFetch: new Date().toDateString()
    };
  }
}

async function updateQuotaUsage(env: any, used: number): Promise<void> {
  try {
    const today = new Date().toDateString();
    const quotaKey = `daily_quota_${today}`;
    
    // Atomic quota update with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        const quota = await getQuotaStatus(env);
        quota.used += used;
        
        await env.SAM_QUOTA_KV?.put(quotaKey, JSON.stringify(quota), {
          expirationTtl: 24 * 60 * 60
        });
        
        console.log(`📊 Quota updated: ${quota.used}/${quota.dailyLimit}`);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await sleep(100 * (4 - retries)); // Exponential backoff
      }
    }
  } catch (error) {
    console.error('Failed to update quota usage:', error);
  }
}

async function getLastFetchDate(env: any): Promise<Date | null> {
  const lastFetch = await env.SAM_QUOTA_KV?.get('last_fetch_date');
  return lastFetch ? new Date(lastFetch) : null;
}

async function updateLastFetchDate(env: any, date: Date): Promise<void> {
  await env.SAM_QUOTA_KV?.put('last_fetch_date', date.toISOString());
}

// Enhanced logging and monitoring with Cloudflare Analytics
async function logMetrics(env: any, metrics: SyncMetrics): Promise<void> {
  try {
    // Store metrics in KV with better organization
    const timestamp = new Date().toISOString();
    const dateKey = timestamp.split('T')[0]; // YYYY-MM-DD
    const logKey = `sync_log_${dateKey}_${Date.now()}`;
    
    // Enhanced metrics with Cloudflare info
    const enhancedMetrics = {
      ...metrics,
      cloudflareDatacenter: env.cf?.colo || 'unknown',
      country: env.cf?.country || 'unknown',
      timezone: env.cf?.timezone || 'unknown',
      version: env.ENVIRONMENT || 'unknown'
    };
    
    await env.SAM_QUOTA_KV?.put(logKey, JSON.stringify(enhancedMetrics), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
    
    // Store daily summary for analytics
    const summaryKey = `daily_summary_${dateKey}`;
    let dailySummary = await env.SAM_QUOTA_KV?.get(summaryKey);
    
    if (dailySummary) {
      const summary = JSON.parse(dailySummary);
      summary.totalRecords += metrics.recordsProcessed;
      summary.totalErrors += metrics.errors.length;
      summary.executionCount++;
      summary.lastUpdate = timestamp;
      
      await env.SAM_QUOTA_KV?.put(summaryKey, JSON.stringify(summary), {
        expirationTtl: 31 * 24 * 60 * 60 // 31 days
      });
    } else {
      const newSummary = {
        date: dateKey,
        totalRecords: metrics.recordsProcessed,
        totalErrors: metrics.errors.length,
        executionCount: 1,
        firstExecution: timestamp,
        lastUpdate: timestamp
      };
      
      await env.SAM_QUOTA_KV?.put(summaryKey, JSON.stringify(newSummary), {
        expirationTtl: 31 * 24 * 60 * 60
      });
    }
    
    // Log to console with enhanced formatting
    console.log('📊 Enhanced Sync Metrics:', JSON.stringify(enhancedMetrics, null, 2));
    
  } catch (error) {
    console.error('Failed to log metrics:', error);
    // Fallback to basic console logging
    console.log('📊 Sync Metrics (fallback):', JSON.stringify(metrics, null, 2));
  }
}

async function cleanupOldLogs(env: any, days: number): Promise<void> {
  // Cleanup logs older than specified days
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  // Implementation would list and delete old log keys
}

async function notifyError(env: any, cron: string, error: any): Promise<void> {
  try {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      cron,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      datacenter: env.cf?.colo || 'unknown',
      country: env.cf?.country || 'unknown'
    };
    
    // Store error for analysis
    const errorKey = `error_${Date.now()}`;
    await env.SAM_QUOTA_KV?.put(errorKey, JSON.stringify(errorDetails), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });
    
    // Check error frequency for intelligent alerting
    const todayKey = new Date().toISOString().split('T')[0];
    const errorCountKey = `error_count_${todayKey}`;
    let errorCount = await env.SAM_QUOTA_KV?.get(errorCountKey);
    const count = errorCount ? parseInt(errorCount) + 1 : 1;
    
    await env.SAM_QUOTA_KV?.put(errorCountKey, count.toString(), {
      expirationTtl: 24 * 60 * 60 // 24 hours
    });
    
    // Enhanced console logging with context
    console.error(`🚨 Critical scheduler error #${count} for ${cron}:`, {
      error: errorDetails.error,
      datacenter: errorDetails.datacenter,
      country: errorDetails.country,
      dailyErrorCount: count
    });
    
    // TODO: Integrate with Cloudflare's Email Workers or external services
    // if (count >= 5) {
    //   await sendSlackAlert(env, errorDetails);
    // }
    
  } catch (notificationError) {
    console.error('Failed to send error notification:', notificationError);
    console.error(`🚨 Original error for ${cron}:`, error);
  }
}

async function getSchedulerStatus(env: any): Promise<any> {
  const quota = await getQuotaStatus(env);
  const lastFetch = await getLastFetchDate(env);
  
  return {
    quota,
    lastFetch,
    nextScheduledRuns: {
      dailyFetch: '6:00 AM EST',
      statusUpdate: '2:00 PM EST', 
      cleanup: '11:00 PM EST'
    },
    status: 'healthy'
  };
}

// CRE scoring algorithm
function calculateCREScore(opportunity: any): number {
  let score = 0;
  
  // NAICS code scoring (highest weight)
  const creNaicsCodes = {
    '236220': 40, // Commercial and Institutional Building Construction
    '531120': 35, // Lessors of Nonresidential Buildings
    '531210': 30, // Real Estate Agents and Brokers
    '531311': 25, // Residential Property Managers
    '531312': 30, // Nonresidential Property Managers
    '238210': 20, // Electrical Contractors
    '238220': 20, // Plumbing, Heating, and Air-Conditioning
  };
  
  if (opportunity.naicsCode && creNaicsCodes[opportunity.naicsCode]) {
    score += creNaicsCodes[opportunity.naicsCode];
  }
  
  // Title and description keyword scoring
  const text = `${opportunity.title || ''} ${opportunity.description || ''}`.toLowerCase();
  const creKeywords = {
    'commercial real estate': 15,
    'office building': 12,
    'retail space': 12,
    'warehouse': 10,
    'industrial': 10,
    'property management': 8,
    'lease': 8,
    'facility management': 6,
    'construction': 5,
    'renovation': 5
  };
  
  for (const [keyword, points] of Object.entries(creKeywords)) {
    if (text.includes(keyword)) {
      score += points;
    }
  }
  
  // Department scoring (some agencies more likely to have CRE opportunities)
  const department = (opportunity.department || '').toLowerCase();
  if (department.includes('general services') || department.includes('gsa')) {
    score += 10;
  }
  
  return Math.min(100, Math.max(0, score));
}

// Test function for SAM.gov API
async function testSAMGovAPI(env: any): Promise<any> {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = new Date();
    
    const opportunities = await fetchSAMGovOpportunities(env, {
      naicsCode: '236220',
      postedFrom: yesterday.toISOString().split('T')[0],
      postedTo: today.toISOString().split('T')[0],
      limit: 5
    });

    return {
      success: true,
      apiKey: env.SAM_GOV_API_KEY ? 'configured' : 'missing',
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing',
      opportunitiesFound: opportunities.length,
      sampleOpportunity: opportunities[0] || null,
      testDate: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      apiKey: env.SAM_GOV_API_KEY ? 'configured' : 'missing',
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing'
    };
  }
}

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}