import { useState, useRef, useEffect } from 'react';
import { Button } from '../../../components/primitives/button';
import { Loader, ExternalLink, Zap, Check } from 'lucide-react';
import clsx from 'clsx';

interface DeploymentControlsProps {
	// Deployment state
	isPhase1Complete: boolean;
	isDeploying: boolean;
	deploymentUrl?: string;
	instanceId: string;
	isRedeployReady: boolean;
	deploymentError?: string;
	
	// Generation state (kept for compatibility but pause button will not be rendered)
	isGenerating: boolean;
	isPaused: boolean;
	
	// Actions
	onDeploy: (instanceId: string) => void;
	onStopGeneration: () => void;
	onResumeGeneration: () => void;
}

// Deployment state enum for better state management
enum DeploymentState {
	WAITING_PHASE1 = 'waiting_phase1',
	READY_TO_DEPLOY = 'ready_to_deploy',
	DEPLOYING = 'deploying',
	DEPLOYED = 'deployed',
	REDEPLOYING = 'redeploying',
	ERROR = 'error'
}

export function DeploymentControls({
	isPhase1Complete,
	isDeploying,
	deploymentUrl,
	instanceId,
	isRedeployReady,
	deploymentError,
	onDeploy,
}: DeploymentControlsProps) {
	const [isDeployButtonClicked, setIsDeployButtonClicked] = useState(false);
	const [copyButtonText, setCopyButtonText] = useState('Copy');
	const deploymentRef = useRef<HTMLDivElement>(null);

	// Reset deployment button state when deployment completes (success or failure)
	useEffect(() => {
		if (!isDeploying) {
			setIsDeployButtonClicked(false);
		}
	}, [isDeploying]);

	// Determine current deployment state with proper logic
	const getCurrentDeploymentState = (): DeploymentState => {
		if (deploymentError && !isDeploying) {
			return DeploymentState.ERROR;
		}
		
		if (isDeploying) {
			if (deploymentUrl) {
				return DeploymentState.REDEPLOYING;
			} else {
				return DeploymentState.DEPLOYING;
			}
		}
		
		if (deploymentUrl && !isDeploying) {
			return DeploymentState.DEPLOYED;
		}
		
		if (isPhase1Complete) {
			return DeploymentState.READY_TO_DEPLOY;
		}
		
		return DeploymentState.WAITING_PHASE1;
	};

	const currentState = getCurrentDeploymentState();

	const handleDeploy = () => {
		setIsDeployButtonClicked(true);
		
		// Smooth scroll animation to deployment section
		if (deploymentRef.current) {
			deploymentRef.current.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'center' 
			});
		}
		
		onDeploy(instanceId);
	};

	// State-based styling and content
	const getStateConfig = (state: DeploymentState) => {
		switch (state) {
			case DeploymentState.WAITING_PHASE1:
				return {
					panelClass: "bg-muted/30 dark:bg-muted/20 border-border/50 dark:border-border/40",
					iconClass: "bg-muted-foreground/40 dark:bg-muted-foreground/30 border-muted-foreground/40 dark:border-muted-foreground/30",
					icon: null,
					titleColor: "text-muted-foreground dark:text-muted-foreground",
					subtitleColor: "text-muted-foreground/80 dark:text-muted-foreground/70",
					title: "Deploy to Cloudflare",
					subtitle: "Deploy will be enabled after Phase 1 is implemented",
					buttonDisabled: true,
					buttonVariant: "secondary" as const,
					buttonClass: "bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground border-muted dark:border-muted cursor-not-allowed"
				};
			
			case DeploymentState.READY_TO_DEPLOY:
				return {
					panelClass: "bg-orange-50/30 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30",
					iconClass: "bg-orange-500 dark:bg-orange-600 border-orange-500 dark:border-orange-600",
					icon: <Zap className="w-2.5 h-2.5 text-white" />,
					titleColor: "text-foreground dark:text-foreground",
					subtitleColor: "text-muted-foreground dark:text-muted-foreground",
					title: "Ready to Deploy",
					subtitle: "Deploy your application to Cloudflare Workers",
					buttonDisabled: false,
					buttonVariant: "primary" as const,
					buttonClass: "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white border-orange-500 dark:border-orange-600 hover:scale-105"
				};
			
			case DeploymentState.DEPLOYING:
				return {
					panelClass: "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/30 shadow-sm dark:shadow-blue-900/20",
					iconClass: "bg-blue-500 dark:bg-blue-600 border-blue-500 dark:border-blue-600 animate-pulse",
					icon: <Loader className="w-2.5 h-2.5 text-white animate-spin" />,
					titleColor: "text-blue-900 dark:text-blue-100",
					subtitleColor: "text-blue-600 dark:text-blue-300",
					title: "Deploying to Cloudflare",
					subtitle: "Please wait while your application is being deployed...",
					buttonDisabled: true,
					buttonVariant: "primary" as const,
					buttonClass: "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border-blue-500 dark:border-blue-600 scale-105 shadow-lg dark:shadow-blue-900/50"
				};
			
			case DeploymentState.REDEPLOYING:
				return {
					panelClass: "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/30 shadow-sm dark:shadow-blue-900/20",
					iconClass: "bg-blue-500 dark:bg-blue-600 border-blue-500 dark:border-blue-600 animate-pulse",
					icon: <Loader className="w-2.5 h-2.5 text-white animate-spin" />,
					titleColor: "text-blue-900 dark:text-blue-100",
					subtitleColor: "text-blue-600 dark:text-blue-300",
					title: "Redeploying to Cloudflare",
					subtitle: "Please wait while your application is being redeployed...",
					buttonDisabled: true,
					buttonVariant: "primary" as const,
					buttonClass: "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border-blue-500 dark:border-blue-600 scale-105 shadow-lg dark:shadow-blue-900/50"
				};
			
			case DeploymentState.ERROR:
				return {
					panelClass: "bg-red-50/40 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/30 shadow-sm dark:shadow-red-900/20",
					iconClass: "bg-red-500 dark:bg-red-600 border-red-500 dark:border-red-600",
					icon: <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
					titleColor: "text-red-900 dark:text-red-100",
					subtitleColor: "text-red-600 dark:text-red-300",
					title: "❌ Deployment Failed",
					subtitle: "Error in deployment, please try again",
					buttonDisabled: !isPhase1Complete,
					buttonVariant: "primary" as const,
					buttonClass: isPhase1Complete 
						? "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white border-orange-500 dark:border-orange-600 hover:scale-105"
						: "bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground border-muted dark:border-muted cursor-not-allowed"
				};
			
			default:
				return getStateConfig(DeploymentState.WAITING_PHASE1);
		}
	};

	const stateConfig = getStateConfig(currentState);
	const isCurrentlyDeploying = currentState === DeploymentState.DEPLOYING || currentState === DeploymentState.REDEPLOYING;

	return (
		<div className="space-y-3">
			{/* Main Deployment Panel - Always visible, changes based on state */}
			{currentState !== DeploymentState.DEPLOYED && (
				<div 
					ref={deploymentRef}
					className={clsx(
						"border rounded-lg p-3 transition-all duration-500 mt-2",
						stateConfig.panelClass
					)}
				>
					<div className="flex items-center gap-3">
						{/* Enhanced Status Icon with deployment state */}
						<div className={clsx(
							"flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-500",
							stateConfig.iconClass
						)}>
							{stateConfig.icon}
						</div>
						
						{/* Enhanced Deployment Section Content */}
						<div className="flex-1">
							<div className={clsx(
								"text-sm font-medium transition-colors duration-300",
								stateConfig.titleColor
							)}>
								{stateConfig.title}
							</div>
							<div className={clsx(
								"text-xs mt-0.5 transition-colors duration-300",
								stateConfig.subtitleColor
							)}>
								{stateConfig.subtitle}
							</div>
						</div>
						
						{/* Enhanced Deploy Button - Always visible, state-aware */}
						<Button
							onClick={handleDeploy}
							disabled={stateConfig.buttonDisabled || isCurrentlyDeploying || isDeployButtonClicked}
							variant={stateConfig.buttonVariant}
							className={clsx(
								"h-8 px-4 text-sm font-medium transition-all duration-300 transform",
								stateConfig.buttonClass
							)}
						>
							{isCurrentlyDeploying ? (
								<>
									<Loader className="w-4 h-4 mr-2 animate-spin" />
									{currentState === DeploymentState.REDEPLOYING ? 'Redeploying...' : 'Deploying...'}
								</>
							) : (
								<>
									<Zap className="w-4 h-4 mr-2" />
									Deploy to Cloudflare
								</>
							)}
						</Button>
					</div>
				</div>
			)}

			{/* Deployed Success State - Enhanced with Redeploy functionality */}
			{currentState === DeploymentState.DEPLOYED && (
				<div 
					ref={deploymentRef}
					className="border rounded-lg p-4 bg-gradient-to-r from-green-50/40 to-emerald-50/40 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/60 dark:border-green-800/30 transition-all duration-700 mt-2 animate-in slide-in-from-top-2 shadow-sm dark:shadow-green-900/20"
				>
					<div className="flex items-center gap-3 mb-3">
						{/* Success Icon with animation */}
						<div className="flex-shrink-0 w-5 h-5 bg-green-500 border-2 border-green-500 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-500">
							<Check className="w-3 h-3 text-white" />
						</div>
						
						{/* Success Header */}
						<div className="flex-1">
							<div className="text-sm font-semibold text-green-900 dark:text-green-100">
								🎉 Successfully Deployed!
							</div>
							<div className="text-xs text-green-700 dark:text-green-300 mt-0.5">
								Your application is now live on Cloudflare Workers
							</div>
						</div>
					</div>
					
					{/* Elegant URL Display */}
					<div className="bg-background/60 dark:bg-card/60 border border-green-200/40 dark:border-green-800/20 rounded-md p-3 mb-3">
						<div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Live URL:</div>
						<div className="flex items-center gap-2">
							<code className="flex-1 text-sm font-mono text-green-800 dark:text-green-200 bg-green-50/50 dark:bg-green-950/30 px-2 py-1 rounded text-ellipsis overflow-hidden">
								{deploymentUrl}
							</code>
							<Button
								onClick={async () => {
									if (deploymentUrl) {
										await navigator.clipboard.writeText(deploymentUrl);
										setCopyButtonText('Copied!');
										setTimeout(() => setCopyButtonText('Copy'), 2000);
									}
								}}
								variant="secondary"
								className="h-7 px-2 text-xs bg-background dark:bg-card border border-green-300 dark:border-green-300/50 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-400 transition-all flex-shrink-0"
							>
								{copyButtonText}
							</Button>
						</div>
					</div>
					
					{/* Action Buttons - Enhanced styling for better appearance */}
					<div className="grid grid-cols-2 gap-3">
						{/* View Live Site Button - Enhanced styling */}
						<Button
							onClick={() => deploymentUrl && window.open(deploymentUrl, '_blank')}
							variant="primary"
							className="h-10 text-sm bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white border-green-600 dark:border-green-700 font-medium shadow-sm hover:shadow-md dark:hover:shadow-green-900/50 transition-all duration-200 hover:scale-[1.02]"
						>
							<ExternalLink className="w-4 h-4 mr-2" />
							View Live Site
						</Button>
						
						{/* Redeploy Button - Enhanced styling and appearance */}
						<Button
							onClick={handleDeploy}
							disabled={!isRedeployReady || isDeploying || isDeployButtonClicked}
							variant="secondary"
							className={clsx(
								"h-10 text-sm font-medium transition-all duration-200 shadow-sm",
								isRedeployReady && !isDeploying
									? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border-blue-500 dark:border-blue-600 hover:shadow-md dark:hover:shadow-blue-900/50 hover:scale-[1.02]" 
									: "bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground border-muted dark:border-muted cursor-not-allowed"
							)}
						>
							{isDeploying ? (
								<>
									<Loader className="w-4 h-4 mr-2 animate-spin" />
									Redeploying...
								</>
							) : (
								<>
									<Zap className="w-4 h-4 mr-2" />
									Redeploy
								</>
							)}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
