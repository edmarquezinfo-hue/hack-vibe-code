import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    Github, 
    Lock, 
    Globe, 
    Upload, 
    CheckCircle, 
    AlertCircle, 
    Loader
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface GitHubExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (options: {
        repositoryName: string;
        isPrivate: boolean;
        description?: string;
    }) => void;
    isExporting?: boolean;
    exportProgress?: {
        message: string;
        step: 'creating_repository' | 'uploading_files' | 'finalizing';
        progress: number;
    };
    exportResult?: {
        success: boolean;
        repositoryUrl?: string;
        error?: string;
    };
}

export function GitHubExportModal({
    isOpen,
    onClose,
    onExport,
    isExporting = false,
    exportProgress,
    exportResult
}: GitHubExportModalProps) {
    const { isAuthenticated } = useAuth();
    const [repositoryName, setRepositoryName] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [hasGitHubIntegration, setHasGitHubIntegration] = useState<boolean | null>(null);
    const [checkingIntegration, setCheckingIntegration] = useState(false);

    // Check GitHub integration status when modal opens and user is authenticated
    useEffect(() => {
        if (!isOpen || !isAuthenticated) {
            setHasGitHubIntegration(null);
            return;
        }

        const checkIntegration = async () => {
            setCheckingIntegration(true);
            try {
                const response = await fetch('/api/integrations/github/status', {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('GitHub integration API response:', data);
                    setHasGitHubIntegration(data.data?.hasIntegration || false);
                } else {
                    console.error('GitHub integration API error:', response.status, response.statusText);
                    setHasGitHubIntegration(false);
                }
            } catch (error) {
                console.error('Error checking GitHub integration:', error);
                setHasGitHubIntegration(false);
            } finally {
                setCheckingIntegration(false);
            }
        };

        checkIntegration();
    }, [isOpen, isAuthenticated]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isAuthenticated || !hasGitHubIntegration) {
            // Redirect to GitHub integration
            window.location.href = '/api/integrations/github/connect';
            return;
        }

        if (!repositoryName.trim()) {
            return;
        }

        onExport({
            repositoryName: repositoryName.trim(),
            isPrivate,
            description: description.trim() || undefined
        });
    }, [repositoryName, description, isPrivate, onExport, isAuthenticated, hasGitHubIntegration]);

    const handleClose = useCallback(() => {
        if (!isExporting) {
            onClose();
        }
    }, [isExporting, onClose]);

    // Auto-generate repository name based on current timestamp
    React.useEffect(() => {
        if (isOpen && !repositoryName) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
            setRepositoryName(`generated-app-${timestamp}`);
        }
    }, [isOpen, repositoryName]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-bg border border-border rounded-xl max-w-md w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-bg-lighter rounded-lg">
                                <Github className="w-5 h-5 text-text" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-text">Export to GitHub</h2>
                                <p className="text-sm text-text/60">Create a new repository with your generated code</p>
                            </div>
                        </div>
                        {!isExporting && (
                            <button
                                onClick={handleClose}
                                className="p-1 hover:bg-bg-lighter rounded-md transition-colors"
                            >
                                <X className="w-5 h-5 text-text/60" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    {!isAuthenticated || (isAuthenticated && checkingIntegration) ? (
                        /* Authentication/Loading State */
                        <div className="text-center py-8">
                            {!isAuthenticated ? (
                                <>
                                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg mb-4">
                                        <Github className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                                        <p className="text-sm text-orange-800 dark:text-orange-200">
                                            Authentication required to export your code
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => window.location.href = '/api/integrations/github/connect'}
                                        className="w-full bg-[#24292e] hover:bg-[#1a1e22] text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Github className="w-4 h-4" />
                                        Connect GitHub Account
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Loader className="w-8 h-8 text-text/60 mx-auto mb-2 animate-spin" />
                                    <p className="text-sm text-text/60">
                                        Checking GitHub integration...
                                    </p>
                                </>
                            )}
                        </div>
                    ) : isAuthenticated && hasGitHubIntegration === false ? (
                        /* GitHub Integration Required */
                        <div className="text-center py-8">
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg mb-4">
                                <Github className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                                <p className="text-sm text-orange-800 dark:text-orange-200">
                                    GitHub integration required to export your code
                                </p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/api/integrations/github/connect'}
                                className="w-full bg-[#24292e] hover:bg-[#1a1e22] text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Github className="w-4 h-4" />
                                Connect GitHub Account
                            </button>
                        </div>
                    ) : exportResult ? (
                        /* Export Result */
                        <div className="text-center py-8">
                            {exportResult.success ? (
                                <div>
                                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-text mb-2">Export Successful!</h3>
                                    <p className="text-sm text-text/60 mb-4">
                                        Your code has been successfully exported to GitHub
                                    </p>
                                    <a
                                        href={exportResult.repositoryUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 bg-bg-lighter hover:bg-border text-text py-2 px-4 rounded-lg transition-colors"
                                    >
                                        <Github className="w-4 h-4" />
                                        View Repository
                                    </a>
                                </div>
                            ) : (
                                <div>
                                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-text mb-2">Export Failed</h3>
                                    <p className="text-sm text-text/60 mb-4">
                                        {exportResult.error || 'An error occurred during export'}
                                    </p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="bg-bg-lighter hover:bg-border text-text py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : isExporting && exportProgress ? (
                        /* Export Progress */
                        <div className="py-8">
                            <div className="text-center mb-6">
                                <Loader className="w-8 h-8 text-brand mx-auto mb-4 animate-spin" />
                                <h3 className="text-lg font-semibold text-text mb-2">Exporting to GitHub</h3>
                                <p className="text-sm text-text/60">{exportProgress.message}</p>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-text/60 mb-2">
                                    <span>Progress</span>
                                    <span>{exportProgress.progress}%</span>
                                </div>
                                <div className="w-full bg-bg-lighter rounded-full h-2">
                                    <motion.div
                                        className="bg-brand h-2 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${exportProgress.progress}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>
                            
                            {/* Step Indicators */}
                            <div className="flex justify-between text-xs">
                                <div className={`flex items-center gap-1 ${
                                    exportProgress.step === 'creating_repository' ? 'text-brand' : 
                                    exportProgress.progress > 30 ? 'text-green-500' : 'text-text/40'
                                }`}>
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                    Creating Repository
                                </div>
                                <div className={`flex items-center gap-1 ${
                                    exportProgress.step === 'uploading_files' ? 'text-brand' : 
                                    exportProgress.progress > 70 ? 'text-green-500' : 'text-text/40'
                                }`}>
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                    Uploading Files
                                </div>
                                <div className={`flex items-center gap-1 ${
                                    exportProgress.step === 'finalizing' ? 'text-brand' : 
                                    exportProgress.progress > 90 ? 'text-green-500' : 'text-text/40'
                                }`}>
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                    Finalizing
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Export Form */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Repository Name */}
                            <div>
                                <label className="block text-sm font-medium text-text mb-2">
                                    Repository Name *
                                </label>
                                <input
                                    type="text"
                                    value={repositoryName}
                                    onChange={(e) => setRepositoryName(e.target.value)}
                                    placeholder="my-awesome-app"
                                    className="w-full px-3 py-2 bg-bg-lighter border border-border rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-text mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="A brief description of your app..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-bg-lighter border border-border rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand resize-none"
                                />
                            </div>

                            {/* Privacy Setting */}
                            <div>
                                <label className="block text-sm font-medium text-text mb-3">
                                    Repository Privacy
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-3 bg-bg-lighter rounded-lg cursor-pointer hover:bg-border transition-colors">
                                        <input
                                            type="radio"
                                            name="privacy"
                                            checked={!isPrivate}
                                            onChange={() => setIsPrivate(false)}
                                            className="w-4 h-4 text-brand focus:ring-brand/50"
                                        />
                                        <Globe className="w-4 h-4 text-text/60" />
                                        <div>
                                            <p className="text-sm font-medium text-text">Public</p>
                                            <p className="text-xs text-text/60">Anyone can see this repository</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-bg-lighter rounded-lg cursor-pointer hover:bg-border transition-colors">
                                        <input
                                            type="radio"
                                            name="privacy"
                                            checked={isPrivate}
                                            onChange={() => setIsPrivate(true)}
                                            className="w-4 h-4 text-brand focus:ring-brand/50"
                                        />
                                        <Lock className="w-4 h-4 text-text/60" />
                                        <div>
                                            <p className="text-sm font-medium text-text">Private</p>
                                            <p className="text-xs text-text/60">Only you can see this repository</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 bg-bg-lighter hover:bg-border text-text py-2 px-4 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!repositoryName.trim()}
                                    className="flex-1 bg-brand hover:bg-brand/90 disabled:bg-brand/50 text-text-on-brand py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    Export to GitHub
                                </button>
                            </div>
                        </form>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}