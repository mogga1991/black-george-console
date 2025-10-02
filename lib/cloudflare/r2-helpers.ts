// R2 Storage Helper Functions for CRE Console

interface CloudflareEnv {
  RFP_UPLOADS: R2Bucket;
  CRE_DOCUMENTS: R2Bucket;
}

export class R2Helper {
  private rfpBucket: R2Bucket;
  private documentsBucket: R2Bucket;

  constructor(env: CloudflareEnv) {
    this.rfpBucket = env.RFP_UPLOADS;
    this.documentsBucket = env.CRE_DOCUMENTS;
  }

  // RFP Document Operations
  async uploadRFPDocument(
    documentId: string,
    fileName: string,
    content: ArrayBuffer,
    metadata: {
      contentType: string;
      originalName: string;
      uploadedBy?: string;
      tags?: string[];
    }
  ): Promise<string> {
    const key = `rfp/${documentId}/${fileName}`;
    
    await this.rfpBucket.put(key, content, {
      httpMetadata: {
        contentType: metadata.contentType,
      },
      customMetadata: {
        originalName: metadata.originalName,
        uploadedBy: metadata.uploadedBy || 'anonymous',
        documentId: documentId,
        tags: JSON.stringify(metadata.tags || []),
        uploadDate: new Date().toISOString(),
      },
    });

    return key;
  }

  async getRFPDocument(key: string): Promise<R2Object | null> {
    return await this.rfpBucket.get(key);
  }

  async getRFPDocumentUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    // Generate a presigned URL for temporary access
    const url = await this.rfpBucket.get(key, {
      range: { offset: 0, length: 1 } // Get just metadata for URL generation
    });
    
