import { useRef } from 'react';
import { ArrowRight } from 'react-feather';
import { useNavigate } from 'react-router';
import { Header } from '../components/header';

export default function Home() {
	const navigate = useNavigate();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	return (
		<div className="flex flex-col items-center size-full">
			<Header />

			<div className="w-full max-w-2xl px-6 pt-40 lg:pt-56 flex flex-col items-center">
				{/* Animate background gradient translating */}
				<h2 className="text-5xl/18 text-center mb-8 font-medium tracking-tight bg-clip-text bg-gradient-to-r text-transparent from-brand/70 to-brand/90">
					What shall I help you build?
				</h2>

				<form
					method="POST"
					onSubmit={(e) => {
						e.preventDefault();
						navigate(
							`chat/new?query=${encodeURIComponent(textareaRef.current!.value)}`,
						);
					}}
					className="flex group flex-col w-full min-h-[100px] bg-bg-lighter border border-text/5 shadow rounded-2xl p-4"
				>
					<textarea
						className="font-sans text-sm flex-1 resize-none outline-none"
						name="query"
						placeholder="What can I help you build?"
						defaultValue="Make a tictactoe game"
						ref={textareaRef}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								navigate(
									`chat/new?query=${encodeURIComponent(textareaRef.current!.value)}`,
								);
							}
						}}
					/>
					<div className="flex items-center justify-between">
						<div></div>

						<div className="flex items-center justify-end">
							<button
								type="submit"
								className="bg-gradient-to-br from-brand/70 to-brand/90 text-text-on-brand p-1 rounded-md *:size-5"
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
