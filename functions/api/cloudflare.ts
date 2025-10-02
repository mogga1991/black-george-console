export async function onRequestGet(context: any) {
  try {
    const { env } = context;
    
    // Test all bindings
    const bindingTests = {
      AI: !!env.AI,
      CRE_DB: !!env.CRE_DB,
      CACHE_DB: !!env.CACHE_DB,
      CRE_DOCUMENTS: !!env.CRE_DOCUMENTS,
      RFP_UPLOADS: !!env.RFP_UPLOADS,
      SESSIONS: !!env.SESSIONS,
      CACHE: !!env.CACHE
    };

    // Test D1 database connection
    let dbTest = null;
    if (env.CRE_DB) {
      try {
        const result = await env.CRE_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 5").all();
        dbTest = {
          connected: true,
          tables: result.results.map((r: any) => r.name)
        };
      } catch (error) {
        dbTest = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Test AI binding
    let aiTest = null;
    if (env.AI) {
      try {
        const testResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'user', content: 'Say "AI binding test successful" and nothing else.' }
          ],
          max_tokens: 50
        });
        aiTest = {
          connected: true,
          response: testResponse.response
        };
      } catch (error) {
        aiTest = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    const status = {
      timestamp: new Date().toISOString(),
      bindings: bindingTests,
      database: dbTest,
      ai: aiTest,
      environment: {
        ENVIRONMENT: env.ENVIRONMENT || 'unknown',
        APP_VERSION: env.APP_VERSION || 'unknown'
      }
    };

    return new Response(
      JSON.stringify(status, null, 2),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to test Cloudflare bindings',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}