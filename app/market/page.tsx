'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, Building, MapPin, BarChart3, Filter, RefreshCw } from 'lucide-react';

export default function MarketPage() {
  const marketData = [
    {
      location: "Downtown",
      avgPrice: "$450/sqft",
      change: "+12.5%",
      trend: "up",
      volume: "234 sales",
      capRate: "6.2%"
    },
    {
      location: "Business District",
      avgPrice: "$380/sqft",
      change: "+8.3%",
      trend: "up",
      volume: "156 sales",
      capRate: "6.8%"
    },
    {
      location: "Tech Corridor",
      avgPrice: "$520/sqft",
      change: "-2.1%",
      trend: "down",
      volume: "89 sales",
      capRate: "5.9%"
    },
    {
      location: "Financial Center",
      avgPrice: "$495/sqft",
      change: "+15.2%",
      trend: "up",
      volume: "198 sales",
      capRate: "6.1%"
    }
  ];

  const insights = [
    {
      title: "Office Space Demand",
      status: "High",
      description: "Increased demand for Class A office spaces in prime locations",
      impact: "Positive"
    },
    {
      title: "Interest Rates",
      status: "Rising",
      description: "Federal rate increases affecting financing costs",
      impact: "Negative"
    },
    {
      title: "Remote Work Impact",
      status: "Stabilizing",
      description: "Office occupancy rates beginning to recover",
      impact: "Neutral"
    },
    {
      title: "Industrial Growth",
      status: "Strong",
      description: "Warehouse and logistics spaces seeing high demand",
      impact: "Positive"
    }
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'Positive': return 'bg-green-100 text-green-800';
      case 'Negative': return 'bg-red-100 text-red-800';
      case 'Neutral': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? 
      <TrendingUp className="w-4 h-4 text-green-600" /> : 
      <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  return (
    <ProtectedRoute>
      <div className="flex-1 p-6 bg-white h-full overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-blue-600" />
                Market Intelligence
              </h1>
              <p className="text-gray-600 mt-1">Real-time market data and commercial real estate insights</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter Markets
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Market Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-600">Market Cap</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">$14.2B</div>
                <div className="text-sm text-green-600 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +7.8%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600">Active Listings</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">1,247</div>
                <div className="text-sm text-blue-600">+23 this week</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-600">Avg Cap Rate</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">6.4%</div>
                <div className="text-sm text-gray-500">Market average</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-gray-600">Hot Markets</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">4</div>
                <div className="text-sm text-orange-600">High activity</div>
              </CardContent>
            </Card>
          </div>

          {/* Market Data by Location */}
          <Card>
            <CardHeader>
              <CardTitle>Market Performance by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {marketData.map((market, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <MapPin className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{market.location}</h3>
                        <p className="text-sm text-gray-600">{market.volume}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">{market.avgPrice}</p>
                        <p className="text-gray-600">Avg Price</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          {getTrendIcon(market.trend)}
                          <span className={market.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                            {market.change}
                          </span>
                        </div>
                        <p className="text-gray-600">Change</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">{market.capRate}</p>
                        <p className="text-gray-600">Cap Rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Market Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Market Insights & Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                      <Badge className={`text-xs ${getImpactColor(insight.impact)}`}>
                        {insight.impact}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    <div className="text-xs text-gray-500">
                      Status: <span className="font-medium">{insight.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Market Analysis Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Market Trends Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Interactive market trends chart will be displayed here</p>
                  <p className="text-sm text-gray-400 mt-1">Showing price movements, volume, and comparative analysis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}