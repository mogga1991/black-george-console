import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context?: {
    userId?: string;
    documentId?: string;
    propertyId?: string;
    rfpId?: string;
  };
}

// System prompt to keep AI focused on RFP/CRE topics
const SYSTEM_PROMPT = `You are a specialized Commercial Real Estate and RFP (Request for Proposals) Assistant. Your expertise covers:

CORE COMPETENCIES:
- Federal, State, Local, and County RFPs/RLPs (Request for Lease Proposals)
- Commercial Real Estate analysis and recommendations
- Property valuation and market analysis
- Lease negotiations and terms
- Zoning and regulatory compliance
- Government contracting requirements
- Space planning and facility management
- Environmental assessments and due diligence

RESPONSE GUIDELINES:
1. STAY ON TOPIC: Only respond to queries related to commercial real estate, RFPs, RLPs, government leasing, or related business topics
2. BE SPECIFIC: Provide actionable insights with relevant data when possible
3. REFERENCE STANDARDS: Mention relevant regulations, standards (GSA, local building codes, etc.)
4. SUGGEST NEXT STEPS: Always provide concrete next steps or recommendations
5. MAINTAIN CONTEXT: Consider previous conversations and document analysis when available

RESTRICTED TOPICS:
- Decline to assist with topics unrelated to CRE, RFPs, or business operations
- Politely redirect off-topic conversations back to your expertise areas
- Do not provide legal advice (suggest consulting with legal professionals)

RESPONSE STYLE:
- Professional and knowledgeable
- Concise but comprehensive
- Include relevant metrics, timelines, or benchmarks when applicable
- Use industry-standard terminology
- Provide practical, actionable guidance

If asked about topics outside your expertise, respond: "I specialize in commercial real estate and RFP/government contracting matters. Could you rephrase your question to focus on property analysis, lease negotiations, RFP responses, or related CRE topics?"`;

export async function POST(request: NextRequest) {
  try {
    const { messages, context }: ChatRequest = await request.json();

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Check if user message is on-topic (basic filter)
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage && !isRFPorCRERelated(lastUserMessage.content)) {
      return NextResponse.json({
        response: "I specialize in commercial real estate and RFP/government contracting matters. Could you rephrase your question to focus on property analysis, lease negotiations, RFP responses, or related CRE topics?",
        type: 'redirect'
      });
    }

    // Prepare messages with system prompt
    const contextualMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    // Add context if available
    if (context) {
      let contextPrompt = '\n\nCONTEXT INFORMATION:\n';
      
      if (context.documentId) {
        contextPrompt += `- Currently analyzing document ID: ${context.documentId}\n`;
      }
      if (context.propertyId) {
        contextPrompt += `- Related to property ID: ${context.propertyId}\n`;
      }
      if (context.rfpId) {
        contextPrompt += `- Related to RFP ID: ${context.rfpId}\n`;
      }
      
      contextualMessages[0].content += contextPrompt;
    }

    // Get Cloudflare AI binding
    const ai = (request as any).ai;
    if (!ai) {
      throw new Error('Cloudflare AI binding not available');
    }

    // Call Cloudflare Workers AI
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: contextualMessages,
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
    });

    // Validate response is still on-topic
    if (response.response && !isResponseAppropriate(response.response)) {
      return NextResponse.json({
        response: "I notice my response may have strayed from commercial real estate topics. Let me refocus on helping you with RFP analysis, property evaluation, or lease negotiations. What specific CRE challenge can I assist you with?",
        type: 'refocus'
      });
    }

    return NextResponse.json({
      response: response.response,
      type: 'success',
      usage: response.usage || null
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to check if message is RFP/CRE related
function isRFPorCRERelated(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  const keywords = [
    // RFP/Government related
    'rfp', 'request for proposal', 'rlp', 'request for lease', 'government',
    'federal', 'state', 'local', 'county', 'gsa', 'contracting', 'bid',
    'proposal', 'procurement', 'solicitation',
    
    // Commercial Real Estate
    'commercial real estate', 'cre', 'property', 'lease', 'rent', 'office',
    'industrial', 'retail', 'warehouse', 'building', 'space', 'tenant',
    'landlord', 'market', 'valuation', 'cap rate', 'noi', 'price per square foot',
    'zoning', 'due diligence', 'environmental', 'facility', 'location',
    'square feet', 'sq ft', 'psf', 'triple net', 'nnn', 'cam', 'operating expenses',
    
    // Related business terms
    'development', 'investment', 'portfolio', 'acquisition', 'disposition',
    'financing', 'construction', 'renovation', 'occupancy', 'vacancy',
    'market analysis', 'comparable', 'comps', 'demographics', 'traffic count'
  ];
  
  return keywords.some(keyword => lowerMessage.includes(keyword)) || 
         lowerMessage.length > 100; // Allow longer messages as they may contain context
}

// Helper function to validate response appropriateness
function isResponseAppropriate(response: string): boolean {
  const lowerResponse = response.toLowerCase();
  
  // Check for obvious off-topic indicators
  const offTopicIndicators = [
    'recipe', 'cooking', 'entertainment', 'sports', 'music', 'movies',
    'personal relationship', 'dating', 'medical advice', 'financial advice',
    'investment advice', 'legal advice', 'tax advice'
  ];
  
  return !offTopicIndicators.some(indicator => lowerResponse.includes(indicator));
}