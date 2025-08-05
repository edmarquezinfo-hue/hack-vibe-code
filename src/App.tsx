import { Outlet } from 'react-router';
import { AuthProvider } from './contexts/auth-context';
import { ThemeProvider } from './contexts/theme-context';
import { Toaster } from './components/ui/sonner';
import { AppLayout } from './components/layout/app-layout';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}