/**
 * Enhanced Auth Button
 * Provides OAuth + Email/Password authentication with enhanced UI
 */

import { useState } from 'react';
import { LogIn, LogOut, Settings, LayoutDashboard, UserCircle, Shield, Bell } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useAuth } from '../../contexts/auth-context';
import { LoginModal } from './login-modal';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuShortcut,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';

interface AuthButtonProps {
  className?: string;
}

export function AuthButton({ className }: AuthButtonProps) {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error,
    login, // OAuth method
    loginWithEmail, 
    register,
    logout,
    clearError 
  } = useAuth();
  
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (isLoading) {
    return <Skeleton className="w-10 h-10 rounded-full" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLoginModal(true)}
          className={clsx('gap-2', className)}
        >
          <LogIn className="h-4 w-4" />
          <span>Sign In</span>
        </Button>

        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={(provider) => {
            // For backward compatibility with original login interface
            login(provider);
            setShowLoginModal(false);
          }}
          onEmailLogin={async (credentials) => {
            await loginWithEmail(credentials);
            if (!error) {
              setShowLoginModal(false);
            }
          }}
          onOAuthLogin={(provider) => {
            login(provider);
            setShowLoginModal(false);
          }}
          onRegister={async (data) => {
            await register(data);
            if (!error) {
              setShowLoginModal(false);
            }
          }}
          error={error}
          onClearError={clearError}
        />
      </>
    );
  }

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email.charAt(0).toUpperCase();
  };

  // Determine provider badge color
  const getProviderColor = () => {
    switch (user.provider) {
      case 'google':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'github':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'email':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative rounded-full hover:ring-2 hover:ring-primary/20 transition-all"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          {user.emailVerified && (
            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <AnimatePresence>
        <DropdownMenuContent
          align="end"
          className="w-72"
          asChild
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <DropdownMenuLabel className="p-0">
              <div className="flex items-start gap-3 p-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{user.displayName || 'User'}</span>
                    {user.emailVerified && (
                      <Shield className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                  <Badge 
                    variant="outline" 
                    className={clsx("text-[10px] px-1.5 py-0 mt-1 w-fit", getProviderColor())}
                  >
                    {user.provider?.toUpperCase() || 'USER'}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => navigate('/dashboard')}
                className="cursor-pointer"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
                <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
              
              <DropdownMenuItem
                onClick={() => navigate('/profile')}
                className="cursor-pointer"
              >
                <UserCircle className="mr-2 h-4 w-4" />
                Profile
                <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              
              <DropdownMenuItem
                onClick={() => navigate('/settings')}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => navigate('/notifications')}
                className="cursor-pointer"
              >
                <Bell className="mr-2 h-4 w-4" />
                Notifications
                <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                  3
                </Badge>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
              <DropdownMenuShortcut>⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground">
                Last active: {user.lastActiveAt 
                  ? new Date(user.lastActiveAt).toLocaleDateString() 
                  : 'Just now'
                }
              </p>
            </div>
          </motion.div>
        </DropdownMenuContent>
      </AnimatePresence>
    </DropdownMenu>
  );
}