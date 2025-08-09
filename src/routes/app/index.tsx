import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import type { Blueprint } from '../../../worker/agents/schemas';
import {
	Star,
	Eye,
	GitBranch,
	Code2,
	ChevronLeft,
	ExternalLink,
	Copy,
	Check,
	Loader2,
	MessageSquare,
	Calendar,
	User,
	Play,
	Lock,
	Unlock,
	Bookmark,
	Shuffle,
	Globe,
} from 'lucide-react';
import { SmartPreviewIframe } from '../chat/components/smart-preview-iframe';
import { WebSocket } from 'partysocket';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { toggleFavorite } from '@/hooks/use-apps';
import { formatDistanceToNow, isValid } from 'date-fns';
import { toast } from 'sonner';
import { capitalizeFirstLetter, cn, getPreviewUrl } from '@/lib/utils';

interface AppDetails {
	id: string;
	title: string;
	description?: string;
	framework?: string;
	visibility: 'private' | 'team' | 'board' | 'public';
	isFavorite?: boolean;
	views?: number;
	stars?: number;
	cloudflareUrl?: string;
	previewUrl?: string;
	createdAt: string;
	updatedAt: string;
	userId: string;
	user?: {
		id: string;
		displayName: string;
		avatarUrl?: string;
	};
	blueprint?: Blueprint;
	generatedCode?: Array<{
		file_path: string;
		file_contents: string;
		explanation?: string;
	}>;
}

