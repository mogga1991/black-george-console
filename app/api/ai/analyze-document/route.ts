import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { v4 as uuidv4 } from 'uuid';

// Type definitions for Cloudflare bindings
interface CloudflareEnv {
  AI: Ai;
  RFP_UPLOADS: R2Bucket;
  CRE_DB: D1Database;
}

// Get Cloudflare bindings from the runtime
function getCloudflareBindings(): CloudflareEnv {
  // @ts-ignore - Cloudflare bindings are available in the runtime
  return process.env as any;
}

export async function POST(request: NextRequest) {
  try {
    const { AI, RFP_UPLOADS, CRE_DB } = getCloudflareBindings();
    
    if (!AI || !RFP_UPLOADS || !CRE_DB) {
      return NextResponse.json(
        { error: 'Cloudflare bindings not available' },
        { status: 500 }
      );
    }

    const { documentId, analysisType = 'summary' } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Get document metadata from D1
    const docResult = await CRE_DB.prepare(`
      SELECT * FROM rfp_documents WHERE id = ?
    `).bind(documentId).first();

    if (!docResult) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get document content from R2
    const r2Object = await RFP_UPLOADS.get(docResult.r2_key as string);
    if (!r2Object) {
      return NextResponse.json(
        { error: 'Document file not found in storage' },
        { status: 404 }
      );
    }

    // Convert to text (simplified - you might want to use a proper PDF parser)
    const content = await r2Object.text();

    // Define analysis prompts based on type
    const prompts = {
      summary: `Please provide a concise summary of this RFP document. Focus on:
- Main purpose and scope of the project
- Key requirements and criteria
- Important dates and deadlines
- Budget information if mentioned

Document content:
${content}`,

      key_requirements: `Extract and list the key requirements from this RFP document. Format as JSON with categories:
{
  "space_requirements": [],
  "location_criteria": [],
  "technical_specifications": [],
  "financial_requirements": [],
  "timeline_requirements": [],
  "other_requirements": []
}

Document content:
${content}`,

      property_criteria: `Based on this RFP, extract the ideal property characteristics that would match this request. Format as JSON:
{
  "property_type": "",
  "size_range": {"min": 0, "max": 0, "unit": "sqft"},
  "location_preferences": [],
  "budget_range": {"min": 0, "max": 0, "currency": "USD"},
  "amenities_required": [],
  "lease_terms": [],
  "special_requirements": []
}

Document content:
${content}`,

      property_match: `Analyze this RFP and suggest what types of commercial real estate properties would be suitable. Consider:
- Property type (office, retail, industrial, etc.)
- Size requirements
- Location preferences
- Special features needed
- Budget considerations

Document content:
${content}`
    };

    const prompt = prompts[analysisType as keyof typeof prompts] || prompts.summary;

    // Call Workers AI for analysis
    const aiResponse = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are an expert commercial real estate analyst. Provide accurate, detailed analysis of RFP documents.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2048
    });

    // Extract the response text
    const analysisResult = aiResponse.response || aiResponse.choices?.[0]?.message?.content || '';

    // Save analysis to D1
    const analysisId = uuidv4();
    await CRE_DB.prepare(`
      INSERT INTO document_analysis (
        id, rfp_document_id, analysis_type, analysis_result, 
        ai_model, confidence_score
      ) VALUES (?, ?, ?, ?, '@cf/meta/llama-3.1-8b-instruct', ?)
    `).bind(
      analysisId,
      documentId,
      analysisType,
      analysisResult,
      0.85 // Default confidence score
    ).run();

    // Update document status
    await CRE_DB.prepare(`
      UPDATE rfp_documents 
      SET status = 'analyzed', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(documentId).run();

    // Track AI usage
    await CRE_DB.prepare(`
      INSERT INTO ai_usage (
        id, model_name, operation_type, input_tokens, 
        output_tokens, request_id
      ) VALUES (?, '@cf/meta/llama-3.1-8b-instruct', 'document_analysis', ?, ?, ?)
    `).bind(
      uuidv4(),
      content.length / 4, // Rough token estimate
      analysisResult.length / 4,
      analysisId
    ).run();

    return NextResponse.json({
      success: true,
      data: {
        analysisId,
        documentId,
        analysisType,
        result: analysisResult,
        model: '@cf/meta/llama-3.1-8b-instruct'
      }
    });

  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { CRE_DB } = getCloudflareBindings();
    
    if (!CRE_DB) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const analysisType = searchParams.get('analysisType');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    let query = `
      SELECT * FROM document_analysis 
      WHERE rfp_document_id = ?
    `;
    const params: any[] = [documentId];

    if (analysisType) {
      query += ` AND analysis_type = ?`;
      params.push(analysisType);
    }

    query += ` ORDER BY analysis_date DESC`;

    const result = await CRE_DB.prepare(query).bind(...params).all();

    return NextResponse.json({
      success: true,
      data: result.results
    });

  } catch (error) {
    console.error('Fetch analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}