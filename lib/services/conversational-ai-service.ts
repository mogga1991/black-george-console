// Conversational AI service for CRE Console
import { strictPropertyMatcher } from './strict-property-matcher';

interface ConversationalContext {
  businessName: string;
  offerings: string[];
  expertise: string[];
  currentProperties: any[];
  lastSearch?: any;
  userPreferences?: any;
}

interface QueryIntent {
  type: 'property_search' | 'business_question' | 'help_request' | 'general_chat' | 'clarification';
  confidence: number;
  extractedCriteria?: any;
  businessTopic?: string;
  location?: string;
  requirements?: string[];
}

export class ConversationalAIService {
  private context: ConversationalContext;
  
  constructor() {
    this.context = {
      businessName: "CRE Console",
      offerings: [
        "Government RFP/RLP Property Matching",
        "AI-Powered Property Similarity Analysis", 
        "Machine Learning Enhanced Search Ranking",
        "TensorFlow.js Neural Network Embeddings",
        "Commercial Real Estate Database Search", 
        "AI-Powered Document Analysis",
        "Location-Based Property Discovery",
        "Multi-Criteria Property Filtering",
        "Government Compliance Assistance",
        "Market Analysis and Reporting",
        "Lease Comparison Services"
      ],
      expertise: [
        "Government Procurement",
        "Commercial Real Estate",
        "Office Space Leasing",
        "Retail Properties",
        "Warehouse/Industrial Space",
        "Location Intelligence",
        "Market Research",
        "Compliance Requirements"
      ],
      currentProperties: []
    };
  }

  async processConversationalQuery(
    userMessage: string, 
    currentProperties: any[] = [],
    previousContext?: any
  ): Promise<{
    response: string;
    intent: QueryIntent;
    suggestedActions?: string[];
    mapUpdate?: any;
    followUpQuestions?: string[];
  }> {
    
    this.context.currentProperties = currentProperties;
    
    // Analyze user intent
    const intent = await this.analyzeIntent(userMessage);
    
    console.log(`🤖 AI Intent Analysis: ${intent.type} (${Math.round(intent.confidence * 100)}% confidence)`);
    
    let response: string;
    let suggestedActions: string[] = [];
    let mapUpdate: any = null;
    let followUpQuestions: string[] = [];
    
    switch (intent.type) {
      case 'property_search':
        const searchResult = await this.handlePropertySearch(userMessage, intent);
        response = searchResult.response;
        mapUpdate = searchResult.mapUpdate;
        suggestedActions = searchResult.suggestedActions;
        followUpQuestions = searchResult.followUpQuestions;
        break;
        
      case 'business_question':
        response = this.handleBusinessQuestion(userMessage, intent);
        suggestedActions = this.getBusinessSuggestedActions(intent.businessTopic);
        followUpQuestions = this.getBusinessFollowUpQuestions(intent.businessTopic);
        break;
        
      case 'help_request':
        response = this.handleHelpRequest(userMessage);
        suggestedActions = ["Upload RFP Document", "Search by Location", "Browse Property Types"];
        followUpQuestions = ["What type of space are you looking for?", "Do you have a specific location in mind?", "What's your timeline for leasing?"];
        break;
        
      case 'clarification':
        response = this.handleClarification(userMessage, previousContext);
        followUpQuestions = ["Would you like me to refine the search?", "Should I look in nearby areas?", "Do you want to adjust the criteria?"];
        break;
        
      default:
        response = this.handleGeneralChat(userMessage);
        suggestedActions = ["Search Properties", "Upload RFP", "Ask About Our Services"];
        break;
    }
    
    return {
      response,
      intent,
      suggestedActions,
      mapUpdate,
      followUpQuestions
    };
  }
  
