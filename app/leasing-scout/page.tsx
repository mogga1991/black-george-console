"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  ScrollArea,
} from "@/components/ui";
import {
  Bot,
  Filter,
  MapPin,
  Mic2,
  Paperclip,
  Send,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Telemetry is blocked globally via /lib/telemetry-blocker.ts
import { ProtectedRoute } from '@/components/protected-route';

interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
}

interface Property {
  id: string;
  lat: number;
  lng: number;
  title: string;
  price: string;
  size: string;
  type: string;
  availability: string;
}

export default function LeasingScoutPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // State
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isBWMode, setIsBWMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "ai",
      content:
        "Welcome to CRE Console! Upload your RFP/RLP document or tell me what you're looking for. I'll extract key requirements and show matching spaces on the map.",
      timestamp: new Date(),
    },
  ]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // State for dynamic properties
  const [displayedProperties, setDisplayedProperties] = useState<Property[]>([]);
  const [mapMarkers, setMapMarkers] = useState<maplibregl.Marker[]>([]);

  // State for RFP requirements and matching properties
  const [rfpCriteria, setRfpCriteria] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", // Softer, eye-friendly light style
      center: [-98.5795, 39.8283], // Center of United States
      zoom: 4, // Zoom out to show continental US
      attributionControl: false,
      transformRequest: (url: string) => {
        // Block telemetry requests
        if (url.includes('events.mapbox.com') || url.includes('mapbox.com/events')) {
          return { url: '' };
        }
        return { url };
      }
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  // Function to add properties to map
  const addPropertiesToMap = (properties: Property[]) => {
    if (!map.current) return;

    // Clear existing markers
    mapMarkers.forEach(marker => marker.remove());
    const newMarkers: maplibregl.Marker[] = [];

    properties.forEach((property) => {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      
      // Use match color if available, otherwise default
      const markerColor = property.matchColor || '#34d399';
      const matchScore = property.matchScore;
      
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background: ${markerColor};
        border: 2px solid rgba(255, 255, 255, 0.9);
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ${markerColor}30;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
        transition: all 0.3s ease;
        position: relative;
      `;
      
      // Add property type icon and match score
      el.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1;
        ">
          <span style="font-size: 18px;">🏢</span>
          ${matchScore ? `<span style="font-size: 8px; margin-top: -2px;">${matchScore}</span>` : 
            `<span style="font-size: 8px; margin-top: -2px;">${property.type?.[0] || 'O'}</span>`}
        </div>
      `;

      // Add hover effects
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.05)';
        el.style.boxShadow = `0 6px 18px rgba(0,0,0,0.2), 0 0 0 2px ${markerColor}60`;
      });
      
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = `0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ${markerColor}30`;
      });

      const popup = new maplibregl.Popup({ 
        offset: 25,
        className: 'cre-popup',
        maxWidth: '300px'
      }).setHTML(`
        <div style="
          padding: 16px;
          background: linear-gradient(135deg, #ffffff, #f8fafc);
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          border: 1px solid #e2e8f0;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 20px;">🏢</span>
            <h3 style="font-weight: 600; color: #1f2937; margin: 0; font-size: 16px;">${property.title}</h3>
            ${property.matchLevel ? `<span style="
              background: ${markerColor}; 
              color: white; 
              padding: 2px 6px; 
              border-radius: 12px; 
              font-size: 10px; 
              font-weight: 600;
              text-transform: uppercase;
            ">${property.matchLevel}</span>` : ''}
          </div>
          ${property.matchScore ? `<div style="
            background: linear-gradient(135deg, ${markerColor}20, ${markerColor}10);
            padding: 8px 12px;
            border-radius: 8px;
            border-left: 3px solid ${markerColor};
            margin-bottom: 8px;
          ">
            <span style="color: ${markerColor}; font-weight: 600; font-size: 12px;">
              📊 Match Score: ${property.matchScore}%
            </span>
            ${property.matchReasons?.length ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
              ${property.matchReasons.slice(0, 2).join(', ')}
            </div>` : ''}
          </div>` : ''}
          <div style="
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 8px; 
            margin-bottom: 8px;
            font-size: 14px;
          ">
            <div>
              <span style="color: #6b7280; font-size: 12px;">Size</span>
              <div style="font-weight: 600; color: #374151;">${property.size || `${property.squareFootage || property.square_footage || 'N/A'} sq ft`}</div>
            </div>
            <div>
              <span style="color: #6b7280; font-size: 12px;">Price</span>
              <div style="font-weight: 600; color: #10b981;">${property.price || property.rateText || 'Contact for pricing'}</div>
            </div>
          </div>
          <div style="
            background: linear-gradient(135deg, #dbeafe, #e0f2fe);
            padding: 8px 12px;
            border-radius: 8px;
            border-left: 3px solid #3b82f6;
          ">
            <span style="color: #1e40af; font-weight: 500; font-size: 12px;">
              📍 ${property.address || property.city + ', ' + property.state || property.availability || 'Available'}
            </span>
          </div>
        </div>
      `);

      const marker = new maplibregl.Marker(el)
        .setLngLat([property.lng, property.lat])
        .setPopup(popup)
        .addTo(map.current!);

      newMarkers.push(marker);
    });

    setMapMarkers(newMarkers);
  };

  // Function to analyze RFP document and find matching properties
  const analyzeRFPDocument = async (file: File): Promise<void> => {
    setIsAnalyzing(true);
    
    try {
      // Step 1: Extract criteria from RFP document
      const formData = new FormData();
      formData.append('file', file);
      
      const extractResponse = await fetch('/api/rfp/extract', {
        method: 'POST',
        body: formData
      });
      
      if (!extractResponse.ok) {
        throw new Error('Failed to extract RFP criteria');
      }
      
      const extractionResult = await extractResponse.json();
      const { criteria } = extractionResult;
      setRfpCriteria(criteria);
      
      console.log(`📋 Extraction completed: ${extractionResult.extractionMethod} (${Math.round(extractionResult.confidence * 100)}% confidence)`);
      
      // Step 2: Find matching properties using strict government criteria
      console.log(`📋 Using strict matching for government RFP with ${Math.round(extractionResult.confidence * 100)}% extraction confidence`);
      
      const matchResponse = await fetch('/api/rfp/match-properties-strict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          criteria: {
            ...criteria,
            locationData: extractionResult.locationData // Enhanced location data from AI
          }, 
          filters: { 
            minScore: 75 // Higher threshold for government RFPs
          } 
        })
      });
      
      if (!matchResponse.ok) {
        throw new Error('Failed to find matching properties');
      }
      
      const { matches, summary } = await matchResponse.json();
      
      // Transform matches to Property format for map display
      const matchedProperties: Property[] = matches.map((match: any) => ({
        id: match.id,
        lat: match.coordinates?.lat || 0,
        lng: match.coordinates?.lng || 0,
        title: `${match.address}, ${match.city}`,
        price: match.rateText || 'Rate not specified',
        size: match.squareFootage || 'Size not specified',
        type: match.buildingTypes.join(', '),
        availability: `Match Score: ${match.matchScore}%`,
        matchLevel: match.matchLevel,
        matchColor: match.matchColor,
        matchScore: match.matchScore
      }));
      
      setDisplayedProperties(matchedProperties);
      
      // Create detailed success message based on strict matching results
      let aiContent: string;
      
      if (matches.length === 0) {
        aiContent = `⚠️ **No properties meet the strict government RFP requirements.**

**Applied Criteria:**
- Location: ${summary?.matchCriteria?.location || criteria.locationText}
- Size: ${summary?.matchCriteria?.sizeRange || 'Not specified'}
- Building Type: ${summary?.matchCriteria?.buildingTypes || 'Not specified'}

**Filtering Results:**
- ${summary?.totalCandidates || 0} properties initially evaluated
- ${summary?.rejectedForLocation || 0} rejected for location mismatch
- ${summary?.rejectedForSize || 0} rejected for size requirements

The system uses strict filtering to ensure only highly relevant properties are shown. Consider relaxing location requirements if needed.`;
      } else {
        aiContent = `✅ **Found ${matches.length} properties meeting strict government RFP criteria.**

**Match Quality:**
- Excellent: ${summary.excellent} properties (${Math.round((summary.excellent / matches.length) * 100)}%)
- Good: ${summary.good} properties (${Math.round((summary.good / matches.length) * 100)}%)
- Fair: ${summary.fair} properties (${Math.round((summary.fair / matches.length) * 100)}%)
- Average Relevance: ${summary.averageRelevance}%

**Search Parameters:**
- Location: ${summary?.matchCriteria?.location} (Strict: ${summary?.strictness?.locationStrict ? 'YES' : 'NO'})
- Size Range: ${summary?.matchCriteria?.sizeRange}
- Minimum Relevance: ${summary?.strictness?.minimumRelevanceThreshold}%

Properties are color-coded on the map by match quality. Click markers for detailed scoring.`;
      }
      
      const aiMessage = {
        id: Date.now().toString(),
        type: "ai" as const,
        content: aiContent,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setSearchPerformed(true);
      
    } catch (error) {
      console.error('RFP analysis error:', error);
      const errorMessage = {
        id: Date.now().toString(),
        type: "ai" as const,
        content: `Sorry, I encountered an error analyzing your RFP document: ${error}. Please try uploading the document again or check that it's a valid RFP/RLP file.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to search properties based on text query (fallback)
  // Enhanced conversational search using AI service
  const handleConversationalQuery = async (query: string): Promise<void> => {
    try {
      setIsAnalyzing(true);
      
      // Import the conversational AI service
      const { conversationalAI } = await import('@/lib/services/conversational-ai-service');
      
      // Process the query with conversational AI
      const result = await conversationalAI.processConversationalQuery(
        query, 
        displayedProperties,
        { lastCriteria: rfpCriteria }
      );
      
      console.log(`🤖 Conversational AI Response: ${result.intent.type} (${Math.round(result.intent.confidence * 100)}% confidence)`);
      
      // Add the AI response message
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: "ai",
        content: result.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      
      // Handle map updates if properties were found
      if (result.mapUpdate && result.mapUpdate.properties) {
        const transformedProperties: Property[] = result.mapUpdate.properties.map((prop: any) => ({
          id: prop.property.id,
          lat: prop.property.latitude || 40.7128,
          lng: prop.property.longitude || -74.0060,
          title: prop.property.address || `Property ${prop.property.id}`,
          price: prop.property.rate_text || (prop.property.rate_per_sqft ? `$${prop.property.rate_per_sqft}/sq ft` : 'Contact for pricing'),
          size: prop.property.square_footage ? `${prop.property.square_footage.toLocaleString()} sq ft` : 
                prop.property.square_footage_min ? `${prop.property.square_footage_min.toLocaleString()} - ${prop.property.square_footage_max?.toLocaleString() || 'Unlimited'} sq ft` :
                'Size TBD',
          availability: 'Available',
          type: prop.property.building_types || ['Office'],
          address: prop.property.address,
          city: prop.property.city,
          state: prop.property.state,
          matchScore: prop.relevanceScore,
          matchLevel: prop.matchLevel,
          matchColor: prop.matchColor,
          matchReasons: prop.matchReasons || []
        }));
        
        setDisplayedProperties(transformedProperties);
        addPropertiesToMap(transformedProperties);
      }
      
      // Add follow-up questions if available
      if (result.followUpQuestions && result.followUpQuestions.length > 0) {
        setTimeout(() => {
          const followUpMessage: ChatMessage = {
            id: (Date.now() + 100).toString(),
            type: "ai",
            content: `**I can also help with:**\n${result.followUpQuestions.map(q => `• ${q}`).join('\n')}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, followUpMessage]);
        }, 1000);
      }
      
      setSearchPerformed(true);
      
    } catch (error) {
      console.error('Conversational query error:', error);
      
      // Fallback to basic text search
      await searchPropertiesByTextFallback(query);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fallback function for basic text search
  const searchPropertiesByTextFallback = async (query: string): Promise<void> => {
    try {
      // For text queries, create basic criteria
      const basicCriteria = {
        locationText: query,
        center: { lng: -98.5795, lat: 39.8283 }, // US center
        radiusKm: 50,
        minSqft: 1000,
        maxSqft: 50000,
        leaseType: "full-service",
        mustHaves: [],
        niceToHaves: [],
        notes: `Text search: ${query}`
      };
      
      const matchResponse = await fetch('/api/rfp/match-properties-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: basicCriteria, filters: { minScore: 20 } })
      });
      
      if (matchResponse.ok) {
        const { matches } = await matchResponse.json();
        
        const searchResults: Property[] = matches.slice(0, 10).map((match: any) => ({
          id: match.id,
          lat: match.coordinates?.lat || 0,
          lng: match.coordinates?.lng || 0,
          title: `${match.address}, ${match.city}`,
          price: match.rateText || 'Rate not specified',
          size: match.squareFootage || 'Size not specified',
          type: match.buildingTypes.join(', '),
          availability: `Match Score: ${match.matchScore}%`,
          matchLevel: match.matchLevel,
          matchColor: match.matchColor,
          matchScore: match.matchScore
        }));
        
        setDisplayedProperties(searchResults);
        
        const aiMessage: ChatMessage = {
          id: Date.now().toString(),
          type: "ai",
          content: `Found ${searchResults.length} properties for "${query}". Properties are displayed on the map with color coding based on match quality.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        setDisplayedProperties([]);
        const aiMessage: ChatMessage = {
          id: Date.now().toString(),
          type: "ai",
          content: `Sorry, I couldn't find any properties matching "${query}". Try being more specific about location, size, or property type.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Text search error:', error);
      setDisplayedProperties([]);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: currentMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setSearchPerformed(true);

    // Use conversational AI for intelligent query processing
    await handleConversationalQuery(currentMessage);
  };

  const handleFileUpload = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const fileNames = Array.from(files).map(f => f.name).join(', ');
        const uploadMessage: ChatMessage = {
          id: Date.now().toString(),
          type: "user",
          content: `Uploaded files: ${fileNames}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, uploadMessage]);
        setSearchPerformed(true);
        
        // Use real RFP analysis for the first file
        if (files[0]) {
          await analyzeRFPDocument(files[0]);
        }
      }
    };
    
    input.click();
  };

  const handleVoiceRecording = () => {
    if (!isRecording) {
      // Start recording
      setIsRecording(true);
      
      // Simulate voice recording
      setTimeout(async () => {
        setIsRecording(false);
        setSearchPerformed(true);
        const voiceMessage: ChatMessage = {
          id: Date.now().toString(),
          type: "user",
          content: "Voice command: Find Class-A office spaces in downtown areas with parking",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, voiceMessage]);
        
        // Process voice command with conversational AI
        const voiceQuery = "Find Class-A office spaces in downtown areas with parking";
        await handleConversationalQuery(voiceQuery);
      }, 3000);
    } else {
      // Stop recording
      setIsRecording(false);
    }
  };

  // Enhanced suggestion tags for conversational interface
  const suggestionTags = [
    "Find office space in New York", 
    "What services do you offer?", 
    "I need 5,000 sq ft warehouse", 
    "Class A buildings in downtown", 
    "Government RFP processing", 
    "Show me retail properties"
  ];

  const handleSuggestionClick = (tag: string) => {
    setCurrentMessage(tag);
  };

  return (
    <ProtectedRoute>
      <div className="flex h-full bg-white w-full">
      {/* Left Panel - AI Assistant */}
      <div className="flex w-[420px] flex-col border-r bg-gray-50">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">AI Assistant</h2>
              <p className="text-xs text-gray-500">Upload RFP or describe your space needs.</p>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            AI
          </Badge>
        </div>

        {/* Welcome Message */}
        <div className="p-4">
          <Card className="bg-gray-100 border-gray-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-700">
                👋 **Welcome to CRE Console!** I'm your AI commercial real estate assistant. I specialize in government RFPs, intelligent property matching, and finding spaces that perfectly meet your requirements.
                
                **I can help you:**
                • Process RFP/RLP documents with precision
                • Find properties using natural language ("I need office space in NYC")
                • Answer questions about our services and capabilities
                • Provide market intelligence and compliance guidance
                
                Try asking me anything - upload a document or just tell me what you're looking for!
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Suggestion Tags */}
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {suggestionTags.map((tag) => (
              <Button
                key={tag}
                variant="outline"
                size="sm"
                className="text-xs h-7 px-3"
                onClick={() => handleSuggestionClick(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    message.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${message.type === "user" ? "text-blue-100" : "text-gray-500"}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t bg-white p-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Describe your space req"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0"
                  onClick={handleFileUpload}
                  title="Upload files"
                >
                  <Paperclip className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className={`h-6 w-6 p-0 ${isRecording ? 'bg-red-100 text-red-600' : ''}`}
                  onClick={handleVoiceRecording}
                  title="Voice input"
                >
                  <Mic2 className={`h-3 w-3 ${isRecording ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={sendMessage}
              disabled={!currentMessage.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Map (Bigger) */}
      <div className="flex-1 relative">
        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="bg-white shadow-md"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>

          <Button
            size="sm"
            variant={isBWMode ? "default" : "outline"}
            onClick={() => setIsBWMode(!isBWMode)}
            className="bg-white shadow-md"
          >
            {isBWMode ? "Color" : "B/W"}
          </Button>

          <div className="flex flex-col gap-1">
            <Button size="sm" variant="outline" className="bg-white shadow-md">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="bg-white shadow-md">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div 
          ref={mapContainer} 
          className={`h-full w-full ${isBWMode ? 'grayscale' : ''}`}
        />


        {/* Map Stats Overlay - Only show after search */}
        {searchPerformed && (
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-gray-900">Search Results</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900">{displayedProperties.length}</div>
                <div className="text-xs text-gray-500">Found Properties</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {displayedProperties.filter(p => p.matchLevel === 'excellent' || p.matchLevel === 'good').length}
                </div>
                <div className="text-xs text-gray-500">Best Matches</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {displayedProperties.length > 0 ? 
                    '$' + Math.round(displayedProperties.reduce((sum, p) => {
                      const rate = p.ratePerSqft || (p.price ? parseInt(p.price.replace(/[^0-9]/g, '')) : 0);
                      return sum + rate;
                    }, 0) / displayedProperties.length) :
                    '$0'
                  }
                </div>
                <div className="text-xs text-gray-500">Avg $/sqft</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
