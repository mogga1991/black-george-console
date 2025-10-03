// Types for Government RFP Opportunities

export type RFPStatus = 'open' | 'closed' | 'awarded' | 'cancelled' | 'draft';
export type RFPType = 'rfp' | 'rfq' | 'ifb' | 'sources_sought' | 'presolicitation';
export type ProcurementMethod = 'sealed_bidding' | 'competitive_proposal' | 'simplified_acquisition' | 'sole_source';
export type SetAsideType = 'none' | 'small_business' | '8a' | 'hubzone' | 'wosb' | 'vosb' | 'sdvosb';

export interface ContactInfo {
  name: string;
  title: string;
  email: string;
  phone?: string;
  organization?: string;
}

export interface LocationRequirements {
  state?: string;
  city?: string;
  zipCodes?: string[];
  country?: string;
  proximityRequirements?: Array<{
    description: string;
    distance: number;
    unit: 'feet' | 'miles' | 'meters' | 'kilometers';
  }>;
}

export interface SpaceRequirements {
  minSquareFeet?: number;
  maxSquareFeet?: number;
  preferredSquareFeet?: number;
  propertyType?: string;
  floors?: number;
  specialRequirements?: string[];
}

export interface BudgetRange {
  min?: number;
  max?: number;
  currency: string;
  period?: 'monthly' | 'annually' | 'total';
}

export interface ComplianceRequirements {
  accessibility?: {
    required: boolean;
    standards?: string[];
    details?: string;
  };
  environmental?: {
    floodZone?: boolean;
    sustainabilityStandards?: string[];
    details?: string;
  };
  security?: {
    requirements?: string[];
    details?: string;
  };
  fireLifeSafety?: {
    required: boolean;
    standards?: string[];
    details?: string;
  };
}

export interface RFPDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  fileSize?: number;
  mimeType?: string;
  extractedText?: string;
  aiAnalysis?: any;
}

export interface RFPOpportunity {
  id: string;
  solicitationNumber: string;
  title: string;
  description?: string;
  synopsis?: string;
  
  // Agency Information
  issuingAgency: string;
  agencyCode?: string;
  subAgency?: string;
  officeAddress?: string;
  
  // Opportunity Details
  rfpType: RFPType;
  status: RFPStatus;
  procurementMethod?: ProcurementMethod;
  setAsideType: SetAsideType;
  
  // Commercial Real Estate Specific
  naicsCodes: string[];
  propertyType?: string;
  spaceRequirements?: SpaceRequirements;
  locationRequirements?: LocationRequirements;
  
  // Financial Information
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  budgetRange?: BudgetRange;
  
  // Timeline
  postedDate?: Date;
  responseDueDate?: Date;
  questionsDueDate?: Date;
  proposalDueDate?: Date;
  estimatedAwardDate?: Date;
  performanceStartDate?: Date;
  performanceEndDate?: Date;
  
  // Location Data
  placeOfPerformanceState?: string;
  placeOfPerformanceCity?: string;
  placeOfPerformanceZip?: string;
  placeOfPerformanceCountry?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  
  // Contact Information
  contactInfo?: {
    primaryContact?: ContactInfo;
    contractingOfficer?: ContactInfo;
    additionalContacts?: ContactInfo[];
  };
  
  // Documents and Links
  samGovUrl?: string;
  documents?: RFPDocument[];
  
  // Compliance and Requirements
  complianceRequirements?: ComplianceRequirements;
  specialRequirements?: string[];
  
  // AI Analysis Fields
  aiSummary?: string;
  commercialRealEstateScore?: number; // 0-100
  keyHighlights?: string[];
  riskFactors?: string[];
  
  // Data Source and Processing
  source: string;
  sourceId?: string;
  lastUpdatedAtSource?: Date;
  extractionConfidence?: number; // 0-1
  
  // System Fields
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  tags?: string[];
}

export interface PropertyMatch {
  id: string;
  rfpOpportunityId: string;
  propertyId: string;
  
  // Property Details (from existing properties table)
  property: {
    id: string;
    title: string;
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
    coords?: { lat: number; lng: number };
    squareFeet?: number;
    monthlyRent?: number;
    spaceType?: string;
    imageUrl?: string;
    parking?: {
      total: number;
      reserved?: number;
      ada?: number;
    };
    amenities?: string[];
    compliance?: {
      ada?: boolean;
      fireCode?: boolean;
      floodZone?: boolean;
      sprinklerSystem?: boolean;
      fireAlarm?: boolean;
    };
  };
  
  // Matching Scores
  overallMatchScore: number; // 0-100
  locationScore?: number;
  spaceScore?: number;
  financialScore?: number;
  complianceScore?: number;
  timelineScore?: number;
  
  // Match Analysis
  advantages?: string[];
  disadvantages?: string[];
  dealBreakers?: string[];
  complianceIssues?: string[];
  
  // AI Analysis
  aiRecommendation?: string;
  confidenceLevel?: number; // 0-1
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RFPMapFilters {
  minMatchScore: number;
  maxRent?: number;
  minSize?: number;
  maxSize?: number;
  spaceTypes: string[];
  rfpTypes: RFPType[];
  states: string[];
  agencies: string[];
  showCompliant: boolean;
  showNonCompliant: boolean;
  showDealBreakers: boolean;
  showBoundaries: boolean;
  showComplianceIndicators: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface RFPNotificationPreferences {
  id: string;
  userId: string;
  
  // Geographic Filters
  states?: string[];
  cities?: string[];
  zipCodes?: string[];
  
  // Opportunity Filters
  rfpTypes?: RFPType[];
  minValue?: number;
  maxValue?: number;
  propertyTypes?: string[];
  naicsCodes?: string[];
  
  // Notification Settings
  emailNotifications: boolean;
  instantNotifications: boolean;
  dailyDigest: boolean;
  weeklySummary: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface SAMGovOpportunity {
  opportunityId: string;
  title: string;
  solicitationNumber: string;
  fullParentPathName: string;
  fullParentPathCode: string;
  postedDate: string;
  type: string;
  baseType: string;
  archiveType: string;
  archiveDate?: string;
  typeOfSetAsideDescription?: string;
  typeOfSetAside?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  classificationCode?: string;
  active: string;
  award?: {
    date: string;
    number: string;
    amount: string;
    awardee: {
      name: string;
      location: {
        streetAddress: string;
        city: {
          code: string;
          name: string;
        };
        state: {
          code: string;
          name: string;
        };
        zip: string;
        country: {
          code: string;
          name: string;
        };
      };
    };
  };
  pointOfContact?: Array<{
    fax?: string;
    type: string;
    email?: string;
    phone?: string;
    title?: string;
    fullName?: string;
  }>;
  placeOfPerformance?: {
    streetAddress?: string;
    city?: {
      code: string;
      name: string;
    };
    state?: {
      code: string;
      name: string;
    };
    zip?: string;
    country?: {
      code: string;
      name: string;
    };
  };
  additionalInfoLink?: string;
  uiLink?: string;
}

export interface SAMGovApiResponse {
  opportunitiesData: SAMGovOpportunity[];
  links: Array<{
    rel: string;
    href: string;
  }>;
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}