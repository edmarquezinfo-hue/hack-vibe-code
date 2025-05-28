import { User } from 'react-feather';
import { AIAvatar } from '../../../components/icons/logos';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeExternalLinks from 'rehype-external-links';

export function UserMessage({ message }: { message: string }) {
	return (
		<div className="flex gap-3">
			<div className="align-text-top pl-1">
				<User className="size-5" />
			</div>
			<div className="flex flex-col gap-2">
				<div className="font-medium text-text-50">You</div>
				<Markdown>{message}</Markdown>
			</div>
		</div>
	);
}

export function AIMessage({
	message,
	isThinking,
}: {
	message: string;
	isThinking?: boolean;
}) {
	return (
		<div className="flex gap-3">
			<div className="align-text-top pl-1">
				<AIAvatar className="size-6 text-orange-500" />
			</div>
			<div className="flex flex-col gap-2">
				<div className="font-mono font-medium text-text-50">V1.dev</div>
				<Markdown className={clsx('a-tag', isThinking ? 'animate-pulse' : '')}>
					{message}
				</Markdown>
			</div>
		</div>
	);
}

interface MarkdownProps extends React.ComponentProps<'article'> {
	children: string;
}

export function Markdown({ children, className, ...props }: MarkdownProps) {
	return (
		<article
			className={clsx('prose prose-sm prose-teal', className)}
			{...props}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[[rehypeExternalLinks, { target: '_blank' }]]}
			>
				{children}
			</ReactMarkdown>
		</article>
	);
}
