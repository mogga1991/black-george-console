// Notion API client without SDK dependency
// Using direct API calls to avoid dependency conflicts

export interface NotionProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  buildingTypes: string[];
  squareFootage: number;
  ratePerSF: number;
  availabilityDate: string;
  maxContiguous?: number;
  parkingSpaces?: number;
  ceilingHeight?: string;
  loadingDocks?: number;
  power?: string;
  hvac?: string;
  securityFeatures?: string[];
  proximityTransit?: string;
  zoning?: string;
  specialFeatures?: string[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  status: string;
  gsaApproved?: boolean;
  securityClearance?: string;
  lastUpdated: string;
}

export interface NotionQueryFilters {
  buildingTypes?: string[];
  minSquareFootage?: number;
  maxSquareFootage?: number;
  maxRatePerSF?: number;
  cities?: string[];
  states?: string[];
  gsaApproved?: boolean;
  status?: string[];
}

export interface RFPRequirements {
  location?: {
    cities?: string[];
    states?: string[];
    regions?: string[];
    proximityRequirements?: string[];
  };
  space?: {
    minSquareFootage?: number;
    maxSquareFootage?: number;
    ceilingHeight?: string;
    specialSpaces?: string[];
    accessibilityRequirements?: string[];
  };
  technical?: {
    powerRequirements?: string;
    hvacSpecs?: string;
    itInfrastructure?: string[];
    loadingDocks?: number;
    parkingMinimum?: number;
  };
  leaseTerms?: {
    duration?: string;
    occupancyDate?: string;
    maxBudgetPerSF?: number;
    governmentTerms?: string[];
  };
  security?: {
    clearanceLevel?: string;
    securityFeatures?: string[];
    complianceRequirements?: string[];
  };
  compliance?: {
    gsaRequired?: boolean;
    environmentalCerts?: string[];
    historicPreservation?: boolean;
    buyAmericanAct?: boolean;
  };
}

export interface PropertyMatch {
  property: NotionProperty;
  score: number;
  matchReasons: string[];
  category: 'excellent' | 'good' | 'fair' | 'poor';
}

class NotionClient {
  private apiToken: string;
  private databaseId: string;
  private baseUrl = 'https://api.notion.com/v1';

