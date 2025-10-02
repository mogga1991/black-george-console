// D1 Database Helper Functions for CRE Console

interface CloudflareEnv {
  CRE_DB: D1Database;
  CACHE_DB: D1Database;
}

export class D1Helper {
  private db: D1Database;
  private cacheDb: D1Database;

  constructor(env: CloudflareEnv) {
    this.db = env.CRE_DB;
    this.cacheDb = env.CACHE_DB;
  }

  // RFP Document Operations
  async createRFPDocument(data: {
    id: string;
    title: string;
    description?: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    r2Key: string;
    userId?: string;
    tags?: string[];
  }) {
    return await this.db.prepare(`
      INSERT INTO rfp_documents (
        id, title, description, file_name, file_size, file_type, 
        r2_key, user_id, tags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      data.id,
      data.title,
      data.description || '',
      data.fileName,
      data.fileSize,
      data.fileType,
      data.r2Key,
      data.userId || null,
      JSON.stringify(data.tags || [])
    ).run();
  }

  async getRFPDocument(id: string) {
    return await this.db.prepare(`
      SELECT * FROM rfp_documents WHERE id = ?
    `).bind(id).first();
  }

  async updateRFPStatus(id: string, status: string) {
    return await this.db.prepare(`
      UPDATE rfp_documents 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, id).run();
  }

  async getRFPDocuments(filters: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let query = `
      SELECT id, title, description, file_name, file_size, file_type,
             status, user_id, tags, upload_date, created_at, updated_at
      FROM rfp_documents WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.userId) {
      query += ` AND user_id = ?`;
      params.push(filters.userId);
    }

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY upload_date DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    return await this.db.prepare(query).bind(...params).all();
  }

  // Document Analysis Operations
  async saveAnalysis(data: {
    id: string;
    rfpDocumentId: string;
    analysisType: string;
    analysisResult: string;
    aiModel: string;
    confidenceScore?: number;
  }) {
    return await this.db.prepare(`
      INSERT INTO document_analysis (
        id, rfp_document_id, analysis_type, analysis_result, 
        ai_model, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      data.id,
      data.rfpDocumentId,
      data.analysisType,
      data.analysisResult,
      data.aiModel,
      data.confidenceScore || 0.85
    ).run();
  }

  async getAnalysis(rfpDocumentId: string, analysisType?: string) {
    let query = `
      SELECT * FROM document_analysis 
      WHERE rfp_document_id = ?
    `;
    const params: any[] = [rfpDocumentId];

    if (analysisType) {
      query += ` AND analysis_type = ?`;
      params.push(analysisType);
    }

    query += ` ORDER BY analysis_date DESC`;

    return await this.db.prepare(query).bind(...params).all();
  }

  // Property Document Operations
  async createPropertyDocument(data: {
    id: string;
    propertyId: string;
    title: string;
    documentType: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    r2Key: string;
    tags?: string[];
  }) {
    return await this.db.prepare(`
      INSERT INTO property_documents (
        id, property_id, title, document_type, file_name, 
        file_size, file_type, r2_key, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.id,
      data.propertyId,
      data.title,
      data.documentType,
      data.fileName,
      data.fileSize,
      data.fileType,
      data.r2Key,
      JSON.stringify(data.tags || [])
    ).run();
  }

  async getPropertyDocuments(propertyId: string, documentType?: string) {
    let query = `
      SELECT * FROM property_documents 
      WHERE property_id = ?
    `;
    const params: any[] = [propertyId];

    if (documentType) {
      query += ` AND document_type = ?`;
      params.push(documentType);
    }

    query += ` ORDER BY upload_date DESC`;

    return await this.db.prepare(query).bind(...params).all();
  }

  // Property Matching Operations
  async savePropertyMatch(data: {
    id: string;
    rfpDocumentId: string;
    propertyId: string;
    matchScore: number;
    matchCriteria: any;
    aiReasoning?: string;
    createdBy: string;
  }) {
    return await this.db.prepare(`
      INSERT INTO rfp_property_matches (
        id, rfp_document_id, property_id, match_score, 
        match_criteria, ai_reasoning, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'suggested')
    `).bind(
      data.id,
      data.rfpDocumentId,
      data.propertyId,
      data.matchScore,
      JSON.stringify(data.matchCriteria),
      data.aiReasoning || '',
      data.createdBy
    ).run();
  }

  async getPropertyMatches(rfpDocumentId: string, minScore?: number) {
    let query = `
      SELECT * FROM rfp_property_matches 
      WHERE rfp_document_id = ?
    `;
    const params: any[] = [rfpDocumentId];

    if (minScore) {
      query += ` AND match_score >= ?`;
      params.push(minScore);
    }

    query += ` ORDER BY match_score DESC`;

    return await this.db.prepare(query).bind(...params).all();
  }

  async updateMatchStatus(id: string, status: string) {
    return await this.db.prepare(`
      UPDATE rfp_property_matches 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, id).run();
  }

