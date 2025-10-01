import { useState, useEffect, useCallback } from 'react';

interface CloudflareResource {
  id: string;
  name: string;
  type: 'worker' | 'kv' | 'r2' | 'd1';
  [key: string]: any;
}

interface UseCloudflareMCPReturn {
  workers: CloudflareResource[];
  kvNamespaces: CloudflareResource[];
  r2Buckets: CloudflareResource[];
  d1Databases: CloudflareResource[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getWorkerDetails: (workerName: string) => Promise<any>;
}

export const useCloudflareMCP = (): UseCloudflareMCPReturn => {
  const [workers, setWorkers] = useState<CloudflareResource[]>([]);
  const [kvNamespaces, setKVNamespaces] = useState<CloudflareResource[]>([]);
  const [r2Buckets, setR2Buckets] = useState<CloudflareResource[]>([]);
  const [d1Databases, setD1Databases] = useState<CloudflareResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [workersRes, kvRes, r2Res, d1Res] = await Promise.all([
        fetch('/api/cloudflare?action=workers'),
        fetch('/api/cloudflare?action=kv'),
        fetch('/api/cloudflare?action=r2'),
        fetch('/api/cloudflare?action=d1'),
      ]);

      const [workersData, kvData, r2Data, d1Data] = await Promise.all([
        workersRes.json(),
        kvRes.json(),
        r2Res.json(),
        d1Res.json(),
      ]);

      if (workersData.success) {
        setWorkers(workersData.data || []);
      }
      if (kvData.success) {
        setKVNamespaces(kvData.data || []);
      }
      if (r2Data.success) {
        setR2Buckets(r2Data.data || []);
      }
      if (d1Data.success) {
        setD1Databases(d1Data.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Cloudflare data');
    } finally {
      setLoading(false);
    }
  }, []);

  const getWorkerDetails = useCallback(async (workerName: string) => {
    try {
      const response = await fetch(`/api/cloudflare?action=worker-details&workerName=${encodeURIComponent(workerName)}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to get worker details');
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get worker details');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    workers,
    kvNamespaces,
    r2Buckets,
    d1Databases,
    loading,
    error,
    refresh: fetchData,
    getWorkerDetails,
  };
};

