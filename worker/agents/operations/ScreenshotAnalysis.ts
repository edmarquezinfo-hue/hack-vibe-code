import { Blueprint, ScreenshotAnalysisSchema, ScreenshotAnalysisType } from '../schemas';
import { createSystemMessage, createMultiModalUserMessage } from '../inferutils/common';
import { executeInference } from '../inferutils/infer';
import { PROMPT_UTILS } from '../prompts';
import { ScreenshotData } from '../core/types';
import { AgentOperation, OperationOptions } from './common';

export interface ScreenshotAnalysisInput {
    screenshotData: ScreenshotData,
}

const SYSTEM_PROMPT = `<ROLE>
    You are an expert UI/UX analyzer and visual quality assurance specialist. You excel at comparing visual implementations against design specifications and identifying UI issues.
</ROLE>

<GOAL>
    Analyze a screenshot of the generated application and compare it against the project blueprint and requirements.
</GOAL>

<TASKS>
1. Check if the UI matches the blueprint specifications
2. Identify any visual issues or bugs
3. Check for responsive design issues based on the viewport size
4. Verify that the color palette and design system is correctly implemented
5. Look for any broken elements or rendering issues
6. Verify layout, spacing, and alignment matches the design intent
7. Check for any missing UI elements specified in the blueprint
</TASKS>

<RESPONSE>
Respond with a JSON object containing your analysis.
</RESPONSE>`;

const USER_PROMPT = `
Please analyze this screenshot of the application and determine if there are any issues.

Blueprint context:
{{blueprint}}

Viewport: {{viewport}}

Analyze the screenshot and provide:
1. Whether there are any issues
2. List of specific issues found
3. Suggestions for improvements
4. Whether the UI matches the blueprint specifications`

const userPromptFormatter = (screenshotData: { viewport: { width: number; height: number }; }, blueprint: Blueprint) => {
    const prompt = USER_PROMPT
        .replaceAll('{{blueprint}}', JSON.stringify(blueprint, null, 2))
        .replaceAll('{{viewport}}', `${screenshotData.viewport.width}x${screenshotData.viewport.height}`)
    return PROMPT_UTILS.verifyPrompt(prompt);
}

export class ScreenshotAnalysisOperation extends AgentOperation<ScreenshotAnalysisInput, ScreenshotAnalysisType> {
    async execute(
        input: ScreenshotAnalysisInput,
        options: OperationOptions
    ): Promise<ScreenshotAnalysisType> {
        const { screenshotData } = input;
        const { env, context, logger } = options;
        try {
            logger.info('Analyzing screenshot from preview', {
                url: screenshotData.url,
                viewport: screenshotData.viewport,
                hasScreenshotData: !!screenshotData.screenshot,
                screenshotDataLength: screenshotData.screenshot?.length || 0
            });
    
            // Create multi-modal messages
            const messages = [
                createSystemMessage(SYSTEM_PROMPT),
                createMultiModalUserMessage(
                    userPromptFormatter(screenshotData, context.blueprint),
                    screenshotData.screenshot, // The base64 data URL
                    'high' // Use high detail for better analysis
                )
            ];
    
            const { object: analysisResult } = await executeInference({
                id: options.agentId,
                env: env,
                messages,
                schema: ScreenshotAnalysisSchema,
                agentActionName: 'screenshotAnalysis',
                retryLimit: 3
            });
    
            if (!analysisResult) {
                logger.warn('Screenshot analysis returned no result');
                throw new Error('No analysis result');
            }
    
            logger.info('Screenshot analysis completed', {
                hasIssues: analysisResult.hasIssues,
                issueCount: analysisResult.issues.length,
                matchesBlueprint: analysisResult.uiCompliance.matchesBlueprint
            });
    
            // Log detected UI issues
            if (analysisResult.hasIssues) {
                logger.warn('UI issues detected in screenshot', {
                    issues: analysisResult.issues,
                    deviations: analysisResult.uiCompliance.deviations
                });
            }
    
            return analysisResult;
        } catch (error) {
            logger.error('Error analyzing screenshot:', error);
            throw new Error(error instanceof Error ? error.message : String(error));
        }
    }
}