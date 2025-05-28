import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FormEvent,
} from 'react';
import { Loader, Check, ArrowRight } from 'react-feather';
import { useParams, useSearchParams } from 'react-router';
import { MonacoEditor } from '../../components/monaco-editor/monaco-editor';
import { Header } from '../../components/header';
import { motion } from 'framer-motion';
import { Expand } from 'lucide-react';
import { Blueprint } from './components/blueprint';
import { FileExplorer } from './components/file-explorer';
import { UserMessage, AIMessage } from './components/messages';
import { ViewModeSwitch } from './components/view-mode-switch';
import { useChat, type FileType } from './hooks/use-chat';
import { Copy } from './components/copy';
import { useNavigate } from 'react-router';
import { useFileContentStream } from './hooks/use-file-content-stream';
import { logger } from '../../utils/logger';

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
		generationStarted,
		totalFiles,
		websocket,
		sendUserMessage,
		sendAiMessage,
		edit,
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
			tps: 350,
			enabled: isBootstrapping,
		});

	const handleFileClick = (file: FileType) => {
		logger.debug('handleFileClick()', file);
		setActiveFilePath(file.file_path);
		setView('editor');
		if (!hasSwitchedFile.current) {
			hasSwitchedFile.current = true;
		}
	};

	const handleViewModeChange = (mode: 'preview' | 'editor') => {
		setView(mode);
	};

	const generatingCount = useMemo(
		() =>
			files.reduce((count, file) => (file.isGenerating ? count + 1 : count), 0),
		[files],
	);

	const generatingFile = useMemo(() => {
		if (generationStarted) {
			for (let i = files.length - 1; i >= 0; i--) {
				if (files[i].isGenerating) return files[i];
			}
		}
		return undefined;
	}, [files, generationStarted]);

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

	const showMainView =
		streamedBootstrapFiles.length > 0 || !!blueprint || files.length > 0;

	const mainMessage = messages[0];
	const otherMessages = messages.slice(1);

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
			sendAiMessage({
				id: 'main',
				message: 'Bootstrapping complete, now creating a blueprint for you...',
				isThinking: true,
			});
		}
	}, [doneStreaming, isGeneratingBlueprint, sendAiMessage, blueprint]);

	const onNewMessage = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			websocket?.send(
				JSON.stringify({ type: 'update_query', query: newMessage }),
			);
			sendUserMessage(newMessage);
			setNewMessage('');
		},
		[newMessage, websocket, sendUserMessage],
	);

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
		});
	}

	const [progress, total] = useMemo((): [number, number] => {
		if (generatingCount === 0 && !isGeneratingBlueprint) {
			return [1, 1];
		}
		const total = typeof totalFiles === 'number' ? totalFiles + 1 : 1;

		return [
			Math.min(
				files.length - generatingCount + (isGeneratingBlueprint ? 0 : 1),
				total,
			),
			total,
		];

		// (files.length -
		// 	generatingCount +
		// 	(isGeneratingBlueprint ? 0 : 1)) /
		// (typeof totalFiles === 'number'
		// 	? totalFiles + 1
		// 	: 1)
	}, [totalFiles, isGeneratingBlueprint, generatingCount, files.length]);

	return (
		<div className="size-full flex flex-col">
			<Header />
			<div className="flex-1 flex min-h-0 justify-center">
				<motion.div
					layout="position"
					className="flex-1 shrink-0 flex flex-col basis-0 max-w-lg relative"
				>
					<div className="flex-1 overflow-y-auto pb-20">
						<div className="pt-5 px-4 text-sm flex flex-col gap-5">
							<UserMessage message={query ?? userQuery ?? ''} />

							{mainMessage && (
								<AIMessage
									message={mainMessage.message}
									isThinking={mainMessage.isThinking}
								/>
							)}

							{(files.length > 0 || blueprint) && (
								<div className="pl-9 -my-2 -mb-4">
									{/* <h3 className="font-medium mb-2">Progress</h3> */}
									<div className="flex items-center gap-2.5">
										<div className="relative w-8 h-8">
											<svg className="w-full h-full" viewBox="0 0 36 36">
												{/* Background circle */}
												<circle
													cx="18"
													cy="18"
													r="16"
													fill="none"
													className="stroke-bg-lighter/50"
													strokeWidth="2"
												/>
												{/* Progress circle */}
												<motion.circle
													cx="18"
													cy="18"
													r="16"
													fill="none"
													className="stroke-bg-bright"
													strokeWidth="2"
													strokeLinecap="round"
													transform="rotate(-90 18 18)"
													initial={{ pathLength: 0 }}
													animate={{
														pathLength: progress / total,
													}}
													transition={{
														duration: 0.5,
														ease: 'easeInOut',
													}}
												/>
											</svg>

											{/* Checkmark, when complete */}
											{generatingCount === 0 &&
												files.length > 0 &&
												blueprint && (
													<motion.div
														className="absolute inset-0 flex items-center justify-center"
														initial={{ scale: 0, opacity: 0 }}
														animate={{ scale: 1, opacity: 1 }}
														transition={{
															duration: 0.3,
															delay: 0.2,
														}}
													>
														<svg
															className="w-4 h-4 text-bg-bright"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
															strokeLinecap="round"
															strokeLinejoin="round"
														>
															<polyline points="20 6 9 17 4 12" />
														</svg>
													</motion.div>
												)}
										</div>
										<div className="flex flex-col">
											<div className="text-xs">
												{progress === total
													? `Your project is ready`
													: `${progress}/${total} files generated`}
											</div>
										</div>
									</div>
								</div>
							)}

							{(blueprint || files.length > 0) && (
								<motion.div layout="position" className="mt-4 pl-9">
									<div className="flex h-10 items-center border border-white/5 justify-between px-4 bg-bg-lighter rounded-t-xl">
										<div className="flex items-center gap-2">
											<span className="text-sm text-white/80">Version 1</span>
										</div>
									</div>
									<div className="bg-bg-light rounded-b-md border border-t-0 border-white/5 overflow-hidden">
										<div className="flex flex-col">
											<button
												onClick={() => {
													setView('blueprint');
													hasSwitchedFile.current = true;
												}}
												className={`flex items-center gap-2 p-2 px-4 transition-colors font-mono ${
													view === 'blueprint'
														? 'text-[#FFBA71] underline decoration-dotted'
														: 'text-white/80 hover:bg-bg-lighter/50 hover:text-white'
												}`}
											>
												{isGeneratingBlueprint ? (
													<span className="text-orange-400 whitespace-nowrap">
														<Loader className="size-4 animate-spin" />
													</span>
												) : (
													<span className="text-[#7EDFA2] whitespace-nowrap">
														<Check className="size-4" />
													</span>
												)}
												<span className="text-xs flex-1 text-left truncate">
													Blueprint.md
												</span>
											</button>
											{files.map((file) => {
												const isFileActive =
													view === 'editor' &&
													activeFile?.file_path === file.file_path;

												return (
													<button
														key={file.file_path}
														onClick={() => handleFileClick(file)}
														className={`flex items-center gap-2 p-2 px-4 transition-colors font-mono ${
															isFileActive
																? // && viewState.mode === 'code'
																	'text-[#FFBA71] underline decoration-dotted'
																: 'text-white/80 hover:bg-bg-lighter/50 hover:text-white'
														}`}
													>
														{file.isGenerating ? (
															<span className="text-orange-400 whitespace-nowrap">
																<Loader className="size-4 animate-spin" />
															</span>
														) : (
															<span className="text-[#7EDFA2] whitespace-nowrap">
																<Check className="size-4" />
															</span>
														)}
														<span className="text-xs flex-1 text-left truncate">
															{file.file_path}
														</span>
														<div className="flex items-center gap-2">
															{file.needsFixing && (
																<span className="text-[9px] text-white/60 font-mono">
																	needs fix
																</span>
															)}
															{file.hasErrors && (
																<span className="text-[9px] text-white/60 font-mono">
																	runtime error
																</span>
															)}
															{/* {file.metadata?.lastModified && (
																	<span className="text-[9px] text-text-50/50">
																		{new Date(
																			file.metadata.lastModified,
																		).toLocaleTimeString()}
																	</span>
																)}
																{file.metadata?.size && (
																	<span className="text-[9px] text-text-50/50">
																		{formatFileSize(file.metadata.size)}
																	</span>
																)} */}
														</div>
													</button>
												);
											})}
										</div>
									</div>
								</motion.div>
							)}

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
								className="w-full bg-bg-lighter border border-white/10 rounded-xl px-3 pr-10 py-2 text-sm outline-none focus:border-white/20 drop-shadow-2xl text-white placeholder:!text-white/50"
							/>
							<button
								type="submit"
								disabled={!newMessage.trim()}
								className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-bg-lighter/30 hover:bg-bg-lighter/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								<ArrowRight className="size-4" />
							</button>
						</div>
					</form>
				</motion.div>

				{showMainView && (
					<motion.div
						layout="position"
						className="flex-1 flex shrink-0 basis-0 p-4 pl-0"
					>
						{view === 'preview' && previewUrl && (
							<div className="flex-1 flex flex-col bg-bg-light rounded-xl overflow-hidden border border-white/10">
								<div className="grid grid-cols-3 px-2 h-10 bg-bg-lighter/50">
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
											<Expand className="size-4 text-white/50" />
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
							<div className="flex-1 flex flex-col bg-bg-light/30 rounded-xl overflow-hidden border border-white/10">
								{/* Toolbar */}
								<div className="flex items-center justify-center px-2 h-10 bg-bg-lighter">
									<div className="flex items-center gap-2">
										<span className="text-sm text-text-50/70 font-mono">
											Blueprint.md
										</span>
										{previewUrl && <Copy text={previewUrl} />}
									</div>
								</div>
								<div className="flex-1 overflow-y-auto">
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
							<div className="flex-1 flex flex-col bg-bg-light rounded-xl overflow-hidden border border-white/10">
								{activeFile && (
									<div className="grid grid-cols-3 px-2 h-10 bg-bg-lighter/50">
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
												<Expand className="size-4 text-white/50" />
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
			</div>
		</div>
	);
}
