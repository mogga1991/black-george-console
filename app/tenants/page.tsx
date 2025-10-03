'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, Plus, Building, Calendar, DollarSign, Phone, Mail } from 'lucide-react';

export default function TenantsPage() {
  const tenants = [
    {
      id: 1,
      name: "Tech Innovations LLC",
      contact: "Sarah Johnson",
      email: "sarah@techinnovations.com",
      phone: "(555) 123-4567",
      property: "Downtown Tower, Suite 1201",
      leaseStart: "2023-01-15",
      leaseEnd: "2025-01-15",
      rent: "$8,500",
      status: "Active"
    },
    {
      id: 2,
      name: "Global Marketing Solutions",
      contact: "Michael Chen",
      email: "m.chen@globalmkt.com",
      phone: "(555) 234-5678",
      property: "Business Plaza, Floor 3",
      leaseStart: "2022-06-01",
      leaseEnd: "2024-06-01",
      rent: "$12,000",
      status: "Active"
    },
    {
      id: 3,
      name: "Creative Design Studio",
      contact: "Emily Rodriguez",
      email: "emily@creativedesign.co",
      phone: "(555) 345-6789",
      property: "Arts District, Unit 205",
      leaseStart: "2023-03-01",
      leaseEnd: "2026-03-01",
      rent: "$6,200",
      status: "Active"
    },
    {
      id: 4,
      name: "Financial Advisors Group",
      contact: "David Thompson",
      email: "david@finadvgroup.com",
      phone: "(555) 456-7890",
      property: "Financial Center, Suite 850",
      leaseStart: "2021-09-15",
      leaseEnd: "2024-09-15",
      rent: "$15,500",
      status: "Expiring Soon"
    },
    {
      id: 5,
      name: "Healthcare Solutions Inc",
      contact: "Lisa Wang",
      email: "lisa@healthsolutions.com",
      phone: "(555) 567-8901",
      property: "Medical Plaza, Suite 420",
      leaseStart: "2023-07-01",
      leaseEnd: "2025-07-01",
      rent: "$9,800",
      status: "Active"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'default';
      case 'Expiring Soon': return 'secondary';
      case 'Expired': return 'outline';
      default: return 'secondary';
    }
  };

  const stats = [
    { label: "Total Tenants", value: "127", icon: <Users className="w-4 h-4" /> },
    { label: "Active Leases", value: "115", icon: <Building className="w-4 h-4" /> },
    { label: "Expiring Soon", value: "8", icon: <Calendar className="w-4 h-4" /> },
    { label: "Monthly Revenue", value: "$1.2M", icon: <DollarSign className="w-4 h-4" /> }
  ];

  return (
    <ProtectedRoute>
      <div className="flex-1 p-6 bg-white h-full overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="w-7 h-7 text-blue-600" />
                Tenant Management
              </h1>
              <p className="text-gray-600 mt-1">Manage tenant relationships and lease information</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input placeholder="Search tenants..." className="pl-9 w-64" />
              </div>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Tenant
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tenants List */}
          <Card>
            <CardHeader>
              <CardTitle>Current Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                          <Badge variant={getStatusColor(tenant.status)}>
                            {tenant.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Contact Person</p>
                            <p className="font-medium">{tenant.contact}</p>
                            <div className="flex items-center gap-1 text-gray-500 mt-1">
                              <Mail className="w-3 h-3" />
                              <span className="text-xs">{tenant.email}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-500">
                              <Phone className="w-3 h-3" />
                              <span className="text-xs">{tenant.phone}</span>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-gray-600">Property</p>
                            <p className="font-medium">{tenant.property}</p>
                            <p className="text-gray-500 text-xs mt-1">Monthly Rent: {tenant.rent}</p>
                          </div>
                          
                          <div>
                            <p className="text-gray-600">Lease Period</p>
                            <p className="font-medium text-xs">{tenant.leaseStart} - {tenant.leaseEnd}</p>
                            <div className="flex items-center gap-1 text-gray-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span className="text-xs">
                                {Math.ceil((new Date(tenant.leaseEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
                  <div className="font-semibold">Lease Renewals</div>
                  <div className="text-sm text-gray-600 text-left">Process upcoming lease renewals</div>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
                  <div className="font-semibold">Rent Collection</div>
                  <div className="text-sm text-gray-600 text-left">Track and manage rent payments</div>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
                  <div className="font-semibold">Maintenance Requests</div>
                  <div className="text-sm text-gray-600 text-left">Handle tenant maintenance issues</div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}