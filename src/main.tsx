import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { routes } from './routes.ts';
import './index.css';

// Type for React Router hydration data
declare global {
  interface Window {
    __staticRouterHydrationData?: unknown;
  }
}

const router = createBrowserRouter(routes, {
	hydrationData: window.__staticRouterHydrationData,
});

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
);
