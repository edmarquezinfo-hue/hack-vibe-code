/**
 * RealtimeCodeFixer integration
 * Handles LLM-based code fixing with proper error handling and context management
 */

import type { ICodeFixer } from '../core/interfaces/benchmark.js';
import type { AlgorithmCategory } from '../core/types/common.js';
import { CLIUtils } from '../utils/cli.js';
import { TIMEOUTS } from '../core/constants/config.js';
import { RealtimeCodeFixer } from '../../../worker/agents/assistants/realtimeCodeFixer.js';
import type { RealtimeCodeFixerContext } from '../../../worker/agents/assistants/realtimeCodeFixer.js';
import type { Blueprint, FileOutputType } from '../../../worker/agents/schemas.js';
import type { TemplateDetails } from '../../../worker/services/runnerServiceTypes.js';

// Now using proper types imported from the actual RealtimeCodeFixer module

export class CodeFixer implements ICodeFixer {
    private realtimeCodeFixer: RealtimeCodeFixer;

    constructor(private env: Record<string, any>) {
        this.realtimeCodeFixer = new RealtimeCodeFixer(this.env);
    }

    async fixCode(
        originalCode: string,
        category: AlgorithmCategory,
        modelId: string
    ): Promise<{
        fixedCode: string;
        llmDiff: string;
        diffLogs: string[];
        success: boolean;
    }> {
        try {

            const buggyFile: FileOutputType = {
                file_path: category.enginePath,
                file_purpose: `${category.description} - contains intentional bugs for testing RealtimeCodeFixer`,
                file_contents: originalCode
            };

            const context: RealtimeCodeFixerContext = {
                previousFiles: [],
                query: `Fix all bugs in the ${category.name} implementation to make all tests pass correctly. Focus on algorithmic correctness and proper implementation patterns.`,
                blueprint: this.createMockBlueprint(category),
                template: this.createMockTemplate()
            };

            CLIUtils.log('info', `🔧 Applying RealtimeCodeFixer with ${modelId}...`);
            
            // Simply run RealtimeCodeFixer without intercepting logs
            const fixedFile = await this.realtimeCodeFixer.run(
                buggyFile, 
                context, 
                modelId
            );

            const success = fixedFile.file_contents !== originalCode;
            
            CLIUtils.log('info', `✅ Code fixing ${success ? 'succeeded' : 'failed'}`);
            
            return {
                fixedCode: fixedFile.file_contents,
                llmDiff: 'Check RealtimeCodeFixer logs above for diff details',
                diffLogs: ['Logs are preserved in RealtimeCodeFixer output'],
                success
            };

        } catch (error: any) {
            CLIUtils.log('error', `      Code fixing failed: ${error.message}`);
            
            return {
                fixedCode: originalCode,
                llmDiff: `Error: ${error.message}`,
                diffLogs: [`Error applying CodeFixer: ${error.message}`],
                success: false
            };
        }
    }

    async validateConfiguration(): Promise<boolean> {
        try {
            // Check for required API keys
            const requiredKeys = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
            const availableKeys = requiredKeys.filter(key => this.env[key]);
            
            if (availableKeys.length === 0) {
                CLIUtils.log('error', 'No API keys found. At least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY is required.');
                return false;
            }

            CLIUtils.log('info', `Found ${availableKeys.length} API key(s): ${availableKeys.join(', ')}`);

            // RealtimeCodeFixer is already initialized in constructor
            
            return true; // RealtimeCodeFixer is always initialized in constructor

        } catch (error: any) {
            CLIUtils.log('error', `Configuration validation failed: ${error.message}`);
            return false;
        }
    }

    // RealtimeCodeFixer is now initialized in constructor - no need for separate initialization method

    private createMockBlueprint(category: AlgorithmCategory): Blueprint {
        return {
            title: `${category.name} Fix Test`,
            projectName: `${category.id}-fix-test`,
            description: `Testing ${category.description}`,
            colorPalette: ['#000000', '#ffffff'],
            views: [{ 
                name: 'main', 
                description: `Main ${category.name} view` 
            }],
            userFlow: {
                uiLayout: 'single-page',
                uiDesign: 'minimal',
                userJourney: `test ${category.name} fixes`
            },
            frameworks: ['typescript'],
            dataFlow: 'simple',
            architecture: {
                dataFlow: `simple data flow for ${category.name} testing`
            },
            pitfalls: [
                `Common issues with ${category.name} implementation`,
                'Off-by-one errors in algorithms',
                'Incorrect boundary conditions',
                'Wrong comparison operators'
            ],
            implementationRoadmap: [
                {
                    phase: '1',
                    description: `Fix the most critical bugs in ${category.name}`,
                },
                {
                    phase: '2', 
                    description: 'Ensure optimal performance and correctness',
                }
            ],
            initialPhase: {
                name: 'bug-fixing',
                description: `Bug fixing phase for ${category.name}`,
                files: [{
                    path: category.enginePath,
                    purpose: `${category.description} implementation file to be fixed`
                }],
                lastPhase: false
            }
        } satisfies Blueprint;
    }

    private createMockTemplate(): TemplateDetails {
        return {
            name: 'TypeScript Algorithm Template',
            description: { 
                selection: 'TypeScript Algorithm Template',
                usage: 'TypeScript template for algorithm implementations with proper testing support'
            },
            fileTree: { path: '/', type: 'directory' as const },
            files: [],
            deps: {},
            frameworks: ['typescript', 'testing']
        } satisfies TemplateDetails;
    }
}