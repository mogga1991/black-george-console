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

  // Mock data - will be populated based on user queries
  const availableProperties = useMemo(
    () => [
      {
        id: "1",
        lat: 37.7749,
        lng: -122.4194,
        title: "Financial District Tower",
        price: "$85/sqft",
        size: "15,000 sqft",
        type: "Office",
        availability: "Available Q2 2024",
      },
      {
        id: "2",
        lat: 37.7849,
        lng: -122.4094,
        title: "SOMA Creative Space",
        price: "$65/sqft",
        size: "8,500 sqft",
        type: "Office",
        availability: "Available Now",
      },
      {
        id: "3",
        lat: 40.7128,
        lng: -74.0060,
        title: "Manhattan Plaza",
        price: "$120/sqft",
        size: "25,000 sqft",
        type: "Office",
        availability: "Available Now",
      },
      {
        id: "4",
        lat: 32.7767,
        lng: -96.7970,
        title: "Dallas Business Center",
        price: "$45/sqft",
        size: "18,000 sqft",
        type: "Office",
        availability: "Available Q1 2024",
      },
      {
        id: "5",
        lat: 33.4484,
        lng: -112.0740,
        title: "Phoenix Corporate Plaza",
        price: "$35/sqft",
        size: "30,000 sqft",
        type: "Office",
        availability: "Available Now",
      },
      {
        id: "6",
        lat: 37.7849,
        lng: -122.4094,
        title: "Mission District Office",
        price: "$75/sqft",
        size: "12,000 sqft",
        type: "Office",
        availability: "Available Q3 2024",
      },
      {
        id: "7",
        lat: 40.7505,
        lng: -73.9934,
        title: "Times Square Building",
        price: "$150/sqft",
        size: "20,000 sqft",
        type: "Office",
        availability: "Available Now",
      },
    ],
    []
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", // Softer, eye-friendly light style
      center: [-98.5795, 39.8283], // Center of United States
      zoom: 4, // Zoom out to show continental US
      attributionControl: false,
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
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #34d399, #6ee7b7);
        border: 2px solid rgba(255, 255, 255, 0.9);
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(52, 211, 153, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
        transition: all 0.3s ease;
        position: relative;
      `;
      
      // Add property type icon
      el.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1;
        ">
          <span style="font-size: 18px;">🏢</span>
          <span style="font-size: 8px; margin-top: -2px;">${property.type[0]}</span>
        </div>
      `;

      // Add hover effects
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.05)';
        el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2), 0 0 0 2px rgba(52, 211, 153, 0.4)';
      });
      
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(52, 211, 153, 0.2)';
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
          </div>
          <div style="
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 8px; 
            margin-bottom: 8px;
            font-size: 14px;
          ">
            <div>
              <span style="color: #6b7280; font-size: 12px;">Size</span>
              <div style="font-weight: 600; color: #374151;">${property.size}</div>
            </div>
            <div>
              <span style="color: #6b7280; font-size: 12px;">Price</span>
              <div style="font-weight: 600; color: #10b981;">${property.price}</div>
            </div>
          </div>
          <div style="
            background: linear-gradient(135deg, #dbeafe, #e0f2fe);
            padding: 8px 12px;
            border-radius: 8px;
            border-left: 3px solid #3b82f6;
          ">
            <span style="color: #1e40af; font-weight: 500; font-size: 12px;">
              📅 ${property.availability}
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

  // Function to find properties based on user query
  const findPropertiesForQuery = (query: string): Property[] => {
    const lowerQuery = query.toLowerCase();
    
    // Simple matching logic - in a real app, this would be more sophisticated
    if (lowerQuery.includes('san francisco') || lowerQuery.includes('sf') || lowerQuery.includes('bay area')) {
      return availableProperties.filter(p => p.lat > 37.5 && p.lat < 38.0 && p.lng > -122.6 && p.lng < -122.3);
    }
    if (lowerQuery.includes('new york') || lowerQuery.includes('manhattan') || lowerQuery.includes('nyc')) {
      return availableProperties.filter(p => p.lat > 40.6 && p.lat < 40.8 && p.lng > -74.1 && p.lng < -73.9);
    }
    if (lowerQuery.includes('dallas') || lowerQuery.includes('dfw')) {
      return availableProperties.filter(p => p.lat > 32.6 && p.lat < 33.0 && p.lng > -97.0 && p.lng < -96.6);
    }
    if (lowerQuery.includes('phoenix') || lowerQuery.includes('arizona')) {
      return availableProperties.filter(p => p.lat > 33.2 && p.lat < 33.6 && p.lng > -112.2 && p.lng < -111.9);
    }
    if (lowerQuery.includes('office') || lowerQuery.includes('class-a') || lowerQuery.includes('class a')) {
      return availableProperties.filter(p => p.type === 'Office');
    }
    if (lowerQuery.includes('large') || lowerQuery.includes('big') || lowerQuery.includes('25,000') || lowerQuery.includes('30,000')) {
      return availableProperties.filter(p => p.size.includes('25,000') || p.size.includes('30,000'));
    }
    if (lowerQuery.includes('affordable') || lowerQuery.includes('cheap') || lowerQuery.includes('$35') || lowerQuery.includes('$45')) {
      return availableProperties.filter(p => p.price.includes('$35') || p.price.includes('$45'));
    }
    
    // Default: return a few random properties
    return availableProperties.slice(0, 3);
  };

  const sendMessage = () => {
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

    // Find properties based on user query
    const matchingProperties = findPropertiesForQuery(currentMessage);
    setDisplayedProperties(matchingProperties);


    // Simulate AI response
    setTimeout(() => {
      const location = currentMessage.toLowerCase().includes('dallas') ? 'Dallas-Fort Worth' : 
                     currentMessage.toLowerCase().includes('new york') ? 'New York' :
                     currentMessage.toLowerCase().includes('phoenix') ? 'Phoenix' :
                     currentMessage.toLowerCase().includes('san francisco') ? 'San Francisco Bay Area' : 'the selected areas';
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: `I found ${matchingProperties.length} properties matching your criteria in ${location}. I've updated the map to show these available spaces. Would you like me to filter by specific amenities or budget range?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      
      // Add properties to map after AI response
      addPropertiesToMap(matchingProperties);
    }, 1000);
  };

  const handleFileUpload = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png';
    input.multiple = true;
    
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // Handle file upload - in a real app, you'd upload to your server
        const fileNames = Array.from(files).map(f => f.name).join(', ');
        const uploadMessage: ChatMessage = {
          id: Date.now().toString(),
          type: "user",
          content: `Uploaded files: ${fileNames}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, uploadMessage]);
        setSearchPerformed(true);
        
        // Find properties based on uploaded files (simulate analysis)
        const fileQuery = `analyzing uploaded files: ${fileNames}`;
        const matchingProperties = findPropertiesForQuery(fileQuery);
        setDisplayedProperties(matchingProperties);


        // Simulate AI response about uploaded files
        setTimeout(() => {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: `I've received your uploaded files (${fileNames}). I'm analyzing the opportunities and found ${matchingProperties.length} relevant properties that match your requirements. I've updated the map to show these spaces.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          
          // Add properties to map after AI response
          addPropertiesToMap(matchingProperties);
        }, 1500);
      }
    };
    
    input.click();
  };

  const handleVoiceRecording = () => {
    if (!isRecording) {
      // Start recording
      setIsRecording(true);
      
      // Simulate voice recording
      setTimeout(() => {
        setIsRecording(false);
        setSearchPerformed(true);
        const voiceMessage: ChatMessage = {
          id: Date.now().toString(),
          type: "user",
          content: "Voice command: Find Class-A office spaces in downtown areas with parking",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, voiceMessage]);
        
        // Find properties for voice command
        const voiceQuery = "Find Class-A office spaces in downtown areas with parking";
        const matchingProperties = findPropertiesForQuery(voiceQuery);
        setDisplayedProperties(matchingProperties);


        // Simulate AI response to voice command
        setTimeout(() => {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: `I heard your request for Class-A office spaces in downtown areas with parking. I've updated the map to show ${matchingProperties.length} matching properties across major downtown districts.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          
          // Add properties to map after AI response
          addPropertiesToMap(matchingProperties);
        }, 1000);
      }, 3000);
    } else {
      // Stop recording
      setIsRecording(false);
    }
  };

  // Suggestion tags
  const suggestionTags = ["near transit", "open plan", "parking", "pet friendly", "class A", "downtown"];

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
                Welcome to CRE Console! Upload your RFP/RLP document or tell me what you&apos;re looking for. I&apos;ll extract key requirements and show matching spaces on the map.
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
                <div className="text-lg font-bold text-green-600">{displayedProperties.length}</div>
                <div className="text-xs text-gray-500">Best Matches</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {displayedProperties.length > 0 ? 
                    '$' + Math.round(displayedProperties.reduce((sum, p) => sum + parseInt(p.price.replace(/[^0-9]/g, '')), 0) / displayedProperties.length) :
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
