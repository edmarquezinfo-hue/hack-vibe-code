/**
 * Generation REST API response
 */
export interface ApiResponse {
	success: boolean;
	data: {
		text_explanation: string;
		generated_code?: GeneratedFile[];
		progress?: {
			completedFiles: number;
			totalFiles: number;
		};
		blueprint?: BlueprintType;
	};
	statusCode: number;
}

export type GeneratedFile = {
	file_path: string;
	file_contents: string;
	explanation?: string;
	next_file_path?: string;
	next_file_purpose?: string;
};

type FileTreeNode = {
	path: string;
	type: 'directory' | 'file';
	children?: FileTreeNode[];
};

type File = {
	file_path: string;
	file_contents: string;
};

export interface BlueprintType {
	title: string;
	description: string;
	colorPalette: string[];
	layout: string;
	userFlow: {
		uiDesign: string;
		userJourney: string;
	};
	frameworks: string[];
	architecture: {
		dataFlow: string;
	};
	implementationDetails: string;
	fileStructure: Array<{
		path: string;
		purpose: string;
		dependencies: string[];
	}>;
	firstFileToGenerate: string;
	pitfalls: string[];
	commands: {
		setup: string[];
	};
}

type StateMessage = {
	type: 'cf_agent_state';
	state: {
		blueprint: BlueprintType;
		query: string;
		isGenerating: boolean;
		generatedFiles?: string[];
		generatedFilesMap?: {
			[file_path: string]: GeneratedFile;
		};
		previewURL?: string;
		templateDetails: {
			name: string;
			description: string;
			fileTree: {
				path: string;
				type: 'directory' | 'file';
				children: FileTreeNode[];
			};
			files: File[];
			language: string;
			frameworks: string[];
		};
	};
};

type GenerationStartedMessage = {
	type: 'generation_started';
	message: string;
	totalFiles: number;
};

type FileGeneratingMessage = {
	type: 'file_generating';
	file_path: string;
	file_purpose: string;
};

type FileChunkGeneratedMessage = {
	type: 'file_chunk_generated';
	file_path: string;
	chunk: string;
};

type FileGeneratedMessage = {
	type: 'file_generated';
	file: GeneratedFile;
	next_file?: string;
};

type FileRegeneratedMessage = {
	type: 'file_regenerated';
	file: GeneratedFile;
	original_issues: string;
};

type GenerationCompleteMessage = {
	type: 'generation_complete';
	instanceId?: string;
	previewURL?: string;
};

type DeploymentCompletedMessage = {
	type: 'deployment_completed';
	previewURL: string;
	instanceId: string;
	message: string;
};

type CodeReviewMessage = {
	type: 'code_review';
	message: string;
	review: {
		thinking_process: string;
		issues_found: boolean;
		summary: string;
		files_to_fix: {
			issues: string[];
			file_path: string;
		}[];
	};
};

type RuntimeErrorFoundMessage = {
	type: 'runtime_error_found';
	errors: RuntimeError[];
	count: number;
};

export type CodeFixEdits = {
	type: 'code_fix_edits';
	filePath: string;
	search: string;
	replacement: string;
};

type RuntimeError = {
	timestamp: string;
	message: string;
	stack: string;
	source: string;
	severity: string;
};

type GenerationErrors = {
	type: 'generation_errors';
	typeErrors: number;
	lintIssues: number;
	runtimeErrors: RuntimeError[];
};

export type WebSocketMessage =
	| StateMessage
	| GenerationStartedMessage
	| FileGeneratingMessage
	| FileChunkGeneratedMessage
	| FileGeneratedMessage
	| FileRegeneratedMessage
	| GenerationCompleteMessage
	| DeploymentCompletedMessage
	| CodeReviewMessage
	| RuntimeErrorFoundMessage
	| CodeFixEdits
	| GenerationErrors;
