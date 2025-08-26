/**
 * Add Provider Modal Component
 * Simple modal for adding custom OpenAI-compatible providers
 */

import { useState } from 'react';
import { Plus, Loader2, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CreateProviderRequest, ModelProviderData } from '@/api-types';
import { useModelProviders } from '@/hooks/use-model-providers';
import { toast } from 'sonner';

interface AddProviderModalProps {
  trigger?: React.ReactNode;
  onProviderAdded?: (provider: ModelProviderData) => void;
}

export function AddProviderModal({ trigger, onProviderAdded }: AddProviderModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  
  const [formData, setFormData] = useState<CreateProviderRequest>({
    name: '',
    baseUrl: '',
    apiKey: ''
  });

  const { createProvider, testProvider } = useModelProviders();

  const handleTest = async () => {
    if (!formData.baseUrl || !formData.apiKey) {
      toast.error('Please enter both base URL and API key to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testProvider({
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey
    });

    if (result) {
      setTestResult(result);
    }
    setIsTesting(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.baseUrl || !formData.apiKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);

    const provider = await createProvider(formData);

    if (provider) {
      // Reset form
      setFormData({ name: '', baseUrl: '', apiKey: '' });
      setTestResult(null);
      setIsOpen(false);
      
      // Notify parent component
      onProviderAdded?.({ provider });
    }

    setIsCreating(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setFormData({ name: '', baseUrl: '', apiKey: '' });
    setTestResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Provider
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Custom Provider
          </DialogTitle>
          <DialogDescription>
            Add an OpenAI-compatible API provider to use custom models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-name">Provider Name</Label>
            <Input
              id="provider-name"
              placeholder="e.g., My Local Ollama"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              placeholder="https://api.example.com/v1"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            />
            <p className="text-xs text-text-tertiary">
              OpenAI-compatible API endpoint (should end with /v1)
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="your-api-key-here"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />
          </div>

          {/* Test Connection */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleTest}
              disabled={isTesting || !formData.baseUrl || !formData.apiKey}
              className="gap-2"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test Connection
            </Button>

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                <AlertDescription>
                  {testResult.success 
                    ? "✅ Connection successful!" 
                    : `❌ Connection failed: ${testResult.error}`
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isCreating || !formData.name || !formData.baseUrl || !formData.apiKey}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Add Provider'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}