  private async analyzeIntent(message: string): Promise<QueryIntent> {
    const lowerMessage = message.toLowerCase();
    
    // Property search patterns
    const locationPatterns = [
      /(?:in|near|around|within)\s+([a-zA-Z\s,]+?)(?:\s|$|,)/i,
      /([a-zA-Z\s]+),\s*([A-Z]{2})/,
      /\b(new york|california|texas|florida|chicago|boston|atlanta|dallas|miami|seattle|denver|phoenix)\b/i
    ];
    
    const sizePatterns = [
      /(\d{1,3}(?:,?\d{3})*)\s*(?:sq\.?\s*ft\.?|square\s*feet|sf)/i,
      /(\d+)k?\s*(?:sq\.?\s*ft\.?|square\s*feet|sf)/i
    ];
    
    const typePatterns = [
      /\b(office|retail|warehouse|industrial|medical|restaurant|coworking)\b/i,
      /\b(class\s*[abc])\b/i
    ];
    
    // Business question patterns
    const businessPatterns = [
      /\b(services|offering|help|do|can|what|how|price|cost|fee)\b/i,
      /\b(rfp|rlp|government|procurement|compliance)\b/i,
      /\b(experience|expertise|specialize|focus)\b/i
    ];
    
    // Check for property search intent
    const hasLocation = locationPatterns.some(pattern => pattern.test(message));
    const hasSize = sizePatterns.some(pattern => pattern.test(message));
    const hasType = typePatterns.some(pattern => pattern.test(message));
    const hasPropertyKeywords = /\b(find|search|look|need|want|property|space|building|lease|rent)\b/i.test(message);
    
    if ((hasLocation || hasSize || hasType) && hasPropertyKeywords) {
      return {
        type: 'property_search',
        confidence: 0.9,
        extractedCriteria: this.extractSearchCriteria(message),
        location: this.extractLocation(message)
      };
    }
    
    // Check for business questions
    if (businessPatterns.some(pattern => pattern.test(message))) {
      return {
        type: 'business_question',
        confidence: 0.85,
        businessTopic: this.identifyBusinessTopic(message)
      };
    }
    
    // Check for help requests
    if (/\b(help|support|guide|how|tutorial|explain)\b/i.test(message)) {
      return {
        type: 'help_request',
        confidence: 0.8
      };
    }
    
    // Check for clarification
    if (/\b(no|not|wrong|different|other|instead|actually|modify|change)\b/i.test(message)) {
      return {
        type: 'clarification',
        confidence: 0.7
      };
    }
    
    return {
      type: 'general_chat',
      confidence: 0.6
    };
  }
  
  private async handlePropertySearch(message: string, intent: QueryIntent): Promise<{
    response: string;
    mapUpdate?: any;
    suggestedActions: string[];
    followUpQuestions: string[];
  }> {
    
    const criteria = intent.extractedCriteria;
    console.log('🔍 Extracted search criteria:', criteria);
    
    try {
      // Use our strict property matcher
      const strictCriteria = {
        location: {
          city: criteria.city,
          state: criteria.state,
          coordinates: criteria.coordinates,
          radiusKm: criteria.radiusKm || 25,
          strictLocation: true
        },
        requirements: {
          minSqft: criteria.minSqft,
          maxSqft: criteria.maxSqft,
          buildingTypes: criteria.buildingTypes
        },
        financial: {
          maxRatePerSqft: criteria.maxRate
        },
        minimumRelevanceScore: 60 // Slightly lower for conversational search
      };
      
      const matchingResult = await strictPropertyMatcher.findStrictMatches(strictCriteria);
      
      let response: string;
      const properties = matchingResult.matches;
      
      if (properties.length === 0) {
        response = `I searched for properties ${criteria.location ? `in ${criteria.location}` : ''} ${criteria.size ? `with ${criteria.size}` : ''} ${criteria.type ? `for ${criteria.type} use` : ''}, but didn't find any that meet our strict quality standards.

🔍 **Search Details:**
- Evaluated ${matchingResult.summary.totalCandidates} properties
- ${matchingResult.summary.rejectedForLocation} filtered out for location mismatch
- ${matchingResult.summary.rejectedForSize} filtered out for size requirements

Would you like me to:
• Expand the search radius
• Look in nearby areas  
• Adjust the size requirements
• Search for different property types`;
      } else {
        const excellent = properties.filter(p => p.matchLevel === 'excellent').length;
        const good = properties.filter(p => p.matchLevel === 'good').length;
        
        response = `Great! I found **${properties.length} properties** ${criteria.location ? `in ${criteria.location}` : ''} that match your criteria.

📊 **Match Quality:**
${excellent > 0 ? `• ${excellent} excellent matches (90%+ relevance)` : ''}
${good > 0 ? `• ${good} good matches (75-89% relevance)` : ''}
• Average relevance score: ${matchingResult.summary.averageRelevance}%

The properties are now displayed on the map with color coding:
🟢 Excellent matches • 🟡 Good matches • 🔴 Fair matches

Click on any marker to see detailed property information and match scoring.`;
      }
      
      return {
        response,
        mapUpdate: properties.length > 0 ? { properties, action: 'show' } : null,
        suggestedActions: properties.length > 0 ? 
          ["Filter by Price", "Sort by Distance", "View Property Details", "Save Favorites"] :
          ["Expand Search Area", "Try Different Criteria", "Upload RFP Document"],
        followUpQuestions: properties.length > 0 ? 
          ["Would you like to see properties in a specific price range?", "Are you interested in any particular amenities?", "Should I look for properties with immediate availability?"] :
          ["Should I search in nearby cities?", "Would you like to adjust the size requirements?", "Do you have budget constraints I should know about?"]
      };
      
    } catch (error) {
      console.error('Property search error:', error);
      return {
        response: `I encountered an issue while searching for properties. Let me help you in a different way - would you like to upload an RFP document for more precise matching, or describe your requirements in more detail?`,
        suggestedActions: ["Upload RFP", "Describe Requirements", "Try Basic Search"],
        followUpQuestions: ["What type of space are you looking for?", "Do you have a preferred location?"]
      };
    }
  }
  
