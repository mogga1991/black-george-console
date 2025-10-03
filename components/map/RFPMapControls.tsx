'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  MapPin, 
  Filter, 
  Download, 
  Share, 
  Layers, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Building,
  Car,
  Shield,
  DollarSign,
  Ruler,
  Clock
} from 'lucide-react';
import { RFPExtractionResult } from '@/lib/types/rfp-extraction';

interface PropertyMatch {
  propertyId: string;
  property: {
    id: string;
    title: string;
    address: string;
    coords: { lat: number; lng: number };
    squareFeet: number;
    monthlyRent: number;
    spaceType: string;
    parking?: { total: number; reserved: number; ada: number };
    compliance?: {
      ada: boolean;
      fireCode: boolean;
      floodZone: boolean;
    };
  };
  matchScore: number;
  matchBreakdown: {
    location: number;
    space: number;
    compliance: number;
    financial: number;
    timeline: number;
  };
  dealBreakers: string[];
  advantages: string[];
  warnings: string[];
}

interface RFPMapControlsProps {
  rfpData: RFPExtractionResult;
  propertyMatches: PropertyMatch[];
  onFiltersChange?: (filters: MapFilters) => void;
  onExport?: () => void;
  onShare?: () => void;
  onCenterMap?: (coords: { lat: number; lng: number }) => void;
}

interface MapFilters {
  minMatchScore: number;
  maxRent?: number;
  minSize?: number;
  maxSize?: number;
  spaceTypes: string[];
  showCompliant: boolean;
  showNonCompliant: boolean;
  showDealBreakers: boolean;
  showBoundaries: boolean;
  showComplianceIndicators: boolean;
  radiusFilter?: {
    center: { lat: number; lng: number };
    radiusKm: number;
  };
}

const DEFAULT_FILTERS: MapFilters = {
  minMatchScore: 60,
  spaceTypes: [],
  showCompliant: true,
  showNonCompliant: true,
  showDealBreakers: true,
  showBoundaries: true,
  showComplianceIndicators: true
};

