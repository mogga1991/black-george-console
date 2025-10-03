// Proximity and distance calculation utilities for RFP mapping
// Includes compliance with government proximity requirements

export interface ProximityRequirement {
  description: string;
  distance: number;
  unit: 'feet' | 'miles' | 'km' | 'meters';
  center?: { lat: number; lng: number };
  required: boolean;
  category: 'public_transport' | 'government' | 'services' | 'infrastructure' | 'commercial' | 'other';
}

export interface DistanceCalculationResult {
  distance: number;
  unit: string;
  meetsRequirement: boolean;
  details: string;
}

export interface ProximityAnalysis {
  propertyId: string;
  propertyCoords: { lat: number; lng: number };
  requirements: ProximityRequirement[];
  results: ProximityCalculationResult[];
  overallCompliance: boolean;
  score: number; // 0-100 based on how well it meets proximity requirements
}

export interface ProximityCalculationResult {
  requirement: ProximityRequirement;
  distance: DistanceCalculationResult;
  compliant: boolean;
  notes?: string;
}

// Convert distance units
export function convertDistance(distance: number, fromUnit: string, toUnit: string): number {
  const conversions: Record<string, number> = {
    'feet': 0.3048, // to meters
    'miles': 1609.34,
    'km': 1000,
    'meters': 1
  };

  const metersDistance = distance * (conversions[fromUnit] || 1);
  const targetConversion = conversions[toUnit] || 1;
  
  return metersDistance / targetConversion;
}

// Calculate distance between two geographic points using Haversine formula
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number },
  unit: 'feet' | 'miles' | 'km' | 'meters' = 'miles'
): number {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKm = R * c;
  
  // Convert to requested unit
  switch (unit) {
    case 'feet':
      return distanceKm * 3280.84;
    case 'miles':
      return distanceKm * 0.621371;
    case 'meters':
      return distanceKm * 1000;
    default:
      return distanceKm;
  }
}

// Find the closest point of interest from a list
export function findClosestPOI(
  propertyCoords: { lat: number; lng: number },
  pointsOfInterest: Array<{ lat: number; lng: number; name: string; type: string }>,
  unit: 'feet' | 'miles' | 'km' | 'meters' = 'miles'
): { poi: any; distance: number } | null {
  if (pointsOfInterest.length === 0) return null;

  let closest = pointsOfInterest[0];
  let minDistance = calculateDistance(propertyCoords, closest, unit);

  for (let i = 1; i < pointsOfInterest.length; i++) {
    const distance = calculateDistance(propertyCoords, pointsOfInterest[i], unit);
    if (distance < minDistance) {
      minDistance = distance;
      closest = pointsOfInterest[i];
    }
  }

  return { poi: closest, distance: minDistance };
}

// Analyze proximity compliance for a property
export function analyzeProximityCompliance(
  propertyCoords: { lat: number; lng: number },
  requirements: ProximityRequirement[],
  propertyId: string,
  pointsOfInterest: Array<{ lat: number; lng: number; name: string; type: string }> = []
): ProximityAnalysis {
  const results: ProximityCalculationResult[] = [];
  let totalScore = 0;
  let maxScore = 0;
  let allCompliant = true;

  for (const requirement of requirements) {
    const weight = requirement.required ? 2 : 1;
    maxScore += weight * 100;

    let calculationResult: DistanceCalculationResult;
    let compliant = false;

    if (requirement.center) {
      // Direct distance calculation to specified center
      const distance = calculateDistance(propertyCoords, requirement.center, requirement.unit);
      const meetsRequirement = distance <= requirement.distance;
      
      calculationResult = {
        distance,
        unit: requirement.unit,
        meetsRequirement,
        details: `${distance.toFixed(2)} ${requirement.unit} to ${requirement.description}`
      };
      
      compliant = meetsRequirement;
      totalScore += compliant ? weight * 100 : 0;
    } else {
      // Find relevant POIs and calculate to closest
      const relevantPOIs = pointsOfInterest.filter(poi => 
        poi.type.toLowerCase().includes(requirement.category) ||
        poi.name.toLowerCase().includes(requirement.description.toLowerCase())
      );

      if (relevantPOIs.length > 0) {
        const closest = findClosestPOI(propertyCoords, relevantPOIs, requirement.unit);
        if (closest) {
          const meetsRequirement = closest.distance <= requirement.distance;
          
          calculationResult = {
            distance: closest.distance,
            unit: requirement.unit,
            meetsRequirement,
            details: `${closest.distance.toFixed(2)} ${requirement.unit} to ${closest.poi.name}`
          };
          
          compliant = meetsRequirement;
          totalScore += compliant ? weight * 100 : Math.max(0, 50 - (closest.distance - requirement.distance) * 10);
        } else {
          calculationResult = {
            distance: -1,
            unit: requirement.unit,
            meetsRequirement: false,
            details: `No ${requirement.category} POIs found for analysis`
          };
          compliant = false;
        }
      } else {
        // No POIs available - mark as needs verification
        calculationResult = {
          distance: -1,
          unit: requirement.unit,
          meetsRequirement: false,
          details: `${requirement.description} - requires manual verification`
        };
        compliant = !requirement.required; // Non-required items default to true if no data
        totalScore += compliant ? weight * 50 : 0; // Partial credit for non-required
      }
    }

    if (requirement.required && !compliant) {
      allCompliant = false;
    }

    results.push({
      requirement,
      distance: calculationResult,
      compliant,
      notes: requirement.required ? 'Required compliance' : 'Preferred requirement'
    });
  }

  const score = maxScore > 0 ? (totalScore / maxScore) * 100 : 100;

  return {
    propertyId,
    propertyCoords,
    requirements,
    results,
    overallCompliance: allCompliant,
    score: Math.round(score)
  };
}

