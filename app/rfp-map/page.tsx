'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMapCanvas } from '@/components/map/GoogleMapCanvas';
import { useRFPMapOverlay } from '@/components/map/RFPMapOverlay';
import { RFPMapControls, applyMapFilters } from '@/components/map/RFPMapControls';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Map, 
  List, 
  Download, 
  Share2, 
  FileText, 
  Building2,
  MapPin,
  Clock,
  AlertCircle,
  Plus,
  Upload,
  RotateCcw
} from 'lucide-react';
import { RFPExtractionResult } from '@/lib/types/rfp-extraction';
import { 
  extractProximityRequirements, 
  analyzeProximityCompliance, 
  getSamplePOIs,
  createProximityCircles
} from '@/lib/map/proximity';

import { RFPOpportunity, RFPMapFilters } from '@/lib/types/rfp-opportunities';

interface OpportunityListState {
  opportunities: RFPOpportunity[];
  selectedOpportunity: RFPOpportunity | null;
  loading: boolean;
  error: string | null;
}

export default function RFPMapPage() {
  const [map, setMap] = useState<any>(null);
  const [opportunityState, setOpportunityState] = useState<OpportunityListState>({
    opportunities: [],
    selectedOpportunity: null,
    loading: false,
    error: null,
  });
  const [filters, setFilters] = useState<RFPMapFilters>({
    minMatchScore: 0,
    spaceTypes: [],
    rfpTypes: [],
    states: [],
    agencies: [],
    showCompliant: true,
    showNonCompliant: true,
    showDealBreakers: false,
    showBoundaries: true,
    showComplianceIndicators: true,
  });
  const [activeTab, setActiveTab] = useState('map');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch government opportunities from SAM.gov
  const fetchOpportunities = async (params?: {
    state?: string;
    naicsCode?: string;
    daysBack?: number;
    minCREScore?: number;
  }) => {
    setOpportunityState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const searchParams = new URLSearchParams();
      if (params?.state) searchParams.append('state', params.state);
      if (params?.naicsCode) searchParams.append('naicsCode', params.naicsCode);
      if (params?.daysBack) searchParams.append('daysBack', params.daysBack.toString());
      if (params?.minCREScore) searchParams.append('minCREScore', params.minCREScore.toString());
      
      const response = await fetch(`/api/opportunities?${searchParams}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOpportunityState(prev => ({
        ...prev,
        opportunities: data.opportunities,
        loading: false,
      }));
    } catch (error) {
      setOpportunityState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch opportunities',
      }));
    }
  };

  // Upload Excel/CSV file via Notion->Supabase pipeline
  const uploadOpportunitiesFile = async (file: File) => {
    setOpportunityState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Step 1: Upload to Notion
      const formData = new FormData();
      formData.append('file', file);
      
      const notionResponse = await fetch('/api/notion/opportunities/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!notionResponse.ok) {
        const error = await notionResponse.json();
        throw new Error(error.error || 'Failed to upload to Notion');
      }
      
      const notionResult = await notionResponse.json();
      
      // Step 2: Sync from Notion to Supabase
      const syncResponse = await fetch('/api/supabase/sync-opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      
      if (!syncResponse.ok) {
        const error = await syncResponse.json();
        throw new Error(error.error || 'Failed to sync to Supabase');
      }
      
      const syncResult = await syncResponse.json();
      
      // Step 3: Refresh opportunities from Supabase
      await fetchOpportunities();
      
      setOpportunityState(prev => ({ ...prev, loading: false }));
      
      alert(
        `Success! Upload: ${notionResult.uploaded} to Notion, ` +
        `Sync: ${syncResult.synced} to Supabase` +
        (syncResult.errors > 0 ? `, ${syncResult.errors} errors` : '')
      );
      
    } catch (error) {
      setOpportunityState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      }));
    }
  };

  // Filter opportunities based on current filters
  const filteredOpportunities = opportunityState.opportunities.filter(opp => {
    if (filters.states.length > 0 && !filters.states.includes(opp.placeOfPerformanceState || '')) {
      return false;
    }
    if (filters.agencies.length > 0 && !filters.agencies.includes(opp.issuingAgency)) {
      return false;
    }
    if (filters.rfpTypes.length > 0 && !filters.rfpTypes.includes(opp.rfpType)) {
      return false;
    }
    if ((opp.commercialRealEstateScore || 0) < filters.minMatchScore) {
      return false;
    }
    return true;
  });

  // Load opportunities on component mount
  useEffect(() => {
    fetchOpportunities({
      naicsCode: '236220', // Commercial Building Construction
      daysBack: 30,
      minCREScore: 30,
    });
  }, []);

  // Handle map ready
  const handleMapReady = (mapInstance: any) => {
    setMap(mapInstance);
    
    // Center map on US
    if (mapInstance) {
      mapInstance.setCenter({ lat: 39.8283, lng: -98.5795 });
      mapInstance.setZoom(4);
    }
  };

  // Handle opportunity selection
  const handleOpportunitySelect = (opportunity: RFPOpportunity) => {
    setOpportunityState(prev => ({ ...prev, selectedOpportunity: opportunity }));
    
    // Center map on opportunity location if coordinates are available
    if (map && opportunity.coordinates) {
      map.setCenter(opportunity.coordinates);
      map.setZoom(12);
    }
  };

  // Generate AI summary for opportunity
  const generateAISummary = async (opportunityId: string) => {
    try {
      const response = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', opportunityId }),
      });
      
      if (response.ok) {
        const analysis = await response.json();
        // Update opportunity with AI analysis
        setOpportunityState(prev => ({
          ...prev,
          opportunities: prev.opportunities.map(opp =>
            opp.id === opportunityId
              ? { ...opp, aiSummary: analysis.analysis.summary }
              : opp
          ),
        }));
      }
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
    }
  };

  // Export opportunities data
  const handleExport = () => {
    const exportData = {
      opportunities: filteredOpportunities,
      filters,
      exportDate: new Date().toISOString(),
      mapCenter: map?.getCenter()?.toJSON(),
      mapZoom: map?.getZoom()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `government-rfp-opportunities-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Share map view
  const handleShare = async () => {
    const shareData = {
      title: 'Government RFP Opportunities Map',
      text: `Commercial real estate opportunities from government agencies`,
      url: window.location.href
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Map URL copied to clipboard!');
    }
  };

  // File input handler for Excel/CSV upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadOpportunitiesFile(file);
    }
    // Reset input so same file can be uploaded again
    event.target.value = '';
  };

  return (
    <ProtectedRoute>
      <div className="h-screen flex">
        {/* Sidebar Controls */}
        <div className="w-80 bg-gray-50 border-r overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Government RFP Map</h1>
              <div className="flex gap-2">
                <Button onClick={handleExport} size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
                <Button onClick={handleShare} size="sm" variant="outline">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                onClick={() => fetchOpportunities({ naicsCode: '236220', daysBack: 30, minCREScore: 30 })}
                size="sm"
                variant="outline"
                disabled={opportunityState.loading}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button size="sm" variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Excel
                </Button>
              </div>
            </div>

            {/* Sync Actions */}
            <div className="mb-4">
              <Button
                onClick={async () => {
                  setOpportunityState(prev => ({ ...prev, loading: true }));
                  try {
                    await fetch('/api/opportunities', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'sync' })
                    });
                    await fetchOpportunities();
                    setOpportunityState(prev => ({ ...prev, loading: false }));
                    alert('Sync completed successfully!');
                  } catch (error) {
                    setOpportunityState(prev => ({ ...prev, loading: false, error: 'Sync failed' }));
                  }
                }}
                size="sm"
                variant="outline"
                className="w-full"
                disabled={opportunityState.loading}
              >
                Sync Notion → Supabase
              </Button>
            </div>

            {/* Loading and Error States */}
            {opportunityState.loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading opportunities...</p>
              </div>
            )}

            {opportunityState.error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-600 text-sm">{opportunityState.error}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Card className="p-2">
                <div className="text-center">
                  <div className="text-lg font-bold">{filteredOpportunities.length}</div>
                  <div className="text-xs text-gray-500">Opportunities</div>
                </div>
              </Card>
              <Card className="p-2">
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {filteredOpportunities.filter(o => o.status === 'open').length}
                  </div>
                  <div className="text-xs text-gray-500">Open</div>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <div className="mb-4">
              <Button 
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Filters {showFilters ? '▲' : '▼'}
              </Button>
              
              {showFilters && (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="text-xs font-medium">Min CRE Score</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.minMatchScore}
                      onChange={(e) => setFilters(prev => ({ ...prev, minMatchScore: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-500">{filters.minMatchScore}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Opportunities List */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Recent Opportunities</h3>
              {filteredOpportunities.slice(0, 10).map((opportunity) => (
                <Card 
                  key={opportunity.id} 
                  className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
                    opportunityState.selectedOpportunity?.id === opportunity.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleOpportunitySelect(opportunity)}
                >
                  <div className="space-y-2">
                    <div className="text-sm font-medium line-clamp-2">{opportunity.title}</div>
                    <div className="text-xs text-gray-500">{opportunity.issuingAgency}</div>
                    <div className="flex justify-between items-center">
                      <Badge variant={opportunity.status === 'open' ? 'default' : 'secondary'}>
                        {opportunity.status}
                      </Badge>
                      <div className="text-xs">
                        CRE: {opportunity.commercialRealEstateScore || 0}%
                      </div>
                    </div>
                    {opportunity.responseDueDate && (
                      <div className="text-xs text-orange-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due: {opportunity.responseDueDate.toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header Bar */}
          <div className="bg-white border-b p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Government RFP Opportunities</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {filteredOpportunities.length} opportunities
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Commercial Real Estate
                  </span>
                  {opportunityState.selectedOpportunity && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {opportunityState.selectedOpportunity.solicitationNumber}
                    </span>
                  )}
                </div>
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="map" className="flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    Map View
                  </TabsTrigger>
                  <TabsTrigger value="list" className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    List View
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Content Tabs */}
          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsContent value="map" className="h-full m-0">
                <div className="h-full relative">
                  <GoogleMapCanvas onReady={handleMapReady} />
                  
                  {/* Selected Opportunity Overlay */}
                  {opportunityState.selectedOpportunity && (
                    <div className="absolute top-4 left-4 right-4 z-10">
                      <Card className="p-4 bg-white/95 backdrop-blur max-w-2xl">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{opportunityState.selectedOpportunity.title}</h3>
                            <p className="text-sm text-gray-600 mb-2">{opportunityState.selectedOpportunity.issuingAgency}</p>
                            <div className="flex gap-4 text-sm mb-2">
                              <Badge variant={opportunityState.selectedOpportunity.status === 'open' ? 'default' : 'secondary'}>
                                {opportunityState.selectedOpportunity.status}
                              </Badge>
                              <span>CRE Score: {opportunityState.selectedOpportunity.commercialRealEstateScore || 0}%</span>
                              {opportunityState.selectedOpportunity.responseDueDate && (
                                <span className="text-orange-600">
                                  Due: {opportunityState.selectedOpportunity.responseDueDate.toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {opportunityState.selectedOpportunity.aiSummary && (
                              <p className="text-sm bg-blue-50 p-2 rounded mt-2">
                                {opportunityState.selectedOpportunity.aiSummary}
                              </p>
                            )}
                            {!opportunityState.selectedOpportunity.aiSummary && (
                              <Button
                                onClick={() => generateAISummary(opportunityState.selectedOpportunity!.id)}
                                size="sm"
                                variant="outline"
                                className="mt-2"
                              >
                                Generate AI Summary
                              </Button>
                            )}
                          </div>
                          <Button
                            onClick={() => setOpportunityState(prev => ({ ...prev, selectedOpportunity: null }))}
                            variant="ghost"
                            size="sm"
                          >
                            ×
                          </Button>
                        </div>
                        
                        {opportunityState.selectedOpportunity.samGovUrl && (
                          <div className="mt-3">
                            <a
                              href={opportunityState.selectedOpportunity.samGovUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              View on SAM.gov →
                            </a>
                          </div>
                        )}
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="list" className="h-full m-0 p-4">
                <div className="space-y-4">
                  {filteredOpportunities.map((opportunity) => (
                    <Card key={opportunity.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold">{opportunity.title}</h3>
                          <p className="text-sm text-gray-600">{opportunity.issuingAgency}</p>
                          <p className="text-xs text-gray-500 mt-1">{opportunity.solicitationNumber}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={opportunity.status === 'open' ? 'default' : 'secondary'}>
                            {opportunity.status}
                          </Badge>
                          <div className="text-xs mt-1">CRE: {opportunity.commercialRealEstateScore || 0}%</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Location:</span> 
                          {opportunity.placeOfPerformanceCity && opportunity.placeOfPerformanceState 
                            ? ` ${opportunity.placeOfPerformanceCity}, ${opportunity.placeOfPerformanceState}`
                            : ' Not specified'}
                        </div>
                        <div>
                          <span className="text-gray-500">Type:</span> {opportunity.rfpType.toUpperCase()}
                        </div>
                      </div>
                      
                      {opportunity.responseDueDate && (
                        <div className="flex items-center gap-2 text-orange-600 text-sm mb-3">
                          <Clock className="h-4 w-4" />
                          <span>Due: {opportunity.responseDueDate.toLocaleDateString()}</span>
                        </div>
                      )}
                      
                      {opportunity.aiSummary && (
                        <div className="bg-blue-50 p-2 rounded text-sm mb-3">
                          {opportunity.aiSummary}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            handleOpportunitySelect(opportunity);
                            setActiveTab('map');
                          }}
                          className="flex-1"
                          variant="outline"
                        >
                          View Details
                        </Button>
                        {opportunity.samGovUrl && (
                          <Button
                            onClick={() => window.open(opportunity.samGovUrl, '_blank')}
                            variant="outline"
                          >
                            SAM.gov
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                  
                  {filteredOpportunities.length === 0 && !opportunityState.loading && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No opportunities found. Try adjusting your filters or refreshing.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}