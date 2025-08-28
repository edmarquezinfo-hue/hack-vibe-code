import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Code, Terminal } from 'lucide-react';

export function ViewModeSwitch({
	view,
	onChange,
	previewAvailable = false,
	showTooltip = false,
	terminalAvailable = true,
}: {
	view: 'preview' | 'editor' | 'blueprint' | 'terminal';
	onChange: (mode: 'preview' | 'editor' | 'terminal') => void;
	previewAvailable: boolean;
	showTooltip: boolean;
	terminalAvailable?: boolean;
}) {
	if (!previewAvailable && !terminalAvailable) {
		return null;
	}

	return (
		<div className="flex items-center gap-1 bg-zinc-100 rounded-md p-0.5 relative">
			<AnimatePresence>
				{showTooltip && (
					<motion.div
						initial={{ opacity: 0, scale: 0.4 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0 }}
						className="absolute z-50 top-10 left-0 bg-bg-lighter text-text text-xs px-2 py-1 rounded whitespace-nowrap animate-fade-in"
					>
						You can view code anytime from here
					</motion.div>
				)}
			</AnimatePresence>

			<button
				onClick={() => onChange('preview')}
				className={clsx(
					'p-1 flex items-center justify-between h-full rounded-md transition-colors',
					view === 'preview'
						? 'bg-bg text-text'
						: 'text-text-50/70 hover:text-text hover:bg-accent',
				)}
			>
				<Eye className="size-4" />
			</button>
			<button
				onClick={() => onChange('editor')}
				className={clsx(
					'p-1 flex items-center justify-between h-full rounded-md transition-colors',
					view === 'editor'
						? 'bg-bg text-text'
						: 'text-text-50/70 hover:text-text hover:bg-accent',
				)}
			>
				<Code className="size-4" />
			</button>
			{terminalAvailable && (
				<button
					onClick={() => onChange('terminal')}
					className={clsx(
						'p-1 flex items-center justify-between h-full rounded-md transition-colors',
						view === 'terminal'
							? 'bg-bg text-text'
							: 'text-text-50/70 hover:text-text hover:bg-accent',
					)}
					title="Terminal"
				>
					<Terminal className="size-4" />
				</button>
			)}
		</div>
	);
}
