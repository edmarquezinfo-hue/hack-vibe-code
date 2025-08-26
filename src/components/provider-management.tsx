/**
 * Provider Management Component
 * Manages custom model providers in settings page
 */

import { useState } from 'react';
import { Settings, TestTube, Trash2, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AddProviderModal } from './add-provider-modal';
import { useModelProviders } from '@/hooks/use-model-providers';
import type { UserModelProvider } from '@/api-types';

interface ProviderCardProps {
  provider: UserModelProvider;
  onTest: (providerId: string) => Promise<void>;
  onDelete: (providerId: string) => Promise<void>;
  isTesting?: boolean;
}

function ProviderCard({ provider, onTest, onDelete, isTesting }: ProviderCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(provider.id);
    setIsDeleting(false);
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{provider.name}</CardTitle>
            <CardDescription className="text-sm">
              {provider.baseUrl}
            </CardDescription>
          </div>
          <Badge variant={provider.isActive ? "default" : "secondary"}>
            {provider.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTest(provider.id)}
            disabled={isTesting}
            className="gap-2"
          >
            <TestTube className="h-3 w-3" />
            {isTesting ? 'Testing...' : 'Test'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(provider.baseUrl, '_blank')}
            className="gap-2"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Provider</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{provider.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProviderManagement() {
  const { providers, loading, testProvider, deleteProvider, refreshProviders } = useModelProviders();
  const [testingProviders, setTestingProviders] = useState<Set<string>>(new Set());

  const handleTestProvider = async (providerId: string) => {
    setTestingProviders(prev => new Set([...prev, providerId]));
    
    await testProvider({ providerId });
    
    setTestingProviders(prev => {
      const newSet = new Set(prev);
      newSet.delete(providerId);
      return newSet;
    });
  };

  const handleDeleteProvider = async (providerId: string) => {
    const success = await deleteProvider(providerId);
    if (success) {
      await refreshProviders();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Custom AI Providers
          </CardTitle>
          <CardDescription>
            Loading your custom model providers...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Custom AI Providers
            </CardTitle>
            <CardDescription>
              Manage your custom OpenAI-compatible model providers
            </CardDescription>
          </div>
          <AddProviderModal 
            onProviderAdded={refreshProviders}
            trigger={
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Provider
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-3">
              <Settings className="h-6 w-6 text-text-tertiary" />
            </div>
            <h3 className="text-sm font-medium">No custom providers</h3>
            <p className="text-sm text-text-tertiary mb-4">
              Add your first custom OpenAI-compatible provider to get started.
            </p>
            <AddProviderModal 
              onProviderAdded={refreshProviders}
              trigger={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Provider
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onTest={handleTestProvider}
                onDelete={handleDeleteProvider}
                isTesting={testingProviders.has(provider.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}