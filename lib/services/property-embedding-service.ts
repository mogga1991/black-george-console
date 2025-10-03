// Property Embedding Service using TensorFlow.js for intelligent property matching
import * as tf from '@tensorflow/tfjs';
import { CREProperty } from '@/lib/property-matching';

interface PropertyEmbedding {
  propertyId: string;
  embedding: number[];
  features: PropertyFeatures;
  lastUpdated: Date;
}

interface PropertyFeatures {
  // Location features
  locationVector: number[];
  
  // Size features
  sizeVector: number[];
  
  // Type features
  typeVector: number[];
  
  // Amenity features
  amenityVector: number[];
  
  // Financial features
  financialVector: number[];
  
  // Government suitability features
  governmentVector: number[];
}

interface SimilarProperty {
  property: CREProperty;
  similarity: number;
  similarityBreakdown: {
    location: number;
    size: number;
    type: number;
    amenities: number;
    financial: number;
    government: number;
  };
}

export class PropertyEmbeddingService {
  private static instance: PropertyEmbeddingService;
  private embeddingModel: tf.LayersModel | null = null;
  private propertyEmbeddings: Map<string, PropertyEmbedding> = new Map();
  private isInitialized = false;
  
  // Feature vocabularies for encoding
  private stateVocabulary: string[] = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];
  
  private buildingTypeVocabulary: string[] = [
    'Office', 'Retail', 'Warehouse', 'Industrial', 'Medical', 'Restaurant',
    'Mixed Use', 'Flex Space', 'Coworking', 'Data Center', 'Manufacturing'
  ];
  
  private amenityVocabulary: string[] = [
    'Parking', 'Elevator', 'ADA Compliant', 'Security', 'Conference Rooms',
    'Fitness Center', 'Cafeteria', 'Loading Dock', 'High Ceilings',
    'Natural Light', 'HVAC', 'Backup Power', 'Fiber Internet', 'Signage',
    'Reception Area', 'Break Room', 'Storage', 'Restrooms', 'Kitchen'
  ];

  static getInstance(): PropertyEmbeddingService {
    if (!PropertyEmbeddingService.instance) {
      PropertyEmbeddingService.instance = new PropertyEmbeddingService();
    }
    return PropertyEmbeddingService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🧠 Initializing Property Embedding Service with TensorFlow.js...');
    
    try {
      // Set TensorFlow.js backend
      await tf.ready();
      console.log(`✅ TensorFlow.js initialized with backend: ${tf.getBackend()}`);
      
      // Create a simple neural network for property embeddings
      this.embeddingModel = this.createEmbeddingModel();
      
      console.log('🎯 Property embedding model created successfully');
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ Failed to initialize TensorFlow.js:', error);
      throw error;
    }
  }

  private createEmbeddingModel(): tf.LayersModel {
    console.log('🏗️ Building property embedding neural network...');
    
    // Input dimensions for property features
    const INPUT_DIM = 100; // Total feature vector size
    const EMBEDDING_DIM = 32; // Output embedding size
    
    const model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.dense({
          inputShape: [INPUT_DIM],
          units: 64,
          activation: 'relu',
          name: 'feature_dense_1'
        }),
        
        // Hidden layers with dropout for regularization
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 48,
          activation: 'relu',
          name: 'feature_dense_2'
        }),
        
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({
          units: EMBEDDING_DIM,
          activation: 'tanh', // Normalize embeddings to [-1, 1]
          name: 'embedding_output'
        })
      ]
    });
    
    // Compile model for similarity learning
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });
    
    console.log('📊 Model architecture:');
    model.summary();
    
    return model;
  }

  async generatePropertyEmbedding(property: CREProperty): Promise<PropertyEmbedding> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Extract comprehensive features from property
    const features = this.extractPropertyFeatures(property);
    
    // Create feature vector
    const featureVector = this.createFeatureVector(features);
    
    // Generate embedding using TensorFlow model
    const inputTensor = tf.tensor2d([featureVector], [1, featureVector.length]);
    const embeddingTensor = this.embeddingModel!.predict(inputTensor) as tf.Tensor;
    const embedding = await embeddingTensor.data();
    
    // Clean up tensors
    inputTensor.dispose();
    embeddingTensor.dispose();
    
    const propertyEmbedding: PropertyEmbedding = {
      propertyId: property.id,
      embedding: Array.from(embedding),
      features,
      lastUpdated: new Date()
    };
    
    // Cache the embedding
    this.propertyEmbeddings.set(property.id, propertyEmbedding);
    
    return propertyEmbedding;
  }

  private extractPropertyFeatures(property: CREProperty): PropertyFeatures {
    return {
      locationVector: this.encodeLocation(property),
      sizeVector: this.encodeSize(property),
      typeVector: this.encodeType(property),
      amenityVector: this.encodeAmenities(property),
      financialVector: this.encodeFinancial(property),
      governmentVector: this.encodeGovernmentSuitability(property)
    };
  }

  private encodeLocation(property: CREProperty): number[] {
    const vector = new Array(15).fill(0);
    
    // State encoding (one-hot)
    const stateIndex = this.stateVocabulary.indexOf(property.state?.toUpperCase() || '');
    if (stateIndex >= 0) {
      vector[0] = 1; // Has state
      vector[1] = stateIndex / this.stateVocabulary.length; // Normalized state index
    }
    
    // Coordinates (normalized)
    if (property.latitude && property.longitude) {
      vector[2] = 1; // Has coordinates
      vector[3] = (property.latitude + 90) / 180; // Normalize lat to [0,1]
      vector[4] = (property.longitude + 180) / 360; // Normalize lng to [0,1]
    }
    
    // City size proxy (zip code as indicator)
    if (property.zip_code) {
      vector[5] = 1; // Has zip
      vector[6] = parseInt(property.zip_code.substring(0, 2)) / 99; // Rough geographic region
    }
    
    // Urban density indicators (based on city patterns)
    const cityName = property.city?.toLowerCase() || '';
    const majorCities = ['new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose'];
    vector[7] = majorCities.some(city => cityName.includes(city)) ? 1 : 0;
    
    return vector;
  }

  private encodeSize(property: CREProperty): number[] {
    const vector = new Array(10).fill(0);
    
    // Square footage (normalized to common ranges)
    const minSqft = property.square_footage_min || property.square_footage || 0;
    const maxSqft = property.square_footage_max || property.square_footage || minSqft;
    
    if (minSqft > 0) {
      vector[0] = 1; // Has size info
      vector[1] = Math.min(minSqft / 100000, 1); // Normalize to 0-1 (100k sqft max)
      vector[2] = Math.min(maxSqft / 100000, 1);
      vector[3] = Math.min((maxSqft - minSqft) / 50000, 1); // Size range flexibility
    }
    
    // Size categories
    const avgSize = (minSqft + maxSqft) / 2;
    if (avgSize < 2000) vector[4] = 1; // Small
    else if (avgSize < 10000) vector[5] = 1; // Medium
    else if (avgSize < 50000) vector[6] = 1; // Large
    else vector[7] = 1; // Very large
    
    return vector;
  }

  private encodeType(property: CREProperty): number[] {
    const vector = new Array(15).fill(0);
    
    if (property.building_types?.length) {
      vector[0] = 1; // Has type info
      
      // Multi-hot encoding for building types
      property.building_types.forEach(type => {
        const index = this.buildingTypeVocabulary.findIndex(vocab => 
          vocab.toLowerCase() === type.toLowerCase() ||
          type.toLowerCase().includes(vocab.toLowerCase())
        );
        if (index >= 0 && index < 10) {
          vector[index + 1] = 1;
        }
      });
      
      // Type diversity
      vector[11] = Math.min(property.building_types.length / 3, 1);
    }
    
    return vector;
  }

  private encodeAmenities(property: CREProperty): number[] {
    const vector = new Array(25).fill(0);
    
    const description = (property.description || '').toLowerCase();
    const amenities = property.amenities || [];
    const allText = [description, ...amenities.map(a => a.toLowerCase())].join(' ');
    
    if (allText.length > 0) {
      vector[0] = 1; // Has amenity info
      
      // Multi-hot encoding for amenities
      this.amenityVocabulary.forEach((amenity, index) => {
        if (index < 20 && allText.includes(amenity.toLowerCase())) {
          vector[index + 1] = 1;
        }
      });
      
      // Amenity richness
      const amenityCount = this.amenityVocabulary.filter(amenity => 
        allText.includes(amenity.toLowerCase())
      ).length;
      vector[21] = Math.min(amenityCount / 10, 1);
    }
    
    return vector;
  }

  private encodeFinancial(property: CREProperty): number[] {
    const vector = new Array(8).fill(0);
    
    if (property.rate_per_sqft) {
      vector[0] = 1; // Has rate info
      vector[1] = Math.min(property.rate_per_sqft / 100, 1); // Normalize to $100/sqft max
      
      // Rate categories
      if (property.rate_per_sqft < 20) vector[2] = 1; // Low cost
      else if (property.rate_per_sqft < 50) vector[3] = 1; // Medium cost
      else vector[4] = 1; // High cost
    }
    
    // Value indicators
    if (property.rate_text?.toLowerCase().includes('negotiable')) vector[5] = 1;
    if (property.rate_text?.toLowerCase().includes('contact')) vector[6] = 1;
    
    return vector;
  }

  private encodeGovernmentSuitability(property: CREProperty): number[] {
    const vector = new Array(15).fill(0);
    
    const description = (property.description || '').toLowerCase();
    const amenities = property.amenities || [];
    const allText = [description, ...amenities.map(a => a.toLowerCase())].join(' ');
    
    // Government-relevant features
    if (allText.includes('ada') || allText.includes('accessible')) vector[0] = 1;
    if (allText.includes('security') || allText.includes('access control')) vector[1] = 1;
    if (allText.includes('parking') || allText.includes('garage')) vector[2] = 1;
    if (allText.includes('elevator')) vector[3] = 1;
    if (allText.includes('conference') || allText.includes('meeting')) vector[4] = 1;
    if (allText.includes('backup') || allText.includes('generator')) vector[5] = 1;
    if (allText.includes('fiber') || allText.includes('internet')) vector[6] = 1;
    if (allText.includes('cafeteria') || allText.includes('dining')) vector[7] = 1;
    if (allText.includes('fitness') || allText.includes('gym')) vector[8] = 1;
    
    // Professional building indicators
    if (property.building_types?.some(type => type.toLowerCase().includes('office'))) vector[9] = 1;
    if (allText.includes('class a') || allText.includes('class-a')) vector[10] = 1;
    if (allText.includes('professional') || allText.includes('corporate')) vector[11] = 1;
    
    return vector;
  }

  private createFeatureVector(features: PropertyFeatures): number[] {
    return [
      ...features.locationVector,
      ...features.sizeVector,
      ...features.typeVector,
      ...features.amenityVector,
      ...features.financialVector,
      ...features.governmentVector
    ];
  }

  async findSimilarProperties(
    targetProperty: CREProperty, 
    candidateProperties: CREProperty[],
    topK: number = 10
  ): Promise<SimilarProperty[]> {
    
    console.log(`🔍 Finding ${topK} similar properties using TensorFlow.js embeddings...`);
    
    // Generate embedding for target property
    const targetEmbedding = await this.generatePropertyEmbedding(targetProperty);
    
    // Generate embeddings for candidates (or retrieve from cache)
    const candidateEmbeddings = await Promise.all(
      candidateProperties.map(async (property) => {
        const cached = this.propertyEmbeddings.get(property.id);
        if (cached && this.isEmbeddingFresh(cached)) {
          return cached;
        }
        return await this.generatePropertyEmbedding(property);
      })
    );
    
    // Calculate similarities
    const similarities = candidateEmbeddings.map(candidateEmbedding => {
      const similarity = this.calculateCosineSimilarity(
        targetEmbedding.embedding,
        candidateEmbedding.embedding
      );
      
      const similarityBreakdown = this.calculateDetailedSimilarity(
        targetEmbedding.features,
        candidateEmbedding.features
      );
      
      return {
        property: candidateProperties.find(p => p.id === candidateEmbedding.propertyId)!,
        similarity,
        similarityBreakdown
      };
    });
    
    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private calculateDetailedSimilarity(featuresA: PropertyFeatures, featuresB: PropertyFeatures) {
    return {
      location: this.calculateCosineSimilarity(featuresA.locationVector, featuresB.locationVector),
      size: this.calculateCosineSimilarity(featuresA.sizeVector, featuresB.sizeVector),
      type: this.calculateCosineSimilarity(featuresA.typeVector, featuresB.typeVector),
      amenities: this.calculateCosineSimilarity(featuresA.amenityVector, featuresB.amenityVector),
      financial: this.calculateCosineSimilarity(featuresA.financialVector, featuresB.financialVector),
      government: this.calculateCosineSimilarity(featuresA.governmentVector, featuresB.governmentVector)
    };
  }

  private isEmbeddingFresh(embedding: PropertyEmbedding): boolean {
    const AGE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - embedding.lastUpdated.getTime() < AGE_THRESHOLD;
  }

  // Enhanced search ranking using ML
  async enhanceSearchRanking(
    properties: CREProperty[],
    searchCriteria: any
  ): Promise<CREProperty[]> {
    
    if (properties.length === 0) return properties;
    
    console.log(`🎯 Enhancing search ranking for ${properties.length} properties using ML...`);
    
    // Create a virtual "ideal" property from search criteria
    const idealProperty = this.createIdealProperty(searchCriteria);
    
    // Find similarities to ideal property
    const similarities = await this.findSimilarProperties(idealProperty, properties, properties.length);
    
    // Return properties sorted by ML similarity
    return similarities.map(sim => sim.property);
  }

  private createIdealProperty(criteria: any): CREProperty {
    return {
      id: 'ideal-property',
      address: criteria.locationText || '',
      city: criteria.locationData?.city || '',
      state: criteria.locationData?.state || '',
      zip_code: '',
      building_types: criteria.buildingTypes || ['Office'],
      square_footage: criteria.preferredSqft || criteria.maxSqft || 10000,
      square_footage_min: criteria.minSqft || 1000,
      square_footage_max: criteria.maxSqft || 50000,
      rate_per_sqft: criteria.maxRatePerSqft,
      rate_text: criteria.maxRatePerSqft ? `$${criteria.maxRatePerSqft}/sq ft` : 'Contact for pricing',
      description: `Ideal property matching: ${criteria.mustHaves?.join(', ') || ''}`,
      amenities: criteria.mustHaves || [],
      latitude: criteria.center?.lat,
      longitude: criteria.center?.lng,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // Get embedding statistics for monitoring
  getEmbeddingStats() {
    return {
      totalEmbeddings: this.propertyEmbeddings.size,
      modelInitialized: this.isInitialized,
      tfBackend: tf.getBackend(),
      memoryUsage: tf.memory()
    };
  }

  // Clear old embeddings to manage memory
  clearOldEmbeddings(maxAge: number = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    let cleared = 0;
    
    for (const [id, embedding] of this.propertyEmbeddings.entries()) {
      if (embedding.lastUpdated.getTime() < cutoff) {
        this.propertyEmbeddings.delete(id);
        cleared++;
      }
    }
    
    console.log(`🧹 Cleared ${cleared} old property embeddings`);
    return cleared;
  }
}

export const propertyEmbeddingService = PropertyEmbeddingService.getInstance();