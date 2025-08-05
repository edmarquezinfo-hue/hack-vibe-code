import { useRef, useState, useEffect } from 'react';
import { ArrowRight } from 'react-feather';
import { useNavigate } from 'react-router';
import { AgentModeToggle, type AgentMode } from '../components/agent-mode-toggle';

export default function Home() {
	const navigate = useNavigate();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [agentMode, setAgentMode] = useState<AgentMode>('deterministic');

	// Auto-resize textarea based on content
	const adjustTextareaHeight = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			const scrollHeight = textareaRef.current.scrollHeight;
			const maxHeight = 300; // Maximum height in pixels
			textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
		}
	};

	useEffect(() => {
		adjustTextareaHeight();
	}, []);
	return (
		<div className="flex flex-col items-center size-full">
			<div className="w-full max-w-2xl px-6 pt-40 lg:pt-56 flex flex-col items-center">
				<h2 className="text-5xl/18 text-center mb-8 font-medium tracking-tight bg-clip-text bg-gradient-to-r text-transparent from-[#0092b8b3] to-[#0092b8e6] dark:from-[#f48120]/70 dark:to-[#faae42]/90">
					What shall I help you build?
				</h2>

				<form
					method="POST"
					onSubmit={(e) => {
						e.preventDefault();
						const query = encodeURIComponent(textareaRef.current!.value);
						const mode = encodeURIComponent(agentMode);
						navigate(
							`chat/new?query=${query}&agentMode=${mode}`,
						);
					}}
					className="flex flex-col w-full min-h-[150px] bg-background dark:bg-card border border-border shadow-sm dark:shadow-lg rounded-2xl p-5 transition-all duration-200 hover:shadow-md dark:hover:shadow-xl hover:border-border/80"
				>
					<textarea
						className="font-sans text-sm flex-1 resize-none outline-none bg-transparent text-foreground placeholder:text-muted-foreground leading-relaxed min-h-[100px] overflow-y-auto"
						name="query"
						placeholder="What can I help you build?"
						defaultValue="Create the 2048 game in React with a 4x4 grid and the ability to move tiles up, down, left, and right. Make it beautiful and responsive. The tiles should merge when they have the same number. The game should end when there are no more moves left. The game should look like the original 2048 game."
						ref={textareaRef}
						onChange={adjustTextareaHeight}
						onInput={adjustTextareaHeight}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								const query = encodeURIComponent(textareaRef.current!.value);
								const mode = encodeURIComponent(agentMode);
								navigate(
									`chat/new?query=${query}&agentMode=${mode}`,
								);
							}
						}}
					/>
					<div className="flex items-center justify-between mt-4 pt-1">
						<AgentModeToggle 
							value={agentMode} 
							onChange={setAgentMode}
							className="flex-1"
						/>

						<div className="flex items-center justify-end ml-4">
							<button
								type="submit"
								className="bg-gradient-to-br from-[#0092b8b3] to-[#0092b8e6] dark:from-[#f48120] dark:to-[#faae42] hover:from-[#0092b8e6] hover:to-[#0092b8b3] dark:hover:from-[#faae42] dark:hover:to-[#f48120] text-white p-1 rounded-md *:size-5 transition-all duration-200 hover:shadow-md"
							>
								<ArrowRight />
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
