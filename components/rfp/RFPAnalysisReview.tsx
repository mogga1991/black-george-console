'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertTriangle, Edit, MapPin, Building, Calendar, DollarSign, Shield, Car } from 'lucide-react';

interface RFPExtractionData {
  id: string;
  rfpDocumentId: string;
  title?: string;
  rfpNumber?: string;
  issuingAgency?: string;
  confidenceScore: number;
  
  // Location
  locationCriteria: any;
  
  // Space
  minSquareFeet?: number;
  maxSquareFeet?: number;
  spaceType?: string;
  measurementType?: string;
  
  // Parking
  reservedGovernmentSpaces?: number;
  reservedVisitorSpaces?: number;
  totalParkingSpaces?: number;
  
  // Financial
  budgetMin?: number;
  budgetMax?: number;
  budgetCurrency?: string;
  budgetPeriod?: string;
  
  // Timeline
  expressionOfInterestDue?: string;
  proposalDueDate?: string;
  occupancyDate?: string;
  
  // Compliance
  complianceRequirementsJson?: string;
  
  // Additional
  keyPhrases?: string;
  warnings?: string;
  notes?: string;
  
  reviewStatus: 'pending' | 'reviewed' | 'approved' | 'rejected';
  extractionDate: string;
}

interface RFPAnalysisReviewProps {
  documentId: string;
  onUpdate?: (extractionId: string, updates: any) => void;
}

