import type { BlueprintType } from '../api-types';
import clsx from 'clsx';
import { Markdown } from './messages';

export function Blueprint({
	blueprint,
	className,
	...props
}: React.ComponentProps<'div'> & {
	blueprint: BlueprintType;
}) {
	if (!blueprint) return null;

	return (
		<div className={clsx('w-full flex flex-col', className)} {...props}>
			<div className="bg-bg-bright-dim/80 p-6 rounded-t-xl flex items-center bg-graph-paper">
				<div className="flex flex-col gap-1">
					<div className="uppercase text-xs tracking-wider text-text-on-brand/90">
						Blueprint
					</div>
					<div className="text-2xl font-medium text-text-on-brand">
						{blueprint.title}
					</div>
				</div>
			</div>
			<div className="flex flex-col px-6 py-4 bg-bg rounded-b-xl space-y-8">
				{/* Basic Info */}
				<div className="grid grid-cols-[120px_1fr] gap-4 text-sm">
					<div className="text-text-50/70 font-mono">Description</div>
					<Markdown className="text-text-50">{blueprint.description}</Markdown>

					{blueprint.layout && (
						<>
							<div className="text-text-50/70 font-mono">Layout</div>
							<Markdown className="text-text-50">{blueprint.layout}</Markdown>
						</>
					)}

					{Array.isArray(blueprint.colorPalette) &&
						blueprint.colorPalette.length > 0 && (
							<>
								<div className="text-text-50/70 font-mono">Color Palette</div>
								<div className="flex items-center gap-2">
									{Array.isArray(blueprint.colorPalette) &&
										blueprint.colorPalette?.map((color, index) => (
											<div
												key={`color-${index}`}
												className="size-6 rounded-md border border-text/10 flex items-center justify-center"
												style={{ backgroundColor: color }}
												title={color}
											>
												<span className="sr-only">{color}</span>
											</div>
										))}
								</div>{' '}
							</>
						)}

					<div className="text-text-50/70 font-mono">Dependencies</div>
					<div className="flex flex-wrap gap-2 items-center">
						{Array.isArray(blueprint.frameworks) &&
							blueprint.frameworks.map((framework, index) => {
								let name: string, version: string | undefined;

								// support scoped packages
								if (framework.startsWith('@')) {
									const secondAt = framework.lastIndexOf('@');
									if (secondAt === 0) {
										name = framework;
									} else {
										name = framework.slice(0, secondAt);
										version = framework.slice(secondAt + 1);
									}
								} else {
									[name, version] = framework.split('@');
								}

								return (
									<span
										key={`framework-${framework}-${index}`}
										className="flex items-center text-xs border border-text/20 rounded-full px-2 py-0.5 text-text/90 hover:border-white/40 transition-colors"
									>
										<span className="font-medium">{name}</span>
										{version && (
											<span className="text-text/50">@{version}</span>
										)}
									</span>
								);
							})}
					</div>
				</div>

				{/* User Flow */}
				{blueprint.userFlow && (
					<div>
						<h3 className="text-sm font-medium mb-3 text-text-50/70 uppercase tracking-wider">
							User Flow
						</h3>
						<div className="space-y-4">
							{blueprint.userFlow?.uiDesign && (
								<div>
									<h4 className="text-xs font-medium mb-2 text-text-50/70">
										UI Design
									</h4>
									<Markdown className="text-sm text-text-50">
										{blueprint.userFlow.uiDesign}
									</Markdown>
								</div>
							)}

							{blueprint.userFlow?.userJourney && (
								<div>
									<h4 className="text-xs font-medium mb-2 text-text-50/70">
										User Journey
									</h4>
									<Markdown className="text-sm text-text-50">
										{blueprint.userFlow?.userJourney}
									</Markdown>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Architecture */}
				<div>
					<h3 className="text-sm font-medium mb-2 text-text-50/70 uppercase tracking-wider">
						Architecture
					</h3>
					<div className="space-y-4">
						<div>
							<h4 className="text-xs font-medium mb-2 text-text-50/70">
								Data Flow
							</h4>
							<Markdown className="text-sm text-text-50">
								{blueprint.architecture?.dataFlow}
							</Markdown>
						</div>
					</div>
				</div>

				{/* Implementation Details */}
				{blueprint.implementationDetails && (
					<div>
						<h3 className="text-sm font-medium mb-2 text-text-50/70 uppercase tracking-wider">
							Implementation Details
						</h3>
						<Markdown className="text-sm text-text-50">
							{blueprint.implementationDetails}
						</Markdown>
					</div>
				)}

				{/* Pitfalls */}
				{Array.isArray(blueprint.pitfalls) && blueprint.pitfalls.length > 0 && (
					<div>
						<h3 className="text-sm font-medium mb-2 text-text-50/70 uppercase tracking-wider">
							Pitfalls
						</h3>
						<div className="prose prose-sm prose-invert">
							<ul className="">
								{blueprint.pitfalls?.map((pitfall, index) => (
									<li key={`pitfall-${index}`} className="">
										{pitfall}
									</li>
								))}
							</ul>
						</div>
					</div>
				)}

				{/* Commands */}
				{Array.isArray(blueprint.commands?.setup) &&
					blueprint.commands.setup.length > 0 && (
						<div>
							<h3 className="text-sm font-medium mb-2 text-text-50/70 uppercase tracking-wider">
								Commands
							</h3>
							<div className="font-mono text-xs text-text-50/80">
								{Array.isArray(blueprint.commands.setup) &&
									blueprint.commands.setup.map((cmd, index) => (
										<div
											key={`cmd-${index}`}
											className="bg-bg-lighter/30 rounded p-2"
										>
											<span className="text-text-50/70 select-none">$</span>
											<span className="ml-2">{cmd}</span>
										</div>
									))}
							</div>
						</div>
					)}
			</div>
		</div>
	);
}