export default function AppView() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [app, setApp] = useState<AppDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isFavorited, setIsFavorited] = useState(false);
	const [isStarred, setIsStarred] = useState(false);
	const [copySuccess, setCopySuccess] = useState(false);
	const [activeTab, setActiveTab] = useState('preview');
	const [isDeploying, setIsDeploying] = useState(false);
	const [websocket, setWebsocket] = useState<WebSocket | null>(null);
	const [deploymentProgress, setDeploymentProgress] = useState<string>('');
	const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
	const previewIframeRef = useRef<HTMLIFrameElement>(null);

	const fetchAppDetails = useCallback(async () => {
		if (!id) return;

		try {
			setLoading(true);
			const response = await fetch(`/api/apps/${id}`, {
				credentials: 'include',
			});

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('App not found');
				}
				throw new Error('Failed to fetch app details');
			}

			const data = await response.json();
			setApp(data.data);
			setIsFavorited(data.data.isFavorite || false);
			setIsStarred(data.data.userHasStarred || false);
		} catch (err) {
			console.error('Error fetching app:', err);
			setError(err instanceof Error ? err.message : 'Failed to load app');
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		fetchAppDetails();
	}, [id, fetchAppDetails]);

	const handleFavorite = async () => {
		if (!user || !app) {
			toast.error('Please sign in to bookmark apps');
			return;
		}

		try {
			const newState = await toggleFavorite(app.id);
			setIsFavorited(newState);
			toast.success(
				newState ? 'Added to bookmarks' : 'Removed from bookmarks',
			);
		} catch (error) {
			toast.error('Failed to update bookmarks');
		}
	};

	const handleStar = async () => {
		if (!user || !app) {
			toast.error('Please sign in to star apps');
			return;
		}

		try {
			const response = await fetch(`/api/apps/${app.id}/star`, {
				method: 'POST',
				credentials: 'include',
			});

			if (!response.ok) {
				throw new Error('Failed to star app');
			}

			const data = await response.json();
			setIsStarred(data.isStarred);
			setApp((prev) =>
				prev ? { ...prev, stars: data.starCount } : null,
			);
			toast.success(data.isStarred ? 'Starred!' : 'Unstarred');
		} catch (error) {
			toast.error('Failed to update star');
		}
	};

	const handleFork = async () => {
		if (!user || !app) {
			toast.error('Please sign in to fork apps');
			return;
		}

		try {
			const response = await fetch(`/api/apps/${app.id}/fork`, {
				method: 'POST',
				credentials: 'include',
			});

			if (!response.ok) {
				throw new Error('Failed to fork app');
			}

			const data = await response.json();
			toast.success('App forked successfully!');
			navigate(`/chat/${data.forkedAppId}`);
		} catch (error) {
			toast.error('Failed to fork app');
		}
	};

	const handleWorkFurther = () => {
		if (!app) return;

		if (app.userId === user?.id) {
			// Owner can directly edit
			navigate(`/chat/${app.id}`);
		} else {
			// Non-owners need to fork first
			handleFork();
		}
	};

	const handleCopyUrl = () => {
		if (!app?.cloudflareUrl) return;

		navigator.clipboard.writeText(app.cloudflareUrl);
		setCopySuccess(true);
		setTimeout(() => setCopySuccess(false), 2000);
	};

	const getAppUrl = () => {
		return app?.cloudflareUrl || app?.previewUrl || '';
	};

	const handlePreviewDeploy = async () => {
		if (!app || isDeploying) return;

		try {
			setIsDeploying(true);
			setDeploymentProgress('Connecting to agent...');

			// Connect to existing agent
			const response = await fetch(`/api/agent/${app.id}`, {
				method: 'GET',
				credentials: 'include',
			});

			if (!response.ok) {
				throw new Error('Failed to connect to agent');
			}

			const data = await response.json();
			if (data.data.websocketUrl && data.data.agentId) {
				// Connect to WebSocket
				const ws = new WebSocket(data.data.websocketUrl);
				setWebsocket(ws);

				ws.onopen = () => {
					setDeploymentProgress(
						'Connected to agent. Starting deployment...',
					);
					// Send PREVIEW request
					ws.send(
						JSON.stringify({
							type: 'preview',
							agentId: data.data.agentId,
						}),
					);
				};

				ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data);
						if (message.type === 'phase_update') {
							setDeploymentProgress(
								message.phase || 'Deploying...',
							);
						} else if (message.previewURL || message.tunnelURL) {
							const newUrl = getPreviewUrl(
								message.previewURL,
								message.tunnelURL,
							);
							setApp((prev) =>
								prev
									? {
											...prev,
											cloudflareUrl: newUrl,
											previewUrl: newUrl,
										}
									: null,
							);
							setDeploymentProgress('Deployment complete!');
						}
					} catch (e) {
						console.error('Error parsing WebSocket message:', e);
					}
				};

				ws.onerror = () => {
					setDeploymentProgress(
						'Deployment failed. Please try again.',
					);
					setIsDeploying(false);
				};

				ws.onclose = () => {
					setIsDeploying(false);
					setWebsocket(null);
				};
			}
		} catch (error) {
			console.error('Error starting deployment:', error);
			setDeploymentProgress('Failed to start deployment');
			setIsDeploying(false);
			toast.error('Failed to start deployment');
		}
	};

	const handleToggleVisibility = async () => {
		if (!app || !user || !isOwner) {
			toast.error('You can only change visibility of your own apps');
			return;
		}

		try {
			setIsUpdatingVisibility(true);
			const newVisibility =
				app.visibility === 'private' ? 'public' : 'private';

			const response = await fetch(`/api/apps/${app.id}/visibility`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ visibility: newVisibility }),
			});

			if (!response.ok) {
				let errorMessage = 'Failed to update visibility';
				try {
					const errorData = await response.json();
					errorMessage =
						errorData.message || errorData.error || errorMessage;
				} catch {
					// If JSON parsing fails, use status-based message
					errorMessage = `Server error (${response.status}): ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			await response.json();

			// Update the app state with new visibility
			setApp((prev) =>
				prev ? { ...prev, visibility: newVisibility } : null,
			);

			toast.success(
				`App is now ${newVisibility === 'private' ? 'private' : 'public'}`,
			);
		} catch (error) {
			console.error('Error updating app visibility:', error);
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to update visibility',
			);
		} finally {
			setIsUpdatingVisibility(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-bg-3 flex items-center justify-center">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
					<p className="text-muted-foreground">Loading app...</p>
				</div>
			</div>
		);
	}

	if (error || !app) {
		return (
			<div className="min-h-screen bg-bg-3 flex items-center justify-center">
				<Card className="max-w-md">
					<CardContent className="pt-6">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-2">
								App not found
							</h2>
							<p className="text-muted-foreground mb-4">
								{error ||
									"The app you're looking for doesn't exist."}
							</p>
							<Button onClick={() => navigate('/apps')}>
								<ChevronLeft className="mr-2 h-4 w-4" />
								Back to Apps
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	const isOwner = app.userId === user?.id;
	const appUrl = getAppUrl();
	const createdDate = new Date(app.createdAt);

	return (
		<div className="min-h-screen bg-bg-3">
			<div className="container mx-auto px-4 pb-6 space-y-6">
				{/* Back button */}
				<button
					onClick={() => navigate('/apps')}
					className="gap-2 flex items-center text-primary/80"
				>
					<ChevronLeft className="h-4 w-4" />
					Back to Apps
				</button>

				{/* App Info Section */}
				<div className="px-3 flex flex-col items-start justify-between gap-4">
					<div className="flex-1">
						<div className="flex items-center gap-3 mb-2">
							<h1 className="text-4xl font-semibold tracking-tight">
								{app.title}
							</h1>

							<div className="flex items-center gap-2 border rounded-xl">
								<Badge variant={'default'}>
									<Globe />
									{capitalizeFirstLetter(app.visibility)}
								</Badge>
								{isOwner && (
									<Button
										variant="ghost"
										size="sm"
										onClick={handleToggleVisibility}
										disabled={isUpdatingVisibility}
										className="h-6 w-6 p-0 hover:bg-muted/50 -ml-1.5 !mr-1.5"
										title={`Make ${app.visibility === 'private' ? 'public' : 'private'}`}
									>
										{isUpdatingVisibility ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : app.visibility === 'private' ? (
											<Unlock className="h-3 w-3" />
										) : (
											<Lock className="h-3 w-3" />
										)}
									</Button>
								)}
							</div>
						</div>
						<div className="flex flex-wrap gap-2 mb-6">
							<Button
								variant="outline"
								size="sm"
								onClick={handleFavorite}
								className={cn(
									'gap-2',
									isFavorited &&
										'text-yellow-600 border-yellow-600',
								)}
							>
								<Bookmark
									className={cn(
										'h-4 w-4',
										isFavorited && 'fill-current',
									)}
								/>
								{isFavorited ? 'Bookmarked' : 'Bookmark'}
							</Button>

							<Button
								variant="outline"
								size="sm"
								onClick={handleStar}
								className={cn(
									'gap-2',
									isStarred &&
										'text-blue-600 border-blue-600',
								)}
							>
								<Star
									className={cn(
										'h-4 w-4',
										isStarred && 'fill-current',
									)}
								/>
								{isStarred ? 'Starred' : 'Star'}
							</Button>

							<Button
								variant="outline"
								size="sm"
								onClick={handleFork}
								className="gap-2"
							>
								<GitBranch className="h-4 w-4" />
								Fork
							</Button>

							<Button
								size="sm"
								onClick={handleWorkFurther}
								className="gap-2"
							>
								{isOwner ? (
									<Code2 className="h-4 w-4" />
								) : (
									<Shuffle className="h-4 w-4" />
								)}
								{isOwner ? 'Continue Editing' : 'Remix'}
							</Button>
						</div>

						{app.description && (
							<p className="text-gray-600 my-3 max-w-4xl">
								{app.description}
							</p>
						)}

						<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
							{app.user && (
								<div className="flex items-center gap-2">
									<User className="h-4 w-4" />
									<span>{app.user.displayName}</span>
								</div>
							)}
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4" />
								<span>
									{isValid(createdDate)
										? formatDistanceToNow(createdDate, {
												addSuffix: true,
											})
										: 'recently'}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Eye className="h-4 w-4" />
								<span>{app.views || 0}</span>
							</div>
							<div className="flex items-center gap-2">
								<Star className="h-4 w-4" />
								<span>{app.stars || 0}</span>
							</div>
						</div>
					</div>
				</div>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full max-w-md grid-cols-3">
						<TabsTrigger value="preview">Preview</TabsTrigger>
						<TabsTrigger value="code">Code</TabsTrigger>
						<TabsTrigger value="conversation">
							Conversation
						</TabsTrigger>
					</TabsList>

					<TabsContent value="preview" className="space-y-4">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-base">
										Live Preview
									</CardTitle>
									<div className="flex items-center gap-0">
										{appUrl && (
											<>
												<Button
													variant="ghost"
													size="sm"
													onClick={handleCopyUrl}
													className="gap-2"
												>
													{copySuccess ? (
														<>
															<Check className="h-3 w-3" />
															Copied!
														</>
													) : (
														<>
															<Copy className="h-3 w-3" />
														</>
													)}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														window.open(
															appUrl,
															'_blank',
														)
													}
													className="gap-2"
												>
													<ExternalLink className="h-3 w-3" />
												</Button>
											</>
										)}
									</div>
								</div>
							</CardHeader>
							<CardContent className="p-0">
								<div className="border-t relative">
									{appUrl ? (
										<SmartPreviewIframe
											ref={previewIframeRef}
											src={appUrl}
											className="w-full h-[600px] lg:h-[800px]"
											title={`${app.title} Preview`}
											webSocket={websocket}
										/>
									) : (
										<div className="relative w-full h-[400px] bg-gray-50 flex items-center justify-center">
											{/* Frosted glass overlay */}
											<div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
												<div className="text-center p-8">
													<h3 className="text-xl font-semibold mb-2 text-gray-700">
														Run App
													</h3>
													<p className="text-gray-500 mb-6 max-w-md">
														Run the app to see a
														live preview.
													</p>
													{deploymentProgress && (
														<p className="text-sm text-gray-800 mb-4">
															{deploymentProgress}
														</p>
													)}
													<div className="flex gap-3 justify-center">
														<Button
															onClick={
																handlePreviewDeploy
															}
															disabled={
																isDeploying
															}
															className="gap-2"
														>
															{isDeploying ? (
																<>
																	<Loader2 className="h-4 w-4 animate-spin" />
																	Deploying...
																</>
															) : (
																<>
																	<Play className="h-4 w-4" />
																	Deploy for
																	Preview
																</>
															)}
														</Button>
													</div>
												</div>
											</div>
											{/* Background pattern */}
											<div className="absolute inset-0 opacity-10">
												<div
													className="w-full h-full"
													style={{
														backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='0.1'%3E%3Cpath d='M20 20c0 11.046-8.954 20-20 20V0c11.046 0 20 8.954 20 20z'/%3E%3C/g%3E%3C/svg%3E")`,
														backgroundSize:
															'40px 40px',
													}}
												/>
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="code" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Generated Code</CardTitle>
							</CardHeader>
							<CardContent>
								{app.generatedCode &&
								app.generatedCode.length > 0 ? (
									<div className="space-y-4">
										{app.generatedCode.map(
											(file, index) => (
												<div
													key={index}
													className="border rounded-lg p-4"
												>
													<div className="flex items-center justify-between mb-2">
														<code className="text-sm font-mono">
															{file.file_path}
														</code>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => {
																navigator.clipboard.writeText(
																	file.file_contents,
																);
																toast.success(
																	'Code copied to clipboard',
																);
															}}
														>
															<Copy className="h-3 w-3" />
														</Button>
													</div>
													<pre className="bg-muted p-3 rounded overflow-x-auto">
														<code className="text-xs">
															{file.file_contents.slice(
																0,
																500,
															)}
															...
														</code>
													</pre>
												</div>
											),
										)}
									</div>
								) : (
									<p className="text-muted-foreground text-center py-8">
										No code has been generated yet.
									</p>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="conversation" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Conversation History</CardTitle>
								<CardDescription>
									The prompts and interactions that created
									this app
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-center py-12 text-muted-foreground">
									<MessageSquare className="h-8 w-8 mr-3" />
									<p>Conversation history coming soon</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
