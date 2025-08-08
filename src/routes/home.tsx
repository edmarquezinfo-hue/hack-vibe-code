import { useRef, useState, useEffect } from 'react';
import { ArrowRight } from 'react-feather';
import { useNavigate } from 'react-router';
import {
	AgentModeToggle,
	type AgentMode,
} from '../components/agent-mode-toggle';

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
			textareaRef.current.style.height =
				Math.min(scrollHeight, maxHeight) + 'px';
		}
	};

	useEffect(() => {
		adjustTextareaHeight();
	}, []);
	return (
		<div className="flex flex-col items-center size-full">
			<div className="w-full max-w-2xl px-6 pt-40 lg:pt-56 flex flex-col items-center">
				<h2 className="text-transparent text-balance text-center font-medium leading-[1.1] tracking-tight text-5xl w-full mb-12 bg-clip-text bg-gradient-to-r from-text-primary to-text-primary/80">
					What shall I help you build?
				</h2>

				<form
					method="POST"
					onSubmit={(e) => {
						e.preventDefault();
						const query = encodeURIComponent(
							textareaRef.current!.value,
						);
						const mode = encodeURIComponent(agentMode);
						navigate(`chat/new?query=${query}&agentMode=${mode}`);
					}}
					className="flex flex-col w-full min-h-[150px] bg-bg-4 justify-between dark:bg-card rounded-[18px] shadow-textarea p-5 transition-all duration-200"
				>
					<textarea
						className="bg-transparent w-full resize-none ring-0 outline-0 placeholder:text-primary/40"
						name="query"
						placeholder="Create the 2048 game"
						ref={textareaRef}
						onChange={adjustTextareaHeight}
						onInput={adjustTextareaHeight}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								const query = encodeURIComponent(
									textareaRef.current!.value,
								);
								const mode = encodeURIComponent(agentMode);
								navigate(
									`chat/new?query=${query}&agentMode=${mode}`,
								);
							}
						}}
					/>
					<div className="flex items-center justify-between mt-4 pt-1">
						{import.meta.env.VITE_AGENT_MODE_ENABLED ? (
							<AgentModeToggle
								value={agentMode}
								onChange={setAgentMode}
								className="flex-1"
							/>
						) : (
							<div></div>
						)}

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
