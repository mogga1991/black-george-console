'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/slider';
import { MapPin, Building2, Car, DollarSign, Clock, Shield, Star, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';

interface PropertyMatch {
  propertyId: string;
  matchScore: number;
  matchBreakdown: {
    location: number;
    space: number;
    compliance: number;
    financial: number;
    timeline: number;
    total: number;
  };
  dealBreakers: string[];
  advantages: string[];
  warnings: string[];
  aiReasoning: string;
  property?: {
    id: string;
    title: string;
    address: string;
    squareFeet: number;
    monthlyRent: number;
    spaceType: string;
    imageUrl?: string;
    parking?: {
      total: number;
      reserved: number;
    };
    amenities?: string[];
  };
}

interface PropertyMatchingResultsProps {
  rfpDocumentId: string;
  onSelectProperty?: (propertyId: string) => void;
  onRejectProperty?: (propertyId: string) => void;
}

export function PropertyMatchingResults({ 
  rfpDocumentId, 
  onSelectProperty, 
  onRejectProperty 
}: PropertyMatchingResultsProps) {
  const [matches, setMatches] = useState<PropertyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'size'>('score');
  const [filterMinScore, setFilterMinScore] = useState(60);

  useEffect(() => {
    fetchMatches();
  }, [rfpDocumentId]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rfp/match-properties?rfpDocumentId=${rfpDocumentId}&minScore=${filterMinScore / 100}`);
      if (!response.ok) throw new Error('Failed to fetch property matches');
      
      const data = await response.json();
      setMatches(data.data?.matches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const triggerMatching = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rfp/match-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rfpDocumentId,
          propertyFilters: {
            maxResults: 20,
            minMatchScore: filterMinScore / 100,
            requireCompliance: true
          }
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate matches');
      
      const data = await response.json();
      setMatches(data.data?.matches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate matches');
    } finally {
      setLoading(false);
    }
  };

  const sortedMatches = [...matches].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return (a.property?.monthlyRent || 0) - (b.property?.monthlyRent || 0);
      case 'size':
        return (b.property?.squareFeet || 0) - (a.property?.squareFeet || 0);
      default:
        return b.matchScore - a.matchScore;
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <Star className="h-4 w-4" />;
    if (score >= 60) return <ThumbsUp className="h-4 w-4" />;
    return <ThumbsDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Finding property matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Property Matches</h2>
          <Button onClick={triggerMatching} className="bg-blue-600 hover:bg-blue-700">
            Generate New Matches
          </Button>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="score">Match Score</option>
              <option value="price">Price</option>
              <option value="size">Size</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Min Score:</label>
            <input
              type="range"
              min="0"
              max="100"
              value={filterMinScore}
              onChange={(e) => setFilterMinScore(parseInt(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-gray-600">{filterMinScore}%</span>
          </div>
          
          <Badge variant="outline" className="ml-auto">
            {sortedMatches.length} matches found
          </Badge>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Property Matches */}
      <div className="grid gap-4">
        {sortedMatches.map((match) => (
          <PropertyMatchCard
            key={match.propertyId}
            match={match}
            onSelect={() => onSelectProperty?.(match.propertyId)}
            onReject={() => onRejectProperty?.(match.propertyId)}
          />
        ))}
        
        {sortedMatches.length === 0 && !loading && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No matches found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search criteria or generate new matches.
            </p>
            <Button onClick={triggerMatching}>
              Generate Matches
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyMatchCard({ 
  match, 
  onSelect, 
  onReject 
}: { 
  match: PropertyMatch; 
  onSelect: () => void; 
  onReject: () => void; 
}) {
  const [expanded, setExpanded] = useState(false);
  
  const scoreColor = match.matchScore >= 80 ? 'green' : match.matchScore >= 60 ? 'yellow' : 'red';
  const property = match.property;

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">
              {property?.title || `Property ${match.propertyId}`}
            </h3>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
              match.matchScore >= 80 ? 'bg-green-100 text-green-700' :
              match.matchScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {match.matchScore >= 80 ? <Star className="h-3 w-3" /> :
               match.matchScore >= 60 ? <ThumbsUp className="h-3 w-3" /> :
               <ThumbsDown className="h-3 w-3" />}
              {Math.round(match.matchScore)}% Match
            </div>
          </div>
          
          {property?.address && (
            <div className="flex items-center text-gray-600 mb-2">
              <MapPin className="h-4 w-4 mr-1" />
              {property.address}
            </div>
          )}
          
          <div className="flex gap-6 text-sm">
            {property?.squareFeet && (
              <div className="flex items-center text-gray-600">
                <Building2 className="h-4 w-4 mr-1" />
                {property.squareFeet.toLocaleString()} sq ft
              </div>
            )}
            {property?.monthlyRent && (
              <div className="flex items-center text-gray-600">
                <DollarSign className="h-4 w-4 mr-1" />
                ${property.monthlyRent.toLocaleString()}/month
              </div>
            )}
            {property?.parking && (
              <div className="flex items-center text-gray-600">
                <Car className="h-4 w-4 mr-1" />
                {property.parking.total} spaces
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={onSelect} size="sm" className="bg-green-600 hover:bg-green-700">
            Select Property
          </Button>
          <Button onClick={onReject} size="sm" variant="outline">
            Reject
          </Button>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Object.entries(match.matchBreakdown).filter(([key]) => key !== 'total').map(([category, score]) => (
          <div key={category} className="text-center">
            <div className="text-xs text-gray-500 capitalize mb-1">
              {category === 'financial' ? 'Budget' : category}
            </div>
            <div className="text-sm font-medium">
              {Math.round(score)}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${
                  score >= 80 ? 'bg-green-500' :
                  score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Deal Breakers & Advantages */}
      {(match.dealBreakers.length > 0 || match.advantages.length > 0 || match.warnings.length > 0) && (
        <div className="space-y-3">
          {match.dealBreakers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-1 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Deal Breakers
              </h4>
              <div className="flex flex-wrap gap-1">
                {match.dealBreakers.map((issue, i) => (
                  <Badge key={i} className="bg-red-100 text-red-700 text-xs">
                    {issue}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {match.advantages.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-1 flex items-center">
                <ThumbsUp className="h-3 w-3 mr-1" />
                Advantages
              </h4>
              <div className="flex flex-wrap gap-1">
                {match.advantages.map((advantage, i) => (
                  <Badge key={i} className="bg-green-100 text-green-700 text-xs">
                    {advantage}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {match.warnings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-yellow-700 mb-1 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Considerations
              </h4>
              <div className="flex flex-wrap gap-1">
                {match.warnings.map((warning, i) => (
                  <Badge key={i} className="bg-yellow-100 text-yellow-700 text-xs">
                    {warning}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Reasoning (expandable) */}
      {match.aiReasoning && (
        <div className="mt-4 pt-4 border-t">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {expanded ? 'Hide' : 'Show'} AI Analysis
          </button>
          
          {expanded && (
            <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700">
              {match.aiReasoning}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}