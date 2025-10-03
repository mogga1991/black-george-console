// Comprehensive test endpoint for Notion integration
// Tests all aspects of the Notion API connection and functionality

interface Env {
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
  NOTION_DATA_SOURCE_ID: string;
  CRE_DB: D1Database;
  CACHE: KVNamespace;
}

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  data?: any;
  duration?: number;
}

async function runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - start;
    return {
      test: testName,
      status: 'pass',
      message: 'Test passed successfully',
      data: result,
      duration
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      test: testName,
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

async function testNotionConnection(env: Env): Promise<TestResult> {
  return runTest('Notion API Connection', async () => {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(error)}`);
    }

    const database = await response.json();
    return {
      title: database.title?.[0]?.plain_text || 'Unknown',
      id: database.id,
      propertyCount: await getPropertyCount(env)
    };
  });
}

async function getPropertyCount(env: Env): Promise<number> {
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
        page_size: 1 // Just to get the count efficiently
      })
    }
  );

  if (response.ok) {
    const result = await response.json();
    // Note: Notion doesn't return total count directly, so this is an approximation
    return result.results.length;
  }
  return 0;
}

async function testDatabaseSchema(env: Env): Promise<TestResult> {
  return runTest('Database Schema Validation', async () => {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    const database = await response.json();
    const properties = database.properties;

    // Check for required properties
    const requiredFields = [
      'Address', 'Property ID', 'City', 'State', 'Zip Code',
      'Building Types', 'Total Sq Ft', 'Rate', 'Latitude', 'Longitude',
      'Match Quality'
    ];

    const missingFields = requiredFields.filter(field => !properties[field]);
    const availableFields = Object.keys(properties);

    if (missingFields.length > 0) {
      return {
        status: 'warning',
        missingFields,
        availableFields,
        message: `Missing ${missingFields.length} required fields`
      };
    }

    return {
      status: 'pass',
      availableFields,
      fieldCount: availableFields.length
    };
  });
}

async function testPropertyQuery(env: Env): Promise<TestResult> {
  return runTest('Property Query Test', async () => {
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
          page_size: 5,
          sorts: [
            {
              property: 'Address',
              direction: 'ascending'
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Query failed: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    const properties = result.results.map((page: any) => ({
      id: page.id,
      address: page.properties.Address?.title?.[0]?.plain_text || 'No address',
      city: page.properties.City?.select?.name || 'No city',
      matchQuality: page.properties['Match Quality']?.select?.name || 'None'
    }));

    return {
      propertyCount: result.results.length,
      hasMore: result.has_more,
      sampleProperties: properties
    };
  });
}

async function testMatchQualityValues(env: Env): Promise<TestResult> {
  return runTest('Match Quality Values Test', async () => {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    const database = await response.json();
    const matchQualityProperty = database.properties['Match Quality'];

    if (!matchQualityProperty) {
      throw new Error('Match Quality property not found');
    }

    if (matchQualityProperty.type !== 'select') {
      throw new Error('Match Quality should be a select property');
    }

    const options = matchQualityProperty.select.options.map((opt: any) => opt.name);
    const expectedOptions = ['Perfect Match', 'Close Match', 'Might Work'];
    const missingOptions = expectedOptions.filter(opt => !options.includes(opt));

    return {
      availableOptions: options,
      expectedOptions,
      missingOptions,
      isValid: missingOptions.length === 0
    };
  });
}

async function testGeographicData(env: Env): Promise<TestResult> {
  return runTest('Geographic Data Test', async () => {
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
          filter: {
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
          },
          page_size: 10
        })
      }
    );

    const result = await response.json();
    const propertiesWithCoords = result.results.filter((page: any) => {
      const lat = page.properties.Latitude?.number;
      const lng = page.properties.Longitude?.number;
      return lat && lng && !isNaN(lat) && !isNaN(lng);
    });

    return {
      totalQueried: result.results.length,
      propertiesWithValidCoords: propertiesWithCoords.length,
      hasMore: result.has_more,
      sampleCoordinates: propertiesWithCoords.slice(0, 3).map((page: any) => ({
        address: page.properties.Address?.title?.[0]?.plain_text,
        lat: page.properties.Latitude?.number,
        lng: page.properties.Longitude?.number
      }))
    };
  });
}

async function testCacheIntegration(env: Env): Promise<TestResult> {
  return runTest('KV Cache Integration', async () => {
    const testKey = 'test_property_match';
    const testData = {
      propertyId: 'test_123',
      matchQuality: 'Perfect Match',
      score: 95,
      timestamp: new Date().toISOString()
    };

    // Test write
    await env.CACHE.put(testKey, JSON.stringify(testData), { expirationTtl: 60 });

    // Test read
    const retrieved = await env.CACHE.get(testKey);
    if (!retrieved) {
      throw new Error('Failed to retrieve cached data');
    }

    const parsedData = JSON.parse(retrieved);
    
    // Clean up
    await env.CACHE.delete(testKey);

    return {
      testData,
      retrievedData: parsedData,
      cacheWorking: JSON.stringify(testData) === JSON.stringify(parsedData)
    };
  });
}

async function testD1Integration(env: Env): Promise<TestResult> {
  return runTest('D1 Database Integration', async () => {
    // Test if the rfp_property_matches table exists and is accessible
    const result = await env.CRE_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='rfp_property_matches'"
    ).first();

    if (!result) {
      throw new Error('rfp_property_matches table not found');
    }

    // Test a sample query
    const sampleQuery = await env.CRE_DB.prepare(
      "SELECT COUNT(*) as count FROM rfp_property_matches"
    ).first();

    return {
      tableExists: true,
      recordCount: sampleQuery?.count || 0
    };
  });
}

// Main test endpoint
export async function onRequestGet(context: any) {
  const { env } = context;
  const url = new URL(context.request.url);
  const testName = url.searchParams.get('test');

  // Validate required environment variables
  if (!env.NOTION_API_KEY) {
    return new Response(JSON.stringify({
      error: 'NOTION_API_KEY environment variable is required',
      instructions: 'Run: wrangler secret put NOTION_API_KEY'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.NOTION_DATABASE_ID) {
    return new Response(JSON.stringify({
      error: 'NOTION_DATABASE_ID environment variable is required'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let results: TestResult[] = [];

    if (testName === 'connection') {
      results = [await testNotionConnection(env)];
    } else if (testName === 'schema') {
      results = [await testDatabaseSchema(env)];
    } else if (testName === 'query') {
      results = [await testPropertyQuery(env)];
    } else if (testName === 'geography') {
      results = [await testGeographicData(env)];
    } else if (testName === 'cache') {
      results = [await testCacheIntegration(env)];
    } else if (testName === 'd1') {
      results = [await testD1Integration(env)];
    } else {
      // Run all tests
      results = await Promise.all([
        testNotionConnection(env),
        testDatabaseSchema(env),
        testPropertyQuery(env),
        testMatchQualityValues(env),
        testGeographicData(env),
        testCacheIntegration(env),
        testD1Integration(env)
      ]);
    }

    const summary = {
      totalTests: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      warnings: results.filter(r => r.status === 'warning').length,
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
    };

    const overallStatus = summary.failed > 0 ? 'FAILED' : 
                         summary.warnings > 0 ? 'WARNING' : 'PASSED';

    return new Response(JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: {
        databaseId: env.NOTION_DATABASE_ID,
        dataSourceId: env.NOTION_DATA_SOURCE_ID
      },
      summary,
      results
    }, null, 2), {
      status: summary.failed > 0 ? 500 : 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Test execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}