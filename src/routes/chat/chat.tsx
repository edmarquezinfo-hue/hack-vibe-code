import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FormEvent,
} from 'react';
import { ArrowRight } from 'react-feather';
import { useParams, useSearchParams } from 'react-router';
import { MonacoEditor } from '../../components/monaco-editor/monaco-editor';
import { Header } from '../../components/header';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Expand, Loader, LoaderCircle } from 'lucide-react';
import { Blueprint } from './components/blueprint';
import { FileExplorer } from './components/file-explorer';
import { UserMessage, AIMessage } from './components/messages';
import { ViewModeSwitch } from './components/view-mode-switch';
import { useChat, type FileType } from './hooks/use-chat';
import { Copy } from './components/copy';
import { useNavigate } from 'react-router';
import { useFileContentStream } from './hooks/use-file-content-stream';
import { logger } from '../../utils/logger';
import clsx from 'clsx';

export default function Chat() {
	const { agentId } = useParams();

	const [searchParams] = useSearchParams();
	const userQuery = searchParams.get('query');

	const {
		messages,
		bootstrapFiles,
		blueprint,
		previewUrl,
		query,
		chatId,
		files,
		isGeneratingBlueprint,
		isBootstrapping,
		totalFiles,
		websocket,
		sendUserMessage,
		sendAiMessage,
		edit,
		clearEdit,
		projectPhases,
		onCompleteBootstrap,
	} = useChat({
		agentId,
		query: userQuery,
	});

	const navigate = useNavigate();

	const [activeFilePath, setActiveFilePath] = useState<string>();
	const [view, setView] = useState<'editor' | 'preview' | 'blueprint'>(
		'editor',
	);

	const hasSeenPreview = useRef(false);
	const hasSwitchedFile = useRef(false);

	const editorRef = useRef<HTMLDivElement>(null);
	const previewRef = useRef<HTMLIFrameElement>(null);

	const [newMessage, setNewMessage] = useState('');
	const [showTooltip, setShowTooltip] = useState(false);

	// Fake stream bootstrap files
	const { streamedFiles: streamedBootstrapFiles, doneStreaming } =
		useFileContentStream(bootstrapFiles, {
			tps: 600,
			enabled: isBootstrapping,
		});

	const handleFileClick = useCallback((file: FileType) => {
		logger.debug('handleFileClick()', file);
		clearEdit();
		setActiveFilePath(file.file_path);
		setView('editor');
		if (!hasSwitchedFile.current) {
			hasSwitchedFile.current = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleViewModeChange = useCallback((mode: 'preview' | 'editor') => {
		setView(mode);
	}, []);

	const generatingCount = useMemo(
		() =>
			files.reduce((count, file) => (file.isGenerating ? count + 1 : count), 0),
		[files],
	);

	const codeGenState = useMemo(() => {
		return projectPhases[2].status;
	}, [projectPhases]);

	const generatingFile = useMemo(() => {
		// code gen status should be active
		if (codeGenState === 'active') {
			for (let i = files.length - 1; i >= 0; i--) {
				if (files[i].isGenerating) return files[i];
			}
		}
		return undefined;
	}, [files, codeGenState]);

	const activeFile = useMemo(() => {
		if (!hasSwitchedFile.current && generatingFile) {
			return generatingFile;
		}
		if (!hasSwitchedFile.current && isBootstrapping) {
			return streamedBootstrapFiles.find(
				(file) => file.file_path === activeFilePath,
			);
		}
		return (
			files.find((file) => file.file_path === activeFilePath) ??
			streamedBootstrapFiles.find((file) => file.file_path === activeFilePath)
		);
	}, [
		activeFilePath,
		generatingFile,
		files,
		streamedBootstrapFiles,
		isBootstrapping,
	]);

	const showMainView = useMemo(
		() => streamedBootstrapFiles.length > 0 || !!blueprint || files.length > 0,
		[streamedBootstrapFiles, blueprint, files.length],
	);

	const [mainMessage, ...otherMessages] = useMemo(() => messages, [messages]);

	useEffect(() => {
		if (previewUrl && !hasSeenPreview.current) {
			setView('preview');
			setShowTooltip(true);
			setTimeout(() => {
				setShowTooltip(false);
			}, 3000);
		}
	}, [previewUrl]);

	useEffect(() => {
		if (chatId) {
			navigate(`/chat/${chatId}`, {
				replace: true,
			});
		}
	}, [chatId, navigate]);

	useEffect(() => {
		if (!edit) return;
		if (files.some((file) => file.file_path === edit.filePath)) {
			setActiveFilePath(edit.filePath);
			setView('editor');
		}
	}, [edit, files]);

	useEffect(() => {
		if (
			isBootstrapping &&
			streamedBootstrapFiles.length > 0 &&
			!hasSwitchedFile.current
		) {
			setActiveFilePath(streamedBootstrapFiles.at(-1)!.file_path);
		} else if (
			view === 'editor' &&
			!activeFile &&
			files.length > 0 &&
			!hasSwitchedFile.current
		) {
			setActiveFilePath(files.at(-1)!.file_path);
		}
	}, [view, activeFile, files, isBootstrapping, streamedBootstrapFiles]);

	useEffect(() => {
		if (view !== 'blueprint' && isGeneratingBlueprint) {
			setView('blueprint');
		} else if (
			!hasSwitchedFile.current &&
			view === 'blueprint' &&
			!isGeneratingBlueprint
		) {
			setView('editor');
		}
	}, [isGeneratingBlueprint, view]);

	useEffect(() => {
		if (doneStreaming && !isGeneratingBlueprint && !blueprint) {
			onCompleteBootstrap();
			sendAiMessage({
				id: 'main',
				message: 'Bootstrapping complete, now creating a blueprint for you...',
				isThinking: true,
			});
		}
	}, [
		doneStreaming,
		isGeneratingBlueprint,
		sendAiMessage,
		blueprint,
		onCompleteBootstrap,
	]);

	const isRunning = useMemo(() => {
		return (
			isBootstrapping || isGeneratingBlueprint || codeGenState === 'active'
		);
	}, [isBootstrapping, isGeneratingBlueprint, codeGenState]);

	const onNewMessage = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			if (!isRunning) {
				websocket?.send(
					JSON.stringify({ type: 'update_query', query: newMessage }),
				);
				sendUserMessage(newMessage);
				setNewMessage('');
			}
		},
		[newMessage, websocket, sendUserMessage, isRunning],
	);

	const [progress, total] = useMemo((): [number, number] => {
		const total = typeof totalFiles === 'number' ? totalFiles : 1;

		// Add blueprint progress into progress
		return [Math.min(files.length - generatingCount, total), total];
	}, [totalFiles, generatingCount, files.length]);

	if (import.meta.env.DEV) {
		logger.debug({
			messages,
			files,
			blueprint,
			query,
			userQuery,
			chatId,
			previewUrl,
			generatingFile,
			activeFile,
			bootstrapFiles,
			streamedBootstrapFiles,
			isGeneratingBlueprint,
			view,
			totalFiles,
			generatingCount,
			isBootstrapping,
			activeFilePath,
			progress,
			total,
			isRunning,
			projectPhases,
		});
	}

	return (
		<div className="size-full flex flex-col">
			<Header />
			<div className="flex-1 flex min-h-0 justify-center">
				<motion.div
					layout="position"
					className="flex-1 shrink-0 flex flex-col basis-0 max-w-lg relative z-10"
				>
					<div className="flex-1 overflow-y-auto">
						<div className="pt-5 px-4 text-sm flex flex-col gap-5">
							<UserMessage message={query ?? userQuery ?? ''} />

							{mainMessage && (
								<AIMessage
									message={mainMessage.message}
									isThinking={mainMessage.isThinking}
								/>
							)}

							<motion.div layout="position" className="pl-9 drop-shadow mb-2">
								<div className="px-2 pr-3.5 py-3 flex-1 rounded-xl border border-black/12 bg-bg">
									{projectPhases.map((phase, index) => {
										const { id, status, title, metadata } = phase;

										return (
											<div className="flex relative w-full gap-2 pb-2.5 last:pb-0">
												<div className="translate-y-px z-20">
													<AnimatePresence>
														{status === 'pending' && (
															<motion.div
																initial={{ scale: 0.2, opacity: 0.4 }}
																animate={{ scale: 1, opacity: 1 }}
																exit={{ scale: 0.2, opacity: 0.4 }}
																className="size-5 flex items-center justify-center"
															>
																<div className="size-2 rounded-full bg-zinc-300" />
															</motion.div>
														)}

														{status === 'active' && (
															<motion.div
																initial={{ scale: 0.2, opacity: 0.4 }}
																animate={{ scale: 1, opacity: 1 }}
																exit={{ scale: 0.2, opacity: 0.4 }}
																className="size-5 bg-bg flex items-center justify-center"
															>
																<LoaderCircle className="size-3 text-orange-400 animate-spin" />
															</motion.div>
														)}

														{status === 'completed' && (
															<motion.div
																initial={{ scale: 0.2, opacity: 0.4 }}
																animate={{ scale: 1, opacity: 1 }}
																exit={{ scale: 0.2, opacity: 0.4 }}
																className="size-5 flex items-center justify-center"
															>
																<div className="size-2 rounded-full bg-orange-400" />
															</motion.div>
														)}
													</AnimatePresence>
												</div>
												<div className="flex flex-col gap-2 flex-1">
													<div className="flex">
														<span
															className={clsx(
																'font-medium',
																status === 'pending'
																	? 'text-zinc-400'
																	: 'text-zinc-700',
															)}
														>
															{title}
														</span>
														{id === 'code' && status !== 'pending' && (
															<motion.div
																initial={{ x: -120 }}
																animate={{ x: 0 }}
															>
																<span className="text-zinc-300 mx-1">
																	&bull;
																</span>
																<span className="text-zinc-400">
																	{progress}/{total} files
																</span>
															</motion.div>
														)}
													</div>

													{id === 'blueprint' && (
														<button
															onClick={() => {
																setView('blueprint');
																hasSwitchedFile.current = true;
															}}
															className={`flex items-start ml-0.5 transition-colors font-mono ${
																view === 'blueprint'
																	? 'text-brand underline decoration-dotted'
																	: 'text-text/80 hover:bg-bg-lighter/50 hover:text-text'
															}`}
														>
															<span className="text-xs text-left truncate">
																Blueprint.md
															</span>
														</button>
													)}

													{id === 'code' &&
														files.map((file) => {
															const isFileActive =
																view === 'editor' &&
																activeFile?.file_path === file.file_path;

															return (
																<button
																	key={file.file_path}
																	onClick={() => handleFileClick(file)}
																	className="flex items-center gap-2 py-0.5 transition-colors font-mono"
																	aria-selected={isFileActive}
																>
																	{file.isGenerating ? (
																		<span className="text-brand/70 whitespace-nowrap">
																			<Loader className="size-4 animate-spin" />
																		</span>
																	) : (
																		<span className="text-green-600 whitespace-nowrap">
																			<Check className="size-4" />
																		</span>
																	)}
																	<span
																		className={clsx(
																			'text-xs flex-1 text-left truncate',

																			isFileActive
																				? // && viewState.mode === 'code'
																					'text-brand underline decoration-dotted'
																				: 'text-text/80 hover:bg-bg-lighter/50 hover:text-text',
																		)}
																	>
																		{file.file_path}
																	</span>

																	<div>
																		<span className="text-green-600 text-xs font-mono tracking-tight">
																			+
																			{file.file_contents.split('\n').length +
																				1}
																		</span>
																	</div>
																</button>
															);
														})}

													{metadata && (
														<span className="font-mono text-xs text-zinc-500 tracking-tighter">
															{metadata}
														</span>
													)}
												</div>

												{index !== projectPhases.length - 1 && (
													<div
														className={clsx(
															'absolute left-[9.25px] w-px h-full top-2.5 z-10',
															status === 'completed'
																? 'bg-orange-400'
																: 'bg-text/5',
														)}
													/>
												)}
											</div>
										);
									})}
								</div>
							</motion.div>

							{otherMessages.map((message) => {
								if (message.type === 'ai')
									return (
										<AIMessage
											key={message.id}
											message={message.message}
											isThinking={message.isThinking}
										/>
									);
								return (
									<UserMessage key={message.id} message={message.message} />
								);
							})}
						</div>
					</div>

					<div className="h-20"></div>

					<form
						onSubmit={onNewMessage}
						className="absolute bottom-0 left-0 right-0 p-4 pb-5 bg-transparent"
					>
						<div className="relative">
							<input
								type="text"
								value={newMessage}
								onChange={(e) => {
									setNewMessage(e.target.value);
								}}
								placeholder="Ask a follow up..."
								className="w-full bg-bg-lighter border border-white/10 rounded-xl px-3 pr-10 py-2 text-sm outline-none focus:border-white/20 drop-shadow-2xl text-text placeholder:!text-text/50"
							/>
							<button
								type="submit"
								disabled={!newMessage.trim() || isRunning}
								className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-brand/90 hover:bg-bg-lighter/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent text-text-on-brands disabled:text-text transition-colors"
							>
								<ArrowRight className="size-4" />
							</button>
						</div>
					</form>
				</motion.div>

				<AnimatePresence>
					{showMainView && (
						<motion.div
							layout="position"
							className="flex-1 flex shrink-0 basis-0 p-4 pl-0 z-30"
							initial={{ opacity: 0, scale: 0.84 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
						>
							{view === 'preview' && previewUrl && (
								<div className="flex-1 flex flex-col bg-bg-light rounded-xl shadow-md overflow-hidden border border-text/10">
									<div className="grid grid-cols-3 px-2 h-10 bg-bg border-b">
										<div className="flex items-center">
											<ViewModeSwitch
												view={view}
												onChange={handleViewModeChange}
												previewAvailable={!!previewUrl}
												showTooltip={showTooltip}
											/>
										</div>

										<div className="flex items-center justify-center">
											<div className="flex items-center gap-2">
												<span className="text-sm font-mono text-text-50/70">
													{blueprint?.title ?? 'Preview'}
												</span>
												<Copy text={previewUrl} />
											</div>
										</div>

										<div className="flex items-center justify-end gap-1.5">
											<button
												className="p-1"
												onClick={() => {
													previewRef.current?.requestFullscreen();
												}}
											>
												<Expand className="size-4 text-text/50" />
											</button>
										</div>
									</div>
									<iframe
										src={previewUrl}
										ref={previewRef}
										className="flex-1 w-full h-full border-0"
										title="Preview"
									/>
								</div>
							)}

							{view === 'blueprint' && (
								<div className="flex-1 flex flex-col bg-bg-light rounded-xl shadow-md overflow-hidden border border-text/10">
									{/* Toolbar */}
									<div className="flex items-center justify-center px-2 h-10 bg-bg-lighter border-b">
										<div className="flex items-center gap-2">
											<span className="text-sm text-text-50/70 font-mono">
												Blueprint.md
											</span>
											{previewUrl && <Copy text={previewUrl} />}
										</div>
									</div>
									<div className="flex-1 overflow-y-auto bg-bg-light">
										<div className="py-12 mx-auto">
											<Blueprint
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												blueprint={blueprint ?? ({} as any)}
												className="w-full max-w-2xl mx-auto"
											/>
										</div>
									</div>
								</div>
							)}

							{view === 'editor' && (
								<div className="flex-1 flex flex-col bg-bg-light rounded-xl shadow-md overflow-hidden border border-text/10">
									{activeFile && (
										<div className="grid grid-cols-3 px-2 h-10 bg-bg border-b">
											<div className="flex items-center">
												<ViewModeSwitch
													view={view}
													onChange={handleViewModeChange}
													previewAvailable={!!previewUrl}
													showTooltip={showTooltip}
												/>
											</div>

											<div className="flex items-center justify-center">
												<div className="flex items-center gap-2">
													<span className="text-sm font-mono text-text-50/70">
														{activeFile.file_path}
													</span>
													{previewUrl && <Copy text={previewUrl} />}
												</div>
											</div>

											<div className="flex items-center justify-end gap-1.5">
												<button
													className="p-1"
													onClick={() => {
														editorRef.current?.requestFullscreen();
													}}
												>
													<Expand className="size-4 text-text/50" />
												</button>
											</div>
										</div>
									)}
									<div className="flex-1 relative">
										<div className="absolute inset-0 flex" ref={editorRef}>
											<FileExplorer
												files={files}
												bootstrapFiles={streamedBootstrapFiles}
												currentFile={activeFile}
												onFileClick={handleFileClick}
											/>
											<div className="flex-1">
												<MonacoEditor
													className="h-full"
													createOptions={{
														value: activeFile?.file_contents || '',
														language: activeFile?.language || 'plaintext',
														readOnly: true,
														minimap: { enabled: false },
														lineNumbers: 'on',
														scrollBeyondLastLine: false,
														fontSize: 13,
														theme: 'v1-dev',
														automaticLayout: true,
													}}
													find={
														edit && edit.filePath === activeFile?.file_path
															? edit.search
															: undefined
													}
													replace={
														edit && edit.filePath === activeFile?.file_path
															? edit.replacement
															: undefined
													}
												/>
											</div>
										</div>
									</div>
								</div>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
