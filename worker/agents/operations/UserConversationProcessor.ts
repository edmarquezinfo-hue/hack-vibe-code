import { ConversationalResponseSchema, ConversationalResponseType } from "../schemas";
import { createAssistantMessage, createUserMessage } from "../inferutils/common";
import { executeInference } from "../inferutils/infer";
import { getSystemPromptWithProjectContext } from "./common";
import { TemplateRegistry } from "../inferutils/schemaFormatters";
import { WebSocketMessageResponses } from "../constants";
import { WebSocketMessageData } from "../../api/websocketTypes";
import { AgentOperation, OperationOptions } from "../operations/common";
import { ConversationMessage } from "../inferutils/common";
import { StructuredLogger } from "../../logger";
import { getToolDefinitions } from "../tools/customTools";
import { XmlStreamFormat, XmlParsingState, XmlStreamingCallbacks } from "../streaming-formats/xml-stream";
import { IdGenerator } from "../utils/idGenerator";

// Constants
const CHUNK_SIZE = 64;

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

## Your role is to:
1. **Understand user needs**: Listen to user feedback, suggestions, and requests about their web application project
2. **Provide helpful responses**: Give informative, encouraging responses about the current project status and capabilities
3. **Clarify requirements**: Transform vague user input into clear, actionable requests for the development agent
4. **Maintain context**: Keep track of the project progress and user's goals throughout the conversation

## IMPORTANT CONSTRAINTS:
- You are NOT a technical implementer - you don't provide code or technical solutions
- You are a liaison between the user and the technical development agent
- Focus on understanding WHAT the user wants, not HOW to implement it
- Be conversational, helpful, and encouraging
- Keep responses concise but informative
- User suggestions would be implemented in the next phase after the current phase is completed. Let them know of this. But don't tell them the name of the phase! Just let them know that the suggestion would be implemented in the next phase and it might take a few minutes.

## Original User requirement:
{{query}}

## OUTPUT FORMAT:
First provide a concise and friendly response to the user. Then write down the enhanced and technical request for the development agent **IFF its a suggestion or change reuqest**. 
**\`<enhanced_user_request>\` is optional. IF There are no technical suggestions to be made, Leave \`<enhanced_user_request>\` blank as there is nothing to send to the technical agent, but ALWAYS RESPOND BACK WITH user_response!**
The output format is as follows (Use xml tags):

<user_response>
{{user_response}}
</user_response>

<enhanced_user_request>
{{enhanced_user_request}}
</enhanced_user_request>

Example1:
user: "I want to add a new feature to my web application"

Your response:
<user_response>
Sure, I can help you with that. Please let me know what feature you want to add and I'll guide you through the process.
</user_response>

Example2:
user: "I want to change the color of the logo to red"

Your response:
<user_response>
Sure, I have noted your request and the logo color would be changed by the end of the next phase. 
</user_response>

<enhanced_user_request>
Please change the color of the logo to red
</enhanced_user_request>
`;