    // In a real implementation, you'd generate a proper presigned URL
    // This is a simplified version - Cloudflare R2 presigned URLs require additional setup
    return `https://your-r2-domain.com/${key}`;
  }

  async deleteRFPDocument(key: string): Promise<void> {
    await this.rfpBucket.delete(key);
  }

  async listRFPDocuments(prefix?: string, limit: number = 1000): Promise<R2Objects> {
    return await this.rfpBucket.list({
      prefix: prefix || 'rfp/',
      limit: limit,
    });
  }

  // Property Document Operations
  async uploadPropertyDocument(
    propertyId: string,
    documentType: string,
    fileName: string,
    content: ArrayBuffer,
    metadata: {
      contentType: string;
      originalName: string;
      uploadedBy?: string;
      tags?: string[];
    }
  ): Promise<string> {
    const documentId = crypto.randomUUID();
    const key = `properties/${propertyId}/${documentType}/${documentId}/${fileName}`;
    
    await this.documentsBucket.put(key, content, {
      httpMetadata: {
        contentType: metadata.contentType,
      },
      customMetadata: {
        originalName: metadata.originalName,
        propertyId: propertyId,
        documentType: documentType,
        documentId: documentId,
        tags: JSON.stringify(metadata.tags || []),
        uploadDate: new Date().toISOString(),
      },
    });

    return key;
  }

  async getPropertyDocument(key: string): Promise<R2Object | null> {
    return await this.documentsBucket.get(key);
  }

  async getPropertyDocumentUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    // Generate a presigned URL for temporary access
    return `https://your-r2-domain.com/${key}`;
  }

  async deletePropertyDocument(key: string): Promise<void> {
    await this.documentsBucket.delete(key);
  }

  async listPropertyDocuments(
    propertyId: string, 
    documentType?: string, 
    limit: number = 1000
  ): Promise<R2Objects> {
    const prefix = documentType 
      ? `properties/${propertyId}/${documentType}/`
      : `properties/${propertyId}/`;
      
    return await this.documentsBucket.list({
      prefix: prefix,
      limit: limit,
    });
  }

  // Bulk Operations
  async uploadMultipleFiles(
    files: Array<{
      key: string;
      content: ArrayBuffer;
      metadata: {
        contentType: string;
        customMetadata?: Record<string, string>;
      };
    }>,
    bucket: 'rfp' | 'documents' = 'documents'
  ): Promise<string[]> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    const uploadPromises = files.map(async (file) => {
      await targetBucket.put(file.key, file.content, {
        httpMetadata: {
          contentType: file.metadata.contentType,
        },
        customMetadata: file.metadata.customMetadata || {},
      });
      return file.key;
    });

    return await Promise.all(uploadPromises);
  }

  async deleteMultipleFiles(keys: string[], bucket: 'rfp' | 'documents' = 'documents'): Promise<void> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    const deletePromises = keys.map(key => targetBucket.delete(key));
    await Promise.all(deletePromises);
  }

  // Search and Filter Operations
  async searchDocuments(
    bucket: 'rfp' | 'documents',
    filters: {
      prefix?: string;
      uploadedBy?: string;
      documentType?: string;
      tags?: string[];
      dateRange?: {
        start: Date;
        end: Date;
      };
    },
    limit: number = 1000
  ): Promise<R2Object[]> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    
    const listResult = await targetBucket.list({
      prefix: filters.prefix || '',
      limit: limit,
    });

    // Filter results based on metadata
    const filteredObjects: R2Object[] = [];
    
    for (const obj of listResult.objects) {
      const objWithMetadata = await targetBucket.get(obj.key);
      if (!objWithMetadata) continue;

      let includeObject = true;

      // Filter by uploadedBy
      if (filters.uploadedBy && objWithMetadata.customMetadata?.uploadedBy !== filters.uploadedBy) {
        includeObject = false;
      }

      // Filter by documentType
      if (filters.documentType && objWithMetadata.customMetadata?.documentType !== filters.documentType) {
        includeObject = false;
      }

      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        const objectTags = objWithMetadata.customMetadata?.tags 
          ? JSON.parse(objWithMetadata.customMetadata.tags)
          : [];
        const hasMatchingTag = filters.tags.some(tag => objectTags.includes(tag));
        if (!hasMatchingTag) {
          includeObject = false;
        }
      }

      // Filter by date range
      if (filters.dateRange) {
        const uploadDate = objWithMetadata.customMetadata?.uploadDate 
          ? new Date(objWithMetadata.customMetadata.uploadDate)
          : objWithMetadata.uploaded;
        
        if (uploadDate < filters.dateRange.start || uploadDate > filters.dateRange.end) {
          includeObject = false;
        }
      }

      if (includeObject) {
        filteredObjects.push(objWithMetadata);
      }
    }

    return filteredObjects;
  }

  // File Processing Operations
  async getFileContent(key: string, bucket: 'rfp' | 'documents' = 'documents'): Promise<ArrayBuffer | null> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    const object = await targetBucket.get(key);
    
    if (!object) return null;
    
    return await object.arrayBuffer();
  }

  async getFileText(key: string, bucket: 'rfp' | 'documents' = 'documents'): Promise<string | null> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    const object = await targetBucket.get(key);
    
    if (!object) return null;
    
    return await object.text();
  }

  async getFileMetadata(key: string, bucket: 'rfp' | 'documents' = 'documents'): Promise<any> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    const object = await targetBucket.get(key);
    
    if (!object) return null;
    
    return {
      key: object.key,
      size: object.size,
      etag: object.etag,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata,
    };
  }

  // CORS and Access Control
  async setupCORS(bucket: 'rfp' | 'documents', allowedOrigins: string[]): Promise<void> {
    // Note: CORS configuration is typically done via the Cloudflare dashboard or API
    // This is a placeholder for documentation purposes
    console.log(`CORS should be configured for ${bucket} bucket with origins:`, allowedOrigins);
  }

  // Cleanup Operations
  async cleanupExpiredFiles(bucket: 'rfp' | 'documents', olderThanDays: number = 30): Promise<string[]> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const listResult = await targetBucket.list({
      limit: 1000,
    });

    const expiredKeys: string[] = [];

    for (const obj of listResult.objects) {
      if (obj.uploaded < cutoffDate) {
        expiredKeys.push(obj.key);
        await targetBucket.delete(obj.key);
      }
    }

    return expiredKeys;
  }

  // Storage Statistics
  async getStorageStats(bucket: 'rfp' | 'documents'): Promise<{
    totalObjects: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    const targetBucket = bucket === 'rfp' ? this.rfpBucket : this.documentsBucket;
    
    const listResult = await targetBucket.list({
      limit: 10000, // Adjust as needed
    });

    let totalSize = 0;
    const byType: Record<string, { count: number; size: number }> = {};

    for (const obj of listResult.objects) {
      totalSize += obj.size || 0;
      
      // Determine file type from extension or metadata
      const extension = obj.key.split('.').pop()?.toLowerCase() || 'unknown';
      
      if (!byType[extension]) {
        byType[extension] = { count: 0, size: 0 };
      }
      
      byType[extension].count++;
      byType[extension].size += obj.size || 0;
    }

    return {
      totalObjects: listResult.objects.length,
      totalSize,
      byType,
    };
  }
}

// Helper function to get R2Helper instance
export function getR2Helper(env: CloudflareEnv): R2Helper {
  return new R2Helper(env);
}

// Utility functions for file validation
export function validateFileType(fileName: string, allowedTypes: string[]): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  
  const mimeTypeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const mimeType = mimeTypeMap[extension];
  return mimeType ? allowedTypes.includes(mimeType) : false;
}

export function generateSecureKey(prefix: string, id: string, fileName: string): string {
  // Generate a secure, predictable key structure
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${prefix}/${id}/${timestamp}_${sanitizedFileName}`;
}