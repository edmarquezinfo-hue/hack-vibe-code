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
	const [bootstrapFiles, setBootstrapFiles] = useState<FileType[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ type: 'ai', id: 'main', message: 'Thinking...', isThinking: true },
	]);
	const [chatId, setChatId] = useState<string>();
	const [websocket, setWebsocket] = useState<WebSocket>();
	const [blueprint, setBlueprint] = useState<BlueprintType>();
	const [previewUrl, setPreviewUrl] = useState<string>();
	const [query, setQuery] = useState<string>();
	const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
	const [isBootstrapping, setIsBootstrapping] = useState(true);

	const [generationStarted, setGenerationStarted] = useState(false);

	const [files, setFiles] = useState<FileType[]>([]);

	const [totalFiles, setTotalFiles] = useState<number>();

	const connectionStatus = useRef<'idle' | 'connecting' | 'connected'>('idle');
	const [edit, setEdit] = useState<Omit<CodeFixEdits, 'type'>>();

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

				setBlueprint(state.blueprint);
				if (state.previewURL) {
					setPreviewUrl(state.previewURL);
					sendMessage({
						id: 'deployment-status',
						message: 'Your project has been deployed to ' + state.previewURL,
					});
				}
				setQuery(state.query);

				if (state.templateDetails?.files) {
					loadBootstrapFiles(state.templateDetails.files);
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
					if (!file) return prev;
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
					if (!file) return prev;
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
				setGenerationStarted(true);
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
				setGenerationStarted(false);
				sendMessage({
					id: 'main',
					message: 'Code generation has been completed.',
					isThinking: false,
				});
				break;
			}

			case 'deployment_completed': {
				setPreviewUrl(message.previewURL);
				sendMessage({
					id: 'deployment-status',
					message: 'Your project has been deployed to ' + message.previewURL,
				});

				break;
			}

			case 'code_review': {
				sendMessage({
					id: 'code-review',
					message: message.message,
				});
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
				sendMessage({
					id: 'generation_errors',
					message: `Found generation errors
| Lint issues | Type Errors | Runtime Errors |
| --- | --- | --- |
| ${message.lintIssues} | ${message.typeErrors} | ${message.runtimeErrors.length}`,
				});
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
					message: `Fixed code errors in \`${message.filePath}\``,
				});

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
		(wsUrl: string) => {
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
					ws.send(JSON.stringify({ type: 'generate_all' }));
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
					const response = await fetch(
						import.meta.env.VITE_API_BASE + '/codegen/incremental',
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
					const response = await fetch(
						import.meta.env.VITE_API_BASE + `/codegen/incremental/${agentId}`,
						{
							method: 'GET',
						},
					);

					if (!response.ok) {
						throw new Error(`HTTP error ${response.status}`);
					}

					const result: ApiResponse = await response.json();

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

					if (result.data.blueprint) {
						setBlueprint(result.data.blueprint);
					}

					sendMessage({
						id: 'main',
						message: 'Starting from where you left off...',
						isThinking: false,
					});

					logger.debug('connecting from init for existing agentId');
					connect(`${import.meta.env.VITE_WS_BASE}/codegen/ws/${agentId}`);
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
		generationStarted,
		totalFiles,
		websocket,
		sendUserMessage,
		sendAiMessage: sendMessage,
		clearEdit,
	};
}
