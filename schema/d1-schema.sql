-- CRE Console D1 Database Schema
-- This schema supports RFP tracking, document metadata, and caching

-- RFP Documents Table
CREATE TABLE IF NOT EXISTS rfp_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    r2_key TEXT NOT NULL, -- R2 storage key
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('pending', 'processing', 'analyzed', 'error')) DEFAULT 'pending',
    user_id TEXT,
    tags TEXT, -- JSON array of tags
    metadata TEXT, -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Document Analysis Results
CREATE TABLE IF NOT EXISTS document_analysis (
    id TEXT PRIMARY KEY,
    rfp_document_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL, -- 'summary', 'key_requirements', 'property_match', etc.
    analysis_result TEXT NOT NULL, -- JSON result from AI
    confidence_score REAL,
    ai_model TEXT,
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfp_document_id) REFERENCES rfp_documents(id) ON DELETE CASCADE
);

-- Property Documents
CREATE TABLE IF NOT EXISTS property_documents (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    title TEXT NOT NULL,
    document_type TEXT, -- 'lease', 'financial', 'photos', 'marketing', etc.
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    r2_key TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    tags TEXT, -- JSON array
    metadata TEXT, -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- RFP to Property Matches
CREATE TABLE IF NOT EXISTS rfp_property_matches (
    id TEXT PRIMARY KEY,
    rfp_document_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    match_score REAL NOT NULL,
    match_criteria TEXT, -- JSON of matching criteria
    ai_reasoning TEXT,
    created_by TEXT, -- 'ai' or user_id
    status TEXT CHECK(status IN ('suggested', 'approved', 'rejected')) DEFAULT 'suggested',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfp_document_id) REFERENCES rfp_documents(id) ON DELETE CASCADE
);

-- Processing Queue for Background Workers
CREATE TABLE IF NOT EXISTS processing_queue (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL, -- 'document_analysis', 'property_match', 'data_sync', etc.
    payload TEXT NOT NULL, -- JSON payload
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    priority INTEGER DEFAULT 0, -- Higher numbers = higher priority
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache for frequently accessed data
CREATE TABLE IF NOT EXISTS cache_entries (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON value
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions and Preferences
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_data TEXT, -- JSON session data
    preferences TEXT, -- JSON user preferences
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- AI Model Usage Tracking
CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_estimate REAL,
    user_id TEXT,
    request_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rfp_documents_status ON rfp_documents(status);
CREATE INDEX IF NOT EXISTS idx_rfp_documents_user_id ON rfp_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_rfp_documents_upload_date ON rfp_documents(upload_date);

CREATE INDEX IF NOT EXISTS idx_document_analysis_rfp_id ON document_analysis(rfp_document_id);
CREATE INDEX IF NOT EXISTS idx_document_analysis_type ON document_analysis(analysis_type);

CREATE INDEX IF NOT EXISTS idx_property_documents_property_id ON property_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_type ON property_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_rfp_matches_rfp_id ON rfp_property_matches(rfp_document_id);
CREATE INDEX IF NOT EXISTS idx_rfp_matches_property_id ON rfp_property_matches(property_id);
CREATE INDEX IF NOT EXISTS idx_rfp_matches_score ON rfp_property_matches(match_score);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON processing_queue(priority);
CREATE INDEX IF NOT EXISTS idx_processing_queue_scheduled ON processing_queue(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);