  private handleBusinessQuestion(message: string, intent: QueryIntent): string {
    const topic = intent.businessTopic;
    
    switch (topic) {
      case 'services':
        return `🏢 **CRE Console** specializes in intelligent commercial real estate matching powered by advanced AI and machine learning.

**Our Core Services:**
• **Government RFP/RLP Processing** - AI-powered document analysis and property matching
• **TensorFlow.js ML Ranking** - Neural network-enhanced property similarity analysis
• **Intelligent Property Suggestions** - ML-powered recommendations based on property embeddings
• **Enhanced Search Ranking** - Machine learning optimization of search results
• **Compliance Assistance** - Government procurement requirement validation
• **Market Intelligence** - Real-time property data and predictive analytics
• **Document Analysis** - Multi-AI extraction with web validation

**What makes us different:**
✅ Machine Learning property embeddings using TensorFlow.js
✅ Neural network similarity analysis for smarter recommendations
✅ Strict location matching (no irrelevant neighboring areas)
✅ Government-grade precision and compliance
✅ Multi-AI validation for maximum accuracy
✅ Real-time property database with ML-enhanced ranking

**AI/ML Technology Stack:**
🧠 TensorFlow.js neural networks for property analysis
🎯 Vector embeddings for intelligent similarity matching
🔍 Enhanced search ranking using machine learning
📊 Real-time inference and property recommendations

How can I help you find the perfect space using our advanced AI technology?`;

      case 'rfp':
        return `📋 **Government RFP/RLP Expertise**

We specialize in processing government Request for Proposals (RFP) and Request for Lease Proposals (RLP) with military-grade precision:

**Our RFP Process:**
1. **AI Document Analysis** - Extract requirements with 85%+ accuracy
2. **Location Validation** - Web search verification of geographic requirements  
3. **Strict Filtering** - Only show properties that truly match your criteria
4. **Compliance Scoring** - Government-specific suitability evaluation
5. **Detailed Reporting** - Transparent matching with rejection reasons

**Government Standards:**
• If you specify "New York" - we show ONLY New York properties
• 75% minimum relevance threshold (vs 30% for commercial searches)
• ADA compliance and security feature prioritization
• Detailed audit trail for procurement transparency

Upload your RFP document and I'll find properties that meet your exact specifications.`;

      case 'pricing':
        return `💰 **Transparent Pricing & Value**

CRE Console operates on a **success-based model** - we're only successful when you find the right space.

**What's Included:**
✅ Unlimited property searches and RFP processing
✅ AI-powered document analysis and matching
✅ Government compliance verification
✅ Market intelligence and competitive analysis
✅ Direct property owner/broker connections

**Enterprise Features:**
• Dedicated account management for government clients
• Custom integration with procurement systems
• Advanced reporting and audit trails
• Priority processing for urgent RFPs

**No Hidden Fees:**
• No monthly subscriptions
• No per-search charges  
• No document processing fees

Ready to experience precision property matching? Upload an RFP or describe your space needs to get started.`;

      case 'compliance':
        return `🏛️ **Government Compliance & Standards**

CRE Console is built specifically for government procurement standards:

**Compliance Features:**
• **Section 508 Accessibility** - ADA compliant property identification
• **GSA Standards** - Government space requirement validation
• **Security Requirements** - Federal security standard assessment
• **Environmental Standards** - Energy efficiency and sustainability scoring

**Procurement Transparency:**
• Detailed match scoring with explainable AI decisions
• Complete audit trail of property filtering
• Rejection reason documentation for each excluded property
• Source verification for all property data

**Risk Mitigation:**
• Strict location enforcement (no scope creep)
• Multi-source data validation
• Government-specific suitability scoring
• Compliance requirement cross-checking

We ensure every property recommendation meets the highest standards of government procurement integrity.`;

      default:
        return `I'd be happy to help you learn more about CRE Console! We're a specialized commercial real estate platform focused on government and corporate clients.

**Quick Overview:**
• AI-powered property matching for RFPs and RLPs
• Strict location and requirement filtering
• Government compliance and procurement standards
• Real-time property database with intelligent search

What specific aspect would you like to know more about?
• Our services and capabilities
• Government RFP processing
• Pricing and enterprise features
• Compliance and security standards`;
    }
  }
  
