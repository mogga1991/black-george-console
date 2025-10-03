// Compliance checking and flagging system for RFP requirements
// Based on government standards and commercial real estate regulations

export interface ComplianceCheck {
  id: string;
  category: 'fire_safety' | 'accessibility' | 'seismic' | 'environmental' | 'security' | 'building_codes';
  name: string;
  description: string;
  required: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  standardReference?: string;
  checkFunction: (property: any, rfpRequirements: any) => ComplianceResult;
}

export interface ComplianceResult {
  passed: boolean;
  status: 'compliant' | 'non_compliant' | 'requires_verification' | 'not_applicable';
  details: string;
  recommendations?: string[];
  estimatedCost?: number;
  timeToResolve?: string;
  supportingDocuments?: string[];
}

export interface PropertyComplianceReport {
  propertyId: string;
  rfpDocumentId: string;
  overallStatus: 'compliant' | 'non_compliant' | 'requires_review';
  criticalIssues: string[];
  passedChecks: ComplianceResult[];
  failedChecks: ComplianceResult[];
  requiresVerification: ComplianceResult[];
  totalScore: number;
  generatedAt: Date;
  recommendations: string[];
}

// Compliance check definitions based on USDA RFP example
export const COMPLIANCE_CHECKS: ComplianceCheck[] = [
  // Fire Safety & Life Safety
  {
    id: 'fire_sprinkler_system',
    category: 'fire_safety',
    name: 'Fire Sprinkler System',
    description: 'Building must have an approved automatic fire sprinkler system',
    required: true,
    severity: 'critical',
    standardReference: 'NFPA 13, IFC',
    checkFunction: (property, rfp) => {
      const hasFireSystem = property.fireSuppressionSystem === 'sprinkler' || 
                           property.amenities?.includes('fire sprinkler system');
      
      return {
        passed: hasFireSystem,
        status: hasFireSystem ? 'compliant' : 'non_compliant',
        details: hasFireSystem ? 
          'Property has approved fire sprinkler system' : 
          'Property lacks required fire sprinkler system',
        recommendations: hasFireSystem ? [] : [
          'Install NFPA 13 compliant fire sprinkler system',
          'Obtain fire marshal approval',
          'Update building systems documentation'
        ],
        estimatedCost: hasFireSystem ? 0 : 25000,
        timeToResolve: hasFireSystem ? undefined : '3-6 months'
      };
    }
  },

  {
    id: 'fire_alarm_system',
    category: 'fire_safety',
    name: 'Fire Alarm System',
    description: 'Building must have addressable fire alarm system',
    required: true,
    severity: 'critical',
    standardReference: 'NFPA 72',
    checkFunction: (property, rfp) => {
      const hasFireAlarm = property.fireAlarmSystem || 
                          property.amenities?.includes('fire alarm system');
      
      return {
        passed: hasFireAlarm,
        status: hasFireAlarm ? 'compliant' : 'non_compliant',
        details: hasFireAlarm ? 
          'Building has approved fire alarm system' : 
          'Building lacks required fire alarm system',
        recommendations: hasFireAlarm ? [] : [
          'Install NFPA 72 compliant addressable fire alarm system',
          'Connect to central monitoring station',
          'Test and certify system'
        ],
        estimatedCost: hasFireAlarm ? 0 : 15000
      };
    }
  },

  // ADA/ABAAS Accessibility
  {
    id: 'ada_entrance',
    category: 'accessibility',
    name: 'ADA Accessible Entrance',
    description: 'At least one primary entrance must be ADA compliant',
    required: true,
    severity: 'critical',
    standardReference: 'ADA Standards, ABAAS',
    checkFunction: (property, rfp) => {
      const adaCompliant = property.adaCompliant === true || 
                          property.accessibility?.entrance === 'compliant';
      
      return {
        passed: adaCompliant,
        status: adaCompliant ? 'compliant' : 'non_compliant',
        details: adaCompliant ? 
          'Property has ADA compliant entrance' : 
          'Property entrance does not meet ADA requirements',
        recommendations: adaCompliant ? [] : [
          'Install ADA compliant automatic door operators',
          'Ensure 32" minimum clear width',
          'Install appropriate ramps and handrails',
          'Update signage to meet ADA standards'
        ],
        estimatedCost: adaCompliant ? 0 : 12000
      };
    }
  },

  {
    id: 'ada_restrooms',
    category: 'accessibility',
    name: 'ADA Compliant Restrooms',
    description: 'Restrooms must meet ADA accessibility standards',
    required: true,
    severity: 'high',
    standardReference: 'ADA Standards Section 604',
    checkFunction: (property, rfp) => {
      const adaRestrooms = property.accessibility?.restrooms === 'compliant' ||
                          property.amenities?.includes('ADA restrooms');
      
      return {
        passed: adaRestrooms,
        status: adaRestrooms ? 'compliant' : 'non_compliant',
        details: adaRestrooms ? 
          'Restrooms meet ADA requirements' : 
          'Restrooms require ADA compliance upgrades',
        recommendations: adaRestrooms ? [] : [
          'Renovate restrooms to ADA standards',
          'Install proper grab bars and fixtures',
          'Ensure adequate turning space (60" diameter)',
          'Update door hardware and signage'
        ],
        estimatedCost: adaRestrooms ? 0 : 8000
      };
    }
  },

  {
    id: 'ada_parking',
    category: 'accessibility',
    name: 'ADA Parking Spaces',
    description: 'Required number of accessible parking spaces',
    required: true,
    severity: 'high',
    standardReference: 'ADA Standards Section 208',
    checkFunction: (property, rfp) => {
      const totalSpaces = property.parking?.total || 0;
      const requiredAdaSpaces = Math.ceil(totalSpaces * 0.04); // 4% minimum
      const actualAdaSpaces = property.parking?.adaCompliant || 0;
      
      const compliant = actualAdaSpaces >= requiredAdaSpaces;
      
      return {
        passed: compliant,
        status: compliant ? 'compliant' : 'non_compliant',
        details: compliant ? 
          `Property has ${actualAdaSpaces} ADA parking spaces (${requiredAdaSpaces} required)` :
          `Property has ${actualAdaSpaces} ADA spaces but requires ${requiredAdaSpaces}`,
        recommendations: compliant ? [] : [
          `Designate ${requiredAdaSpaces - actualAdaSpaces} additional ADA parking spaces`,
          'Install proper ADA signage and markings',
          'Ensure accessible routes to building entrance',
          'Add van-accessible spaces if required'
        ],
        estimatedCost: compliant ? 0 : (requiredAdaSpaces - actualAdaSpaces) * 500
      };
    }
  },

  // Environmental Compliance
  {
    id: 'flood_zone_restriction',
    category: 'environmental',
    name: 'Flood Zone Compliance',
    description: 'Property must not be in 100-year or 500-year flood plain',
    required: true,
    severity: 'critical',
    standardReference: 'FEMA Flood Insurance Rate Maps',
    checkFunction: (property, rfp) => {
      const inFloodZone = property.floodZone === 'A' || 
                         property.floodZone === 'AE' ||
                         property.floodZone === 'V' ||
                         property.environmental?.floodZone === 'high_risk';
      
      return {
        passed: !inFloodZone,
        status: inFloodZone ? 'non_compliant' : 'compliant',
        details: inFloodZone ? 
          `Property is located in flood zone ${property.floodZone || 'high-risk area'}` :
          'Property is not located in restricted flood zone',
        recommendations: inFloodZone ? [
          'Property is disqualified due to flood zone restrictions',
          'Consider alternative properties outside flood zones',
          'Verify current FEMA flood maps'
        ] : [],
        estimatedCost: inFloodZone ? undefined : 0
      };
    }
  },

  {
    id: 'environmental_assessment',
    category: 'environmental',
    name: 'Environmental Site Assessment',
    description: 'Phase I Environmental Site Assessment required',
    required: true,
    severity: 'high',
    standardReference: 'ASTM E1527',
    checkFunction: (property, rfp) => {
      const hasAssessment = property.environmental?.phaseICompleted === true ||
                           property.documents?.includes('Phase I ESA');
      
      return {
        passed: hasAssessment,
        status: hasAssessment ? 'compliant' : 'requires_verification',
        details: hasAssessment ? 
          'Phase I Environmental Site Assessment completed' :
          'Phase I Environmental Site Assessment required before lease execution',
        recommendations: hasAssessment ? [] : [
          'Commission ASTM E1527 Phase I Environmental Site Assessment',
          'Review historical land use records',
          'Identify any recognized environmental conditions',
          'Obtain environmental insurance if needed'
        ],
        estimatedCost: hasAssessment ? 0 : 5000,
        timeToResolve: hasAssessment ? undefined : '2-4 weeks'
      };
    }
  },

  // Security Requirements
  {
    id: 'telecommunications_compliance',
    category: 'security',
    name: 'Section 889 Telecommunications Compliance',
    description: 'Building systems must comply with NDAA Section 889 restrictions',
    required: true,
    severity: 'critical',
    standardReference: 'NDAA Section 889, FAR Case 2019-009',
    checkFunction: (property, rfp) => {
      const compliantTelecom = property.security?.section889Compliant === true ||
                              property.telecommunications?.compliant === true;
      
      return {
        passed: compliantTelecom,
        status: compliantTelecom ? 'compliant' : 'requires_verification',
        details: compliantTelecom ? 
          'Building telecommunications systems comply with Section 889' :
          'Section 889 telecommunications compliance requires verification',
        recommendations: compliantTelecom ? [] : [
          'Audit all telecommunications and video surveillance equipment',
          'Remove any prohibited equipment (Huawei, ZTE, etc.)',
          'Obtain compliance certification from vendors',
          'Document compliance for government records'
        ],
        estimatedCost: compliantTelecom ? 0 : 25000
      };
    }
  },

  // Seismic Safety
  {
    id: 'seismic_safety',
    category: 'seismic',
    name: 'Seismic Safety Standards',
    description: 'Building must meet current seismic safety requirements',
    required: true,
    severity: 'high',
    standardReference: 'IBC Seismic Provisions',
    checkFunction: (property, rfp) => {
      const seismicCompliant = property.structural?.seismicCompliant === true ||
                              property.buildingYear >= 1990; // Simplified heuristic
      
      return {
        passed: seismicCompliant,
        status: seismicCompliant ? 'compliant' : 'requires_verification',
        details: seismicCompliant ? 
          'Building meets current seismic safety standards' :
          'Seismic safety evaluation required for older buildings',
        recommendations: seismicCompliant ? [] : [
          'Commission structural engineer seismic evaluation',
          'Perform seismic retrofitting if required',
          'Obtain seismic compliance certification',
          'Update building insurance coverage'
        ],
        estimatedCost: seismicCompliant ? 0 : 50000
      };
    }
  },

  // Building Codes
  {
    id: 'occupancy_certificate',
    category: 'building_codes',
    name: 'Certificate of Occupancy',
    description: 'Valid certificate of occupancy for intended use',
    required: true,
    severity: 'critical',
    standardReference: 'Local Building Code',
    checkFunction: (property, rfp) => {
      const validOccupancy = property.certificates?.occupancy === 'valid' ||
                            property.permits?.occupancy === true;
      
      return {
        passed: validOccupancy,
        status: validOccupancy ? 'compliant' : 'requires_verification',
        details: validOccupancy ? 
          'Property has valid certificate of occupancy' :
          'Certificate of occupancy status requires verification',
        recommendations: validOccupancy ? [] : [
          'Verify current certificate of occupancy',
          'Apply for change of use permit if needed',
          'Ensure compliance with zoning requirements',
          'Update occupancy classification if required'
        ],
        estimatedCost: validOccupancy ? 0 : 2000
      };
    }
  }
];

