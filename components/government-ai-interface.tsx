'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui';
import {
  Upload,
  FileText,
  Bot,
  Send,
  Paperclip,
  MapPin,
  Building2,
  DollarSign,
  Calendar,
  Users,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Trash2,
  Download,
} from 'lucide-react';

interface DocumentUpload {
  id: string;
  name: string;
  type: 'RFP' | 'RLP' | 'PDS' | 'OTHER';
  size: string;
  uploadDate: Date;
  status: 'processing' | 'analyzed' | 'error';
  extractedData?: {
    location?: string;
    sqft?: string;
    budget?: string;
    deadline?: string;
    requirements?: string[];
  };
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'analysis' | 'search_trigger';
  extractedData?: any;
}

interface GovernmentAIInterfaceProps {
  onMapSearch: (query: string, location: string, filters: any) => void;
  onLocationFocus: (location: string) => void;
}

export default function GovernmentAIInterface({ 
  onMapSearch, 
  onLocationFocus 
}: GovernmentAIInterfaceProps) {
  const [documents, setDocuments] = useState<DocumentUpload[]>([]);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Government CRE Intelligence Assistant. Upload RFPs, RLPs, or PDS documents and I'll analyze them to find the perfect commercial real estate matches. I can also answer questions about government contracting and commercial real estate.",
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileUpload = async (files: File[]) => {
    for (const file of files) {
      const documentType = detectDocumentType(file.name);
      const newDoc: DocumentUpload = {
        id: Date.now().toString() + Math.random(),
        name: file.name,
        type: documentType,
        size: formatFileSize(file.size),
        uploadDate: new Date(),
        status: 'processing'
      };

      setDocuments(prev => [...prev, newDoc]);
      
      // Simulate AI processing
      setTimeout(() => {
        const extractedData = simulateDocumentAnalysis(file.name, documentType);
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === newDoc.id 
              ? { ...doc, status: 'analyzed', extractedData }
              : doc
          )
        );

        // Add AI analysis message
        const analysisMessage: AIMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I've analyzed "${file.name}" and extracted key requirements. ${extractedData.location ? `Location: ${extractedData.location}. ` : ''}${extractedData.sqft ? `Space needed: ${extractedData.sqft}. ` : ''}${extractedData.budget ? `Budget: ${extractedData.budget}. ` : ''}Let me search for matching properties.`,
          timestamp: new Date(),
          type: 'analysis',
          extractedData
        };

        setMessages(prev => [...prev, analysisMessage]);

        // Trigger map search if we have location data
        if (extractedData.location) {
          setTimeout(() => {
            onLocationFocus(extractedData.location!);
            onMapSearch(
              `${extractedData.sqft || 'office space'} ${extractedData.location}`,
              extractedData.location!,
              {
                sqft: extractedData.sqft,
                budget: extractedData.budget,
                requirements: extractedData.requirements
              }
            );
          }, 1000);
        }
      }, 2000);
    }
  };

  const detectDocumentType = (filename: string): DocumentUpload['type'] => {
    const lower = filename.toLowerCase();
    if (lower.includes('rfp')) return 'RFP';
    if (lower.includes('rlp')) return 'RLP';
    if (lower.includes('pds')) return 'PDS';
    return 'OTHER';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const simulateDocumentAnalysis = (filename: string, type: string) => {
    // Simulate different extraction results based on document type
    const mockData = {
      RFP: {
        location: 'Washington, DC',
        sqft: '15,000 - 20,000 sq ft',
        budget: '$400,000 - $600,000 annually',
        deadline: '45 days',
        requirements: ['Security clearance required', 'Federal building standards', 'Parking for 50 vehicles']
      },
      RLP: {
        location: 'New York, NY',
        sqft: '8,000 - 12,000 sq ft',
        budget: '$800,000 - $1,200,000 annually',
        deadline: '30 days',
        requirements: ['Ground floor access', 'Conference facilities', 'Public transportation access']
      },
      PDS: {
        location: 'San Francisco, CA',
        sqft: '25,000 - 35,000 sq ft',
        budget: '$2,000,000 - $3,000,000 annually',
        deadline: '60 days',
        requirements: ['LEED certified', 'Technology infrastructure', 'Flexible workspace design']
      }
    };

    return mockData[type as keyof typeof mockData] || mockData.RFP;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);

    // Simulate AI response
    setTimeout(() => {
      const response = generateAIResponse(inputMessage);
      const aiMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        type: response.type
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsProcessing(false);

      // If the response triggers a map search
      if (response.type === 'search_trigger' && response.location) {
        setTimeout(() => {
          onLocationFocus(response.location!);
          onMapSearch(inputMessage, response.location!, {});
        }, 500);
      }
    }, 1500);
  };

  const generateAIResponse = (userInput: string) => {
    const input = userInput.toLowerCase();
    
    if (input.includes('new york') || input.includes('ny')) {
      return {
        content: "I'll search for commercial real estate opportunities in New York. Looking for properties that match government requirements including security standards, accessibility compliance, and competitive pricing. Let me update the map with relevant options.",
        type: 'search_trigger' as const,
        location: 'New York, NY'
      };
    }
    
    if (input.includes('washington') || input.includes('dc')) {
      return {
        content: "Searching Washington, DC for government-suitable commercial real estate. I'm focusing on properties near federal buildings, with appropriate security features and clearance requirements. Updating the map now.",
        type: 'search_trigger' as const,
        location: 'Washington, DC'
      };
    }

    if (input.includes('california') || input.includes('san francisco')) {
      return {
        content: "Exploring California commercial real estate opportunities. I'll prioritize LEED-certified buildings, tech-ready infrastructure, and properties that meet federal sustainability requirements. Map updating with matches.",
        type: 'search_trigger' as const,
        location: 'San Francisco, CA'
      };
    }

    return {
      content: "I can help you find the perfect commercial real estate for government needs. Upload RFP documents or tell me the location, square footage, and specific requirements you're looking for. I'll analyze CRExi data and find the best matches.",
      type: 'text' as const
    };
  };

  const getStatusIcon = (status: DocumentUpload['status']) => {
    switch (status) {
      case 'processing': return <Clock className="h-4 w-4 text-yellow-500 ai-thinking" />;
      case 'analyzed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getTypeColor = (type: DocumentUpload['type']) => {
    switch (type) {
      case 'RFP': return 'bg-blue-100 text-blue-800';
      case 'RLP': return 'bg-green-100 text-green-800';
      case 'PDS': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Government CRE AI</h2>
              <p className="text-sm text-gray-600">Intelligent document analysis & property matching</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="status-indicator">
              <Zap className="h-3 w-3 mr-1" />
              AI Active
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDocuments(true)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Documents ({documents.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Document Upload Zone */}
      <div className="p-4">
        <div
          className={`document-upload-zone rounded-lg p-6 text-center transition-all ${
            dragActive ? 'border-blue-500 bg-blue-50' : ''
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            Drop RFP, RLP, or PDS documents here
          </p>
          <p className="text-xs text-gray-500 mb-3">
            AI will extract requirements and find matching properties
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Paperclip className="h-4 w-4" />
            Browse Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => e.target.files && handleFileUpload(Array.from(e.target.files))}
            className="hidden"
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 pb-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : ''}`}>
                  <Card className={`${
                    message.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' 
                      : 'enterprise-card'
                  }`}>
                    <CardContent className="p-3">
                      <p className="text-sm">{message.content}</p>
                      {message.extractedData && (
                        <div className="mt-3 p-3 rounded-lg bg-white/10 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <Zap className="h-3 w-3" />
                            Extracted Requirements
                          </div>
                          {message.extractedData.location && (
                            <div className="flex items-center gap-2 text-xs">
                              <MapPin className="h-3 w-3" />
                              {message.extractedData.location}
                            </div>
                          )}
                          {message.extractedData.sqft && (
                            <div className="flex items-center gap-2 text-xs">
                              <Building2 className="h-3 w-3" />
                              {message.extractedData.sqft}
                            </div>
                          )}
                          {message.extractedData.budget && (
                            <div className="flex items-center gap-2 text-xs">
                              <DollarSign className="h-3 w-3" />
                              {message.extractedData.budget}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <p className="text-xs text-gray-500 mt-1 px-3">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-3 mt-1 ${
                  message.role === 'user' 
                    ? 'bg-gray-200 order-1' 
                    : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                }`}>
                  {message.role === 'user' ? (
                    <Users className="h-4 w-4 text-gray-600" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center mx-3 mt-1">
                <Bot className="h-4 w-4" />
              </div>
              <Card className="enterprise-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="ai-thinking w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="ai-thinking w-2 h-2 bg-purple-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                    <div className="ai-thinking w-2 h-2 bg-blue-500 rounded-full" style={{ animationDelay: '0.4s' }}></div>
                    <span className="text-sm text-gray-600 ml-2">AI is analyzing...</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about CRE requirements, locations, or upload documents..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isProcessing}
            className="bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          AI specialized in government CRE requirements • CRExi data integration
        </p>
      </div>

      {/* Documents Sheet */}
      <Sheet open={showDocuments} onOpenChange={setShowDocuments}>
        <SheetContent side="right" className="w-[400px]">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Uploaded Documents</h3>
              <p className="text-sm text-gray-600">AI-analyzed government procurement documents</p>
            </div>
            <Separator />
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="enterprise-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium truncate">{doc.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getTypeColor(doc.type)} variant="secondary">
                            {doc.type}
                          </Badge>
                          <span className="text-xs text-gray-500">{doc.size}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(doc.status)}
                          <span className="text-xs text-gray-600 capitalize">{doc.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {doc.extractedData && doc.status === 'analyzed' && (
                      <div className="mt-3 p-3 rounded-lg bg-gray-50 space-y-2">
                        <div className="text-xs font-medium text-gray-700">Extracted Data:</div>
                        {doc.extractedData.location && (
                          <div className="text-xs text-gray-600">📍 {doc.extractedData.location}</div>
                        )}
                        {doc.extractedData.sqft && (
                          <div className="text-xs text-gray-600">🏢 {doc.extractedData.sqft}</div>
                        )}
                        {doc.extractedData.budget && (
                          <div className="text-xs text-gray-600">💰 {doc.extractedData.budget}</div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {documents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents uploaded yet</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}