  private handleHelpRequest(message: string): string {
    return `👋 **Welcome to CRE Console!** I'm here to help you find the perfect commercial space.

**How I Can Help:**

🎯 **Smart Property Search**
• Tell me what you're looking for in plain English
• Upload RFP/RLP documents for precise matching
• Search by location, size, type, or budget

🗺️ **Interactive Map**
• Color-coded properties by match quality
• Click markers for detailed information
• Filter results in real-time

📋 **Government RFP Processing**
• Upload your RFP document for AI analysis
• Get strict location-based matching
• Compliance and suitability scoring

**Try saying:**
• "Find office space in New York under $50/sq ft"
• "I need 5,000 sq ft warehouse in Texas"
• "Show me Class A buildings near downtown Chicago"

**Or simply upload your RFP document** and I'll extract all requirements automatically.

What type of space are you looking for today?`;
  }
  
  private handleClarification(message: string, previousContext: any): string {
    return `I understand you'd like to adjust the search. Let me help you refine the criteria.

**Current Search:**
${previousContext?.lastCriteria ? `• Location: ${previousContext.lastCriteria.location || 'Not specified'}
• Size: ${previousContext.lastCriteria.size || 'Not specified'}  
• Type: ${previousContext.lastCriteria.type || 'Not specified'}` : 'No previous search found'}

**What would you like to change?**
• Different location or expand the search area
• Adjust size requirements (larger/smaller spaces)
• Different property types (office, retail, warehouse, etc.)
• Budget or rate constraints
• Specific amenities or features

Just tell me what you'd like differently and I'll run a new search for you.`;
  }
  
  private handleGeneralChat(message: string): string {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon'];
    const isGreeting = greetings.some(greeting => 
      message.toLowerCase().includes(greeting)
    );
    
    if (isGreeting) {
      return `Hello! 👋 Welcome to **CRE Console** - your AI-powered commercial real estate assistant.

I specialize in finding properties that precisely match government RFPs and corporate requirements. Whether you're looking for office space, retail locations, or industrial facilities, I can help!

**What I can do for you:**
🎯 Smart property search with natural language
📋 Government RFP/RLP document processing  
🗺️ Interactive map-based property discovery
🏛️ Government compliance and standards verification

**Get started by:**
• Uploading your RFP document
• Telling me what you're looking for ("I need office space in downtown Miami")
• Asking about our services

How can I help you find the perfect commercial space today?`;
    }
    
    return `I'm your CRE Console assistant, specialized in commercial real estate and government procurement.

I can help you:
• **Find properties** by describing what you need
• **Process RFP documents** with AI-powered analysis
• **Answer questions** about our services and capabilities
• **Navigate the map** to discover available spaces

Try asking me something like:
• "Find 10,000 sq ft office space in Dallas"
• "What services do you offer for government RFPs?"
• "I need help understanding your pricing"

What would you like to know or search for?`;
  }
  
