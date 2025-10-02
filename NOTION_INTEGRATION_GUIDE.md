# 🏢 CRE Console - Notion Integration Guide

## Overview
This guide sets up Notion as your property database, enabling AI-powered matching of RFP requirements to available commercial real estate properties.

## Workflow
1. **RFP Upload/Input** → AI extracts requirements
2. **Requirement Matching** → Search Notion property database
3. **Map Display** → Show best matches with scores
4. **Interactive Results** → Click for property details

## 1. Notion Database Setup

### Create a "Properties" Database in Notion

#### Required Properties (Exact Names):
- **Property ID** (Title) - Unique identifier
- **Address** (Rich Text) - Full property address
- **City** (Select) - Property city
- **State** (Select) - Two-letter state code
- **Zip Code** (Rich Text) - Postal code
- **Building Types** (Multi-select) - Office, Industrial, Retail, etc.
- **Square Footage** (Number) - Total rentable square feet
- **Rate Per SF** (Number) - Annual rate per square foot
- **Availability Date** (Date) - When space is available
- **Max Contiguous** (Number) - Largest contiguous space
- **Parking Spaces** (Number) - Available parking
- **Ceiling Height** (Rich Text) - Floor to ceiling height
- **Loading Docks** (Number) - Number of dock doors
- **Power** (Rich Text) - Electrical capacity
- **HVAC** (Select) - Climate control type
- **Security Features** (Multi-select) - Security amenities
- **Proximity Transit** (Rich Text) - Distance to public transit
- **Zoning** (Rich Text) - Zoning classification
- **Special Features** (Multi-select) - Unique amenities
- **Contact Name** (Rich Text) - Leasing contact
- **Contact Email** (Email) - Contact email
- **Contact Phone** (Phone) - Contact phone
- **Latitude** (Number) - GPS latitude
- **Longitude** (Number) - GPS longitude
- **Description** (Rich Text) - Detailed description
- **Images** (Files & Media) - Property photos
- **Documents** (Files & Media) - Spec sheets, floor plans
- **Status** (Select) - Available, Under Negotiation, Leased
- **GSA Approved** (Checkbox) - Government approved facility
- **Security Clearance** (Select) - Required clearance level
- **Last Updated** (Date) - Data freshness

#### Optional Advanced Properties:
- **Market Class** (Select) - Class A, B, C
- **Year Built** (Number)
- **Renovation Year** (Number)
- **NOI** (Number) - Net Operating Income
- **Cap Rate** (Number) - Capitalization rate
- **Price Per SF** (Number) - Sale price per square foot
- **Lease Terms** (Multi-select) - Available lease lengths
- **Tenant Improvements** (Rich Text) - TI allowance
- **Operating Expenses** (Number) - Annual operating costs
- **Property Manager** (Rich Text)
- **Ownership** (Rich Text)

## 2. Notion API Integration

### Get Your Notion API Token
1. Go to https://www.notion.so/my-integrations
2. Create a new integration named "CRE Console"
3. Copy the API token
4. Share your Properties database with the integration

### Environment Variables
Add to your Cloudflare Pages environment:
```bash
NOTION_API_TOKEN=secret_your_notion_token
NOTION_PROPERTIES_DATABASE_ID=your_database_id
```

## 3. RFP Requirement Extraction

The AI will extract these key requirements from RFPs:

### Space Requirements
- Square footage (min/max)
- Ceiling height requirements
- Special space needs (conference rooms, labs, etc.)
- Accessibility requirements (ADA compliance)

### Location Requirements
- Geographic constraints (city, state, region)
- Proximity requirements (airports, transit, highways)
- Security requirements (clearance zones, restricted areas)

### Technical Requirements
- Power requirements (electrical capacity)
- HVAC specifications
- IT/Telecom infrastructure
- Loading dock requirements
- Parking minimums

### Lease Terms
- Lease duration (short-term, long-term)
- Occupancy date requirements
- Budget constraints (rate per SF)
- Government-specific terms (GSA compliance)

### Special Requirements
- Security clearance levels
- Environmental certifications
- Historic preservation compliance
- Buy American Act compliance

## 4. Matching Algorithm

### Scoring System (0-100 points)
- **Location Match**: 25 points
  - City/state exact match: 25 pts
  - Regional match: 15 pts
  - State match only: 5 pts

- **Space Requirements**: 30 points
  - Square footage fit: 15 pts
  - Ceiling height adequate: 5 pts
  - Special features match: 10 pts

- **Technical Requirements**: 20 points
  - Power capacity adequate: 5 pts
  - HVAC suitable: 5 pts
  - Loading docks sufficient: 5 pts
  - Parking adequate: 5 pts

- **Compliance & Security**: 15 points
  - GSA approved: 10 pts
  - Security clearance match: 5 pts

- **Budget & Terms**: 10 points
  - Rate within budget: 5 pts
  - Availability timing: 5 pts

### Match Categories
- **Excellent Match**: 85-100 points (Green markers)
- **Good Match**: 70-84 points (Yellow markers)
- **Fair Match**: 55-69 points (Orange markers)
- **Poor Match**: Below 55 points (Not displayed)

## 5. Map Integration

### Property Display
- **Color-coded markers** based on match score
- **Clustered markers** for dense areas
- **Property cards** on marker click
- **Filter controls** by match score, property type, etc.

### Property Card Information
- Property address and basic details
- Match score and reasoning
- Key features that match requirements
- Contact information
- Quick action buttons (Save, Contact, Share)

## 6. AI Chat Integration

### Enhanced Commands
- "Find office space for 200 people in Dallas"
- "Show properties with loading docks near airports"
- "Filter for GSA-approved facilities under $25/SF"
- "Find secure facilities requiring Secret clearance"

### Context Awareness
- Remember previous searches
- Reference uploaded RFP documents
- Suggest similar properties
- Explain match reasoning

## 7. Implementation Phases

### Phase 1: Core Integration
- [x] Notion API connection
- [x] Basic property search
- [x] Map display integration

### Phase 2: AI Enhancement
- [x] RFP requirement extraction
- [x] Intelligent property matching
- [x] Scoring algorithm implementation

### Phase 3: Advanced Features
- [ ] Real-time Notion updates
- [ ] Saved searches and alerts
- [ ] Property comparison tools
- [ ] Automated RFP response generation

## 8. Data Management

### Notion Best Practices
- **Consistent data entry** - Use templates for new properties
- **Regular updates** - Keep availability and pricing current
- **Rich descriptions** - Include detailed property features
- **Quality photos** - Upload high-resolution images
- **Document organization** - Standardize file naming

### Data Sync Strategy
- **Real-time queries** - Always pull fresh data from Notion
- **Caching strategy** - Cache search results for 5 minutes
- **Error handling** - Graceful degradation if Notion is unavailable
- **Rate limiting** - Respect Notion API limits

## 9. Security Considerations

### API Security
- Store Notion token securely in environment variables
- Use read-only access where possible
- Implement request rate limiting
- Log all property access for audit trails

### Data Privacy
- Redact sensitive information in logs
- Implement user access controls
- Secure property document access
- GDPR compliance for contact information

## 10. Success Metrics

### User Engagement
- Search-to-contact conversion rate
- Property card view duration
- Map interaction frequency
- AI query complexity growth

### Data Quality
- Property freshness (last update date)
- Complete property profiles (% fields filled)
- User feedback on match accuracy
- Contact information accuracy

This integration transforms your CRE Console into a powerful property matching engine that understands government requirements and finds the best commercial real estate solutions automatically.