// Get proximity requirements from RFP data
export function extractProximityRequirements(rfpData: any): ProximityRequirement[] {
  const requirements: ProximityRequirement[] = [];

  // Extract from location criteria
  if (rfpData.locationCriteria?.proximityRequirements) {
    rfpData.locationCriteria.proximityRequirements.forEach((req: any) => {
      requirements.push({
        description: req.description,
        distance: req.distance,
        unit: req.unit,
        required: true,
        category: categorizeProximityRequirement(req.description)
      });
    });
  }

  // Add standard government facility requirements
  const standardRequirements: ProximityRequirement[] = [
    {
      description: "Public transportation access",
      distance: 0.5,
      unit: 'miles',
      required: false,
      category: 'public_transport'
    },
    {
      description: "Parking within building or 300 feet",
      distance: 300,
      unit: 'feet',
      required: true,
      category: 'infrastructure'
    },
    {
      description: "Emergency services access",
      distance: 5,
      unit: 'miles',
      required: false,
      category: 'services'
    },
    {
      description: "Commercial services and amenities",
      distance: 2,
      unit: 'miles',
      required: false,
      category: 'commercial'
    }
  ];

  // Add standard requirements if not already specified
  standardRequirements.forEach(stdReq => {
    const exists = requirements.some(req => 
      req.description.toLowerCase().includes(stdReq.description.toLowerCase()) ||
      req.category === stdReq.category
    );
    if (!exists) {
      requirements.push(stdReq);
    }
  });

  return requirements;
}

// Categorize proximity requirements
export function categorizeProximityRequirement(description: string): ProximityRequirement['category'] {
  const lower = description.toLowerCase();
  
  if (lower.includes('transit') || lower.includes('bus') || lower.includes('train') || lower.includes('metro')) {
    return 'public_transport';
  }
  if (lower.includes('government') || lower.includes('federal') || lower.includes('courthouse')) {
    return 'government';
  }
  if (lower.includes('parking') || lower.includes('garage') || lower.includes('road') || lower.includes('highway')) {
    return 'infrastructure';
  }
  if (lower.includes('hospital') || lower.includes('police') || lower.includes('fire') || lower.includes('emergency')) {
    return 'services';
  }
  if (lower.includes('restaurant') || lower.includes('retail') || lower.includes('shopping') || lower.includes('commercial')) {
    return 'commercial';
  }
  
  return 'other';
}

// Create circles on map for proximity requirements
export function createProximityCircles(
  map: any,
  propertyCoords: { lat: number; lng: number },
  requirements: ProximityRequirement[]
): any[] {
  if (!map || !window.google) return [];

  const circles: any[] = [];

  requirements.forEach((req, index) => {
    const center = req.center || propertyCoords;
    const radiusMeters = convertDistance(req.distance, req.unit, 'meters');
    
    const color = req.required ? '#ef4444' : '#3b82f6';
    const opacity = req.required ? 0.3 : 0.15;

    const circle = new window.google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: opacity,
      map: map,
      center: center,
      radius: radiusMeters,
      clickable: true
    });

    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div class="p-3">
          <h4 class="font-semibold text-sm mb-2">${req.description}</h4>
          <div class="text-xs text-gray-600">
            <div>Distance: ${req.distance} ${req.unit}</div>
            <div>Type: ${req.category.replace('_', ' ')}</div>
            <div class="mt-1">
              <span class="px-2 py-1 rounded text-xs ${req.required ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">
                ${req.required ? 'Required' : 'Preferred'}
              </span>
            </div>
          </div>
        </div>
      `
    });

    circle.addListener('click', (event: any) => {
      infoWindow.setPosition(event.latLng);
      infoWindow.open(map);
    });

    circles.push(circle);
  });

  return circles;
}

// Get sample points of interest for testing (you'd replace with real data)
export function getSamplePOIs(city: string, state: string): Array<{ lat: number; lng: number; name: string; type: string }> {
  // Sample POIs for St. Cloud, FL (from USDA example)
  if (city.toLowerCase().includes('st cloud') || city.toLowerCase().includes('st. cloud')) {
    return [
      { lat: 28.2458, lng: -81.4068, name: 'SunRail Station St. Cloud', type: 'public_transport' },
      { lat: 28.2884, lng: -81.4012, name: 'St. Cloud Police Department', type: 'services' },
      { lat: 28.2772, lng: -81.4078, name: 'St. Cloud Fire Department', type: 'services' },
      { lat: 28.2916, lng: -81.4010, name: 'St. Cloud City Hall', type: 'government' },
      { lat: 28.2885, lng: -81.4231, name: 'The Loop Shopping Center', type: 'commercial' },
      { lat: 28.2424, lng: -81.4084, name: 'St. Cloud Regional Medical Center', type: 'services' },
      { lat: 28.3024, lng: -81.4156, name: 'Valencia College Osceola Campus', type: 'services' },
      { lat: 28.2750, lng: -81.4028, name: 'Osceola County Courthouse', type: 'government' }
    ];
  }

  // Return empty array for other cities (would be populated from a real POI service)
  return [];
}

// Batch analyze multiple properties
export function batchAnalyzeProximity(
  properties: Array<{ id: string; coords: { lat: number; lng: number } }>,
  requirements: ProximityRequirement[],
  pointsOfInterest: Array<{ lat: number; lng: number; name: string; type: string }> = []
): ProximityAnalysis[] {
  return properties.map(property => 
    analyzeProximityCompliance(property.coords, requirements, property.id, pointsOfInterest)
  );
}