  private extractSearchCriteria(message: string): any {
    const criteria: any = {};
    
    // Extract location
    const locationMatch = message.match(/(?:in|near|around|within)\s+([a-zA-Z\s,]+?)(?:\s|$|,)/i) ||
                         message.match(/([a-zA-Z\s]+),\s*([A-Z]{2})/) ||
                         message.match(/\b(new york|california|texas|florida|chicago|boston|atlanta|dallas|miami|seattle|denver|phoenix)\b/i);
    
    if (locationMatch) {
      criteria.location = locationMatch[1] || locationMatch[0];
      criteria.city = this.extractLocation(message);
      criteria.state = this.extractState(message);
    }
    
    // Extract size
    const sizeMatch = message.match(/(\d{1,3}(?:,?\d{3})*)\s*(?:sq\.?\s*ft\.?|square\s*feet|sf)/i);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1].replace(/,/g, ''));
      criteria.minSqft = Math.round(size * 0.8); // 20% flexibility
      criteria.maxSqft = Math.round(size * 1.2);
      criteria.size = `${size.toLocaleString()} sq ft`;
    }
    
    // Extract property type
    const typeMatch = message.match(/\b(office|retail|warehouse|industrial|medical|restaurant|coworking)\b/i);
    if (typeMatch) {
      criteria.buildingTypes = [typeMatch[1]];
      criteria.type = typeMatch[1];
    }
    
    // Extract budget/rate
    const rateMatch = message.match(/\$(\d+)\s*(?:per|\/)\s*(?:sq\.?\s*ft\.?|sf)/i) ||
                     message.match(/under\s*\$(\d+)/i) ||
                     message.match(/max\s*\$(\d+)/i);
    if (rateMatch) {
      criteria.maxRate = parseInt(rateMatch[1]);
    }
    
    return criteria;
  }
  
  private extractLocation(message: string): string | undefined {
    const cityMatch = message.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s*[A-Z]{2}/) ||
                     message.match(/\b(new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|san francisco|indianapolis|seattle|denver|boston|el paso|detroit|nashville|memphis|portland|oklahoma city|las vegas|baltimore|louisville|milwaukee|albuquerque|tucson|fresno|sacramento|mesa|kansas city|atlanta|colorado springs|omaha|raleigh|miami|oakland|minneapolis|tulsa|cleveland|wichita|arlington|new orleans|bakersfield|tampa|honolulu|anaheim|aurora|santa ana|st louis|riverside|corpus christi|lexington|pittsburgh|anchorage|stockton|cincinnati|st paul|toledo|newark|greensboro|plano|henderson|lincoln|buffalo|jersey city|chula vista|fort wayne|orlando|st petersburg|chandler|laredo|norfolk|durham|madison|lubbock|irvine|winston salem|glendale|garland|hialeah|reno|chesapeake|gilbert|baton rouge|irving|scottsdale|north las vegas|fremont|boise|richmond|san bernardino|birmingham|spokane|rochester|des moines|modesto|fayetteville|tacoma|oxnard|fontana|columbus|montgomery)\b/i);
    
    return cityMatch?.[1] || cityMatch?.[0];
  }
  
  private extractState(message: string): string | undefined {
    const stateMatch = message.match(/\b([A-Z]{2})\b/) ||
                      message.match(/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i);
    
    if (stateMatch) {
      const state = stateMatch[1] || stateMatch[0];
      // Convert full state names to abbreviations if needed
      const stateAbbreviations: { [key: string]: string } = {
        'new york': 'NY', 'california': 'CA', 'texas': 'TX', 'florida': 'FL',
        'illinois': 'IL', 'pennsylvania': 'PA', 'ohio': 'OH', 'georgia': 'GA'
        // Add more as needed
      };
      
      return stateAbbreviations[state.toLowerCase()] || state.toUpperCase();
    }
  }
  
  private identifyBusinessTopic(message: string): string {
    if (/\b(services|offering|help|do|capabilities)\b/i.test(message)) return 'services';
    if (/\b(rfp|rlp|government|procurement)\b/i.test(message)) return 'rfp';
    if (/\b(price|cost|fee|pricing|payment)\b/i.test(message)) return 'pricing';
    if (/\b(compliance|standards|government|federal)\b/i.test(message)) return 'compliance';
    return 'general';
  }
  
  private getBusinessSuggestedActions(topic?: string): string[] {
    switch (topic) {
      case 'services': return ["View Our Capabilities", "Upload RFP Document", "Start Property Search"];
      case 'rfp': return ["Upload RFP", "Government Services", "Compliance Guide"];
      case 'pricing': return ["Request Quote", "View Enterprise Features", "Contact Sales"];
      case 'compliance': return ["Compliance Guide", "Government Standards", "Upload RFP"];
      default: return ["Learn More", "Start Search", "Upload Document"];
    }
  }
  
  private getBusinessFollowUpQuestions(topic?: string): string[] {
    switch (topic) {
      case 'services': return ["What type of space are you looking for?", "Do you work with government RFPs?", "Would you like a demo of our capabilities?"];
      case 'rfp': return ["Do you have an RFP document to upload?", "What government level are you working with?", "Are there specific compliance requirements?"];
      case 'pricing': return ["What size organization are you with?", "How many searches do you expect to do monthly?", "Are you interested in enterprise features?"];
      default: return ["How can I help you today?", "What would you like to know more about?"];
    }
  }
}

export const conversationalAI = new ConversationalAIService();