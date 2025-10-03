// USDA RFP Map Integration Test
// Validates that our enhanced mapping system works with the USDA St. Cloud example

import { RFPExtractionResult } from '@/lib/types/rfp-extraction';
import { 
  extractProximityRequirements, 
  analyzeProximityCompliance, 
  getSamplePOIs,
  calculateDistance 
} from '@/lib/map/proximity';

// Test data based on actual USDA RFP
const USDA_RFP_TEST_DATA: RFPExtractionResult = {
  documentId: 'test-usda-st-cloud',
  extractionId: 'ext-test-001',
  extractionDate: new Date('2024-11-20'),
  confidenceScore: 0.92,
  
  title: 'USDA FPAC-BC St. Cloud Office Lease',
  rfpNumber: 'USDA-FL-2024-001',
  issuingAgency: 'United States Department of Agriculture',
  
  locationCriteria: {
    state: 'FL',
    city: 'St Cloud',
    zipCodes: ['34769', '34771', '34772'],
    delineatedAreas: ['St. Cloud metropolitan area'],
    proximityRequirements: [
      {
        description: 'Parking within 300 feet of building premises',
        distance: 300,
        unit: 'feet'
      }
    ],
    geographicRestrictions: ['Not in flood plain'],
    preferredLocations: ['Downtown St. Cloud', 'Business districts']
  },
  
  spaceRequirements: {
    minSquareFeet: 4237,
    maxSquareFeet: 4542,
    preferredSquareFeet: 4400,
    measurementType: 'ABOA',
    spaceType: 'office',
    floors: undefined,
    ceilingHeight: undefined,
    specialSpaceNeeds: ['Government vehicle parking area'],
    layoutRequirements: ['Open office configuration', 'Private offices for management']
  },
  
  parkingRequirements: {
    reservedGovernmentSpaces: 9,
    reservedVisitorSpaces: 10,
    reservedCustomerSpaces: 0,
    nonReservedEmployeeSpaces: 15,
    totalParkingSpaces: 34,
    onSiteRequired: true,
    proximityToBuilding: { maxDistance: 300, unit: 'feet' },
    adaCompliantSpaces: 2,
    parkingType: 'surface'
  },
  
  leaseTerms: {
    fullTermMonths: 240, // 20 years
    firmTermMonths: 60,  // 5 years
    terminationRights: { noticeDays: 120, conditions: ['Government convenience'] },
    leaseType: 'full-service',
    renewalOptions: { periods: 4, lengthMonths: 60 },
    escalationClauses: ['Annual CPI adjustment']
  },
  
  financialRequirements: {
    budgetRange: { min: 10500, max: 15000, currency: 'USD', period: 'monthly' },
    pricePerSquareFoot: { min: 2.25, max: 3.50, currency: 'USD', period: 'monthly' },
    operatingExpenses: { included: true, estimatedAmount: 2000, details: ['Utilities', 'Maintenance', 'Security'] },
    utilities: { included: true, types: ['Electric', 'Gas', 'Water', 'Sewer', 'Internet'] },
    securityDeposit: { required: false, amount: 0, description: 'Government lease - no deposit required' }
  },
  
  complianceRequirements: {
    fireLifeSafety: { 
      required: true, 
      standards: ['IFC', 'NFPA 13', 'NFPA 72'], 
      details: 'Automatic fire sprinkler and alarm systems required' 
    },
    accessibility: { 
      required: true, 
      standards: 'ABAAS', 
      details: 'Must meet Architectural Barriers Act Accessibility Standards' 
    },
    seismicSafety: { 
      required: true, 
      standards: ['IBC Seismic Provisions'], 
      details: 'Current seismic safety compliance required' 
    },
    environmentalRequirements: {
      floodZoneRestrictions: { 
        prohibited: true, 
        allowedZones: [], 
        details: 'Property must not be in 1-percent-annual chance (100-year) or 0.2-percent annual chance (500-year) flood plain' 
      },
      nepaCompliance: false,
      sustainabilityStandards: ['ENERGY STAR qualified building preferred'],
      environmentalAssessment: true
    },
    securityRequirements: {
      clearanceLevel: 'Public Trust',
      backgroundChecks: true,
      accessControl: ['Key card entry', 'Visitor management'],
      telecommunicationsRestrictions: { 
        section889Compliance: true, 
        details: 'Must comply with NDAA Section 889 telecommunications prohibitions' 
      }
    },
    buildingCodes: ['International Building Code', 'Florida Building Code'],
    certifications: ['ENERGY STAR preferred', 'LEED certification preferred']
  },
  
  timeline: {
    expressionOfInterestDue: new Date('2024-12-15'),
    marketSurveyDate: new Date('2025-01-10'),
    proposalDueDate: new Date('2025-01-30'),
    awardDate: new Date('2025-03-15'),
    occupancyDate: new Date('2025-06-01'),
    moveInDate: new Date('2025-06-01'),
    keyMilestones: [
      { name: 'Site visits begin', date: new Date('2025-01-12'), description: 'Government site inspections' },
      { name: 'Final proposals due', date: new Date('2025-01-30'), description: 'No late submissions accepted' },
      { name: 'Award announcement', date: new Date('2025-03-15'), description: 'Successful offeror notification' }
    ]
  },
  
  submissionRequirements: {
    requiredDocuments: [
      'Building site/lot plans',
      'Interior layout drawings with dimensions',
      'Current floor plan',
      'Parking layout and count verification',
      'Building systems condition report',
      'ABAAS compliance confirmation',
      'Seismic safety standards confirmation',
      'Fire protection & life safety confirmation',
      'Environmental assessment (if required)',
      'Owner authorization letter (if agent submitting)'
    ],
    samRegistrationRequired: true,
    authorizationLetters: { 
      required: true, 
      description: 'Written authorization from property owner required if submitted by agent' 
    },
    photoPermissions: true,
    buildingInspectionRequired: true,
    ownershipDocumentation: ['Title documentation', 'Property deed', 'Lease authority documentation'],
    contactInformation: {
      primaryContact: {
        name: 'Stephen Paulsen',
        title: 'Realty Specialist',
        email: 'Stephen.paulsen@usda.gov',
        phone: '919-873-2155'
      },
      secondaryContact: {
        name: 'Theresa Black',
        title: 'Lease Contracting Officer',
        email: 'Theresa.black@usda.gov',
        phone: '919-376-8839'
      }
    }
  },
  
  contactInfo: {
    agency: 'USDA',
    department: 'Farm Production and Conservation Business Center',
    division: 'FPAC-BC',
    projectManager: {
      name: 'Stephen Paulsen',
      title: 'Realty Specialist',
      email: 'Stephen.paulsen@usda.gov',
      phone: '919-873-2155'
    },
    contractingOfficer: {
      name: 'Theresa Black',
      title: 'Lease Contracting Officer',
      email: 'Theresa.black@usda.gov',
      phone: '919-376-8839'
    }
  },
  
  keyPhrases: [
    'fire safety', 'accessibility', 'seismic safety', 'flood plain restrictions', 
    'Section 889 compliance', 'fully serviced lease', 'government vehicle parking',
    'ABAAS standards', 'telecommunications prohibitions'
  ],
  warnings: [
    'Flood zone restrictions are critical deal-breakers',
    'Section 889 telecommunications compliance audit required',
    'Fire sprinkler and alarm systems are mandatory',
    'ABAAS accessibility compliance is non-negotiable'
  ],
  notes: [
    'Fully serviced lease required - all utilities included',
    'Government vehicle parking is essential',
    'Long-term lease (20 years) with government tenant',
    'No security deposit required for government lease'
  ],
  
  processingModel: '@cf/meta/llama-3.1-8b-instruct',
  extractionMethod: 'ai',
  reviewStatus: 'approved'
};