export class UserConversationProcessor extends AgentOperation<UserConversationInputs, UserConversationOutputs> {
    async execute(inputs: UserConversationInputs, options: OperationOptions): Promise<UserConversationOutputs> {
        const { env, logger, context } = options;
        const { userMessage, pastMessages } = inputs;
        logger.info("Processing user message", { 
            messageLength: inputs.userMessage.length,
        });

        try {
            const systemPrompts = getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, false);
            const messages = [...pastMessages, {...createUserMessage(userMessage), conversationId: IdGenerator.generateConversationId()}];

            let extractedUserResponse = "";
            let extractedEnhancedRequest = "";
            
            // Generate unique conversation ID for this turn
            const aiConversationId = IdGenerator.generateConversationId();
            
            // Initialize robust XML streaming parser
            const xmlParser = new XmlStreamFormat();
            const xmlConfig = {
                targetElements: ['user_response', 'enhanced_user_request'],
                streamingElements: ['user_response'],
                caseSensitive: false,
                maxBufferSize: 10000
            };
            let xmlState: XmlParsingState = xmlParser.initializeXmlState(xmlConfig);
            
            // Get available tools for the conversation
            const tools = await getToolDefinitions();
            
            // XML streaming callbacks
            const xmlCallbacks: XmlStreamingCallbacks = {
                onElementContent: (tagName: string, content: string, isComplete: boolean) => {
                    if (tagName.toLowerCase() === 'user_response') {
                        extractedUserResponse += content;
                        // Stream to frontend
                        inputs.conversationResponseCallback(content, aiConversationId, true);
                        logger.info("Streamed user_response content", { 
                            length: content.length, 
                            isComplete,
                            totalLength: extractedUserResponse.length 
                        });
                    }
                },
                onElementComplete: (element) => {
                    if (element.tagName.toLowerCase() === 'enhanced_user_request') {
                        extractedEnhancedRequest = element.content.trim();
                        logger.info("Extracted enhanced_user_request", { length: extractedEnhancedRequest.length });
                    } else if (element.tagName.toLowerCase() === 'user_response') {
                        logger.info("Completed user_response streaming", { totalLength: extractedUserResponse.length });
                    }
                },
                onParsingError: (error) => {
                    logger.warn("XML parsing error in conversation response", { error });
                }
            };
            
            // Don't save the system prompts so that every time new initial prompts can be generated with latest project context
            const result = await executeInference({
                env: env,
                messages: [...systemPrompts, ...messages],
                agentActionName: "conversationalResponse",
                context: options.inferenceContext,
                tools, // Enable tools for the conversational AI
                stream: {
                    onChunk: (chunk) => {
                        logger.info("Processing user message chunk", { 
                            chunkLength: chunk.length,
                            hasXmlState: !!xmlState
                        });
                        
                        // Process chunk through XML parser
                        xmlState = xmlParser.parseXmlStream(chunk, xmlState, xmlCallbacks);
                    },
                    chunk_size: CHUNK_SIZE
                }
            });

            // Finalize XML parsing to extract any remaining content
            const finalElements = xmlParser.finalizeXmlParsing(xmlState);
            
            // Extract final values if not already captured during streaming
            if (!extractedUserResponse) {
                const userResponseElements = finalElements.get('user_response');
                if (userResponseElements && userResponseElements.length > 0) {
                    extractedUserResponse = userResponseElements[0].content.trim();
                }
            }
            
            if (!extractedEnhancedRequest) {
                const enhancedElements = finalElements.get('enhanced_user_request');
                if (enhancedElements && enhancedElements.length > 0) {
                    extractedEnhancedRequest = enhancedElements[0].content.trim();
                }
            }
            
            // Use the parsed values from streaming, fallback to original user message if parsing failed
            const finalEnhancedRequest = extractedEnhancedRequest || userMessage;
            const finalUserResponse = extractedUserResponse || "I understand you'd like to make some changes to your project. Let me pass this along to the development team.";

            const parsingErrors = xmlState.hasParsingErrors;
            const errorMessages = xmlState.errorMessages;
            
            logger.info("Successfully processed user message", {
                finalEnhancedRequest,
                finalUserResponse,
                streamingSuccess: !!extractedUserResponse,
                hasEnhancedRequest: !!extractedEnhancedRequest,
                xmlParsingErrors: parsingErrors,
                xmlErrorMessages: errorMessages
            });

            const conversationResponse: ConversationalResponseType = {
                enhancedUserRequest: finalEnhancedRequest,
                userResponse: finalUserResponse
            };

            // Save the assistant's response to conversation history
            messages.push({...createAssistantMessage(result.string), conversationId: IdGenerator.generateConversationId()});

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
                    {...createUserMessage(userMessage), conversationId: IdGenerator.generateConversationId()},
                    {...createAssistantMessage("I received your message and I'm passing it along to our development team. They'll incorporate your feedback in the next phase of development."), conversationId: IdGenerator.generateConversationId()}
                ]
            };
        }
    }

    processProjectUpdates<T extends ProjectUpdateType>(updateType: T, _data: WebSocketMessageData<T>, logger: StructuredLogger) : ConversationMessage[] {
        try {
            logger.info("Processing project update", { updateType });

            // Just save it as an assistant message. Dont save data for now to avoid DO size issues
            const preparedMessage = `**<Internal Memo>**
Project Updates: ${updateType}
</Internal Memo>`;

            return [{
                role: 'assistant',
                content: preparedMessage,
                conversationId: IdGenerator.generateConversationId()
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