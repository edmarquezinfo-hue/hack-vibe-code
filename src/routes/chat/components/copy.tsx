import { useState } from "react";
import { Check, Link2 } from "react-feather";

export function Copy({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	return (
		<button
			className="p-1"
			onClick={() => {
				navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => {
					setCopied(false);
				}, 2500);
			}}
		>
			{copied ? (
				<Check className="size-4 text-green-300/70" />
			) : (
				<Link2 className="size-4 text-white/60" />
			)}
		</button>
	);
}
