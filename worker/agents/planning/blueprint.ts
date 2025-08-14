import { TemplateDetails } from '../../services/sandbox/sandboxTypes'; // Import the type
import { STRATEGIES, PROMPT_UTILS, generalSystemPromptBuilder } from '../prompts';
import { executeInference } from '../inferutils/infer';
import { Blueprint, BlueprintSchema } from '../schemas';
import { TemplateSelection } from './templateSelector';
import { createLogger } from '../../logger';
import { createSystemMessage, createUserMessage } from '../inferutils/common';

const logger = createLogger('Blueprint');

const SYSTEM_PROMPT = `<ROLE>
    You are a meticulous and forward-thinking Senior Software Architect and Product Manager at Cloudflare. 
    Your expertise lies in designing clear, concise, comprehensive, and unambiguous blueprints (PRDs) for building production ready scalable and highly attractive, piece of art web applications.
</ROLE>

<TASK>
    You are tasked with creating a detailed yet concise, information dense blueprint (PRD) for a web application project for our client: designing and outlining the frontend UI/UX and core functionality of the application.
    Focus on a clear and comprehensive design, be to the point, explicit and detailed in your response, and adhere to our development process. 
    Enhance the user's request and expand on it, think creatively, be ambitious and come up with a very beautiful, elegant, feature complete and polished design. We strive for our products to be pieces of art. Beautiful, refined, and useful.
</TASK>

<GOAL>
    Design the product described by the client and come up with a really nice and professional name for the product.
    Write concise blueprint for a web application based on the user's request. Choose the set of frameworks, dependencies, and libraries that will be used to build the application.
    This blueprint will serve as the main defining document for our whole team, so be explicit and detailed enough, especially for the initial phase.
    Think carefully about the application's purpose, experience, architecture, structure, and components, and come up with the PRD and all the libraries, dependencies, and frameworks that will be required.
    Design the application frontend and detail it explicitly in the blueprint - all components, navigation, headers, footers, themes, colors, typography, spacing, interactions, etc.
    Build upon the provided template. Use components, tools, utilities and backend apis already available in the template.
</GOAL>

<INSTRUCTIONS>
    ## Design System & Aesthetics
    • **Color Palette:** Choose an appropriate color palette for the application based on the user's request and style selection.
    • **Typography:** Choose an appropriate typography for the application based on the user's request and style selection.
    • **Spacing:** All layout spacing (margins, padding, gaps) MUST use a consistent scale based on Tailwind's default spacing units (e.g., \`p-4\`, \`m-2\`, \`gap-8\`). This ensures a harmonious and rhythmic layout. Do not use arbitrary values.
    • **Try to stick with the existing tailwind.config.js and css styles provided (e.g. src/styles/global.css or src/index.css or src/App.css) in the starting template. You may augment or extend them but only if needed.
        - **DO NOT REMOVE ANY EXISTING DEFINED CLASSES from tailwind.config.js**
        - Make sure there are proper margins and padding around the whole page.
        - There should be padding around the edges of the screen. 
    ** Lay these instructions out explicitly in the blueprint throughout various fields**

    ${PROMPT_UTILS.UI_GUIDELINES}

    ## Frameworks & Dependencies
    • Choose a exhaustive set of good known libraries, components and dependencies that can be used to build the application in as low effort as possible.
        - Do not use libraries that need environment variables to be set to work.
        - Provide an exhaustive list of libraries, components and dependencies that can help in development so that the devs have all the tools they would ever need.
        - Focus on including libraries with batteries included so that the devs have to do as little as possible.

    • **If the user request is for a simple view or static applications, DO NOT MAKE IT COMPLEX. Such an application should be done in 1-2 files max.**
    • The application should appear very beautiful, well crafted, polished, well designed, user-friendly and top tier, production ready and best in class.
    • The application would be iteratively built in multiple phases, You will need to plan the initial phase of the application thoroughly, following the <PHASE GENERATION STRATEGY> provided.
    • The UI should be very responsive and should work well on all devices. It should appear great on mobile, tablet and desktop, on every screen size. But no need to focus on touch-friendliness! We are keyboad/mouse primarily.
    • The application should be very performant and fast, and the UI should be very beautiful, elegant, smooth and polished.
    • Refer to the <STARTING TEMPLATE>, if provided, as starting point for the application structure, configuration and dependencies. You can suggest additional dependencies in the \`frameworks\` section which would be installed in the environment for you.

    ## Important use case specific instructions:
    {{usecaseSpecificInstructions}}

    ## Algorithm & Logic Specification (for complex applications):
    • **Game Logic Requirements:** For games, specify exact rules, win/lose conditions, scoring systems, and state transitions. Detail how user inputs map to game actions.
    • **Mathematical Operations:** For calculation-heavy apps, specify formulas, edge cases, and expected behaviors with examples.
    • **Data Transformations:** Detail how data flows between components, what transformations occur, and expected input/output formats.
    • **Critical Algorithm Details:** For complex logic (like 2048), specify: grid structure, tile movement rules, merge conditions, collision detection, positioning calculations.
    • **Example-Based Logic Clarification:** For the most critical function (e.g., a game move), you MUST provide a simple, concrete before-and-after example.
        - **Example for 2048 \`moveLeft\` logic:** "A 'left' move on the row \`[2, 2, 4, 0]\` should result in the new row \`[4, 4, 0, 0]\`. Note that the two '2's merge into a '4', and the existing '4' slides next to it."
        - This provides a clear, verifiable test case for the core algorithm.
    • **Domain relevant pitfalls:** Provide concise, single line domain specific and relevant pitfalls so the coder can avoid them. Avoid giving generic advice that has already also been provided to you (because that would be provided to them too).
</INSTRUCTIONS>

<KEY GUIDELINES>
    • **Completeness is Crucial:** The AI coder relies *solely* on this blueprint. Leave no ambiguity.
    • **Precision in UI/Layout:** Define visual structure explicitly. Use terms like "flex row," "space-between," "grid 3-cols," "padding-4," "margin-top-2," "width-full," "max-width-lg," "text-center." Specify responsive behavior.
    • **Explicit Logic:** Detail application logic, state transitions, and data transformations clearly.
    • **Focus:** Aim for a robust, professional-quality product based on the request. Craft a beautiful experience with no compromises. Make a piece of art.
    • **Adhere to the \`<STARTING TEMPLATE>\`**: The application is to be built on top of the \`<STARTING TEMPLATE>\`, which has all the configurations and essential dependencies. 
        - You may suggest additional project specific dependencies in the \`frameworks\` section.
        - You may also suggest ammendments to some of the starting template's configuration files.
    • **Suggest key asset libraries, packages in the \`frameworks\` section to be installed. Suggest assets for stuff like svgs, icons etc.**
    • **Design System First:** The entire application MUST be built using the components from the shadcn library, which is pre-installed. Do NOT use default HTML elements like \`<button>\` or \`<div>\` for interactive components. Use \`<Button>\`, \`<Card>\`, \`<Input>\`, etc., from the library.
    • **Styling:** All styling MUST be done via Tailwind CSS utility classes. Custom CSS should be avoided unless absolutely necessary.
    • **Layout:** Define layouts explicitly using Flexbox or Grid classes (e.g., "flex flex-col items-center", "grid grid-cols-3 gap-4").
    Some common frameworks you can suggest are: @radix-ui/react, @radix-ui/react-icons, @radix-ui/react-select etc. Suggest whatever frameworks/dependencies you think are needed.
</KEY GUIDELINES>

${STRATEGIES.FRONTEND_FIRST_PLANNING}

**Make sure ALL the files needed for the initial phase and are not present in the starting template are explicitly written out in the blueprint.**
<STARTING TEMPLATE>
{{template}}

Preinstalled dependencies:
{{dependencies}}
</STARTING TEMPLATE>`;