// Main compliance checking function
export function checkPropertyCompliance(
  property: any, 
  rfpRequirements: any
): PropertyComplianceReport {
  const results: ComplianceResult[] = [];
  const criticalIssues: string[] = [];
  let totalScore = 0;
  let maxScore = 0;

  // Run all compliance checks
  for (const check of COMPLIANCE_CHECKS) {
    const result = check.checkFunction(property, rfpRequirements);
    results.push({
      ...result,
      checkId: check.id,
      checkName: check.name,
      category: check.category,
      severity: check.severity
    } as any);

    // Calculate scoring
    const weight = check.severity === 'critical' ? 4 : 
                   check.severity === 'high' ? 3 :
                   check.severity === 'medium' ? 2 : 1;
    
    maxScore += weight;
    
    if (result.passed) {
      totalScore += weight;
    } else if (check.severity === 'critical') {
      criticalIssues.push(`${check.name}: ${result.details}`);
    }
  }

  // Categorize results
  const passedChecks = results.filter(r => r.passed);
  const failedChecks = results.filter(r => !r.passed && r.status === 'non_compliant');
  const requiresVerification = results.filter(r => r.status === 'requires_verification');

  // Determine overall status
  let overallStatus: 'compliant' | 'non_compliant' | 'requires_review';
  if (criticalIssues.length > 0) {
    overallStatus = 'non_compliant';
  } else if (requiresVerification.length > 0 || failedChecks.length > 0) {
    overallStatus = 'requires_review';
  } else {
    overallStatus = 'compliant';
  }

  // Generate recommendations
  const recommendations = [
    ...criticalIssues.map(issue => `CRITICAL: ${issue}`),
    ...failedChecks.flatMap(check => check.recommendations || []),
    ...requiresVerification.map(check => `VERIFY: ${check.details}`)
  ];

  return {
    propertyId: property.id,
    rfpDocumentId: rfpRequirements.documentId,
    overallStatus,
    criticalIssues,
    passedChecks,
    failedChecks,
    requiresVerification,
    totalScore: Math.round((totalScore / maxScore) * 100),
    generatedAt: new Date(),
    recommendations: [...new Set(recommendations)] // Remove duplicates
  };
}

