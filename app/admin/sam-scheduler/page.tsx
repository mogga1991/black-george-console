'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  Database,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Settings,
  BarChart3,
  Calendar
} from 'lucide-react';

interface SchedulerStatus {
  quota: {
    dailyLimit: number;
    used: number;
    resetTime: number;
    lastFetch: string;
  };
  lastSync: {
    timestamp: string;
    action: string;
    recordsProcessed: number;
    duration: number;
    errors: string[];
  };
  nextRuns: {
    dailyFetch: string;
    statusUpdate: string;
    cleanup: string;
  };
  stats: {
    totalOpportunities: number;
    recentOpportunities: number;
    statusBreakdown: Record<string, number>;
    sourceBreakdown: Record<string, number>;
  };
}

interface SyncMetrics {
  timestamp: string;
  action: string;
  recordsProcessed: number;
  errors: string[];
  duration: number;
  quotaUsed: number;
}

export default function SAMSchedulerAdminPage() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [recentLogs, setRecentLogs] = useState<SyncMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  // Load scheduler status on mount
  useEffect(() => {
    loadSchedulerStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSchedulerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSchedulerStatus = async () => {
    try {
      setLoading(true);
      
      // Fetch status from our scheduler worker
      const response = await fetch('/api/sam-scheduler/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
      
      // Fetch recent sync logs
      const logsResponse = await fetch('/api/sam-scheduler/logs');
      if (logsResponse.ok) {
        const logs = await logsResponse.json();
        setRecentLogs(logs);
      }
      
    } catch (error) {
      console.error('Failed to load scheduler status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSync = async (action: 'fetch' | 'update' | 'cleanup') => {
    try {
      setTriggering(action);
      
      const response = await fetch('/api/sam-scheduler/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (response.ok) {
        // Refresh status after triggering
        setTimeout(loadSchedulerStatus, 2000);
      } else {
        const error = await response.json();
        alert(`Failed to trigger ${action}: ${error.message}`);
      }
      
    } catch (error) {
      console.error(`Failed to trigger ${action}:`, error);
      alert(`Failed to trigger ${action}`);
    } finally {
      setTriggering(null);
    }
  };

  const getQuotaUsageColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">SAM.gov Scheduler</h1>
            <p className="text-gray-600">Monitor and manage automated opportunity fetching</p>
          </div>
          <Button onClick={loadSchedulerStatus} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">API Quota</p>
                <p className={`text-2xl font-bold ${status ? getQuotaUsageColor(status.quota.used, status.quota.dailyLimit) : ''}`}>
                  {status?.quota.used || 0} / {status?.quota.dailyLimit || 1000}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Opportunities</p>
                <p className="text-2xl font-bold">{status?.stats.totalOpportunities || 0}</p>
              </div>
              <Database className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recent (7 days)</p>
                <p className="text-2xl font-bold">{status?.stats.recentOpportunities || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Last Sync</p>
                <p className="text-sm font-medium">
                  {status?.lastSync ? new Date(status.lastSync.timestamp).toLocaleString() : 'Never'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="logs">Sync Logs</TabsTrigger>
            <TabsTrigger value="manual">Manual Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Breakdown */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Opportunity Status</h3>
                <div className="space-y-3">
                  {status?.stats.statusBreakdown && Object.entries(status.stats.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="capitalize">{status}</span>
                      <Badge variant={status === 'open' ? 'default' : 'secondary'}>
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Source Breakdown */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Data Sources</h3>
                <div className="space-y-3">
                  {status?.stats.sourceBreakdown && Object.entries(status.stats.sourceBreakdown).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="capitalize">{source}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Scheduled Jobs</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Daily Opportunity Fetch</p>
                      <p className="text-sm text-gray-600">Fetches new opportunities from SAM.gov</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">6:00 AM EST</p>
                    <p className="text-sm text-gray-600">Every day</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Status Updates</p>
                      <p className="text-sm text-gray-600">Check for status changes on existing opportunities</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">2:00 PM EST</p>
                    <p className="text-sm text-gray-600">Every day</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium">Database Cleanup</p>
                      <p className="text-sm text-gray-600">Remove expired and awarded opportunities</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">11:00 PM EST</p>
                    <p className="text-sm text-gray-600">Every day</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Sync Logs</h3>
              <div className="space-y-3">
                {recentLogs.map((log, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.errors.length > 0 ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <span className="font-medium capitalize">{log.action}</span>
                        <Badge variant="outline">
                          {log.recordsProcessed} records
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Duration: {formatDuration(log.duration)}</span>
                      <span>Quota used: {log.quotaUsed}</span>
                      {log.errors.length > 0 && (
                        <span className="text-red-600">{log.errors.length} errors</span>
                      )}
                    </div>
                    
                    {log.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                        {log.errors.slice(0, 3).map((error, i) => (
                          <div key={i}>{error}</div>
                        ))}
                        {log.errors.length > 3 && (
                          <div>... and {log.errors.length - 3} more</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {recentLogs.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No sync logs available</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Manual Controls</h3>
              <p className="text-gray-600 mb-6">Trigger scheduled jobs manually for testing or immediate updates</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => triggerManualSync('fetch')}
                  disabled={triggering === 'fetch'}
                  className="h-20 flex flex-col items-center justify-center"
                >
                  <Database className="h-6 w-6 mb-1" />
                  {triggering === 'fetch' ? 'Fetching...' : 'Fetch Opportunities'}
                </Button>

                <Button
                  onClick={() => triggerManualSync('update')}
                  disabled={triggering === 'update'}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center"
                >
                  <RefreshCw className="h-6 w-6 mb-1" />
                  {triggering === 'update' ? 'Updating...' : 'Update Status'}
                </Button>

                <Button
                  onClick={() => triggerManualSync('cleanup')}
                  disabled={triggering === 'cleanup'}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center"
                >
                  <Database className="h-6 w-6 mb-1" />
                  {triggering === 'cleanup' ? 'Cleaning...' : 'Cleanup Database'}
                </Button>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Rate Limiting Notice</p>
                    <p className="text-sm text-yellow-700">
                      Manual triggers count against your daily API quota. 
                      Current usage: {status?.quota.used || 0} / {status?.quota.dailyLimit || 1000} requests.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}