export function RFPAnalysisReview({ documentId, onUpdate }: RFPAnalysisReviewProps) {
  const [extraction, setExtraction] = useState<RFPExtractionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    fetchExtractionData();
  }, [documentId]);

  const fetchExtractionData = async () => {
    try {
      const response = await fetch(`/api/rfp/extraction?documentId=${documentId}`);
      if (!response.ok) throw new Error('Failed to fetch extraction data');
      
      const data = await response.json();
      setExtraction(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!extraction) return;
    
    try {
      const response = await fetch(`/api/rfp/extraction/${extraction.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reviewStatus: 'approved',
          reviewNotes: 'Approved by user review'
        })
      });
      
      if (!response.ok) throw new Error('Failed to approve extraction');
      
      setExtraction(prev => prev ? { ...prev, reviewStatus: 'approved' } : null);
      onUpdate?.(extraction.id, { reviewStatus: 'approved' });
    } catch (err) {
      console.error('Error approving extraction:', err);
    }
  };

  const handleReject = async () => {
    if (!extraction) return;
    
    try {
      const response = await fetch(`/api/rfp/extraction/${extraction.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reviewStatus: 'rejected',
          reviewNotes: 'Rejected - requires manual review'
        })
      });
      
      if (!response.ok) throw new Error('Failed to reject extraction');
      
      setExtraction(prev => prev ? { ...prev, reviewStatus: 'rejected' } : null);
      onUpdate?.(extraction.id, { reviewStatus: 'rejected' });
    } catch (err) {
      console.error('Error rejecting extraction:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Analyzing RFP document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
        <p className="text-red-600">{error}</p>
        <Button onClick={fetchExtractionData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!extraction) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
        <p className="text-gray-600">No extraction data available</p>
      </div>
    );
  }

  const locationCriteria = extraction.locationCriteria ? 
    (typeof extraction.locationCriteria === 'string' ? 
      JSON.parse(extraction.locationCriteria) : extraction.locationCriteria) : {};
  
  const complianceReqs = extraction.complianceRequirementsJson ? 
    JSON.parse(extraction.complianceRequirementsJson) : {};
  
  const keyPhrases = extraction.keyPhrases ? JSON.parse(extraction.keyPhrases) : [];
  const warnings = extraction.warnings ? JSON.parse(extraction.warnings) : [];
  const notes = extraction.notes ? JSON.parse(extraction.notes) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'reviewed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {extraction.title || 'RFP Analysis'}
            </h1>
            {extraction.rfpNumber && (
              <p className="text-gray-600 mt-1">RFP #{extraction.rfpNumber}</p>
            )}
            {extraction.issuingAgency && (
              <p className="text-gray-600">{extraction.issuingAgency}</p>
            )}
          </div>
          <div className="text-right">
            <Badge className={getStatusColor(extraction.reviewStatus)}>
              {extraction.reviewStatus.toUpperCase()}
            </Badge>
            <p className="text-sm text-gray-500 mt-2">
              Confidence: <span className={getConfidenceColor(extraction.confidenceScore)}>
                {Math.round(extraction.confidenceScore * 100)}%
              </span>
            </p>
          </div>
        </div>

        {extraction.reviewStatus === 'pending' && (
          <div className="flex gap-3">
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Extraction
            </Button>
            <Button onClick={handleReject} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
              <XCircle className="h-4 w-4 mr-2" />
              Reject & Review Manually
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location Requirements */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <MapPin className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold">Location Requirements</h3>
          </div>
          <div className="space-y-3">
            {locationCriteria.state && (
              <div><span className="font-medium">State:</span> {locationCriteria.state}</div>
            )}
            {locationCriteria.city && (
              <div><span className="font-medium">City:</span> {locationCriteria.city}</div>
            )}
            {locationCriteria.zipCodes && locationCriteria.zipCodes.length > 0 && (
              <div>
                <span className="font-medium">Zip Codes:</span> 
                <div className="flex flex-wrap gap-1 mt-1">
                  {locationCriteria.zipCodes.map((zip: string, i: number) => (
                    <Badge key={i} variant="outline">{zip}</Badge>
                  ))}
                </div>
              </div>
            )}
            {locationCriteria.delineatedAreas && locationCriteria.delineatedAreas.length > 0 && (
              <div>
                <span className="font-medium">Areas:</span>
                <ul className="list-disc list-inside mt-1 text-sm text-gray-600">
                  {locationCriteria.delineatedAreas.map((area: string, i: number) => (
                    <li key={i}>{area}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        {/* Space Requirements */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Building className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold">Space Requirements</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {extraction.minSquareFeet && (
                <div>
                  <span className="text-sm text-gray-600">Min Size</span>
                  <p className="font-medium">{extraction.minSquareFeet.toLocaleString()} sq ft</p>
                </div>
              )}
              {extraction.maxSquareFeet && (
                <div>
                  <span className="text-sm text-gray-600">Max Size</span>
                  <p className="font-medium">{extraction.maxSquareFeet.toLocaleString()} sq ft</p>
                </div>
              )}
            </div>
            {extraction.spaceType && (
              <div>
                <span className="font-medium">Type:</span> 
                <Badge className="ml-2">{extraction.spaceType}</Badge>
              </div>
            )}
            {extraction.measurementType && (
              <div>
                <span className="font-medium">Measurement:</span> {extraction.measurementType}
              </div>
            )}
          </div>
        </Card>

        {/* Parking Requirements */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Car className="h-5 w-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold">Parking Requirements</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {extraction.reservedGovernmentSpaces && (
                <div>
                  <span className="text-gray-600">Government</span>
                  <p className="font-medium">{extraction.reservedGovernmentSpaces} spaces</p>
                </div>
              )}
              {extraction.reservedVisitorSpaces && (
                <div>
                  <span className="text-gray-600">Visitor</span>
                  <p className="font-medium">{extraction.reservedVisitorSpaces} spaces</p>
                </div>
              )}
            </div>
            {extraction.totalParkingSpaces && (
              <div>
                <span className="font-medium">Total Required:</span> {extraction.totalParkingSpaces} spaces
              </div>
            )}
          </div>
        </Card>

        {/* Financial Requirements */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold">Financial Requirements</h3>
          </div>
          <div className="space-y-3">
            {(extraction.budgetMin || extraction.budgetMax) && (
              <div>
                <span className="font-medium">Budget Range:</span>
                <p className="text-lg">
                  {extraction.budgetMin ? `$${extraction.budgetMin.toLocaleString()}` : 'N/A'} - 
                  {extraction.budgetMax ? `$${extraction.budgetMax.toLocaleString()}` : 'N/A'}
                  <span className="text-sm text-gray-600 ml-1">
                    {extraction.budgetPeriod || 'monthly'}
                  </span>
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Timeline */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Calendar className="h-5 w-5 text-orange-600 mr-2" />
            <h3 className="text-lg font-semibold">Timeline</h3>
          </div>
          <div className="space-y-3 text-sm">
            {extraction.expressionOfInterestDue && (
              <div>
                <span className="font-medium">Expression of Interest Due:</span>
                <p>{new Date(extraction.expressionOfInterestDue).toLocaleDateString()}</p>
              </div>
            )}
            {extraction.proposalDueDate && (
              <div>
                <span className="font-medium">Proposal Due:</span>
                <p>{new Date(extraction.proposalDueDate).toLocaleDateString()}</p>
              </div>
            )}
            {extraction.occupancyDate && (
              <div>
                <span className="font-medium">Occupancy Date:</span>
                <p>{new Date(extraction.occupancyDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Compliance Requirements */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Shield className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold">Compliance Requirements</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(complianceReqs).map(([key, value]) => (
              <div key={key} className="flex items-center text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Key Information */}
      {(keyPhrases.length > 0 || warnings.length > 0 || notes.length > 0) && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
          
          {keyPhrases.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">Key Phrases</h4>
              <div className="flex flex-wrap gap-2">
                {keyPhrases.map((phrase: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{phrase}</Badge>
                ))}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-red-700 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Warnings
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                {warnings.map((warning: string, i: number) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {notes.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Notes</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {notes.map((note: string, i: number) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}