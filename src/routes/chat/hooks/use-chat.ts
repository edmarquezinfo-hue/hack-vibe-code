import { WebSocket } from 'partysocket';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
	BlueprintType,
	GeneratedFile,
	WebSocketMessage,
	ApiResponse,
	CodeFixEdits,
} from '../api-types';
import {
	createRepairingJSONParser,
	ndjsonStream,
} from '../../../utils/ndjson-parser/ndjson-parser';
import { getFileType } from '../../../utils/string';
import { logger } from '../../../utils/logger';

export interface FileType {
	file_path: string;
	file_contents: string;
	explanation?: string;
	isGenerating?: boolean;
	needsFixing?: boolean;
	hasErrors?: boolean;
	language?: string;
}

export interface Phase {
	id: 'bootstrap' | 'blueprint' | 'code' | 'validate' | 'fix';
	title: string;
	status: 'pending' | 'active' | 'completed' | 'error';
	metadata?: string;
}

const initialPhases: Phase[] = [
	{
		id: 'bootstrap',
		title: 'Bootstrapping project',
		status: 'active',
	},
	{
		id: 'blueprint',
		title: 'Generating Blueprint',
		status: 'pending',
	},
	{ id: 'code', title: 'Generating code', status: 'pending' },
	{ id: 'validate', title: 'Validating code', status: 'pending' },
	// { id: 'fixingErrors', title: 'Fixing errors', status: 'pending' },
];

type ChatMessage = {
	type: 'user' | 'ai';
	id: string;
	message: string;
	isThinking?: boolean;
};

