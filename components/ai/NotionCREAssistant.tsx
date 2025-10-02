'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Bot, 
  User, 
  FileText, 
  Building2, 
  AlertCircle, 
  Lightbulb,
  MapPin,
  DollarSign,
  Square,
  Calendar,
  Shield
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'success' | 'redirect' | 'refocus' | 'error' | 'property_match';
  propertyMatches?: PropertyMatch[];
}

interface PropertyMatch {
  property: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    squareFootage: number;
    ratePerSF: number;
    buildingTypes: string[];
    latitude?: number;
    longitude?: number;
    status: string;
    gsaApproved?: boolean;
  };
  score: number;
  matchReasons: string[];
  category: 'excellent' | 'good' | 'fair' | 'poor';
}

interface NotionCREAssistantProps {
  onPropertyMatches?: (matches: PropertyMatch[]) => void;
  className?: string;
}

const SPECIALIZED_PROMPTS = [
  "Find GSA-approved office space for 150 employees in Washington DC",
  "Show me industrial properties with loading docks near major highways",
  "I need secure facilities requiring Secret clearance under $30/SF",
  "Find retail space in downtown areas with high foot traffic",
  "Show properties suitable for government agencies with 24/7 operations",
  "Find medical facilities with specialized HVAC and power requirements"
];

export default function NotionCREAssistant({ 
  onPropertyMatches,
  className = "" 
}: NotionCREAssistantProps) {
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
        content: `Hello! I'm your specialized CRE & RFP Assistant powered by Notion. I can help you:

🏢 **Find Commercial Properties** that match your specific requirements
📋 **Analyze RFP Documents** and extract key requirements automatically  
🗺️ **Map Property Matches** with scoring and detailed analysis
🏛️ **Government Compliance** - GSA standards, security clearances, etc.
💰 **Budget Analysis** - Compare rates, calculate costs, find best value

I'm connected to your Notion property database and will show matches on the map automatically. 

**Try asking:** "Find office space for 200 people in Dallas under $25/SF" or upload an RFP document for analysis.`,
        timestamp: new Date(),
        type: 'success'
      };
      
      setMessages([welcomeMessage]);
      setIsInitialized(true);
    }
  }, [isInitialized]);

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
      // First, try to extract requirements and search properties
      const searchResults = await searchPropertiesFromQuery(content);
      
      // Then get AI response
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      let assistantContent = data.response || 'I encountered an issue processing your request.';

      // If we found property matches, enhance the response
      if (searchResults.matches && searchResults.matches.length > 0) {
        assistantContent += `\n\n🎯 **Property Search Results:**\n`;
        assistantContent += `Found ${searchResults.matches.length} matching properties:\n\n`;
        
        searchResults.matches.slice(0, 3).forEach((match: PropertyMatch, index: number) => {
          const scoreEmoji = match.score >= 85 ? '🟢' : match.score >= 70 ? '🟡' : '🟠';
          assistantContent += `${scoreEmoji} **${match.property.name}** (${match.score}% match)\n`;
          assistantContent += `   📍 ${match.property.address}, ${match.property.city}, ${match.property.state}\n`;
          assistantContent += `   📏 ${match.property.squareFootage.toLocaleString()} SF • $${match.property.ratePerSF}/SF\n`;
          assistantContent += `   🏗️ ${match.property.buildingTypes.join(', ')}\n`;
          if (match.property.gsaApproved) assistantContent += `   ✅ GSA Approved\n`;
          assistantContent += `\n`;
        });

        if (searchResults.matches.length > 3) {
          assistantContent += `...and ${searchResults.matches.length - 3} more properties shown on the map.\n\n`;
        }

        assistantContent += `Properties are now displayed on the map with color-coded markers based on match scores. Click any marker for detailed information.`;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        type: searchResults.matches?.length > 0 ? 'property_match' : (data.type || 'success'),
        propertyMatches: searchResults.matches
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Notify parent component about property matches
      if (searchResults.matches && onPropertyMatches) {
        onPropertyMatches(searchResults.matches);
      }

    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered a technical issue. Please try rephrasing your question about commercial real estate or RFP requirements.',
        timestamp: new Date(),
        type: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchPropertiesFromQuery = async (query: string) => {
    try {
      // First analyze the query to extract requirements
      const analysisResponse = await fetch('/api/rfp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query })
      });

      if (!analysisResponse.ok) {
        return { matches: [] };
      }

      const analysis = await analysisResponse.json();
      
      // Search properties based on extracted requirements
      const searchResponse = await fetch('/api/notion/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requirements: analysis.requirements,
          includeAll: false // Only good+ matches
        })
      });

      if (!searchResponse.ok) {
        return { matches: [] };
      }

      return await searchResponse.json();

    } catch (error) {
      console.error('Property search error:', error);
      return { matches: [] };
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
      case 'property_match':
        return <MapPin className="w-4 h-4 text-blue-500" />;
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
      case 'property_match':
        return (
          <Badge variant="secondary" className="text-xs text-blue-600">
            <MapPin className="w-3 h-3 mr-1" />
            Property Matches
          </Badge>
        );
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
    <Card className={`flex flex-col h-[700px] ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          Notion CRE Assistant
          <Badge variant="outline" className="ml-auto">
            <MapPin className="w-3 h-3 mr-1" />
            Live Property Search
          </Badge>
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
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
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

                  {/* Property match summary */}
                  {message.propertyMatches && message.propertyMatches.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <MapPin className="w-3 h-3" />
                        {message.propertyMatches.length} properties found
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium text-green-600">
                            {message.propertyMatches.filter(m => m.score >= 85).length}
                          </div>
                          <div className="text-gray-500">Excellent</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-yellow-600">
                            {message.propertyMatches.filter(m => m.score >= 70 && m.score < 85).length}
                          </div>
                          <div className="text-gray-500">Good</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-orange-600">
                            {message.propertyMatches.filter(m => m.score >= 55 && m.score < 70).length}
                          </div>
                          <div className="text-gray-500">Fair</div>
                        </div>
                      </div>
                    </div>
                  )}
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
                    <span className="text-xs text-gray-500 ml-2">Searching properties...</span>
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
                <span className="text-sm font-medium text-gray-700">Try These Searches</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {SPECIALIZED_PROMPTS.slice(0, 3).map((prompt, index) => (
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
              placeholder="Find properties: 'office space 10,000 SF Dallas GSA approved'..."
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
            🔗 Connected to Notion • Real-time property search • Always stays on CRE topics
          </div>
        </div>
      </CardContent>
    </Card>
  );
}