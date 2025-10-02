'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';

interface RFPDocument {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: 'pending' | 'processing' | 'analyzed' | 'error';
  uploadDate: string;
  tags?: string[];
}

interface DocumentAnalysis {
  id: string;
  analysisType: string;
  analysisResult: string;
  confidenceScore: number;
  analysisDate: string;
}

interface RFPUploadManagerProps {
  userId?: string;
  onDocumentUploaded?: (document: RFPDocument) => void;
}

export const RFPUploadManager: React.FC<RFPUploadManagerProps> = ({
  userId,
  onDocumentUploaded
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<RFPDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<RFPDocument | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis[]>([]);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  }, [title]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title);
      formData.append('description', description);
      if (userId) formData.append('userId', userId);
      if (tags) formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim())));

      const response = await fetch('/api/upload/rfp', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        const newDocument: RFPDocument = result.data;
        setDocuments(prev => [newDocument, ...prev]);
        onDocumentUploaded?.(newDocument);
        
        // Reset form
        setSelectedFile(null);
        setTitle('');
        setDescription('');
        setTags('');
        
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, title, description, userId, tags, onDocumentUploaded]);

  const loadDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      
      const response = await fetch(`/api/upload/rfp?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setDocuments(result.data);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }, [userId]);

  const loadAnalysis = useCallback(async (documentId: string) => {
    setIsLoadingAnalysis(true);
    try {
      const response = await fetch(`/api/ai/analyze-document?documentId=${documentId}`);
      const result = await response.json();
      
      if (result.success) {
        setAnalysis(result.data);
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, []);

  const requestAnalysis = useCallback(async (documentId: string, analysisType: string) => {
    try {
      const response = await fetch('/api/ai/analyze-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          analysisType,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Analysis "${analysisType}" completed successfully!`);
        // Reload analysis for this document
        loadAnalysis(documentId);
        // Reload documents to update status
        loadDocuments();
      }
    } catch (error) {
      console.error('Analysis request failed:', error);
      alert('Failed to request analysis. Please try again.');
    }
  }, [loadAnalysis, loadDocuments]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'processing':
        return <Badge variant="outline">Processing</Badge>;
      case 'analyzed':
        return <Badge variant="default">Analyzed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload RFP Document
          </CardTitle>
          <CardDescription>
            Upload RFP documents for AI analysis and property matching
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Select File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="mt-1"
            />
            {selectedFile && (
              <p className="text-sm text-gray-500 mt-1">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter document description"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (Optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter comma-separated tags"
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No documents uploaded yet
              </p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-gray-500">{doc.fileName}</p>
                      {doc.description && (
                        <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(doc.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDocument(doc);
                          loadAnalysis(doc.id);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                  </div>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {doc.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => requestAnalysis(doc.id, 'summary')}
                      >
                        Analyze Summary
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => requestAnalysis(doc.id, 'key_requirements')}
                      >
                        Extract Requirements
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => requestAnalysis(doc.id, 'property_criteria')}
                      >
                        Property Criteria
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results Modal/Panel */}
      {selectedDocument && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results: {selectedDocument.title}</CardTitle>
            <CardDescription>
              AI-generated analysis and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAnalysis ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading analysis...
              </div>
            ) : analysis.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No analysis available yet. Request analysis above.
              </p>
            ) : (
              <div className="space-y-4">
                {analysis.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium capitalize">
                        {item.analysisType.replace('_', ' ')}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Confidence: {Math.round(item.confidenceScore * 100)}%
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(item.analysisDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {item.analysisType === 'key_requirements' || 
                       item.analysisType === 'property_criteria' ? (
                        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">
                          {item.analysisResult}
                        </pre>
                      ) : (
                        <p className="text-sm">{item.analysisResult}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};