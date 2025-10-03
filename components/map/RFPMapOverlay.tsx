'use client';

import { useEffect, useRef, useState } from 'react';
import { RFPExtractionResult } from '@/lib/types/rfp-extraction';

declare global {
  interface Window {
    google: any;
  }
}

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
    imageUrl?: string;
    parking?: { total: number; reserved: number; ada: number };
    amenities?: string[];
    compliance?: {
      ada: boolean;
      fireCode: boolean;
      floodZone: boolean;
      sprinklerSystem: boolean;
      fireAlarm: boolean;
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

interface RFPMapOverlayProps {
  map: any;
  rfpData: RFPExtractionResult;
  propertyMatches: PropertyMatch[];
  onPropertySelect?: (propertyId: string) => void;
  showBoundaries?: boolean;
  showComplianceIndicators?: boolean;
  filterMinScore?: number;
}

export function useRFPMapOverlay({
  map,
  rfpData,
  propertyMatches,
  onPropertySelect,
  showBoundaries = true,
  showComplianceIndicators = true,
  filterMinScore = 0
}: RFPMapOverlayProps) {
  const [markers, setMarkers] = useState<any[]>([]);
  const [boundaryShapes, setBoundaryShapes] = useState<any[]>([]);
  const [infoWindows, setInfoWindows] = useState<any[]>([]);

  // Clear all overlays
  const clearOverlays = () => {
    markers.forEach(marker => marker.setMap(null));
    boundaryShapes.forEach(shape => shape.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());
    setMarkers([]);
    setBoundaryShapes([]);
    setInfoWindows([]);
  };

  // Render RFP geographic boundaries
  const renderRFPBoundaries = () => {
    if (!map || !window.google || !showBoundaries) return;

    const locationCriteria = rfpData.locationCriteria;
    const newShapes: any[] = [];

    // Create zip code boundaries
    if (locationCriteria.zipCodes && locationCriteria.zipCodes.length > 0) {
      locationCriteria.zipCodes.forEach((zipCode, index) => {
        // Get approximate coordinates for zip code (you'd want to use a geocoding service)
        getZipCodeBounds(zipCode).then(bounds => {
          if (bounds) {
            const polygon = new window.google.maps.Polygon({
              paths: bounds,
              strokeColor: '#3b82f6',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
              map: map,
              clickable: true
            });

            // Add info window for boundary
            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-3">
                  <h3 class="font-semibold text-sm mb-2">RFP Area: ${zipCode}</h3>
                  <div class="text-xs text-gray-600">
                    <div>Delineated area for ${rfpData.issuingAgency}</div>
                    <div class="mt-1 font-medium">${rfpData.title}</div>
                  </div>
                </div>
              `
            });

            polygon.addListener('click', (event: any) => {
              infoWindow.setPosition(event.latLng);
              infoWindow.open(map);
            });

            newShapes.push(polygon);
          }
        });
      });
    }

    // Create circular area if proximity requirements exist
    if (locationCriteria.proximityRequirements && locationCriteria.proximityRequirements.length > 0) {
      locationCriteria.proximityRequirements.forEach(req => {
        // You'd geocode the description to get coordinates
        const center = { lat: 28.2916, lng: -81.4071 }; // St. Cloud, FL example
        const radiusMeters = req.unit === 'feet' ? req.distance * 0.3048 : 
                           req.unit === 'miles' ? req.distance * 1609.34 : req.distance;

        const circle = new window.google.maps.Circle({
          strokeColor: '#10b981',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#10b981',
          fillOpacity: 0.1,
          map: map,
          center: center,
          radius: radiusMeters,
          clickable: true
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div class="p-3">
              <h3 class="font-semibold text-sm mb-2">Proximity Requirement</h3>
              <div class="text-xs text-gray-600">
                <div>${req.description}</div>
                <div class="mt-1">Within ${req.distance} ${req.unit}</div>
              </div>
            </div>
          `
        });

        circle.addListener('click', (event: any) => {
          infoWindow.setPosition(event.latLng);
          infoWindow.open(map);
        });

        newShapes.push(circle);
      });
    }

    setBoundaryShapes(prev => [...prev, ...newShapes]);
  };

  // Render property markers with RFP-specific styling
  const renderPropertyMarkers = () => {
    if (!map || !window.google) return;

    const filteredProperties = propertyMatches.filter(match => 
      match.matchScore >= filterMinScore
    );

    const newMarkers: any[] = [];
    const newInfoWindows: any[] = [];

    filteredProperties.forEach((match, index) => {
      const property = match.property;
      
      // Create custom marker based on match score and compliance
      const markerElement = createCustomMarker(match, index + 1);
      
      // Create detailed info window
      const infoWindowContent = createPropertyInfoWindow(match, rfpData);
      
      const infoWindow = new window.google.maps.InfoWindow({
        content: infoWindowContent,
        maxWidth: 400
      });

      // Create marker
      let marker;
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: property.coords,
          map: map,
          content: markerElement,
          title: property.title,
        });
      } else {
        // Fallback to regular marker with custom icon
        marker = new window.google.maps.Marker({
          position: property.coords,
          map: map,
          title: property.title,
          icon: createMarkerIcon(match, index + 1),
        });
      }

      // Add click handlers
      marker.addListener('click', () => {
        // Close other info windows
        newInfoWindows.forEach(iw => iw.close());
        infoWindow.open(map, marker);
        onPropertySelect?.(property.id);
      });

      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    setMarkers(prev => [...prev, ...newMarkers]);
    setInfoWindows(prev => [...prev, ...newInfoWindows]);

    // Auto-focus map if properties exist
    if (filteredProperties.length > 0) {
      focusMapOnProperties(filteredProperties.map(m => m.property));
    }
  };

  // Create custom marker element
  const createCustomMarker = (match: PropertyMatch, number: number) => {
    const markerElement = document.createElement('div');
    const score = match.matchScore;
    const hasDealBreakers = match.dealBreakers.length > 0;
    
    // Determine marker color based on score and deal breakers
    let backgroundColor = '#ef4444'; // Red for low scores
    let borderColor = '#dc2626';
    
    if (hasDealBreakers) {
      backgroundColor = '#ef4444';
      borderColor = '#dc2626';
    } else if (score >= 80) {
      backgroundColor = '#10b981'; // Green for high scores
      borderColor = '#059669';
    } else if (score >= 60) {
      backgroundColor = '#f59e0b'; // Yellow for medium scores
      borderColor = '#d97706';
    }

    markerElement.style.cssText = `
      background-color: ${backgroundColor};
      border: 3px solid ${borderColor};
      color: white;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      position: relative;
    `;

    markerElement.textContent = number.toString();

    // Add compliance indicator if enabled
    if (showComplianceIndicators && hasDealBreakers) {
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: absolute;
        top: -2px;
        right: -2px;
        width: 12px;
        height: 12px;
        background-color: #ef4444;
        border: 2px solid white;
        border-radius: 50%;
      `;
      markerElement.appendChild(indicator);
    }

    // Add hover effects
    markerElement.addEventListener('mouseenter', () => {
      markerElement.style.transform = 'scale(1.1)';
      markerElement.style.zIndex = '1000';
    });

    markerElement.addEventListener('mouseleave', () => {
      markerElement.style.transform = 'scale(1)';
      markerElement.style.zIndex = 'auto';
    });

    return markerElement;
  };

  // Create marker icon for fallback
  const createMarkerIcon = (match: PropertyMatch, number: number) => {
    const score = match.matchScore;
    const hasDealBreakers = match.dealBreakers.length > 0;
    
    let color = '#ef4444';
    if (!hasDealBreakers) {
      if (score >= 80) color = '#10b981';
      else if (score >= 60) color = '#f59e0b';
    }

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="18" fill="${color}" stroke="white" stroke-width="3"/>
          <text x="18" y="23" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${number}</text>
          ${hasDealBreakers ? '<circle cx="28" cy="8" r="6" fill="#ef4444" stroke="white" stroke-width="2"/>' : ''}
        </svg>
      `),
      scaledSize: new window.google.maps.Size(36, 36),
      anchor: new window.google.maps.Point(18, 18),
    };
  };

  // Create property info window content
  const createPropertyInfoWindow = (match: PropertyMatch, rfpData: RFPExtractionResult) => {
    const property = match.property;
    const score = match.matchScore;
    const breakdown = match.matchBreakdown;

    return `
      <div class="max-w-md">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-t-lg">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h3 class="font-semibold text-lg mb-1">${property.title}</h3>
              <p class="text-blue-100 text-sm">${property.address}</p>
            </div>
            <div class="text-right">
              <div class="bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
                ${Math.round(score)}% Match
              </div>
            </div>
          </div>
        </div>

        <!-- Property Details -->
        <div class="p-4 bg-white">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Size</div>
              <div class="font-semibold">${property.squareFeet.toLocaleString()} sq ft</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Rent</div>
              <div class="font-semibold">$${property.monthlyRent.toLocaleString()}/mo</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Type</div>
              <div class="font-semibold capitalize">${property.spaceType}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Parking</div>
              <div class="font-semibold">${property.parking?.total || 0} spaces</div>
            </div>
          </div>

          <!-- RFP Fit Analysis -->
          <div class="mb-4">
            <h4 class="font-semibold text-sm mb-2">RFP Requirements Match</h4>
            <div class="space-y-2">
              ${Object.entries(breakdown).filter(([key]) => key !== 'total').map(([category, score]) => `
                <div class="flex justify-between items-center">
                  <span class="text-sm capitalize">${category.replace('_', ' ')}</span>
                  <div class="flex items-center gap-2">
                    <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div class="h-full bg-gradient-to-r ${
                        score >= 80 ? 'from-green-400 to-green-500' :
                        score >= 60 ? 'from-yellow-400 to-yellow-500' :
                        'from-red-400 to-red-500'
                      }" style="width: ${score}%"></div>
                    </div>
                    <span class="text-xs font-medium w-8">${Math.round(score)}%</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Deal Breakers -->
          ${match.dealBreakers.length > 0 ? `
            <div class="mb-4">
              <h4 class="font-semibold text-sm mb-2 text-red-600">⚠️ Deal Breakers</h4>
              <div class="space-y-1">
                ${match.dealBreakers.map(issue => `
                  <div class="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">${issue}</div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Advantages -->
          ${match.advantages.length > 0 ? `
            <div class="mb-4">
              <h4 class="font-semibold text-sm mb-2 text-green-600">✅ Advantages</h4>
              <div class="space-y-1">
                ${match.advantages.map(advantage => `
                  <div class="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">${advantage}</div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Warnings -->
          ${match.warnings.length > 0 ? `
            <div class="mb-4">
              <h4 class="font-semibold text-sm mb-2 text-yellow-600">⚠️ Considerations</h4>
              <div class="space-y-1">
                ${match.warnings.map(warning => `
                  <div class="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">${warning}</div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div class="flex gap-2 pt-4 border-t">
            <button 
              onclick="window.selectProperty('${property.id}')" 
              class="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Select Property
            </button>
            <button 
              onclick="window.viewPropertyDetails('${property.id}')" 
              class="flex-1 border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    `;
  };

  // Focus map on properties
  const focusMapOnProperties = (properties: PropertyMatch['property'][]) => {
    if (!map || properties.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    properties.forEach(property => {
      bounds.extend(property.coords);
    });

    map.fitBounds(bounds);
    
    // Add padding and ensure reasonable zoom
    const listener = map.addListener('bounds_changed', () => {
      if (map.getZoom() > 15) map.setZoom(15);
      window.google.maps.event.removeListener(listener);
    });
  };

  // Geocoding helper (simplified - you'd want to use a proper service)
  const getZipCodeBounds = async (zipCode: string): Promise<any[]> => {
    // This is a simplified example - you'd use a geocoding service
    // For St. Cloud, FL zip codes from USDA example
    const zipCodeBounds: Record<string, any[]> = {
      '34769': [
        { lat: 28.245, lng: -81.427 },
        { lat: 28.245, lng: -81.367 },
        { lat: 28.305, lng: -81.367 },
        { lat: 28.305, lng: -81.427 }
      ],
      '34771': [
        { lat: 28.305, lng: -81.427 },
        { lat: 28.305, lng: -81.367 },
        { lat: 28.365, lng: -81.367 },
        { lat: 28.365, lng: -81.427 }
      ],
      '34772': [
        { lat: 28.245, lng: -81.487 },
        { lat: 28.245, lng: -81.427 },
        { lat: 28.305, lng: -81.427 },
        { lat: 28.305, lng: -81.487 }
      ]
    };

    return Promise.resolve(zipCodeBounds[zipCode] || null);
  };

  // Set up global functions for info window buttons
  useEffect(() => {
    window.selectProperty = (propertyId: string) => {
      onPropertySelect?.(propertyId);
    };

    window.viewPropertyDetails = (propertyId: string) => {
      // You can implement property details modal here
      console.log('View details for property:', propertyId);
    };

    return () => {
      delete window.selectProperty;
      delete window.viewPropertyDetails;
    };
  }, [onPropertySelect]);

  // Main render function
  const renderOverlays = () => {
    clearOverlays();
    renderRFPBoundaries();
    renderPropertyMarkers();
  };

  return {
    renderOverlays,
    clearOverlays,
    focusMapOnProperties: () => focusMapOnProperties(propertyMatches.map(m => m.property))
  };
}