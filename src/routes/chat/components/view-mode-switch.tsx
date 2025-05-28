import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Code } from 'react-feather';

export function ViewModeSwitch({
	view,
	onChange,
	previewAvailable = false,
	showTooltip = false,
}: {
	view: 'preview' | 'editor' | 'blueprint';
	onChange: (mode: 'preview' | 'editor') => void;
	previewAvailable: boolean;
	showTooltip: boolean;
}) {
	if (!previewAvailable) {
		return null;
	}

	return (
		<div className="flex items-center gap-1 bg-[#1A171199] rounded-md p-0.5 relative">
			<AnimatePresence>
				{showTooltip && (
					<motion.div
						initial={{ opacity: 0, scale: 0.4 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0 }}
						className="absolute z-50 top-10 left-0 bg-bg-lighter text-white text-xs px-2 py-1 rounded whitespace-nowrap animate-fade-in"
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
						? 'bg-[#3E3324] text-white'
						: 'text-text-50/70 hover:text-white hover:bg-white/5',
				)}
			>
				<Eye className="size-4" />
			</button>
			<button
				onClick={() => onChange('editor')}
				className={clsx(
					'p-1 flex items-center justify-between h-full rounded-md transition-colors',
					view === 'editor'
						? 'bg-[#3E3324] text-white'
						: 'text-text-50/70 hover:text-white hover:bg-white/5',
				)}
			>
				<Code className="size-4" />
			</button>
		</div>
	);
}