  // Processing Queue Operations
  async addToQueue(data: {
    id: string;
    taskType: string;
    payload: any;
    priority?: number;
    scheduledAt?: Date;
  }) {
    return await this.db.prepare(`
      INSERT INTO processing_queue (
        id, task_type, payload, priority, scheduled_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      data.id,
      data.taskType,
      JSON.stringify(data.payload),
      data.priority || 0,
      data.scheduledAt?.toISOString() || new Date().toISOString()
    ).run();
  }

  async getQueueTasks(status: string = 'pending', limit: number = 10) {
    return await this.db.prepare(`
      SELECT * FROM processing_queue 
      WHERE status = ? 
      ORDER BY priority DESC, scheduled_at ASC 
      LIMIT ?
    `).bind(status, limit).all();
  }

  async updateTaskStatus(id: string, status: string, errorMessage?: string) {
    let query = `
      UPDATE processing_queue 
      SET status = ?, attempts = attempts + 1
    `;
    const params: any[] = [status, id];

    if (status === 'processing') {
      query += `, started_at = CURRENT_TIMESTAMP`;
    } else if (status === 'completed' || status === 'failed') {
      query += `, completed_at = CURRENT_TIMESTAMP`;
      if (errorMessage) {
        query += `, error_message = ?`;
        params.splice(-1, 0, errorMessage);
      }
    }

    query += ` WHERE id = ?`;

    return await this.db.prepare(query).bind(...params).run();
  }

  // Cache Operations
  async setCache(key: string, value: any, expiresInMinutes: number = 60) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    return await this.cacheDb.prepare(`
      INSERT OR REPLACE INTO cache_entries (key, value, expires_at)
      VALUES (?, ?, ?)
    `).bind(key, JSON.stringify(value), expiresAt.toISOString()).run();
  }

  async getCache(key: string) {
    const result = await this.cacheDb.prepare(`
      SELECT value FROM cache_entries 
      WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `).bind(key).first();

    if (result) {
      return JSON.parse(result.value as string);
    }
    return null;
  }

  async deleteCache(key: string) {
    return await this.cacheDb.prepare(`
      DELETE FROM cache_entries WHERE key = ?
    `).bind(key).run();
  }

  async clearExpiredCache() {
    return await this.cacheDb.prepare(`
      DELETE FROM cache_entries WHERE expires_at <= CURRENT_TIMESTAMP
    `).run();
  }

  // Session Operations
  async createSession(data: {
    id: string;
    userId: string;
    sessionData?: any;
    preferences?: any;
    expiresAt: Date;
  }) {
    return await this.db.prepare(`
      INSERT INTO user_sessions (
        id, user_id, session_data, preferences, expires_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      data.id,
      data.userId,
      JSON.stringify(data.sessionData || {}),
      JSON.stringify(data.preferences || {}),
      data.expiresAt.toISOString()
    ).run();
  }

  async getSession(id: string) {
    return await this.db.prepare(`
      SELECT * FROM user_sessions 
      WHERE id = ? AND expires_at > CURRENT_TIMESTAMP
    `).bind(id).first();
  }

  async updateSessionActivity(id: string) {
    return await this.db.prepare(`
      UPDATE user_sessions 
      SET last_activity = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(id).run();
  }

  // AI Usage Tracking
  async trackAIUsage(data: {
    id: string;
    modelName: string;
    operationType: string;
    inputTokens: number;
    outputTokens: number;
    costEstimate?: number;
    userId?: string;
    requestId?: string;
  }) {
    return await this.db.prepare(`
      INSERT INTO ai_usage (
        id, model_name, operation_type, input_tokens, 
        output_tokens, cost_estimate, user_id, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.id,
      data.modelName,
      data.operationType,
      data.inputTokens,
      data.outputTokens,
      data.costEstimate || 0,
      data.userId || null,
      data.requestId || null
    ).run();
  }

  async getAIUsageStats(userId?: string, timeRange?: { start: Date; end: Date }) {
    let query = `
      SELECT model_name, operation_type, 
             COUNT(*) as usage_count,
             SUM(input_tokens) as total_input_tokens,
             SUM(output_tokens) as total_output_tokens,
             SUM(cost_estimate) as total_cost
      FROM ai_usage WHERE 1=1
    `;
    const params: any[] = [];

    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }

    if (timeRange) {
      query += ` AND created_at BETWEEN ? AND ?`;
      params.push(timeRange.start.toISOString(), timeRange.end.toISOString());
    }

    query += ` GROUP BY model_name, operation_type ORDER BY usage_count DESC`;

    return await this.db.prepare(query).bind(...params).all();
  }
}

// Helper function to get D1Helper instance
export function getD1Helper(env: CloudflareEnv): D1Helper {
  return new D1Helper(env);
}