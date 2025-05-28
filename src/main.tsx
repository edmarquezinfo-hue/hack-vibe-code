import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';

import { routes } from './routes.ts';
import './index.css';
import { RouterProvider } from 'react-router/dom';

const router = createBrowserRouter(routes, {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	hydrationData: (window as any).__staticRouterHydrationData,
});

createRoot(document.getElementById('root')!).render(
	<RouterProvider router={router} />,
);
