// Background Processing Worker for CRE Console
// This worker processes queued tasks like document analysis and property matching

interface CloudflareEnv {
  AI: Ai;
  RFP_UPLOADS: R2Bucket;
  CRE_DOCUMENTS: R2Bucket;
  CRE_DB: D1Database;
  CACHE_DB: D1Database;
}

interface ProcessingTask {
  id: string;
  task_type: string;
  payload: string;
  attempts: number;
  max_attempts: number;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    // Process pending tasks every minute
    ctx.waitUntil(processQueue(env));
  },

  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    // Allow manual triggering of the queue processor
    if (request.method === 'POST') {
      const url = new URL(request.url);
      if (url.pathname === '/process-queue') {
        await processQueue(env);
        return new Response('Queue processed', { status: 200 });
      }
    }
    
    return new Response('Background processor worker', { status: 200 });
  },
};

async function processQueue(env: CloudflareEnv): Promise<void> {
  const { CRE_DB } = env;

  try {
    // Get pending tasks (limit to 10 at a time)
    const result = await CRE_DB.prepare(`
      SELECT * FROM processing_queue 
      WHERE status = 'pending' 
      ORDER BY priority DESC, scheduled_at ASC 
      LIMIT 10
    `).all();

    const tasks = result.results as ProcessingTask[];

    for (const task of tasks) {
      await processTask(task, env);
    }
  } catch (error) {
    console.error('Queue processing error:', error);
  }
}

async function processTask(task: ProcessingTask, env: CloudflareEnv): Promise<void> {
  const { CRE_DB } = env;

  try {
    // Mark task as processing
    await CRE_DB.prepare(`
      UPDATE processing_queue 
      SET status = 'processing', started_at = CURRENT_TIMESTAMP, attempts = attempts + 1
      WHERE id = ?
    `).bind(task.id).run();

    const payload = JSON.parse(task.payload);

    switch (task.task_type) {
      case 'document_analysis':
        await processDocumentAnalysis(payload, env);
        break;
      case 'property_match':
        await processPropertyMatch(payload, env);
        break;
      case 'data_sync':
        await processDataSync(payload, env);
        break;
      default:
        throw new Error(`Unknown task type: ${task.task_type}`);
    }

    // Mark task as completed
    await CRE_DB.prepare(`
      UPDATE processing_queue 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(task.id).run();

  } catch (error) {
    console.error(`Task ${task.id} failed:`, error);
    
    // Check if we should retry or mark as failed
    if (task.attempts >= task.max_attempts) {
      await CRE_DB.prepare(`
        UPDATE processing_queue 
        SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(error.message, task.id).run();
    } else {
      // Reset to pending for retry
      await CRE_DB.prepare(`
        UPDATE processing_queue 
        SET status = 'pending', started_at = NULL
        WHERE id = ?
      `).bind(task.id).run();
    }
  }
}

async function processDocumentAnalysis(payload: any, env: CloudflareEnv): Promise<void> {
  const { AI, RFP_UPLOADS, CRE_DB } = env;
  const { documentId, r2Key, analysisTypes } = payload;

  // Get document content
  const r2Object = await RFP_UPLOADS.get(r2Key);
  if (!r2Object) {
    throw new Error('Document not found in R2');
  }

  const content = await r2Object.text();

  // Process each analysis type
  for (const analysisType of analysisTypes) {
    const prompt = getAnalysisPrompt(analysisType, content);
    
    const aiResponse = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are an expert commercial real estate analyst.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2048
    });

    const analysisResult = aiResponse.response || '';

    // Save analysis result
    await CRE_DB.prepare(`
      INSERT INTO document_analysis (
        id, rfp_document_id, analysis_type, analysis_result, ai_model, confidence_score
      ) VALUES (?, ?, ?, ?, '@cf/meta/llama-3.1-8b-instruct', 0.85)
    `).bind(
      crypto.randomUUID(),
      documentId,
      analysisType,
      analysisResult
    ).run();
  }

  // Update document status
  await CRE_DB.prepare(`
    UPDATE rfp_documents 
    SET status = 'analyzed', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(documentId).run();
}

async function processPropertyMatch(payload: any, env: CloudflareEnv): Promise<void> {
  const { AI, CRE_DB } = env;
  const { rfpDocumentId, propertyIds } = payload;

  // Get RFP analysis results
  const analysisResult = await CRE_DB.prepare(`
    SELECT analysis_result FROM document_analysis 
    WHERE rfp_document_id = ? AND analysis_type = 'property_criteria'
    ORDER BY analysis_date DESC LIMIT 1
  `).bind(rfpDocumentId).first();

  if (!analysisResult) {
    throw new Error('No property criteria analysis found');
  }

  const criteria = JSON.parse(analysisResult.analysis_result as string);

  // Match against properties (simplified logic)
  for (const propertyId of propertyIds) {
    const matchScore = await calculateMatchScore(criteria, propertyId, env);
    
    if (matchScore > 0.6) { // Only save high-confidence matches
      await CRE_DB.prepare(`
        INSERT INTO rfp_property_matches (
          id, rfp_document_id, property_id, match_score, 
          match_criteria, created_by, status
        ) VALUES (?, ?, ?, ?, ?, 'ai', 'suggested')
      `).bind(
        crypto.randomUUID(),
        rfpDocumentId,
        propertyId,
        matchScore,
        JSON.stringify(criteria)
      ).run();
    }
  }
}

async function processDataSync(payload: any, env: CloudflareEnv): Promise<void> {
  // Sync data with external sources, update caches, etc.
  const { CACHE_DB } = env;
  const { syncType, data } = payload;

  switch (syncType) {
    case 'property_cache_refresh':
      // Refresh property cache
      await CACHE_DB.prepare(`
        INSERT OR REPLACE INTO cache_entries (key, value, expires_at)
        VALUES (?, ?, datetime('now', '+1 hour'))
      `).bind('properties_list', JSON.stringify(data)).run();
      break;
    
    case 'market_data_update':
      // Update market data cache
      await CACHE_DB.prepare(`
        INSERT OR REPLACE INTO cache_entries (key, value, expires_at)
        VALUES (?, ?, datetime('now', '+6 hours'))
      `).bind('market_data', JSON.stringify(data)).run();
      break;
  }
}

function getAnalysisPrompt(analysisType: string, content: string): string {
  const prompts = {
    summary: `Provide a concise summary of this RFP document:\n${content}`,
    key_requirements: `Extract key requirements as JSON:\n${content}`,
    property_criteria: `Extract property criteria as JSON:\n${content}`,
  };

  return prompts[analysisType as keyof typeof prompts] || prompts.summary;
}

async function calculateMatchScore(criteria: any, propertyId: string, env: CloudflareEnv): Promise<number> {
  // Simplified matching logic - in reality, this would be more sophisticated
  // Compare property attributes against RFP criteria
  // Return a score between 0 and 1
  
  // This is a placeholder - implement actual matching logic based on your property data structure
  return Math.random() * 0.4 + 0.6; // Random score between 0.6 and 1.0 for demo
}