// Test properties in St. Cloud, FL area
const TEST_PROPERTIES = [
  {
    id: 'prop-st-cloud-prime',
    title: 'St. Cloud Professional Center',
    address: '1200 Main Street, St Cloud, FL 34769',
    coords: { lat: 28.2916, lng: -81.4071 },
    squareFeet: 4350,
    monthlyRent: 13050, // $3.00/sqft
    spaceType: 'office',
    parking: { total: 40, reserved: 25, ada: 3, onSite: true },
    compliance: {
      ada: true,
      fireCode: true,
      floodZone: false, // Not in flood zone
      sprinklerSystem: true,
      fireAlarm: true,
      section889: true
    },
    amenities: ['Fire sprinkler system', 'Fire alarm system', 'ADA compliant', 'On-site parking', 'ENERGY STAR'],
    buildingYear: 2015,
    lastInspection: '2024-06-15'
  },
  {
    id: 'prop-st-cloud-budget',
    title: 'Osceola Commerce Park',
    address: '5600 Commerce Boulevard, St Cloud, FL 34771',
    coords: { lat: 28.3156, lng: -81.3891 },
    squareFeet: 4200,
    monthlyRent: 10500, // $2.50/sqft
    spaceType: 'office',
    parking: { total: 30, reserved: 18, ada: 2, onSite: true },
    compliance: {
      ada: true,
      fireCode: false, // Missing fire sprinkler system
      floodZone: false,
      sprinklerSystem: false, // Deal breaker
      fireAlarm: true,
      section889: true
    },
    amenities: ['Fire alarm system', 'ADA compliant', 'On-site parking'],
    buildingYear: 2008,
    lastInspection: '2024-03-20'
  },
  {
    id: 'prop-st-cloud-premium',
    title: 'Downtown St. Cloud Executive Plaza',
    address: '950 City Center Drive, St Cloud, FL 34769',
    coords: { lat: 28.2756, lng: -81.4128 },
    squareFeet: 4650,
    monthlyRent: 16275, // $3.50/sqft
    spaceType: 'office',
    parking: { total: 50, reserved: 30, ada: 4, onSite: true },
    compliance: {
      ada: true,
      fireCode: true,
      floodZone: true, // CRITICAL: In flood zone - deal breaker
      sprinklerSystem: true,
      fireAlarm: true,
      section889: true
    },
    amenities: ['Fire sprinkler system', 'Fire alarm system', 'ADA compliant', 'Covered parking', 'LEED certified'],
    buildingYear: 2018,
    lastInspection: '2024-09-10'
  },
  {
    id: 'prop-st-cloud-suburban',
    title: 'Osceola Business Center',
    address: '2400 Suburban Drive, St Cloud, FL 34772',
    coords: { lat: 28.2656, lng: -81.4528 },
    squareFeet: 4425,
    monthlyRent: 12407, // $2.80/sqft
    spaceType: 'office',
    parking: { total: 35, reserved: 20, ada: 2, onSite: false }, // Parking 400 feet away - issue
    compliance: {
      ada: true,
      fireCode: true,
      floodZone: false,
      sprinklerSystem: true,
      fireAlarm: true,
      section889: false // Section 889 compliance issue
    },
    amenities: ['Fire sprinkler system', 'Fire alarm system', 'ADA compliant'],
    buildingYear: 2012,
    lastInspection: '2024-05-30'
  }
];

