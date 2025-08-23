/**
 * Authentication Modal Provider
 * Provides global authentication modal management
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { LoginModal } from './login-modal';
import { useAuth } from '../../contexts/auth-context';

interface AuthModalContextType {
  showAuthModal: (context?: string) => void;
  hideAuthModal: () => void;
  isAuthModalOpen: boolean;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}

interface AuthModalProviderProps {
  children: React.ReactNode;
}

export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<string | undefined>();
  const { login, error, clearError } = useAuth();

  const showAuthModal = useCallback((context?: string) => {
    setModalContext(context);
    setIsAuthModalOpen(true);
  }, []);

  const hideAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setModalContext(undefined);
    clearError();
  }, [clearError]);

  const handleLogin = useCallback((provider: 'google' | 'github', redirectUrl?: string) => {
    login(provider, redirectUrl);
  }, [login]);

  const value: AuthModalContextType = {
    showAuthModal,
    hideAuthModal,
    isAuthModalOpen,
  };

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <LoginModal
        isOpen={isAuthModalOpen}
        onClose={hideAuthModal}
        onLogin={login} // Fallback for backward compatibility
        onOAuthLogin={handleLogin}
        error={error}
        onClearError={clearError}
        actionContext={modalContext}
      />
    </AuthModalContext.Provider>
  );
}