import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { v4 as uuidv4 } from 'uuid';

// Type definitions for Cloudflare bindings
interface CloudflareEnv {
  CRE_DOCUMENTS: R2Bucket;
  CRE_DB: D1Database;
}

// Get Cloudflare bindings from the runtime
function getCloudflareBindings(): CloudflareEnv {
  // @ts-ignore - Cloudflare bindings are available in the runtime
  return process.env as any;
}

export async function POST(request: NextRequest) {
  try {
    const { CRE_DOCUMENTS, CRE_DB } = getCloudflareBindings();
    
    if (!CRE_DOCUMENTS || !CRE_DB) {
      return NextResponse.json(
        { error: 'Cloudflare bindings not available' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const propertyId = formData.get('propertyId') as string;
    const title = formData.get('title') as string;
    const documentType = formData.get('documentType') as string;
    const tags = formData.get('tags') as string;

    if (!file || !propertyId) {
      return NextResponse.json(
        { error: 'File and property ID are required' },
        { status: 400 }
      );
    }

    // Validate file type (more permissive for property documents)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Generate unique ID and R2 key
    const documentId = uuidv4();
    const r2Key = `properties/${propertyId}/${documentType}/${documentId}/${file.name}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await CRE_DOCUMENTS.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalName: file.name,
        propertyId: propertyId,
        documentType: documentType || 'general',
        documentId: documentId,
      },
    });

    // Save metadata to D1
    const parsedTags = tags ? JSON.parse(tags) : [];
    await CRE_DB.prepare(`
      INSERT INTO property_documents (
        id, property_id, title, document_type, file_name, 
        file_size, file_type, r2_key, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      documentId,
      propertyId,
      title || file.name,
      documentType || 'general',
      file.name,
      file.size,
      file.type,
      r2Key,
      JSON.stringify(parsedTags)
    ).run();

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        propertyId,
        title: title || file.name,
        documentType: documentType || 'general',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
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
    const propertyId = searchParams.get('propertyId');
    const documentType = searchParams.get('documentType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT id, property_id, title, document_type, file_name, 
             file_size, file_type, tags, upload_date, created_at
      FROM property_documents
      WHERE 1=1
    `;
    const params: any[] = [];

    if (propertyId) {
      query += ` AND property_id = ?`;
      params.push(propertyId);
    }

    if (documentType) {
      query += ` AND document_type = ?`;
      params.push(documentType);
    }

    query += ` ORDER BY upload_date DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await CRE_DB.prepare(query).bind(...params).all();

    return NextResponse.json({
      success: true,
      data: result.results,
      meta: {
        limit,
        offset,
        count: result.results?.length || 0
      }
    });

  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}