export function useChat({
	agentId,
	query: userQuery,
}: {
	agentId?: string;
	query: string | null;
}) {
	const connectionStatus = useRef<'idle' | 'connecting' | 'connected'>('idle');
	const [chatId, setChatId] = useState<string>();
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ type: 'ai', id: 'main', message: 'Thinking...', isThinking: true },
	]);

	const [bootstrapFiles, setBootstrapFiles] = useState<FileType[]>([]);
	const [blueprint, setBlueprint] = useState<BlueprintType>();
	const [previewUrl, setPreviewUrl] = useState<string>();
	const [query, setQuery] = useState<string>();

	const [websocket, setWebsocket] = useState<WebSocket>();

	const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
	const [isBootstrapping, setIsBootstrapping] = useState(true);

	const [projectPhases, setProjectPhases] = useState<Phase[]>(initialPhases);

	const [files, setFiles] = useState<FileType[]>([]);

	const [totalFiles, setTotalFiles] = useState<number>();

	const [edit, setEdit] = useState<Omit<CodeFixEdits, 'type'>>();

	const updatePhase = useCallback(
		(phaseId: Phase['id'], data: Partial<Omit<Phase, 'id'>>) => {
			logger.debug('updatePhase', { phaseId, ...data });
			setProjectPhases((prevPhases) =>
				prevPhases.map((phase) =>
					phase.id === phaseId ? { ...phase, ...data } : phase,
				),
			);
		},
		[],
	);

	const onCompleteBootstrap = useCallback(() => {
		updatePhase('bootstrap', { status: 'completed' });
	}, [updatePhase]);

	const clearEdit = useCallback(() => {
		setEdit(undefined);
	}, []);

	const sendMessage = useCallback((message: Omit<ChatMessage, 'type'>) => {
		setMessages((prev) => {
			if (prev.some((m) => m.id === message.id && m.type === 'ai')) {
				return prev.map((msg) =>
					msg.id === message.id ? { ...msg, ...message } : msg,
				);
			}
			return [...prev, { type: 'ai', ...message }];
		});
	}, []);

	const sendUserMessage = useCallback((message: string) => {
		setMessages((prev) => [
			...prev,
			{ type: 'user', id: crypto.randomUUID(), message },
		]);
	}, []);

	const loadBootstrapFiles = (files: FileType[]) => {
		setBootstrapFiles((prev) => [
			...prev,
			...files.map((file) => ({
				...file,
				language: getFileType(file.file_path),
			})),
		]);
	};

	const addFile = (file: FileType) => {
		// add file to files if it doesn't exist, else replace old file with new one
		setFiles((prev) => {
			const fileExists = prev.some((f) => f.file_path === file.file_path);
			if (fileExists) {
				return prev.map((f) => (f.file_path === file.file_path ? file : f));
			}
			return [...prev, file];
		});
	};

	const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
		if (import.meta.env.DEV) {
			if (message.type !== 'file_chunk_generated') {
				logger.debug('received message', message);
			}
		}
		switch (message.type) {
			case 'cf_agent_state': {
				const { state } = message;

				if (state.blueprint) {
					setBlueprint(state.blueprint);
					updatePhase('blueprint', { status: 'completed' });
				}
				const previewURL = import.meta.env.VITE_PREVIEW_MODE === 'tunnel' ? state.tunnelURL : state.previewURL;
				if (previewURL) {
					setPreviewUrl(previewURL);
					sendMessage({
						id: 'deployment-status',
						message: 'Your project has been deployed to ' + previewURL,
					});
				}
				setQuery(state.query);

				if (state.templateDetails?.files) {
					loadBootstrapFiles(state.templateDetails.files);
					// updatePhaseStatus('bootstrapping', 'completed');
				}

				if (state.generatedFilesMap) {
					setFiles(
						Object.values(state.generatedFilesMap).map((file) => {
							return {
								file_path: file.file_path,
								file_contents: file.file_contents,
								explanation: file.explanation,
								isGenerating: false,
								needsFixing: false,
								hasErrors: false,
								language: getFileType(file.file_path),
							};
						}),
					);

					if (
						agentId === 'new' &&
						Object.values(state.generatedFilesMap).length > 0
					) {
						updatePhase('code', { status: 'active' });
						// updatePhaseStatus('validatingCode', 'completed');
					}
				}

				break;
			}

			case 'file_generating': {
				addFile({
					file_path: message.file_path,
					file_contents: '',
					explanation: '',
					isGenerating: true,
					needsFixing: false,
					hasErrors: false,
					language: getFileType(message.file_path),
				});
				break;
			}

			case 'file_chunk_generated': {
				// update the file
				setFiles((prev) => {
					const file = prev.find(
						(file) => file.file_path === message.file_path,
					);
					if (!file)
						return [
							...prev,
							{
								file_path: message.file_path,
								file_contents: message.chunk,
								explanation: '',
								isGenerating: true,
								needsFixing: false,
								hasErrors: false,
								language: getFileType(message.file_path),
							},
						];
					file.file_contents += message.chunk;
					return [...prev];
				});
				break;
			}

			case 'file_generated': {
				// find the file and change isGenerating to false with the file in same index
				setFiles((prev) => {
					const file = prev.find(
						(file) => file.file_path === message.file.file_path,
					);
					if (!file)
						return [
							...prev,
							{
								file_path: message.file.file_path,
								file_contents: message.file.file_contents,
								explanation: message.file.explanation,
								isGenerating: false,
								needsFixing: false,
								hasErrors: false,
								language: getFileType(message.file.file_path),
							},
						];
					file.isGenerating = false;
					file.file_contents = message.file.file_contents;
					file.explanation = message.file.explanation;
					return [...prev];
				});
				break;
			}

			case 'file_regenerated': {
				// update the file
				setFiles((prev) => {
					const file = prev.find(
						(file) => file.file_path === message.file.file_path,
					);
					if (!file) return prev;
					file.file_contents = message.file.file_contents;
					file.explanation = message.file.explanation;
					return [...prev];
				});
				break;
			}

			case 'generation_started': {
				updatePhase('code', { status: 'active' });
				setTotalFiles(message.totalFiles);
				break;
			}

			case 'generation_complete': {
				// update the file
				setFiles((prev) =>
					prev.map((file) => {
						file.isGenerating = false;
						file.needsFixing = false;
						file.hasErrors = false;
						return file;
					}),
				);
				updatePhase('code', { status: 'completed' });
				// update validate phase only if isn't completed
				setProjectPhases((prev) => {
					return prev.map((phase) => {
						if (phase.id === 'validate' && phase.status !== 'completed') {
							return { ...phase, status: 'active' };
						}
						return phase;
					});
				});

				sendMessage({
					id: 'main',
					message: 'Code generation has been completed.',
					isThinking: false,
				});
				break;
			}

			case 'deployment_completed': {
				const previewURL = import.meta.env.VITE_PREVIEW_MODE === 'tunnel' ? message.tunnelURL : message.previewURL;
				setPreviewUrl(previewURL);
				sendMessage({
					id: 'deployment-status',
					message: 'Your project has been deployed to ' + previewURL,
				});

				break;
			}

			case 'code_review': {
				// sendMessage({
				// 	id: 'code-review',
				// 	message: message.message,
				// });
				// updatePhaseStatus('codeReview', 'active');
				break;
			}

			case 'runtime_error_found': {
				setMessages((prev) => [
					...prev,
					{
						type: 'ai',
						id: 'runtime_error',
						message: `Runtime error found: \nCount: ${message.count}\nMessage: ${message.errors.map((e) => e.message).join('\n')}`,
					},
				]);
				logger.info('Runtime error found', message.errors);
				break;
			}

			case 'generation_errors': {
				const totalIssues =
					message.lintIssues +
					message.typeErrors +
					message.runtimeErrors.length;

				updatePhase('code', { status: 'completed' });
				updatePhase('validate', { status: 'completed' });

				if (totalIssues > 0) {
					setProjectPhases((list) => [
						...list,
						{
							id: 'fix',
							title: 'Fixing errors',
							status: 'active',
							metadata: `Fixing ${totalIssues} errors`,
						},
					]);
				}
				break;
			}

			case 'code_fix_edits': {
				setEdit({
					filePath: message.filePath,
					search: message.search,
					replacement: message.replacement,
				});
				sendMessage({
					id: 'code_fix_edits',
					message: `Fixed errors in \`${message.filePath}\``,
				});

				updatePhase('code', { status: 'completed' });
				updatePhase('validate', { status: 'completed' });

				setFiles((prev) =>
					prev.map((file) => {
						if (file.file_path === message.filePath) {
							file.file_contents = file.file_contents.replace(
								message.search,
								message.replacement,
							);
						}
						return file;
					}),
				);
				break;
			}

			default:
				console.warn('Unhandled message:', message);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const connect = useCallback(
		(
			wsUrl: string,
			{ disableGenerate = false }: { disableGenerate?: boolean } = {
				disableGenerate: false,
			},
		) => {
			logger.debug('connect() called with url:', wsUrl);
			if (!wsUrl) return;
			connectionStatus.current = 'connecting';

			try {
				const ws = new WebSocket(wsUrl);
				setWebsocket(ws);

				ws.addEventListener('open', () => {
					logger.info('✅ WebSocket connection established!');
					connectionStatus.current = 'connected';
					// Request file generation

					if (!disableGenerate) {
						ws.send(JSON.stringify({ type: 'generate_all' }));
					}
				});

				ws.addEventListener('message', (event) => {
					const message: WebSocketMessage = JSON.parse(event.data);
					handleWebSocketMessage(message);
				});

				ws.addEventListener('error', (error) => {
					console.error('❌ WebSocket error:', error);
				});

				ws.addEventListener('close', (event) => {
					logger.info(
						`WebSocket connection closed with code ${event.code}: ${event.reason || 'No reason provided'}`,
						event,
					);
				});

				return function disconnect() {
					ws.close();
				};
			} catch (error) {
				console.error('❌ Error establishing WebSocket connection:', error);
			}
		},
		[handleWebSocketMessage],
	);

	useEffect(() => {
		async function init() {
			if (!agentId || connectionStatus.current !== 'idle') return;

			try {
				if (agentId === 'new') {
					if (!userQuery) {
						console.error('Query is required for new code generation');
						return;
					}

					// Start new code generation
					const response = await fetch('/codegen/incremental',
						{
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ query: userQuery }),
						},
					);

					if (!response.ok) {
						throw new Error(`HTTP error ${response.status}`);
					}

					const parser = createRepairingJSONParser();

					let result;

					let startedBlueprintStream = false;

					for await (const obj of ndjsonStream(response)) {
						if (obj.chunk) {
							if (!startedBlueprintStream) {
								sendMessage({
									id: 'main',
									message: 'Blueprint is being generated...',
									isThinking: true,
								});
								logger.info('Blueprint stream has started');
								setIsBootstrapping(false);
								setIsGeneratingBlueprint(true);
								startedBlueprintStream = true;
								updatePhase('bootstrap', { status: 'completed' });
								updatePhase('blueprint', { status: 'active' });
							}
							parser.feed(obj.chunk);
							try {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const partial = parser.finalize() as any;
								setBlueprint(partial);
							} catch (e) {
								console.error('Error parsing JSON:', e);
							}
						} else {
							logger.info('chat-result', obj);
							result = obj;
							sendMessage({
								id: 'main',
								message:
									"Sure, let's get started. Bootstrapping the project first...",
								isThinking: true,
							});
							loadBootstrapFiles(result.template.files);
						}
					}

					updatePhase('blueprint', { status: 'completed' });
					setIsGeneratingBlueprint(false);
					sendMessage({
						id: 'main',
						message:
							'Blueprint generation complete. Now starting the code generation...',
						isThinking: true,
					});

					// Connect to WebSocket
					logger.debug('connecting to ws with created id');
					connect(result.websocketUrl);
					setChatId(result.agentId);
				} else if (connectionStatus.current === 'idle') {
					setIsBootstrapping(false);
					// Get existing progress
					sendMessage({
						id: 'main',
						message: 'Fetching your previous chat...',
					});
					const response = await fetch(`/codegen/incremental/${agentId}`,
						{
							method: 'GET',
						},
					);

					if (!response.ok) {
						throw new Error(`HTTP error ${response.status}`);
					}

					const result: ApiResponse = await response.json();

					logger.debug('Existing agentId API result', result);

					if (result.data.blueprint) {
						setBlueprint(result.data.blueprint);
						updatePhase('bootstrap', { status: 'completed' });
						updatePhase('blueprint', { status: 'completed' });
						// If blueprint exists, assume prior stages are done for an existing agent
						setBlueprint(result.data.blueprint);
					}

					if (result.data.progress) {
						setTotalFiles(result.data.progress.totalFiles);
						console.log(result.data.progress);

						if (
							result.data.progress.completedFiles ===
							result.data.progress.totalFiles
						) {
							console.log('complete');
							updatePhase('code', { status: 'completed' });
							updatePhase('validate', { status: 'completed' });
						}
					}

					let loadedFiles: FileType[] = [];

					// Load existing files into state
					if (result.data.generated_code) {
						loadedFiles = result.data.generated_code.map(
							(file: GeneratedFile) => {
								return {
									file_path: file.file_path,
									file_contents: file.file_contents,
									explanation: file.explanation,
									isGenerating: false,
									needsFixing: false,
									hasErrors: false,
									language: getFileType(file.file_path),
								};
							},
						);

						setFiles(loadedFiles);
					}

					sendMessage({
						id: 'main',
						message: 'Starting from where you left off...',
						isThinking: false,
					});

					logger.debug('connecting from init for existing agentId');
					connect(`/codegen/ws/${agentId}`, {
						disableGenerate: true,
					});
				}
			} catch (error) {
				console.error('Error initializing code generation:', error);
			}
		}

		init();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		return () => {
			websocket?.close();
		};
	}, [websocket]);

	useEffect(() => {
		if (edit) {
			// When edit is cleared, write the edit changes
			return () => {
				setFiles((prev) =>
					prev.map((file) => {
						if (file.file_path === edit.filePath) {
							file.file_contents = file.file_contents.replace(
								edit.search,
								edit.replacement,
							);
						}
						return file;
					}),
				);
			};
		}
	}, [edit]);

	return {
		messages,
		edit,
		bootstrapFiles,
		chatId,
		query,
		files,
		blueprint,
		previewUrl,
		isGeneratingBlueprint,
		isBootstrapping,
		totalFiles,
		websocket,
		sendUserMessage,
		sendAiMessage: sendMessage,
		clearEdit,
		projectPhases,
		onCompleteBootstrap,
	};
}
