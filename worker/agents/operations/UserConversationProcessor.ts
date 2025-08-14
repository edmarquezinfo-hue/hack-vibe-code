import { ConversationalResponseSchema, ConversationalResponseType } from "../schemas";
import { createAssistantMessage, createUserMessage } from "../inferutils/common";
import { executeInference } from "../inferutils/infer";
import { getSystemPromptWithProjectContext } from "./common";
import { TemplateRegistry } from "../inferutils/schemaFormatters";
import { WebSocketMessageResponses } from "../constants";
import { WebSocketMessageData } from "../websocketTypes";
import { AgentOperation, OperationOptions } from "../operations/common";
import { ConversationMessage } from "../inferutils/common";
import { StructuredLogger } from "../../logger";
import { getToolDefinitions } from "../tools/customTools";

export interface UserConversationInputs {
    userMessage: string;
    pastMessages: ConversationMessage[];
    conversationResponseCallback: (message: string, conversationId: string, isStreaming: boolean) => void;
}

export interface UserConversationOutputs {
    conversationResponse: ConversationalResponseType;
    newMessages: ConversationMessage[];
}

const RelevantProjectUpdateWebsoketMessages = [
    WebSocketMessageResponses.PHASE_IMPLEMENTING,
    WebSocketMessageResponses.PHASE_IMPLEMENTED,
    WebSocketMessageResponses.CODE_REVIEW,
    WebSocketMessageResponses.FILE_REGENERATING,
    WebSocketMessageResponses.FILE_REGENERATED,
    WebSocketMessageResponses.DEPLOYMENT_COMPLETED,
    WebSocketMessageResponses.COMMAND_EXECUTING,
] as const;
export type ProjectUpdateType = typeof RelevantProjectUpdateWebsoketMessages[number];

const SYSTEM_PROMPT = `You are a friendly and knowledgeable Customer Success Technical Representative Agent at Cloudflare's AI-powered development platform. 

Your role is to:
1. **Understand user needs**: Listen to user feedback, suggestions, and requests about their web application project
2. **Provide helpful responses**: Give informative, encouraging responses about the current project status and capabilities
3. **Clarify requirements**: Transform vague user input into clear, actionable requests for the development agent
4. **Maintain context**: Keep track of the project progress and user's goals throughout the conversation

IMPORTANT CONSTRAINTS:
- You are NOT a technical implementer - you don't provide code or technical solutions
- You are a liaison between the user and the technical development agent
- Focus on understanding WHAT the user wants, not HOW to implement it
- Be conversational, helpful, and encouraging
- Keep responses concise but informative
- User suggestions would be implemented in the next phase after the current phase is completed. Let them know of this. But don't tell them the name of the phase! Just let them know that the suggestion would be implemented in the next phase and it might take a few minutes.

First write down the enhanced and technical request for the development agent **IFF its a suggestion or change reuqest**. Then provide a concise and friendly response to the user.
**IF There are no technical suggestions to be made, Leave enhanced_user_request blank as there is nothing to send to the technical agent, but ALWAYS RESPOND BACK WITH user_response!**
The output format is as follows (Use xml tags):

<enhanced_user_request>
{{enhanced_user_request}}
</enhanced_user_request>

<user_response>
{{user_response}}
</user_response>`;

