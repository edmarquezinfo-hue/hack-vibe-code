import type { RouteObject } from 'react-router';

import Home from './routes/home';
import Chat from './routes/chat/chat';

const routes = [
	{
		path: '/',
		Component: Home,
	},
	{
		path: '/chat/:agentId',
		Component: Chat,
	},
] satisfies RouteObject[];

export { routes };