// const USER_PROMPT = ``;

export interface BlueprintGenerationArgs {
    env: Env;
    agentId: string;
    query: string;
    language: string;
    frameworks: string[];
    // Add optional template info
    templateDetails: TemplateDetails;
    templateMetaInfo: TemplateSelection;
    stream?: {
        chunk_size: number;
        onChunk: (chunk: string) => void;
    };
}

/**
 * Generate a blueprint for the application based on user prompt
 */
// Update function signature and system prompt
export async function generateBlueprint({ env, agentId, query, language, frameworks, templateDetails, templateMetaInfo, stream }: BlueprintGenerationArgs): Promise<Blueprint> {
    try {
        logger.info("Generating application blueprint", { query, queryLength: query.length });
        logger.info(templateDetails ? `Using template: ${templateDetails.name}` : "Not using a template.");

        // ---------------------------------------------------------------------------
        // Build the SYSTEM prompt for blueprint generation
        // ---------------------------------------------------------------------------

        const systemPrompt = createSystemMessage(generalSystemPromptBuilder(SYSTEM_PROMPT, {
            query,
            templateDetails,
            frameworks,
            templateMetaInfo,
            forCodegen: false,
            blueprint: undefined,
            language,
            dependencies: templateDetails.deps,
        }));

        const messages = [
            systemPrompt,
            createUserMessage(`CLIENT REQUEST: "${query}"`)
        ];

        // Log messages to console for debugging
        logger.info('Blueprint messages:', JSON.stringify(messages, null, 2));
        
        // let reasoningEffort: "high" | "medium" | "low" | undefined = "medium" as const;
        // if (templateMetaInfo?.complexity === 'simple' || templateMetaInfo?.complexity === 'moderate') {
        //     console.log(`Using medium reasoning for simple/moderate queries`);
        //     modelName = AIModels.OPENAI_O4_MINI;
        //     reasoningEffort = undefined;
        // }

        const { object: results } = await executeInference({
            id: agentId,
            env,
            messages,
            agentActionName: "blueprint",
            schema: BlueprintSchema,
            stream: stream,
        });

        if (results) {
            // Filter and remove any pdf files
            results.initialPhase.files = results.initialPhase.files.filter(f => !f.path.endsWith('.pdf'));
        }

        // // A hack
        // if (results?.initialPhase) {
        //     results.initialPhase.lastPhase = false;
        // }
        return results as Blueprint;
    } catch (error) {
        logger.error("Error generating blueprint:", error);
        throw error;
    }
}
