/**
 * Hook for managing custom model providers
 * Provides CRUD operations and caching for model providers
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { 
  UserModelProvider,
  CreateProviderRequest,
  UpdateProviderRequest,
  TestProviderRequest,
  ModelProviderTestData
} from '@/api-types';
import { toast } from 'sonner';

interface UseModelProvidersReturn {
  providers: UserModelProvider[];
  loading: boolean;
  error: string | null;
  createProvider: (data: CreateProviderRequest) => Promise<UserModelProvider | null>;
  updateProvider: (providerId: string, data: UpdateProviderRequest) => Promise<UserModelProvider | null>;
  deleteProvider: (providerId: string) => Promise<boolean>;
  testProvider: (data: TestProviderRequest) => Promise<ModelProviderTestData | null>;
  refreshProviders: () => Promise<void>;
}

export function useModelProviders(): UseModelProvidersReturn {
  const [providers, setProviders] = useState<UserModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.getModelProviders();
      
      if (response.success) {
        setProviders(response.data.providers);
      } else {
        setError(response.error || null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch providers';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const createProvider = useCallback(async (data: CreateProviderRequest): Promise<UserModelProvider | null> => {
    try {
      const response = await apiClient.createModelProvider(data);
      
      if (response.success) {
        const newProvider = response.data.provider;
        setProviders(prev => [...prev, newProvider]);
        toast.success(`Provider "${data.name}" created successfully`);
        return newProvider;
      } else {
        toast.error(response.error);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create provider';
      toast.error(errorMessage);
      return null;
    }
  }, []);

  const updateProvider = useCallback(async (providerId: string, data: UpdateProviderRequest): Promise<UserModelProvider | null> => {
    try {
      const response = await apiClient.updateModelProvider(providerId, data);
      
      if (response.success) {
        const updatedProvider = response.data.provider;
        setProviders(prev => prev.map(p => p.id === providerId ? updatedProvider : p));
        toast.success('Provider updated successfully');
        return updatedProvider;
      } else {
        toast.error(response.error);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update provider';
      toast.error(errorMessage);
      return null;
    }
  }, []);

  const deleteProvider = useCallback(async (providerId: string): Promise<boolean> => {
    try {
      const response = await apiClient.deleteModelProvider(providerId);
      
      if (response.success) {
        setProviders(prev => prev.filter(p => p.id !== providerId));
        toast.success('Provider deleted successfully');
        return true;
      } else {
        toast.error(response.error);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete provider';
      toast.error(errorMessage);
      return false;
    }
  }, []);

  const testProvider = useCallback(async (data: TestProviderRequest): Promise<ModelProviderTestData | null> => {
    try {
      const response = await apiClient.testModelProvider(data);
      
      if (response.success) {
        const testResult = response.data;
        if (testResult.success) {
          toast.success(`Connection successful (${testResult.responseTime}ms)`);
        } else {
          toast.error(`Connection failed: ${testResult.error}`);
        }
        return testResult;
      } else {
        toast.error(response.error);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test provider';
      toast.error(errorMessage);
      return null;
    }
  }, []);

  const refreshProviders = useCallback(async () => {
    await fetchProviders();
  }, [fetchProviders]);

  return {
    providers,
    loading,
    error,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
    refreshProviders
  };
}