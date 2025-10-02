'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import NotionCREAssistant from '@/components/ai/NotionCREAssistant';
import { 
  Bot, 
  FileText, 
  Building2, 
  MessageSquare, 
  Zap, 
  Shield,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

export default function AIAssistantPage() {
  const [selectedContext, setSelectedContext] = useState<string | null>(null);

  const contextOptions = [
    {
      id: 'general',
      title: 'General CRE Assistance',
      description: 'Ask about commercial real estate topics, market analysis, or industry best practices',
      icon: <Building2 className="w-5 h-5" />,
      color: 'blue'
    },
    {
      id: 'rfp',
      title: 'RFP/RLP Analysis',
      description: 'Get help with government RFPs, proposal writing, and compliance requirements',
      icon: <FileText className="w-5 h-5" />,
      color: 'green'
    },
    {
      id: 'valuation',
      title: 'Property Valuation',
      description: 'Assistance with property analysis, comps, and financial metrics',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'purple'
    }
  ];

  const features = [
    {
      icon: <Shield className="w-5 h-5 text-green-600" />,
      title: 'Always On-Topic',
      description: 'Specialized AI that stays focused on CRE and RFP matters'
    },
    {
      icon: <Zap className="w-5 h-5 text-blue-600" />,
      title: 'Notion-Powered',
      description: 'Connected to your Notion property database for real-time search'
    },
    {
      icon: <CheckCircle className="w-5 h-5 text-purple-600" />,
      title: 'Expert Knowledge',
      description: 'Trained on federal, state, and local RFP requirements'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-600" />
            CRE & RFP Assistant
          </h1>
          <p className="text-gray-600 mt-2">
            Your specialized AI assistant for commercial real estate and government contracting
          </p>
        </div>
        
        <Badge variant="secondary" className="px-3 py-1">
          <Zap className="w-3 h-3 mr-1" />
          Always Active
        </Badge>
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Context Selection */}
      {!selectedContext && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Choose Your Focus Area
            </CardTitle>
            <p className="text-sm text-gray-600">
              Select a context to get more targeted assistance from the AI
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contextOptions.map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-3 hover:bg-gray-50"
                  onClick={() => setSelectedContext(option.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {option.icon}
                    <span className="font-medium">{option.title}</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </div>
                  <p className="text-sm text-gray-600 text-left">
                    {option.description}
                  </p>
                </Button>
              ))}
            </div>
            
            <Separator className="my-4" />
            
            <Button
              variant="ghost"
              onClick={() => setSelectedContext('general')}
              className="w-full"
            >
              Or start with general assistance
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Assistant Interface */}
      {selectedContext && (
        <div className="space-y-4">
          {/* Context Header */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">
                      {contextOptions.find(c => c.id === selectedContext)?.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {contextOptions.find(c => c.id === selectedContext)?.description}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContext(null)}
                >
                  Change Context
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Assistant Component */}
          <NotionCREAssistant
            onPropertyMatches={(matches) => {
              console.log('Property matches found:', matches);
              // Could integrate with map here in the future
            }}
            className="min-h-[700px]"
          />
        </div>
      )}

      {/* Quick Access Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            AI Assistant Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>• <strong>Notion Integration:</strong> Directly searches your Notion property database for real-time matches</p>
          <p>• <strong>Smart Property Matching:</strong> Automatically scores properties based on your requirements</p>
          <p>• <strong>RFP Analysis:</strong> Upload or paste RFP text to extract requirements automatically</p>
          <p>• <strong>Map Integration:</strong> Properties are displayed on the map with color-coded match scores</p>
          <p>• <strong>Government Focus:</strong> Specialized for federal, state, and local real estate requirements</p>
        </CardContent>
      </Card>
    </div>
  );
}