// Test functions
export async function testUSDAMapIntegration() {
  console.log('🗺️ Testing USDA RFP Map Integration...\n');
  
  // Test 1: Proximity Requirements Extraction
  console.log('📍 Test 1: Proximity Requirements Extraction');
  const proximityReqs = extractProximityRequirements(USDA_RFP_TEST_DATA);
  console.log(`✅ Extracted ${proximityReqs.length} proximity requirements`);
  proximityReqs.forEach(req => {
    console.log(`   - ${req.description}: ${req.distance} ${req.unit} (${req.required ? 'Required' : 'Preferred'})`);
  });
  console.log('');

  // Test 2: Geographic Boundary Validation
  console.log('🗺️ Test 2: Geographic Boundary Validation');
  const targetZipCodes = USDA_RFP_TEST_DATA.locationCriteria.zipCodes || [];
  console.log(`✅ Target zip codes: ${targetZipCodes.join(', ')}`);
  
  TEST_PROPERTIES.forEach(property => {
    const propertyZip = property.address.match(/\b(\d{5})\b/)?.[1];
    const inTargetArea = propertyZip && targetZipCodes.includes(propertyZip);
    console.log(`   - ${property.title}: ${propertyZip} ${inTargetArea ? '✅ In target area' : '❌ Outside target area'}`);
  });
  console.log('');

  // Test 3: Distance Calculations
  console.log('📏 Test 3: Distance Calculations');
  const stCloudCenter = { lat: 28.2916, lng: -81.4071 };
  TEST_PROPERTIES.forEach(property => {
    const distance = calculateDistance(stCloudCenter, property.coords, 'miles');
    console.log(`   - ${property.title}: ${distance.toFixed(2)} miles from city center`);
  });
  console.log('');

  // Test 4: Proximity Compliance Analysis
  console.log('🔍 Test 4: Proximity Compliance Analysis');
  const pois = getSamplePOIs('St Cloud', 'FL');
  console.log(`✅ Loaded ${pois.length} points of interest for St. Cloud, FL`);
  
  TEST_PROPERTIES.forEach(property => {
    const analysis = analyzeProximityCompliance(
      property.coords,
      proximityReqs,
      property.id,
      pois
    );
    console.log(`   - ${property.title}:`);
    console.log(`     Overall compliance: ${analysis.overallCompliance ? '✅ Compliant' : '❌ Non-compliant'}`);
    console.log(`     Proximity score: ${analysis.score}/100`);
    analysis.results.forEach(result => {
      const status = result.compliant ? '✅' : '❌';
      console.log(`     ${status} ${result.requirement.description}: ${result.distance.details}`);
    });
  });
  console.log('');

  // Test 5: Space Requirements Matching
  console.log('📐 Test 5: Space Requirements Matching');
  const spaceReqs = USDA_RFP_TEST_DATA.spaceRequirements;
  console.log(`✅ Required: ${spaceReqs.minSquareFeet} - ${spaceReqs.maxSquareFeet} sq ft (${spaceReqs.measurementType})`);
  
  TEST_PROPERTIES.forEach(property => {
    const meetsSize = property.squareFeet >= (spaceReqs.minSquareFeet || 0) && 
                      property.squareFeet <= (spaceReqs.maxSquareFeet || Infinity);
    const sizeScore = meetsSize ? 100 : 
      property.squareFeet < (spaceReqs.minSquareFeet || 0) ? 50 : 75; // Too small is worse than too big
    
    console.log(`   - ${property.title}: ${property.squareFeet.toLocaleString()} sq ft ${meetsSize ? '✅' : '❌'} (Score: ${sizeScore})`);
  });
  console.log('');

  // Test 6: Parking Requirements Analysis
  console.log('🚗 Test 6: Parking Requirements Analysis');
  const parkingReqs = USDA_RFP_TEST_DATA.parkingRequirements;
  const totalRequired = (parkingReqs.reservedGovernmentSpaces || 0) + 
                       (parkingReqs.reservedVisitorSpaces || 0) + 
                       (parkingReqs.nonReservedEmployeeSpaces || 0);
  console.log(`✅ Required parking: ${totalRequired} total spaces (${parkingReqs.reservedGovernmentSpaces} gov + ${parkingReqs.reservedVisitorSpaces} visitor + ${parkingReqs.nonReservedEmployeeSpaces} employee)`);
  
  TEST_PROPERTIES.forEach(property => {
    const meetsCount = (property.parking?.total || 0) >= totalRequired;
    const onSiteCompliant = parkingReqs.onSiteRequired ? property.parking?.onSite !== false : true;
    const parkingScore = (meetsCount ? 50 : 0) + (onSiteCompliant ? 50 : 0);
    
    console.log(`   - ${property.title}: ${property.parking?.total || 0} spaces ${meetsCount ? '✅' : '❌'} | On-site: ${onSiteCompliant ? '✅' : '❌'} (Score: ${parkingScore})`);
  });
  console.log('');

  // Test 7: Compliance Deal-Breakers
  console.log('⚠️ Test 7: Compliance Deal-Breakers Analysis');
  const complianceReqs = USDA_RFP_TEST_DATA.complianceRequirements;
  
  TEST_PROPERTIES.forEach(property => {
    const dealBreakers: string[] = [];
    
    // Flood zone check (critical)
    if (complianceReqs.environmentalRequirements?.floodZoneRestrictions?.prohibited && property.compliance.floodZone) {
      dealBreakers.push('Located in prohibited flood zone');
    }
    
    // Fire safety systems (critical)
    if (complianceReqs.fireLifeSafety?.required && !property.compliance.sprinklerSystem) {
      dealBreakers.push('Missing required fire sprinkler system');
    }
    
    // Section 889 compliance (critical)
    if (complianceReqs.securityRequirements?.telecommunicationsRestrictions?.section889Compliance && !property.compliance.section889) {
      dealBreakers.push('Section 889 telecommunications compliance required');
    }
    
    // ADA compliance (critical)
    if (complianceReqs.accessibility?.required && !property.compliance.ada) {
      dealBreakers.push('ADA/ABAAS accessibility compliance required');
    }
    
    console.log(`   - ${property.title}:`);
    if (dealBreakers.length === 0) {
      console.log(`     ✅ No critical compliance issues`);
    } else {
      dealBreakers.forEach(issue => {
        console.log(`     ❌ DEAL BREAKER: ${issue}`);
      });
    }
  });
  console.log('');

  // Test 8: Financial Requirements Check
  console.log('💰 Test 8: Financial Requirements Analysis');
  const financialReqs = USDA_RFP_TEST_DATA.financialRequirements;
  const maxBudget = financialReqs.budgetRange?.max || Infinity;
  const maxPSF = financialReqs.pricePerSquareFoot?.max || Infinity;
  
  console.log(`✅ Budget limit: $${maxBudget.toLocaleString()}/month | Max PSF: $${maxPSF}/sq ft`);
  
  TEST_PROPERTIES.forEach(property => {
    const withinBudget = property.monthlyRent <= maxBudget;
    const psf = property.monthlyRent / property.squareFeet;
    const withinPSF = psf <= maxPSF;
    const financialScore = (withinBudget ? 50 : 0) + (withinPSF ? 50 : 0);
    
    console.log(`   - ${property.title}: $${property.monthlyRent.toLocaleString()}/month | $${psf.toFixed(2)}/sqft ${withinBudget && withinPSF ? '✅' : '❌'} (Score: ${financialScore})`);
  });
  console.log('');

  // Test 9: Overall Property Ranking
  console.log('🏆 Test 9: Overall Property Ranking');
  
  interface PropertyScore {
    property: typeof TEST_PROPERTIES[0];
    scores: {
      location: number;
      space: number;
      parking: number;
      compliance: number;
      financial: number;
      total: number;
    };
    dealBreakers: string[];
  }

  const scoredProperties: PropertyScore[] = TEST_PROPERTIES.map(property => {
    // Location score (zip code + distance)
    const propertyZip = property.address.match(/\b(\d{5})\b/)?.[1];
    const inTargetArea = propertyZip && targetZipCodes.includes(propertyZip);
    const distance = calculateDistance(stCloudCenter, property.coords, 'miles');
    const locationScore = (inTargetArea ? 70 : 0) + Math.max(0, 30 - distance * 10);

    // Space score
    const meetsSize = property.squareFeet >= (spaceReqs.minSquareFeet || 0) && 
                      property.squareFeet <= (spaceReqs.maxSquareFeet || Infinity);
    const spaceScore = meetsSize ? 100 : property.squareFeet < (spaceReqs.minSquareFeet || 0) ? 50 : 75;

    // Parking score
    const meetsCount = (property.parking?.total || 0) >= totalRequired;
    const onSiteCompliant = parkingReqs.onSiteRequired ? property.parking?.onSite !== false : true;
    const parkingScore = (meetsCount ? 50 : 0) + (onSiteCompliant ? 50 : 0);

    // Compliance score and deal breakers
    const dealBreakers: string[] = [];
    let complianceScore = 100;

    if (complianceReqs.environmentalRequirements?.floodZoneRestrictions?.prohibited && property.compliance.floodZone) {
      dealBreakers.push('Located in prohibited flood zone');
      complianceScore = 0;
    }
    if (complianceReqs.fireLifeSafety?.required && !property.compliance.sprinklerSystem) {
      dealBreakers.push('Missing required fire sprinkler system');
      complianceScore -= 30;
    }
    if (complianceReqs.securityRequirements?.telecommunicationsRestrictions?.section889Compliance && !property.compliance.section889) {
      dealBreakers.push('Section 889 telecommunications compliance required');
      complianceScore -= 25;
    }
    if (complianceReqs.accessibility?.required && !property.compliance.ada) {
      dealBreakers.push('ADA/ABAAS accessibility compliance required');
      complianceScore -= 25;
    }

    // Financial score
    const withinBudget = property.monthlyRent <= maxBudget;
    const psf = property.monthlyRent / property.squareFeet;
    const withinPSF = psf <= maxPSF;
    const financialScore = (withinBudget ? 50 : 0) + (withinPSF ? 50 : 0);

    // Total score (weighted)
    const totalScore = Math.round(
      (locationScore * 0.25) +
      (spaceScore * 0.20) +
      (parkingScore * 0.15) +
      (complianceScore * 0.25) +
      (financialScore * 0.15)
    );

    return {
      property,
      scores: {
        location: Math.round(locationScore),
        space: Math.round(spaceScore),
        parking: Math.round(parkingScore),
        compliance: Math.round(complianceScore),
        financial: Math.round(financialScore),
        total: totalScore
      },
      dealBreakers
    };
  });

  // Sort by total score (descending)
  scoredProperties.sort((a, b) => b.scores.total - a.scores.total);

  scoredProperties.forEach((scored, index) => {
    const rank = index + 1;
    const property = scored.property;
    const scores = scored.scores;
    
    console.log(`   ${rank}. ${property.title} - ${scores.total}/100`);
    console.log(`      Location: ${scores.location} | Space: ${scores.space} | Parking: ${scores.parking} | Compliance: ${scores.compliance} | Financial: ${scores.financial}`);
    
    if (scored.dealBreakers.length > 0) {
      console.log(`      ❌ Deal Breakers: ${scored.dealBreakers.join(', ')}`);
    } else {
      console.log(`      ✅ No deal breakers - Viable candidate`);
    }
  });

  console.log('\n🎯 Test Summary:');
  console.log(`✅ Top ranked property: ${scoredProperties[0].property.title} (${scoredProperties[0].scores.total}/100)`);
  console.log(`✅ Viable candidates: ${scoredProperties.filter(p => p.dealBreakers.length === 0).length}/${scoredProperties.length}`);
  console.log(`✅ Properties in target area: ${scoredProperties.filter(p => {
    const zip = p.property.address.match(/\b(\d{5})\b/)?.[1];
    return zip && targetZipCodes.includes(zip);
  }).length}/${scoredProperties.length}`);
  
  return {
    success: true,
    rfpData: USDA_RFP_TEST_DATA,
    properties: TEST_PROPERTIES,
    rankings: scoredProperties,
    topChoice: scoredProperties[0]
  };
}

// Export test data for use in components
export {
  USDA_RFP_TEST_DATA,
  TEST_PROPERTIES
};