// Helper function to get compliance status badge info
export function getComplianceStatusInfo(status: string) {
  switch (status) {
    case 'compliant':
      return {
        color: 'bg-green-100 text-green-800',
        icon: 'CheckCircle',
        label: 'Compliant'
      };
    case 'non_compliant':
      return {
        color: 'bg-red-100 text-red-800',
        icon: 'XCircle',
        label: 'Non-Compliant'
      };
    case 'requires_review':
      return {
        color: 'bg-yellow-100 text-yellow-800',
        icon: 'AlertTriangle',
        label: 'Requires Review'
      };
    default:
      return {
        color: 'bg-gray-100 text-gray-800',
        icon: 'HelpCircle',
        label: 'Unknown'
      };
  }
}

// Compliance category information
export const COMPLIANCE_CATEGORIES = {
  fire_safety: {
    name: 'Fire Safety',
    icon: 'Flame',
    description: 'Fire suppression and life safety systems'
  },
  accessibility: {
    name: 'Accessibility',
    icon: 'Users',
    description: 'ADA and ABAAS compliance requirements'
  },
  seismic: {
    name: 'Seismic Safety',
    icon: 'Mountain',
    description: 'Earthquake safety and structural integrity'
  },
  environmental: {
    name: 'Environmental',
    icon: 'Globe',
    description: 'Environmental assessments and restrictions'
  },
  security: {
    name: 'Security',
    icon: 'Shield',
    description: 'Government security and telecommunications requirements'
  },
  building_codes: {
    name: 'Building Codes',
    icon: 'FileText',
    description: 'Local building code and permit compliance'
  }
};