export class UserConversationProcessor extends AgentOperation<UserConversationInputs, UserConversationOutputs> {
    async execute(inputs: UserConversationInputs, options: OperationOptions): Promise<UserConversationOutputs> {
        const { env, logger, context } = options;
        const { userMessage, pastMessages } = inputs;
        logger.info("Processing user message", { 
            messageLength: inputs.userMessage.length,
        });

        try {
            const systemPrompts = getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, false);
            const messages = [...pastMessages, {...createUserMessage(userMessage), conversationId: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`}];

            let userResponse = "";
            let enhancedSuggestion = "";
            
            // Generate unique conversation ID for this turn
            const aiConversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            // Simple XML parsing state for streaming
            let isInUserResponse = false;
            let buffer = '';

            // Get available tools for the conversation
            const tools = await getToolDefinitions();
            
            // Don't save the system prompts so that every time new initial prompts can be generated with latest project context
            await executeInference({
                id: options.agentId,
                env: env,
                messages: [...systemPrompts, ...messages],
                agentActionName: "conversationalResponse",
                tools, // Enable tools for the conversational AI
                stream: {
                    onChunk: (chunk) => {
                        logger.info("Processing user message chunk", { 
                            chunk,
                            isInUserResponse
                        });
                        
                        buffer += chunk;
                        
                        // Handle enhanced_user_request parsing (optional field - capture once if present)
                        if (!enhancedSuggestion) {
                            const enhancedMatch = buffer.match(/<enhanced_user_request>([\s\S]*?)<\/enhanced_user_request>/i);
                            if (enhancedMatch) {
                                enhancedSuggestion = enhancedMatch[1].trim();
                                logger.info("Extracted enhanced_user_request", { length: enhancedSuggestion.length });
                                // Remove the processed enhanced_user_request from buffer
                                buffer = buffer.replace(enhancedMatch[0], '');
                            }
                        }
                        
                        // Handle user_response streaming
                        if (!isInUserResponse) {
                            // Look for opening tag
                            const startMatch = buffer.match(/<user_response>/i);
                            if (startMatch) {
                                isInUserResponse = true;
                                // Remove everything up to and including the opening tag
                                buffer = buffer.substring(startMatch.index! + startMatch[0].length);
                                logger.info("Started streaming user_response");
                            }
                        }
                        
                        if (isInUserResponse) {
                            // Look for closing tag
                            const endMatch = buffer.match(/<\/user_response>/i);
                            if (endMatch) {
                                // Stream the final content before closing tag
                                const finalContent = buffer.substring(0, endMatch.index);
                                if (finalContent) {
                                    userResponse += finalContent;
                                    inputs.conversationResponseCallback(finalContent, aiConversationId, true);
                                    logger.info("Streamed final user_response chunk", { length: finalContent.length });
                                }
                                isInUserResponse = false;
                                logger.info("Completed user_response streaming", { totalLength: userResponse.length });
                            } else {
                                // Stream current buffer content
                                if (buffer) {
                                    userResponse += buffer;
                                    inputs.conversationResponseCallback(buffer, aiConversationId, true);
                                    logger.info("Streamed user_response chunk", { length: buffer.length });
                                    buffer = ''; // Clear buffer after streaming
                                }
                            }
                        }
                    },
                    chunk_size: 64
                }
            });

            // Use the parsed values from streaming, fallback to result if streaming failed
            const finalEnhancedRequest = enhancedSuggestion || userMessage;
            const finalUserResponse = userResponse || "I understand you'd like to make some changes to your project. Let me pass this along to the development team.";

            logger.info("Successfully processed user message", {
                finalEnhancedRequest: finalEnhancedRequest,
                finalUserResponse: finalUserResponse,
                streamingSuccess: !!userResponse,
                hasEnhancedRequest: !!enhancedSuggestion
            });

            const conversationResponse: ConversationalResponseType = {
                enhancedUserRequest: finalEnhancedRequest,
                userResponse: finalUserResponse
            };

            // Save the assistant's response to conversation history
            messages.push({...createAssistantMessage(TemplateRegistry.markdown.serialize(conversationResponse, ConversationalResponseSchema)), conversationId: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`});

            return {
                conversationResponse,
                newMessages: messages
            };
        } catch (error) {
            logger.error("Error processing user message:", error);
            
            // Fallback response
            return {
                conversationResponse: {
                    enhancedUserRequest: `User request: ${userMessage}`,
                    userResponse: "I received your message and I'm passing it along to our development team. They'll incorporate your feedback in the next phase of development."
                },
                newMessages: [
                    {...createUserMessage(userMessage), conversationId: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`},
                    {...createAssistantMessage("I received your message and I'm passing it along to our development team. They'll incorporate your feedback in the next phase of development."), conversationId: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`}
                ]
            };
        }
    }

    processProjectUpdates<T extends ProjectUpdateType>(updateType: T, data: WebSocketMessageData<T>, logger: StructuredLogger) : ConversationMessage[] {
        try {
            logger.info("Processing project update", { updateType });

            // Just save it as an assistant message
            const preparedMessage = `**<Internal Memo>**
Project Updates: ${updateType}

Relevant Data: 
${JSON.stringify(data, null, 2)}
</Internal Memo>`;

            return [{
                role: 'assistant',
                content: preparedMessage,
                conversationId: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            }];
        } catch (error) {
            logger.error("Error processing project update:", error);
            return [];
        }
    }

    isProjectUpdateType(type: any): type is ProjectUpdateType {
        return RelevantProjectUpdateWebsoketMessages.includes(type);
    }
}