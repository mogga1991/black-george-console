'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Building, BarChart3, Activity, PieChart } from 'lucide-react';

export default function AnalyticsPage() {
  const metrics = [
    {
      title: "Total Properties",
      value: "1,247",
      change: "+12%",
      trend: "up",
      icon: <Building className="w-4 h-4" />
    },
    {
      title: "Portfolio Value",
      value: "$2.4B",
      change: "+8.2%",
      trend: "up",
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      title: "Avg Cap Rate",
      value: "6.8%",
      change: "-0.3%",
      trend: "down",
      icon: <TrendingUp className="w-4 h-4" />
    },
    {
      title: "Occupancy Rate",
      value: "94.2%",
      change: "+2.1%",
      trend: "up",
      icon: <Activity className="w-4 h-4" />
    }
  ];

  return (
    <ProtectedRoute>
      <div className="flex-1 p-6 bg-white h-full overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-blue-600" />
                Analytics Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Track performance metrics and portfolio insights</p>
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              Real-time Data
            </Badge>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {metric.icon}
                      <span className="text-sm font-medium text-gray-600">{metric.title}</span>
                    </div>
                    <Badge 
                      variant={metric.trend === 'up' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {metric.change}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Market Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Market trends chart will be displayed here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Property Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Property distribution chart will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-green-900">Strong Performance</h3>
                    <p className="text-green-700 text-sm">Portfolio is outperforming market average by 2.3%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">85</div>
                    <div className="text-sm text-gray-600">Active Listings</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">12</div>
                    <div className="text-sm text-gray-600">New Acquisitions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">$1.2M</div>
                    <div className="text-sm text-gray-600">Avg Property Value</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}