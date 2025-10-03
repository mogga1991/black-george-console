// Enhanced RFP Extraction Schema
// Based on USDA RFP example and comprehensive government lease requirements

export interface RFPLocationCriteria {
  state?: string;
  city?: string;
  zipCodes?: string[];
  delineatedAreas?: string[];
  proximityRequirements?: {
    description: string;
    distance: number;
    unit: 'feet' | 'miles' | 'km';
  }[];
  geographicRestrictions?: string[];
  preferredLocations?: string[];
}

export interface RFPSpaceRequirements {
  minSquareFeet?: number;
  maxSquareFeet?: number;
  preferredSquareFeet?: number;
  measurementType: 'ABOA' | 'RSF' | 'gross' | 'net' | 'usable';
  spaceType: 'office' | 'industrial' | 'retail' | 'warehouse' | 'mixed' | 'other';
  floors?: number;
  ceilingHeight?: number;
  specialSpaceNeeds?: string[];
  layoutRequirements?: string[];
}

export interface RFPParkingRequirements {
  reservedGovernmentSpaces?: number;
  reservedVisitorSpaces?: number;
  reservedCustomerSpaces?: number;
  nonReservedEmployeeSpaces?: number;
  totalParkingSpaces?: number;
  onSiteRequired?: boolean;
  proximityToBuilding?: {
    maxDistance: number;
    unit: 'feet' | 'miles';
  };
  adaCompliantSpaces?: number;
  parkingType?: 'covered' | 'uncovered' | 'garage' | 'surface' | 'any';
}

export interface RFPLeaseTerms {
  fullTermMonths?: number;
  firmTermMonths?: number;
  terminationRights?: {
    noticeDays: number;
    conditions?: string[];
  };
  leaseType?: 'full-service' | 'modified-gross' | 'triple-net' | 'gross' | 'other';
  renewalOptions?: {
    periods: number;
    lengthMonths: number;
  };
  escalationClauses?: string[];
}

export interface RFPFinancialRequirements {
  budgetRange?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'monthly' | 'annually' | 'total';
  };
  pricePerSquareFoot?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'monthly' | 'annually';
  };
  operatingExpenses?: {
    included: boolean;
    estimatedAmount?: number;
    details?: string[];
  };
  utilities?: {
    included: boolean;
    types?: string[];
  };
  securityDeposit?: {
    required: boolean;
    amount?: number;
    description?: string;
  };
}

export interface RFPComplianceRequirements {
  fireLifeSafety: {
    required: boolean;
    standards?: string[];
    details?: string;
  };
  accessibility: {
    required: boolean;
    standards: 'ADA' | 'ABAAS' | 'other';
    details?: string;
  };
  seismicSafety: {
    required: boolean;
    standards?: string[];
    details?: string;
  };
  environmentalRequirements: {
    floodZoneRestrictions?: {
      prohibited: boolean;
      allowedZones?: string[];
      details?: string;
    };
    nepaCompliance?: boolean;
    sustainabilityStandards?: string[];
    environmentalAssessment?: boolean;
  };
  securityRequirements?: {
    clearanceLevel?: string;
    backgroundChecks?: boolean;
    accessControl?: string[];
    telecommunicationsRestrictions?: {
      section889Compliance?: boolean;
      details?: string;
    };
  };
  buildingCodes?: string[];
  certifications?: string[];
}

export interface RFPTimeline {
  expressionOfInterestDue?: Date;
  marketSurveyDate?: Date;
  proposalDueDate?: Date;
  awardDate?: Date;
  occupancyDate?: Date;
  moveInDate?: Date;
  keyMilestones?: {
    name: string;
    date: Date;
    description?: string;
  }[];
}

export interface RFPSubmissionRequirements {
  requiredDocuments?: string[];
  samRegistrationRequired?: boolean;
  authorizationLetters?: {
    required: boolean;
    description: string;
  };
  photoPermissions?: boolean;
  buildingInspectionRequired?: boolean;
  ownershipDocumentation?: string[];
  contactInformation?: {
    primaryContact: {
      name: string;
      title: string;
      email: string;
      phone?: string;
    };
    secondaryContact?: {
      name: string;
      title: string;
      email: string;
      phone?: string;
    };
  };
}

export interface RFPContactInfo {
  agency?: string;
  department?: string;
  division?: string;
  projectManager?: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
  contractingOfficer?: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
  technicalContact?: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
}

// Main RFP Extraction Result
export interface RFPExtractionResult {
  documentId: string;
  extractionId: string;
  extractionDate: Date;
  confidenceScore: number;
  
  // Basic Information
  title?: string;
  rfpNumber?: string;
  issuingAgency?: string;
  
  // Extracted Categories
  locationCriteria: RFPLocationCriteria;
  spaceRequirements: RFPSpaceRequirements;
  parkingRequirements: RFPParkingRequirements;
  leaseTerms: RFPLeaseTerms;
  financialRequirements: RFPFinancialRequirements;
  complianceRequirements: RFPComplianceRequirements;
  timeline: RFPTimeline;
  submissionRequirements: RFPSubmissionRequirements;
  contactInfo: RFPContactInfo;
  
  // Additional Information
  rawText?: string;
  keyPhrases?: string[];
  warnings?: string[];
  notes?: string[];
  
  // Processing Metadata
  processingModel: string;
  extractionMethod: 'ai' | 'hybrid' | 'manual';
  reviewStatus: 'pending' | 'reviewed' | 'approved' | 'rejected';
  reviewNotes?: string;
}

// Property Matching Criteria derived from RFP
export interface PropertyMatchingCriteria {
  required: {
    location: RFPLocationCriteria;
    space: RFPSpaceRequirements;
    parking: RFPParkingRequirements;
    compliance: RFPComplianceRequirements;
  };
  preferred: {
    financial: RFPFinancialRequirements;
    timeline: RFPTimeline;
    additionalFeatures: string[];
  };
  dealBreakers: string[];
  scoring: {
    locationWeight: number;
    spaceWeight: number;
    complianceWeight: number;
    financialWeight: number;
    timelineWeight: number;
  };
}