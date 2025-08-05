import type { Blueprint, ClientReportedErrorType, PhaseConceptType ,
    FileOutputType,
    // FileStructureOutputType,
    CodeReviewOutputType,
} from '../schemas';
import type { TemplateDetails } from '../../services/sandbox/sandboxTypes';
import type { ScreenshotData } from './types';
import type { ConversationMessage } from '../inferutils/common';

export interface FileState extends FileOutputType {
    last_hash: string;
    last_modified: number;
    unmerged: string[];
}

export interface PhaseState extends PhaseConceptType {
    // deploymentNeeded: boolean;
    completed: boolean;
}

export enum CurrentDevState {
    IDLE,
    PHASE_GENERATING,
    PHASE_IMPLEMENTING,
    REVIEWING,
    FILE_REGENERATING,
    FINALIZING,
}

export interface CodeGenState {
    blueprint: Blueprint;
    query: string;
    generatedFilesMap: Record<string, FileState >;
    generationPromise?: Promise<void>;
    generatedPhases: PhaseState[];
    commandsHistory?: string[]; // History of commands run
    lastPackageJson?: string; // Last package.json file contents
    templateDetails: TemplateDetails;
    sandboxInstanceId?: string;
    previewURL?: string;
    tunnelURL?: string;
    lastCodeReview?: CodeReviewOutputType;
    enableFileEnhancement?: boolean; // Flag to control file enhancement feature
    clientReportedErrors: ClientReportedErrorType[];
    latestScreenshot?: ScreenshotData; // Store captured screenshot
    shouldBeGenerating?: boolean; // Persistent flag indicating generation should be active

    // conversationalAssistant: ConversationalAssistant;
    agentMode: 'deterministic' | 'smart';
    sessionId: string;
    hostname: string;

    pendingUserInputs: string[];
    currentDevState: CurrentDevState;
    reviewCycles?: number; // Number of review cycles for code review phase
    currentPhase?: PhaseConceptType; // Current phase being worked on

    conversationMessages: ConversationMessage[];
}  