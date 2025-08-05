import { SidebarTrigger } from '@/components/ui/sidebar';
import { AuthButton } from '../auth/auth-button';
import { ThemeToggle } from '../theme-toggle';
import { motion } from 'framer-motion';

export function GlobalHeader() {
  return (
    <motion.header 
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="sticky top-0 z-50 bg-bg-light/80 backdrop-blur-xl"
    >
      <div className="relative">
        {/* Subtle gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-50/5 to-transparent" />
        
        {/* Main content - thinner height */}
        <div className="relative flex items-center justify-between px-5 h-12">
          {/* Left section */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <SidebarTrigger className="h-8 w-8 rounded-md hover:bg-orange-50/40 transition-colors duration-200" />
          </motion.div>
          
          {/* Right section */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2"
          >
            <ThemeToggle />
            <AuthButton />
          </motion.div>
        </div>
        
      </div>
    </motion.header>
  );
}