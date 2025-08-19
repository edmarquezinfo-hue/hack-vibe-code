import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import type { Blueprint } from '../../../worker/agents/schemas';
import {
	Star,
	Eye,
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
import { MonacoEditor } from '../../components/monaco-editor/monaco-editor';
import { getFileType } from '../../utils/string';
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

interface AgentState {
	generatedCode: Array<{
		file_path: string;
		file_contents: string;
		file_purpose?: string;
	}>;
	conversationMessages: Array<{
		type: 'user' | 'assistant';
		content: string;
		timestamp?: string;
	}>;
	originalPrompt: string;
	blueprint?: Blueprint;
	totalFiles: number;
	isGenerating: boolean;
}

// Match chat FileType interface
interface FileType {
	file_path: string;
	file_contents: string;
	explanation?: string;
	isGenerating?: boolean;
	needsFixing?: boolean;
	hasErrors?: boolean;
	language?: string;
}

export default function AppView() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [app, setApp] = useState<AppDetails | null>(null);
	const [agentState, setAgentState] = useState<AgentState | null>(null);
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
	const [activeFilePath, setActiveFilePath] = useState<string>();
	const previewIframeRef = useRef<HTMLIFrameElement>(null);

	const fetchAppDetails = useCallback(async () => {
		if (!id) return;

		try {
			setLoading(true);
			
			// Fetch app details and agent state in parallel
			const [appResponse, agentResponse] = await Promise.allSettled([
				fetch(`/api/apps/${id}`, { credentials: 'include' }),
				fetch(`/api/agent/${id}/state`, { credentials: 'include' })
			]);

			// Handle app details response
			if (appResponse.status === 'fulfilled' && appResponse.value.ok) {
				const appData = await appResponse.value.json();
				setApp(appData.data);
				setIsFavorited(appData.data.isFavorite || false);
				setIsStarred(appData.data.userHasStarred || false);
			} else if (appResponse.status === 'fulfilled') {
				if (appResponse.value.status === 404) {
					throw new Error('App not found');
				}
				throw new Error('Failed to fetch app details');
			} else {
				throw new Error('Failed to fetch app details');
			}

			// Handle agent state response (optional - may not exist for some apps)
			if (agentResponse.status === 'fulfilled' && agentResponse.value.ok) {
				const agentData = await agentResponse.value.json();
				setAgentState(agentData.data);
			} else {
				console.log('Agent state not available - this may be normal for some apps');
				setAgentState(null);
			}

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

	// Convert agent state files to chat FileType format
	const files = useMemo<FileType[]>(() => {
		if (!agentState?.generatedCode) return [];
		return agentState.generatedCode.map((file) => ({
			file_path: file.file_path,
			file_contents: file.file_contents,
			explanation: file.file_purpose,
			language: getFileType(file.file_path),
			isGenerating: false,
			needsFixing: false,
			hasErrors: false,
		}));
	}, [agentState?.generatedCode]);

	// Get active file
	const activeFile = useMemo(() => {
		return files.find((file) => file.file_path === activeFilePath);
	}, [files, activeFilePath]);

	// Auto-select first file when files are loaded
	useEffect(() => {
		if (files.length > 0 && !activeFilePath) {
			setActiveFilePath(files[0].file_path);
		}
	}, [files, activeFilePath]);

	// File click handler
	const handleFileClick = useCallback((file: FileType) => {
		setActiveFilePath(file.file_path);
	}, []);

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
			setIsStarred(data.data.isStarred);
			setApp((prev) =>
				prev ? { ...prev, stars: data.data.starCount } : null,
			);
			toast.success(data.data.isStarred ? 'Starred!' : 'Unstarred');
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
			console.log('Fork response:', data); // Debug log
			
			if (!data.data?.forkedAppId) {
				throw new Error('Invalid fork response: missing forkedAppId');
			}
			
			toast.success('App forked successfully!');
			navigate(`/chat/${data.data.forkedAppId}`);
		} catch (error) {
			console.error('Fork error:', error);
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
		<div className="min-h-screen bg-bg-3 flex flex-col">
			<div className="container mx-auto px-4 pb-6 space-y-6 flex flex-col flex-1">
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
				<Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
					<TabsList className="grid w-full max-w-md grid-cols-3">
						<TabsTrigger value="preview">Preview</TabsTrigger>
						<TabsTrigger value="code">Code</TabsTrigger>
						<TabsTrigger value="conversation">
							Conversation
						</TabsTrigger>
					</TabsList>

					<TabsContent value="preview" className="space-y-4 flex-1">
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
											devMode={false}
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

					<TabsContent value="code" className="flex-1">
						<Card className="flex flex-col" style={{height: 'calc(100vh - 300px)'}}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>Generated Code</CardTitle>
										{agentState && (
											<p className="text-sm text-muted-foreground">
												{files.length} files generated ({agentState.totalFiles} total planned)
											</p>
										)}
									</div>
									{activeFile && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												navigator.clipboard.writeText(activeFile.file_contents);
												toast.success('Code copied to clipboard');
											}}
											className="gap-2"
										>
											<Copy className="h-3 w-3" />
											Copy File
										</Button>
									)}
								</div>
							</CardHeader>
							<CardContent className="p-0 flex-1 flex flex-col">
								{files.length > 0 ? (
									<div className="flex-1 relative bg-bg-light overflow-hidden">
										<div className="absolute inset-0 flex">
											<div className="w-full max-w-[250px] bg-bg-light border-r border-text/10 h-full overflow-y-auto">
												<div className="p-2 px-3 text-sm flex items-center gap-1 text-text/50 font-medium border-b bg-background">
													<Code2 className="size-4" />
													Files
												</div>
												<div className="flex flex-col">
													{files.map((file) => (
														<button
															key={file.file_path}
															onClick={() => handleFileClick(file)}
															className={cn(
																"flex items-center w-full gap-2 py-2 px-3 text-left text-sm transition-colors",
																activeFile?.file_path === file.file_path
																	? "bg-blue-100 text-blue-900 border-r-2 border-blue-500"
																	: "hover:bg-muted text-muted-foreground hover:text-foreground"
															)}
														>
															<Code2 className="h-4 w-4 flex-shrink-0" />
															<span className="truncate font-mono text-xs">
																{file.file_path}
															</span>
														</button>
													))}
												</div>
											</div>
											
											<div className="flex-1 flex flex-col">
												{activeFile ? (
													<>
														<div className="flex items-center justify-between p-3 border-b bg-background">
															<div className="flex items-center gap-2 flex-1">
																<Code2 className="h-4 w-4" />
																<span className="text-sm font-mono">
																	{activeFile.file_path}
																</span>
																{activeFile.explanation && (
																	<span className="text-xs text-muted-foreground ml-3">
																		{activeFile.explanation}
																	</span>
																)}
															</div>
														</div>
														
														<div className="flex-1 min-h-0">
															<MonacoEditor
																className="h-full"
																createOptions={{
																	value: activeFile.file_contents,
																	language: activeFile.language || 'plaintext',
																	readOnly: true,
																	minimap: { enabled: false },
																	lineNumbers: 'on',
																	scrollBeyondLastLine: false,
																	fontSize: 13,
																	theme: 'v1-dev',
																	automaticLayout: true,
																}}
															/>
														</div>
													</>
												) : (
													<div className="flex-1 flex items-center justify-center">
														<p className="text-muted-foreground">Select a file to view</p>
													</div>
												)}
											</div>
										</div>
									</div>
								) : (
									<div className="flex items-center justify-center h-[400px]">
										<p className="text-muted-foreground">
											{agentState === null 
												? 'Loading code...' 
												: 'No code has been generated yet.'
											}
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="conversation" className="space-y-4 flex-1">
						<Card>
							<CardHeader>
								<CardTitle>Conversation History</CardTitle>
								<CardDescription>
									The prompts and interactions that created this app
								</CardDescription>
							</CardHeader>
							<CardContent>
								{agentState?.originalPrompt || agentState?.conversationMessages?.length ? (
									<div className="space-y-4">
										{/* Original Prompt */}
										{agentState.originalPrompt && (
											<div className="border-l-4 border-blue-500 pl-4 py-2">
												<div className="flex items-center gap-2 mb-2">
													<User className="h-4 w-4 text-blue-600" />
													<span className="text-sm font-medium text-blue-600">Original Prompt</span>
												</div>
												<p className="text-sm bg-blue-50 p-3 rounded">
													{agentState.originalPrompt}
												</p>
											</div>
										)}
										
										{/* Conversation Messages */}
										{agentState.conversationMessages && agentState.conversationMessages.length > 0 && (
											<div className="space-y-3">
												<h4 className="text-sm font-medium text-muted-foreground">Development Conversation</h4>
												{agentState.conversationMessages.map((message, index) => (
													<div
														key={index}
														className={cn(
															"border-l-4 pl-4 py-2",
															message.type === 'user' 
																? "border-green-500" 
																: "border-gray-400"
														)}
													>
														<div className="flex items-center gap-2 mb-2">
															{message.type === 'user' ? (
																<User className="h-4 w-4 text-green-600" />
															) : (
																<MessageSquare className="h-4 w-4 text-gray-600" />
															)}
															<span className={cn(
																"text-sm font-medium",
																message.type === 'user' 
																	? "text-green-600" 
																	: "text-gray-600"
															)}>
																{message.type === 'user' ? 'User' : 'Assistant'}
															</span>
															{message.timestamp && (
																<span className="text-xs text-muted-foreground">
																	{new Date(message.timestamp).toLocaleString()}
																</span>
															)}
														</div>
														<div className={cn(
															"text-sm p-3 rounded",
															message.type === 'user' 
																? "bg-green-50" 
																: "bg-gray-50"
														)}>
															{message.content}
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								) : (
									<div className="flex items-center justify-center py-12 text-muted-foreground">
										<MessageSquare className="h-8 w-8 mr-3" />
										<p>
											{agentState === null 
												? 'Loading conversation...' 
												: 'No conversation history available'
											}
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
