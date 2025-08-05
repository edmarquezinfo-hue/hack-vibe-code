import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { WebSocketMessage } from '@/routes/chat/api-types';

export interface GitHubExportOptions {
    repositoryName: string;
    isPrivate: boolean;
    description?: string;
}

export interface GitHubExportProgress {
    message: string;
    step: 'creating_repository' | 'uploading_files' | 'finalizing';
    progress: number;
}

export interface GitHubExportResult {
    success: boolean;
    repositoryUrl?: string;
    error?: string;
}

export interface GitHubExportState {
    isExporting: boolean;
    progress?: GitHubExportProgress;
    result?: GitHubExportResult;
    isModalOpen: boolean;
}

export function useGitHubExport(websocket?: WebSocket | any) {
    const { user, isAuthenticated } = useAuth();
    const [state, setState] = useState<GitHubExportState>({
        isExporting: false,
        isModalOpen: false
    });

    // Handle WebSocket messages for GitHub export
    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        switch (message.type) {
            case 'github_export_started':
                setState(prev => ({
                    ...prev,
                    isExporting: true,
                    progress: undefined,
                    result: undefined
                }));
                break;
            
            case 'github_export_progress':
                setState(prev => ({
                    ...prev,
                    progress: {
                        message: message.message,
                        step: message.step,
                        progress: message.progress
                    }
                }));
                break;
            
            case 'github_export_completed':
                setState(prev => ({
                    ...prev,
                    isExporting: false,
                    progress: undefined,
                    result: {
                        success: true,
                        repositoryUrl: message.repositoryUrl
                    }
                }));
                break;
            
            case 'github_export_error':
                setState(prev => ({
                    ...prev,
                    isExporting: false,
                    progress: undefined,
                    result: {
                        success: false,
                        error: message.error
                    }
                }));
                break;
        }
    }, []);

    // Set up WebSocket message listener
    useEffect(() => {
        if (!websocket) return;

        const handleMessage = (event: MessageEvent) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        websocket.addEventListener('message', handleMessage);
        return () => websocket.removeEventListener('message', handleMessage);
    }, [websocket, handleWebSocketMessage]);

    // Open the export modal
    const openModal = useCallback(() => {
        setState(prev => ({
            ...prev,
            isModalOpen: true,
            result: undefined // Clear any previous results
        }));
    }, []);

    // Close the export modal
    const closeModal = useCallback(() => {
        setState(prev => ({
            ...prev,
            isModalOpen: false,
            isExporting: false,
            progress: undefined,
            result: undefined
        }));
    }, []);

    // Start GitHub export
    const startExport = useCallback((options: GitHubExportOptions) => {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not connected');
            setState(prev => ({
                ...prev,
                result: {
                    success: false,
                    error: 'Connection to server lost. Please refresh the page.'
                }
            }));
            return;
        }

        // Send export request via WebSocket
        websocket.send(JSON.stringify({
            type: 'github_export',
            repositoryName: options.repositoryName,
            isPrivate: options.isPrivate,
            description: options.description,
            userId: user?.id
        }));

        setState(prev => ({
            ...prev,
            isExporting: true,
            progress: undefined,
            result: undefined
        }));
    }, [websocket, user?.id]);

    // Check if user has GitHub integration
    const checkGitHubIntegration = useCallback(async (): Promise<boolean> => {
        if (!isAuthenticated) return false;

        try {
            const response = await fetch('/api/integrations/github/status', {
                credentials: 'include'
            });
            
            if (!response.ok) return false;
            
            const data = await response.json();
            return data.hasIntegration || false;
        } catch (error) {
            console.error('Error checking GitHub integration:', error);
            return false;
        }
    }, [isAuthenticated]);

    // Connect GitHub account
    const connectGitHub = useCallback(() => {
        // Redirect to GitHub integration endpoint for authenticated users
        window.location.href = '/api/integrations/github/connect';
    }, []);

    return {
        ...state,
        openModal,
        closeModal,
        startExport,
        checkGitHubIntegration,
        connectGitHub,
        isAuthenticated,
        user
    };
}