export function RFPMapControls({
  rfpData,
  propertyMatches,
  onFiltersChange,
  onExport,
  onShare,
  onCenterMap
}: RFPMapControlsProps) {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [mapStats, setMapStats] = useState({
    totalProperties: 0,
    visibleProperties: 0,
    avgMatchScore: 0,
    compliantProperties: 0,
    dealBreakerProperties: 0
  });

  // Update filters and notify parent
  const updateFilters = (newFilters: Partial<MapFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  };

  // Calculate map statistics
  useEffect(() => {
    const filteredProperties = applyFilters(propertyMatches, filters);
    const compliant = filteredProperties.filter(p => p.dealBreakers.length === 0);
    const withDealBreakers = filteredProperties.filter(p => p.dealBreakers.length > 0);
    const avgScore = filteredProperties.length > 0 
      ? filteredProperties.reduce((sum, p) => sum + p.matchScore, 0) / filteredProperties.length
      : 0;

    setMapStats({
      totalProperties: propertyMatches.length,
      visibleProperties: filteredProperties.length,
      avgMatchScore: avgScore,
      compliantProperties: compliant.length,
      dealBreakerProperties: withDealBreakers.length
    });
  }, [propertyMatches, filters]);

  // Apply filters to properties
  const applyFilters = (properties: PropertyMatch[], filters: MapFilters): PropertyMatch[] => {
    return properties.filter(match => {
      // Match score filter
      if (match.matchScore < filters.minMatchScore) return false;

      // Rent filter
      if (filters.maxRent && match.property.monthlyRent > filters.maxRent) return false;

      // Size filters
      if (filters.minSize && match.property.squareFeet < filters.minSize) return false;
      if (filters.maxSize && match.property.squareFeet > filters.maxSize) return false;

      // Space type filter
      if (filters.spaceTypes.length > 0 && !filters.spaceTypes.includes(match.property.spaceType)) return false;

      // Compliance filters
      const hasCompliance = match.dealBreakers.length === 0;
      if (!filters.showCompliant && hasCompliance) return false;
      if (!filters.showNonCompliant && !hasCompliance) return false;
      if (!filters.showDealBreakers && match.dealBreakers.length > 0) return false;

      // Radius filter
      if (filters.radiusFilter) {
        const distance = calculateDistance(
          match.property.coords,
          filters.radiusFilter.center
        );
        if (distance > filters.radiusFilter.radiusKm) return false;
      }

      return true;
    });
  };

  // Calculate distance between two points
  const calculateDistance = (
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get unique space types
  const availableSpaceTypes = [...new Set(propertyMatches.map(p => p.property.spaceType))];

  // Center map on RFP area
  const centerOnRFPArea = () => {
    const locationCriteria = rfpData.locationCriteria;
    
    // Try to center on the first zip code area
    if (locationCriteria.zipCodes && locationCriteria.zipCodes.length > 0) {
      // St. Cloud, FL coordinates for demonstration
      const stCloudCoords = { lat: 28.2916, lng: -81.4071 };
      onCenterMap?.(stCloudCoords);
    }
  };

  // Export map data
  const handleExport = () => {
    const exportData = {
      rfp: {
        title: rfpData.title,
        agency: rfpData.issuingAgency,
        location: rfpData.locationCriteria,
        requirements: {
          size: { min: rfpData.spaceRequirements.minSquareFeet, max: rfpData.spaceRequirements.maxSquareFeet },
          parking: rfpData.parkingRequirements,
          budget: rfpData.financialRequirements
        }
      },
      properties: applyFilters(propertyMatches, filters).map(match => ({
        id: match.property.id,
        title: match.property.title,
        address: match.property.address,
        coordinates: match.property.coords,
        matchScore: match.matchScore,
        dealBreakers: match.dealBreakers,
        advantages: match.advantages
      })),
      mapSettings: filters,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfp-map-${rfpData.title?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onExport?.();
  };

  return (
    <div className="space-y-4">
      {/* RFP Summary Card */}
      <Card className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">{rfpData.title}</h3>
            <p className="text-sm text-gray-600">{rfpData.issuingAgency}</p>
          </div>
          <Button onClick={centerOnRFPArea} size="sm" variant="outline">
            <Target className="h-4 w-4 mr-2" />
            Center Map
          </Button>
        </div>

        {/* RFP Requirements Summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-blue-600" />
            <span>{rfpData.spaceRequirements.minSquareFeet?.toLocaleString()} - {rfpData.spaceRequirements.maxSquareFeet?.toLocaleString()} sq ft</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span>{rfpData.locationCriteria.city}, {rfpData.locationCriteria.state}</span>
          </div>
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-purple-600" />
            <span>{(rfpData.parkingRequirements.reservedGovernmentSpaces || 0) + (rfpData.parkingRequirements.reservedVisitorSpaces || 0)} spaces</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span>${rfpData.financialRequirements.budgetMin?.toLocaleString()} - ${rfpData.financialRequirements.budgetMax?.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Map Statistics */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Map Overview
        </h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Visible Properties</div>
            <div className="text-lg font-semibold text-blue-600">
              {mapStats.visibleProperties} / {mapStats.totalProperties}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Avg Match Score</div>
            <div className="text-lg font-semibold text-green-600">
              {Math.round(mapStats.avgMatchScore)}%
            </div>
          </div>
          <div>
            <div className="text-gray-600">Compliant</div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-semibold">{mapStats.compliantProperties}</span>
            </div>
          </div>
          <div>
            <div className="text-gray-600">Deal Breakers</div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-semibold">{mapStats.dealBreakerProperties}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </h4>
          <Button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            variant="ghost" 
            size="sm"
          >
            {showAdvancedFilters ? 'Simple' : 'Advanced'}
          </Button>
        </div>

        {/* Basic Filters */}
        <div className="space-y-4">
          {/* Match Score Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Min Match Score: {filters.minMatchScore}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.minMatchScore}
              onChange={(e) => updateFilters({ minMatchScore: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Display Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Show Boundaries</span>
              <Switch
                checked={filters.showBoundaries}
                onCheckedChange={(checked) => updateFilters({ showBoundaries: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Compliance Indicators</span>
              <Switch
                checked={filters.showComplianceIndicators}
                onCheckedChange={(checked) => updateFilters({ showComplianceIndicators: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Show Deal Breakers</span>
              <Switch
                checked={filters.showDealBreakers}
                onCheckedChange={(checked) => updateFilters({ showDealBreakers: checked })}
              />
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <>
              <Separator />
              
              {/* Rent Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Max Monthly Rent
                </label>
                <input
                  type="number"
                  placeholder="Enter max rent"
                  value={filters.maxRent || ''}
                  onChange={(e) => updateFilters({ 
                    maxRent: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              {/* Size Filters */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Size (sq ft)</label>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minSize || ''}
                    onChange={(e) => updateFilters({ 
                      minSize: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Max Size (sq ft)</label>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxSize || ''}
                    onChange={(e) => updateFilters({ 
                      maxSize: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>

              {/* Space Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Space Types</label>
                <div className="flex flex-wrap gap-1">
                  {availableSpaceTypes.map(type => (
                    <Badge
                      key={type}
                      variant={filters.spaceTypes.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const newTypes = filters.spaceTypes.includes(type)
                          ? filters.spaceTypes.filter(t => t !== type)
                          : [...filters.spaceTypes, type];
                        updateFilters({ spaceTypes: newTypes });
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Compliance Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Compliance Status</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show Compliant</span>
                    <Switch
                      checked={filters.showCompliant}
                      onCheckedChange={(checked) => updateFilters({ showCompliant: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show Non-Compliant</span>
                    <Switch
                      checked={filters.showNonCompliant}
                      onCheckedChange={(checked) => updateFilters({ showNonCompliant: checked })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Reset Filters */}
          <Button
            onClick={() => updateFilters(DEFAULT_FILTERS)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Reset Filters
          </Button>
        </div>
      </Card>

      {/* Action Buttons */}
      <Card className="p-4">
        <div className="space-y-2">
          <Button onClick={handleExport} variant="outline" className="w-full" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Map Data
          </Button>
          <Button onClick={onShare} variant="outline" className="w-full" size="sm">
            <Share className="h-4 w-4 mr-2" />
            Share Map View
          </Button>
        </div>
      </Card>

      {/* Property Legend */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Map Legend</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-600"></div>
            <span>High Match (80%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-yellow-600"></div>
            <span>Medium Match (60-79%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-600"></div>
            <span>Low Match or Deal Breakers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 bg-blue-500 border border-blue-600"></div>
            <span>RFP Area Boundary</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Helper function to apply filters - export for use in parent component
export const applyMapFilters = (properties: PropertyMatch[], filters: MapFilters): PropertyMatch[] => {
  return properties.filter(match => {
    if (match.matchScore < filters.minMatchScore) return false;
    if (filters.maxRent && match.property.monthlyRent > filters.maxRent) return false;
    if (filters.minSize && match.property.squareFeet < filters.minSize) return false;
    if (filters.maxSize && match.property.squareFeet > filters.maxSize) return false;
    if (filters.spaceTypes.length > 0 && !filters.spaceTypes.includes(match.property.spaceType)) return false;
    
    const hasCompliance = match.dealBreakers.length === 0;
    if (!filters.showCompliant && hasCompliance) return false;
    if (!filters.showNonCompliant && !hasCompliance) return false;
    if (!filters.showDealBreakers && match.dealBreakers.length > 0) return false;

    return true;
  });
};