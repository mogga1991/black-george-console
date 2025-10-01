'use client';

import { useCloudflareMCP } from '@/lib/hooks/useCloudflareMCP';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Server, Database, HardDrive, Cloud } from 'lucide-react';

export function CloudflareDashboard() {
  const { workers, kvNamespaces, r2Buckets, d1Databases, loading, error, refresh } = useCloudflareMCP();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading Cloudflare resources...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-red-500 mb-4">
          <Cloud className="h-12 w-12 mx-auto mb-2" />
          <p className="text-lg font-semibold">Error loading Cloudflare data</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cloudflare Resources</h2>
          <p className="text-gray-600">Manage your Cloudflare Workers, KV, R2, and D1 resources</p>
        </div>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Workers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workers.length}</div>
            <p className="text-xs text-muted-foreground">
              Active Cloudflare Workers
            </p>
            {workers.length > 0 && (
              <div className="mt-2 space-y-1">
                {workers.slice(0, 3).map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between">
                    <span className="text-xs truncate">{worker.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {worker.type}
                    </Badge>
                  </div>
                ))}
                {workers.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{workers.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KV Namespaces */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KV Namespaces</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kvNamespaces.length}</div>
            <p className="text-xs text-muted-foreground">
              Key-Value stores
            </p>
            {kvNamespaces.length > 0 && (
              <div className="mt-2 space-y-1">
                {kvNamespaces.slice(0, 3).map((kv) => (
                  <div key={kv.id} className="flex items-center justify-between">
                    <span className="text-xs truncate">{kv.title}</span>
                    <Badge variant="outline" className="text-xs">
                      KV
                    </Badge>
                  </div>
                ))}
                {kvNamespaces.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{kvNamespaces.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* R2 Buckets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">R2 Buckets</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{r2Buckets.length}</div>
            <p className="text-xs text-muted-foreground">
              Object storage buckets
            </p>
            {r2Buckets.length > 0 && (
              <div className="mt-2 space-y-1">
                {r2Buckets.slice(0, 3).map((bucket) => (
                  <div key={bucket.name} className="flex items-center justify-between">
                    <span className="text-xs truncate">{bucket.name}</span>
                    <Badge variant="outline" className="text-xs">
                      R2
                    </Badge>
                  </div>
                ))}
                {r2Buckets.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{r2Buckets.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* D1 Databases */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">D1 Databases</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d1Databases.length}</div>
            <p className="text-xs text-muted-foreground">
              SQLite databases
            </p>
            {d1Databases.length > 0 && (
              <div className="mt-2 space-y-1">
                {d1Databases.slice(0, 3).map((db) => (
                  <div key={db.uuid} className="flex items-center justify-between">
                    <span className="text-xs truncate">{db.name}</span>
                    <Badge variant="outline" className="text-xs">
                      D1
                    </Badge>
                  </div>
                ))}
                {d1Databases.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{d1Databases.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workers List */}
        <Card>
          <CardHeader>
            <CardTitle>Workers</CardTitle>
            <CardDescription>Your Cloudflare Workers</CardDescription>
          </CardHeader>
          <CardContent>
            {workers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workers found</p>
            ) : (
              <div className="space-y-2">
                {workers.map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{worker.name}</p>
                      <p className="text-sm text-muted-foreground">ID: {worker.id}</p>
                    </div>
                    <Badge variant="secondary">{worker.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KV Namespaces List */}
        <Card>
          <CardHeader>
            <CardTitle>KV Namespaces</CardTitle>
            <CardDescription>Your Key-Value stores</CardDescription>
          </CardHeader>
          <CardContent>
            {kvNamespaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">No KV namespaces found</p>
            ) : (
              <div className="space-y-2">
                {kvNamespaces.map((kv) => (
                  <div key={kv.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{kv.title}</p>
                      <p className="text-sm text-muted-foreground">ID: {kv.id}</p>
                    </div>
                    <Badge variant="outline">KV</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

