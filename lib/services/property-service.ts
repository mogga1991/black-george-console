// Property Service - Fetches real properties from Supabase and applies RFP matching

import { createClient } from '@/lib/supabase/client';
import { CREProperty, RFPRequirements, PropertyMatch, findMatchingProperties } from '@/lib/property-matching';

export class PropertyService {
  private supabase = createClient();

  // Fetch all properties from Supabase
  async fetchAllProperties(): Promise<CREProperty[]> {
    try {
      const { data, error } = await this.supabase
        .from('cre_properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        return [];
      }

      return data as CREProperty[];
    } catch (error) {
      console.error('Error in fetchAllProperties:', error);
      return [];
    }
  }

  // Fetch properties that match RFP requirements
  async fetchMatchingProperties(
    requirements: RFPRequirements,
    minScore: number = 30
  ): Promise<PropertyMatch[]> {
    try {
      // Start with location filtering for efficiency
      let query = this.supabase.from('cre_properties').select('*');

      // Apply location filters at database level for performance
      if (requirements.locationCriteria.state) {
        query = query.ilike('state', requirements.locationCriteria.state);
      }

      if (requirements.locationCriteria.city) {
        query = query.ilike('city', `%${requirements.locationCriteria.city}%`);
      }

      if (requirements.locationCriteria.zipCodes?.length) {
        query = query.in('zip_code', requirements.locationCriteria.zipCodes);
      }

      // Apply size filters if specified
      if (requirements.spaceRequirements.minSquareFeet) {
        query = query.gte('square_footage_max', requirements.spaceRequirements.minSquareFeet);
      }

      if (requirements.spaceRequirements.maxSquareFeet) {
        query = query.lte('square_footage_min', requirements.spaceRequirements.maxSquareFeet);
      }

      // Apply rate filter if specified
      if (requirements.maxRatePerSqft) {
        query = query.lte('rate_per_sqft', requirements.maxRatePerSqft);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching matching properties:', error);
        return [];
      }

      // Apply detailed matching algorithm to filtered results
      const properties = data as CREProperty[];
      return findMatchingProperties(properties, requirements, minScore);

    } catch (error) {
      console.error('Error in fetchMatchingProperties:', error);
      return [];
    }
  }

  // Fetch properties within a geographic radius
  async fetchPropertiesInRadius(
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<CREProperty[]> {
    try {
      // Use PostGIS for geographic queries if available, otherwise fetch all and filter
      const { data, error } = await this.supabase
        .from('cre_properties')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) {
        console.error('Error fetching properties in radius:', error);
        return [];
      }

      // Filter by distance in JavaScript (could be optimized with PostGIS)
      const properties = data as CREProperty[];
      return properties.filter(property => {
        if (!property.latitude || !property.longitude) return false;
        
        const distance = this.calculateDistance(
          centerLat, centerLng,
          property.latitude, property.longitude
        );
        
        return distance <= radiusKm;
      });

    } catch (error) {
      console.error('Error in fetchPropertiesInRadius:', error);
      return [];
    }
  }

  // Search properties by text query
  async searchProperties(query: string): Promise<CREProperty[]> {
    try {
      const { data, error } = await this.supabase
        .from('cre_properties')
        .select('*')
        .or(`address.ilike.%${query}%,city.ilike.%${query}%,building_types.cs.{${query}}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error searching properties:', error);
        return [];
      }

      return data as CREProperty[];
    } catch (error) {
      console.error('Error in searchProperties:', error);
      return [];
    }
  }

  // Get properties by building type
  async getPropertiesByType(buildingTypes: string[]): Promise<CREProperty[]> {
    try {
      const { data, error } = await this.supabase
        .from('cre_properties')
        .select('*')
        .overlaps('building_types', buildingTypes)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties by type:', error);
        return [];
      }

      return data as CREProperty[];
    } catch (error) {
      console.error('Error in getPropertiesByType:', error);
      return [];
    }
  }

  // Helper method to calculate distance between two points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Get property statistics
  async getPropertyStats() {
    try {
      const { data, error } = await this.supabase
        .from('cre_properties')
        .select('building_types, state, rate_per_sqft, square_footage_min, square_footage_max');

      if (error) {
        console.error('Error fetching property stats:', error);
        return null;
      }

      const properties = data as CREProperty[];
      
      // Calculate statistics
      const totalProperties = properties.length;
      const stateDistribution = properties.reduce((acc, prop) => {
        acc[prop.state] = (acc[prop.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const typeDistribution = properties.reduce((acc, prop) => {
        prop.building_types.forEach(type => {
          acc[type] = (acc[type] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      const ratesWithValues = properties
        .filter(p => p.rate_per_sqft && p.rate_per_sqft > 0)
        .map(p => p.rate_per_sqft!);
      
      const averageRate = ratesWithValues.length > 0
        ? ratesWithValues.reduce((sum, rate) => sum + rate, 0) / ratesWithValues.length
        : 0;

      const sizesWithValues = properties
        .filter(p => p.square_footage_min && p.square_footage_min > 0)
        .map(p => p.square_footage_min!);
      
      const averageSize = sizesWithValues.length > 0
        ? sizesWithValues.reduce((sum, size) => sum + size, 0) / sizesWithValues.length
        : 0;

      return {
        totalProperties,
        stateDistribution,
        typeDistribution,
        averageRate: Math.round(averageRate * 100) / 100,
        averageSize: Math.round(averageSize),
        propertiesWithCoordinates: properties.filter(p => p.latitude && p.longitude).length
      };

    } catch (error) {
      console.error('Error in getPropertyStats:', error);
      return null;
    }
  }
}

// Create singleton instance
export const propertyService = new PropertyService();