  constructor(apiToken: string, databaseId: string) {
    this.apiToken = apiToken;
    this.databaseId = databaseId;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async queryProperties(filters?: NotionQueryFilters): Promise<NotionProperty[]> {
    const body: any = {
      page_size: 100,
    };

    // Build Notion filters
    if (filters) {
      body.filter = this.buildNotionFilters(filters);
    }

    // Add sorting
    body.sorts = [
      {
        property: 'Last Updated',
        direction: 'descending'
      }
    ];

    const response = await this.makeRequest(`/databases/${this.databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return response.results.map((page: any) => this.parseNotionPage(page));
  }

  async getPropertyById(propertyId: string): Promise<NotionProperty | null> {
    try {
      const response = await this.makeRequest(`/pages/${propertyId}`);
      return this.parseNotionPage(response);
    } catch (error) {
      console.error('Error fetching property:', error);
      return null;
    }
  }

  async searchProperties(query: string): Promise<NotionProperty[]> {
    const response = await this.makeRequest(`/databases/${this.databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          or: [
            {
              property: 'Address',
              rich_text: {
                contains: query
              }
            },
            {
              property: 'City',
              select: {
                equals: query
              }
            },
            {
              property: 'Description',
              rich_text: {
                contains: query
              }
            }
          ]
        },
        page_size: 50,
      }),
    });

    return response.results.map((page: any) => this.parseNotionPage(page));
  }

  private buildNotionFilters(filters: NotionQueryFilters): any {
    const conditions: any[] = [];

    if (filters.buildingTypes && filters.buildingTypes.length > 0) {
      conditions.push({
        property: 'Building Types',
        multi_select: {
          contains: filters.buildingTypes[0] // Notion doesn't support multiple contains
        }
      });
    }

    if (filters.minSquareFootage) {
      conditions.push({
        property: 'Square Footage',
        number: {
          greater_than_or_equal_to: filters.minSquareFootage
        }
      });
    }

    if (filters.maxSquareFootage) {
      conditions.push({
        property: 'Square Footage',
        number: {
          less_than_or_equal_to: filters.maxSquareFootage
        }
      });
    }

    if (filters.maxRatePerSF) {
      conditions.push({
        property: 'Rate Per SF',
        number: {
          less_than_or_equal_to: filters.maxRatePerSF
        }
      });
    }

    if (filters.cities && filters.cities.length > 0) {
      conditions.push({
        property: 'City',
        select: {
          equals: filters.cities[0] // Use first city for simplicity
        }
      });
    }

    if (filters.gsaApproved !== undefined) {
      conditions.push({
        property: 'GSA Approved',
        checkbox: {
          equals: filters.gsaApproved
        }
      });
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push({
        property: 'Status',
        select: {
          equals: filters.status[0]
        }
      });
    }

    if (conditions.length === 0) {
      return undefined;
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return {
      and: conditions
    };
  }

  private parseNotionPage(page: any): NotionProperty {
    const props = page.properties;

    return {
      id: page.id,
      name: this.getPropertyValue(props['Property ID']) || '',
      address: this.getPropertyValue(props['Address']) || '',
      city: this.getPropertyValue(props['City']) || '',
      state: this.getPropertyValue(props['State']) || '',
      zipCode: this.getPropertyValue(props['Zip Code']) || '',
      buildingTypes: this.getMultiSelectValues(props['Building Types']) || [],
      squareFootage: this.getPropertyValue(props['Square Footage']) || 0,
      ratePerSF: this.getPropertyValue(props['Rate Per SF']) || 0,
      availabilityDate: this.getPropertyValue(props['Availability Date']) || '',
      maxContiguous: this.getPropertyValue(props['Max Contiguous']),
      parkingSpaces: this.getPropertyValue(props['Parking Spaces']),
      ceilingHeight: this.getPropertyValue(props['Ceiling Height']),
      loadingDocks: this.getPropertyValue(props['Loading Docks']),
      power: this.getPropertyValue(props['Power']),
      hvac: this.getPropertyValue(props['HVAC']),
      securityFeatures: this.getMultiSelectValues(props['Security Features']),
      proximityTransit: this.getPropertyValue(props['Proximity Transit']),
      zoning: this.getPropertyValue(props['Zoning']),
      specialFeatures: this.getMultiSelectValues(props['Special Features']),
      contactName: this.getPropertyValue(props['Contact Name']),
      contactEmail: this.getPropertyValue(props['Contact Email']),
      contactPhone: this.getPropertyValue(props['Contact Phone']),
      latitude: this.getPropertyValue(props['Latitude']),
      longitude: this.getPropertyValue(props['Longitude']),
      description: this.getPropertyValue(props['Description']),
      status: this.getPropertyValue(props['Status']) || 'Unknown',
      gsaApproved: this.getPropertyValue(props['GSA Approved']) || false,
      securityClearance: this.getPropertyValue(props['Security Clearance']),
      lastUpdated: this.getPropertyValue(props['Last Updated']) || new Date().toISOString(),
    };
  }

  private getPropertyValue(property: any): any {
    if (!property) return null;

    switch (property.type) {
      case 'title':
        return property.title[0]?.plain_text || '';
      case 'rich_text':
        return property.rich_text[0]?.plain_text || '';
      case 'number':
        return property.number;
      case 'select':
        return property.select?.name || '';
      case 'checkbox':
        return property.checkbox;
      case 'date':
        return property.date?.start || '';
      case 'email':
        return property.email || '';
      case 'phone_number':
        return property.phone_number || '';
      default:
        return null;
    }
  }

  private getMultiSelectValues(property: any): string[] {
    if (!property || property.type !== 'multi_select') return [];
    return property.multi_select.map((item: any) => item.name);
  }
}

// Singleton instance
let notionClient: NotionClient | null = null;

export function getNotionClient(): NotionClient {
  if (!notionClient) {
    const apiToken = process.env.NOTION_API_TOKEN || process.env.NEXT_PUBLIC_NOTION_API_TOKEN;
    const databaseId = process.env.NOTION_PROPERTIES_DATABASE_ID || process.env.NEXT_PUBLIC_NOTION_PROPERTIES_DATABASE_ID;

    if (!apiToken || !databaseId) {
      throw new Error('Notion API token and database ID are required');
    }

    notionClient = new NotionClient(apiToken, databaseId);
  }

  return notionClient;
}

export { NotionClient };