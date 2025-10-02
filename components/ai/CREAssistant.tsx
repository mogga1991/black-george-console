'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, FileText, Building2, AlertCircle, Lightbulb } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'success' | 'redirect' | 'refocus' | 'error';
}

interface CREAssistantProps {
  context?: {
    documentId?: string;
    propertyId?: string;
    rfpId?: string;
  };
  initialMessage?: string;
  className?: string;
}

const SUGGESTED_PROMPTS = [
  "Analyze this RFP for key requirements and deadlines",
  "What should I consider when evaluating office space for a government lease?",
  "Help me calculate fair market rent for this property",
  "What are the typical terms in a federal RLP response?",
  "Review environmental requirements for this commercial property",
  "Explain GSA lease standards and compliance requirements"
];

export default function CREAssistant({ 
  context, 
  initialMessage, 
  className = "" 
}: CREAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (!isInitialized) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm your Commercial Real Estate and RFP Assistant. I specialize in:

• **Federal, State, Local & County RFPs/RLPs**
• **Commercial Property Analysis**
• **Lease Negotiations & Terms**
• **Government Contracting Requirements**
• **Market Analysis & Valuations**
• **Zoning & Regulatory Compliance**

${context?.documentId ? `I see you have a document loaded (ID: ${context.documentId}). ` : ''}How can I help you with your commercial real estate or RFP needs today?`,
        timestamp: new Date(),
        type: 'success'
      };
      
      setMessages([welcomeMessage]);
      setIsInitialized(true);
      
      // If there's an initial message, send it
      if (initialMessage) {
        setTimeout(() => {
          setInput(initialMessage);
          inputRef.current?.focus();
        }, 500);
      }
    }
  }, [isInitialized, context, initialMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          context
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.error || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        type: data.type || (data.error ? 'error' : 'success')
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered a technical issue. Please try again or rephrase your question about commercial real estate or RFP matters.',
        timestamp: new Date(),
        type: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getMessageIcon = (message: Message) => {
    if (message.role === 'user') return <User className="w-4 h-4" />;
    
    switch (message.type) {
      case 'redirect':
      case 'refocus':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Bot className="w-4 h-4 text-blue-500" />;
    }
  };

  const getMessageBadge = (message: Message) => {
    if (message.role === 'user') return null;
    
    switch (message.type) {
      case 'redirect':
        return <Badge variant="outline" className="text-xs text-amber-600">Off-topic</Badge>;
      case 'refocus':
        return <Badge variant="outline" className="text-xs text-orange-600">Refocused</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs text-blue-600">CRE Assistant</Badge>;
    }
  };

  return (
    <Card className={`flex flex-col h-[600px] ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          CRE & RFP Assistant
          {context?.documentId && (
            <Badge variant="outline" className="ml-auto">
              <FileText className="w-3 h-3 mr-1" />
              Document Context
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex flex-col items-center gap-1 mt-1">
                    {getMessageIcon(message)}
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white ml-12'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    {getMessageBadge(message)}
                    <span className="text-xs text-gray-500 ml-auto">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                </div>
                
                {message.role === 'user' && (
                  <div className="flex flex-col items-center gap-1 mt-1">
                    {getMessageIcon(message)}
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Bot className="w-4 h-4 text-blue-500 mt-1" />
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1">
                    <div className="animate-pulse flex space-x-1">
                      <div className="rounded-full bg-gray-400 h-1 w-1"></div>
                      <div className="rounded-full bg-gray-400 h-1 w-1"></div>
                      <div className="rounded-full bg-gray-400 h-1 w-1"></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
        
        {/* Suggested Prompts */}
        {messages.length <= 1 && (
          <>
            <Separator />
            <div className="p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">Suggested Questions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-left justify-start h-auto p-2 text-xs"
                    onClick={() => sendMessage(prompt)}
                    disabled={isLoading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
        
        <Separator />
        
        {/* Input */}
        <div className="p-4 bg-white">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about RFPs, commercial real estate, or property analysis..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="mt-2 text-xs text-gray-500 text-center">
            Specialized in CRE, RFPs, and government contracting • Always stays on topic
          </div>
        </div>
      </CardContent>
    </Card>
  );
}