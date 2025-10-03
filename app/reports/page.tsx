'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Calendar, Filter, Search, Eye } from 'lucide-react';

export default function ReportsPage() {
  const reports = [
    {
      id: 1,
      name: "Monthly Portfolio Performance",
      type: "Financial",
      date: "2024-01-15",
      status: "Ready",
      size: "2.4 MB"
    },
    {
      id: 2,
      name: "Property Valuation Summary",
      type: "Valuation",
      date: "2024-01-10",
      status: "Ready",
      size: "1.8 MB"
    },
    {
      id: 3,
      name: "Market Analysis Q4 2023",
      type: "Market",
      date: "2024-01-05",
      status: "Processing",
      size: "3.2 MB"
    },
    {
      id: 4,
      name: "Occupancy & Lease Report",
      type: "Operations",
      date: "2023-12-28",
      status: "Ready",
      size: "1.5 MB"
    },
    {
      id: 5,
      name: "Investment Returns Analysis",
      type: "Financial",
      date: "2023-12-20",
      status: "Ready",
      size: "2.1 MB"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready': return 'default';
      case 'Processing': return 'secondary';
      default: return 'secondary';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Financial': return 'bg-green-100 text-green-800';
      case 'Market': return 'bg-blue-100 text-blue-800';
      case 'Valuation': return 'bg-purple-100 text-purple-800';
      case 'Operations': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex-1 p-6 bg-white h-full overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-7 h-7 text-blue-600" />
                Reports & Analytics
              </h1>
              <p className="text-gray-600 mt-1">Generate and download portfolio reports</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
              <Button size="sm">
                Generate New Report
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">24</div>
                <div className="text-sm text-gray-600">Total Reports</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">18</div>
                <div className="text-sm text-gray-600">Ready</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">3</div>
                <div className="text-sm text-gray-600">Processing</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">45.2MB</div>
                <div className="text-sm text-gray-600">Total Size</div>
              </CardContent>
            </Card>
          </div>

          {/* Reports List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{report.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs px-2 py-1 ${getTypeColor(report.type)}`}>
                            {report.type}
                          </Badge>
                          <Badge variant={getStatusColor(report.status)} className="text-xs">
                            {report.status}
                          </Badge>
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {report.date}
                          </span>
                          <span className="text-sm text-gray-500">• {report.size}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled={report.status === 'Processing'}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Report Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Generate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
                  <div className="font-semibold">Financial Summary</div>
                  <div className="text-sm text-gray-600 text-left">Portfolio performance and returns analysis</div>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
                  <div className="font-semibold">Market Report</div>
                  <div className="text-sm text-gray-600 text-left">Current market trends and comparisons</div>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
                  <div className="font-semibold">Occupancy Report</div>
                  <div className="text-sm text-gray-600 text-left">Tenant information and lease schedules</div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}