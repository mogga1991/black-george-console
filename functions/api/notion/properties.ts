// Cloudflare Worker function for Notion property management
// Integrates with CRE Console map and property matching system

interface Env {
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
  NOTION_DATA_SOURCE_ID: string;
  CRE_DB: D1Database;
  CACHE: KVNamespace;
  AI: any;
}

interface PropertyMatchUpdate {
  propertyId: string;
  score: number;
  matchReasons?: string[];
  rfpId?: string;
  aiReasoning?: string;
}

interface NotionPropertyData {
  address: string;
  propertyId: string;
  city: string;
  state: string;
  zipCode: string;
  buildingTypes: string[];
  totalSqFt: number;
  rate: number;
  suites?: number;
  tenancy?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  matchQuality?: 'Perfect Match' | 'Close Match' | 'Might Work';
}

// Update property match quality in Notion
async function updatePropertyMatchQuality(
  propertyId: string, 
  matchQuality: 'Perfect Match' | 'Close Match' | 'Might Work',
  env: Env,
  additionalData?: {
    rfpId?: string;
    score?: number;
    reasoning?: string;
  }
) {
  try {
    // First find the property page by Property ID
    const queryResult = await queryNotionProperties({
      property: 'Property ID',
      rich_text: {
        equals: propertyId
      }
    }, env);

    if (queryResult.results.length === 0) {
      throw new Error(`Property with ID ${propertyId} not found in Notion`);
    }

    const pageId = queryResult.results[0].id;
    
    // Prepare update payload
    const updatePayload: any = {
      properties: {
        'Match Quality': {
          select: { name: matchQuality }
        }
      }
    };

    // Add additional fields if provided
    if (additionalData?.score) {
      updatePayload.properties['Match Score'] = {
        number: additionalData.score
      };
    }

    if (additionalData?.reasoning) {
      updatePayload.properties['AI Reasoning'] = {
        rich_text: [{ text: { content: additionalData.reasoning } }]
      };
    }

    if (additionalData?.rfpId) {
      updatePayload.properties['Related RFP'] = {
        rich_text: [{ text: { content: additionalData.rfpId } }]
      };
    }

    // Add timestamp
    updatePayload.properties['Last Match Update'] = {
      date: { start: new Date().toISOString() }
    };

    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Notion API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();

    // Cache the updated match quality in KV for fast access
    await env.CACHE.put(
      `property_match:${propertyId}`, 
      JSON.stringify({ 
        matchQuality, 
        score: additionalData?.score,
        updatedAt: new Date().toISOString()
      }),
      { expirationTtl: 3600 } // 1 hour cache
    );

    // Store in D1 for analytics
    if (additionalData?.score && additionalData?.rfpId) {
      await env.CRE_DB.prepare(`
        INSERT OR REPLACE INTO rfp_property_matches 
        (id, rfp_document_id, property_id, match_score, match_criteria, ai_reasoning, created_by, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `match_${additionalData.rfpId}_${propertyId}`,
        additionalData.rfpId,
        propertyId,
        additionalData.score,
        JSON.stringify({ matchQuality }),
        additionalData.reasoning || '',
        'ai',
        matchQuality === 'Perfect Match' ? 'approved' : 'suggested',
        new Date().toISOString()
      ).run();
    }

    return result;
  } catch (error) {
    console.error('Error updating property match quality:', error);
    throw error;
  }
}

// Query properties from Notion with advanced filtering
async function queryNotionProperties(filters: any, env: Env) {
  const response = await fetch(
    `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        filter: filters,
        page_size: 100,
        sorts: [
          {
            property: 'Match Quality',
            direction: 'ascending'
          },
          {
            property: 'Address',
            direction: 'ascending'
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Notion query error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return await response.json();
}

// Get properties for map display with geographic data
async function getPropertiesForMap(env: Env, filters?: any) {
  const baseFilter = {
    and: [
      {
        property: 'Latitude',
        number: {
          is_not_empty: true
        }
      },
      {
        property: 'Longitude',
        number: {
          is_not_empty: true
        }
      }
    ]
  };

  // Combine with additional filters if provided
  const finalFilter = filters ? {
    and: [baseFilter, filters]
  } : baseFilter;

  const result = await queryNotionProperties(finalFilter, env);
  
  return result.results.map((page: any) => parseNotionPropertyForMap(page));
}

// Parse Notion page data for map display
function parseNotionPropertyForMap(page: any): NotionPropertyData {
  const props = page.properties;
  
  return {
    address: getPropertyValue(props['Address']) || '',
    propertyId: page.id,
    city: getPropertyValue(props['City']) || '',
    state: getPropertyValue(props['State']) || '',
    zipCode: getPropertyValue(props['Zip Code']) || '',
    buildingTypes: getMultiSelectValues(props['Building Types']) || [],
    totalSqFt: getPropertyValue(props['Total Sq Ft']) || 0,
    rate: getPropertyValue(props['Rate']) || 0,
    suites: getPropertyValue(props['Suites']),
    tenancy: getPropertyValue(props['Tenancy']),
    latitude: getPropertyValue(props['Latitude']),
    longitude: getPropertyValue(props['Longitude']),
    source: getPropertyValue(props['Source']),
    matchQuality: getPropertyValue(props['Match Quality']) as 'Perfect Match' | 'Close Match' | 'Might Work' | undefined
  };
}

// Helper functions
function getPropertyValue(property: any): any {
  if (!property) return null;

  switch (property.type) {
    case 'title':
      return property.title[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text[0]?.plain_text || '';
    case 'number':
      return property.number;
    case 'select':
      return property.select?.name || '';
    case 'checkbox':
      return property.checkbox;
    case 'date':
      return property.date?.start || '';
    case 'email':
      return property.email || '';
    case 'phone_number':
      return property.phone_number || '';
    default:
      return null;
  }
}

function getMultiSelectValues(property: any): string[] {
  if (!property || property.type !== 'multi_select') return [];
  return property.multi_select.map((item: any) => item.name);
}

// Determine match quality based on score
function getMatchQuality(score: number): 'Perfect Match' | 'Close Match' | 'Might Work' {
  if (score >= 90) return 'Perfect Match';
  if (score >= 70) return 'Close Match';
  return 'Might Work';
}

// Main Cloudflare Worker handler
export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'list': {
        // Get all properties with optional filtering
        const buildingType = url.searchParams.get('buildingType');
        const city = url.searchParams.get('city');
        const state = url.searchParams.get('state');
        const matchQuality = url.searchParams.get('matchQuality');

        let filters: any = {};
        const conditions: any[] = [];

        if (buildingType) {
          conditions.push({
            property: 'Building Types',
            multi_select: {
              contains: buildingType
            }
          });
        }

        if (city) {
          conditions.push({
            property: 'City',
            select: {
              equals: city
            }
          });
        }

        if (state) {
          conditions.push({
            property: 'State',
            select: {
              equals: state
            }
          });
        }

        if (matchQuality) {
          conditions.push({
            property: 'Match Quality',
            select: {
              equals: matchQuality
            }
          });
        }

        if (conditions.length > 0) {
          filters = conditions.length === 1 ? conditions[0] : { and: conditions };
        }

        const result = await queryNotionProperties(filters, env);
        
        return new Response(JSON.stringify({
          properties: result.results.map(parseNotionPropertyForMap),
          total: result.results.length,
          hasMore: result.has_more
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'map-data': {
        // Get properties specifically for map display
        const properties = await getPropertiesForMap(env);
        
        return new Response(JSON.stringify({
          properties,
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'property': {
        // Get specific property by ID
        const propertyId = url.searchParams.get('propertyId');
        if (!propertyId) {
          return new Response('Property ID required', { status: 400 });
        }

        const response = await fetch(`https://api.notion.com/v1/pages/${propertyId}`, {
          headers: {
            'Authorization': `Bearer ${env.NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          },
        });

        if (!response.ok) {
          return new Response('Property not found', { status: 404 });
        }

        const page = await response.json();
        return new Response(JSON.stringify(parseNotionPropertyForMap(page)), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      default: {
        return new Response('Invalid action. Use: list, map-data, or property', { 
          status: 400 
        });
      }
    }
  } catch (error) {
    console.error('Notion API error:', error);
    return new Response(JSON.stringify({ 
      error: 'API error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    const body = await request.json();

    switch (action) {
      case 'update-match': {
        // Update property match quality
        const { propertyId, score, rfpId, reasoning }: PropertyMatchUpdate = body;
        
        if (!propertyId || typeof score !== 'number') {
          return new Response('propertyId and score are required', { status: 400 });
        }

        const matchQuality = getMatchQuality(score);
        
        const result = await updatePropertyMatchQuality(
          propertyId, 
          matchQuality, 
          env,
          { score, rfpId, reasoning }
        );
        
        return new Response(JSON.stringify({
          success: true,
          propertyId,
          matchQuality,
          score,
          notionResult: result
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'bulk-update': {
        // Bulk update multiple properties
        const { updates }: { updates: PropertyMatchUpdate[] } = body;
        
        if (!Array.isArray(updates)) {
          return new Response('updates array is required', { status: 400 });
        }

        const results = [];
        
        for (const update of updates) {
          try {
            const matchQuality = getMatchQuality(update.score);
            const result = await updatePropertyMatchQuality(
              update.propertyId,
              matchQuality,
              env,
              { 
                score: update.score, 
                rfpId: update.rfpId, 
                reasoning: update.aiReasoning 
              }
            );
            
            results.push({
              propertyId: update.propertyId,
              success: true,
              matchQuality,
              result
            });
          } catch (error) {
            results.push({
              propertyId: update.propertyId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return new Response(JSON.stringify({
          results,
          processed: results.length,
          successful: results.filter(r => r.success).length
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      default: {
        return new Response('Invalid action. Use: update-match or bulk-update', { 
          status: 400 
        });
      }
    }
  } catch (error) {
    console.error('Notion POST error:', error);
    return new Response(JSON.stringify({ 
      error: 'API error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}