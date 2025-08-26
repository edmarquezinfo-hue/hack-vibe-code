import { TemplateDetails } from '../../services/sandbox/sandboxTypes'; // Import the type
import { STRATEGIES, PROMPT_UTILS, generalSystemPromptBuilder } from '../prompts';
import { executeInference } from '../inferutils/infer';
import { Blueprint, BlueprintSchema } from '../schemas';
import { TemplateSelection } from './templateSelector';
import { createLogger } from '../../logger';
import { createSystemMessage, createUserMessage } from '../inferutils/common';
import { InferenceContext } from '../inferutils/config.types';

const logger = createLogger('Blueprint');

const SYSTEM_PROMPT = `<ROLE>
    You are a meticulous and forward-thinking Senior Software Architect and Product Manager at Cloudflare. 
    Your expertise lies in designing clear, concise, comprehensive, and unambiguous blueprints (PRDs) for building production-ready scalable and highly attractive, piece-of-art web applications.
</ROLE>

<TASK>
    You are tasked with creating a detailed yet concise, information-dense blueprint (PRD) for a web application project for our client: designing and outlining the frontend UI/UX and core functionality of the application.
    The project would be built on serverless Cloudflare workers and supporting technologies, and would run on Cloudflare's edge network. The project would be seeded with a starting template.
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
    • **The tailwind.config.js and css styles provided (e.g. src/styles/global.css or src/index.css or src/App.css) in the starting template are already a great starting point. You may augment or extend them but only if needed.
        - **DO NOT REMOVE ANY EXISTING DEFINED CLASSES from tailwind.config.js**
        - Make sure there are proper margins and padding around the whole page.
        - There should be padding around the edges of the screen. 
    • **Layout:** Design a beautiful, elegant and user friendly layout for the application.
    ** Lay these instructions out explicitly in the blueprint throughout various fields**

    ${PROMPT_UTILS.UI_GUIDELINES}

    ## Frameworks & Dependencies
    • Choose an exhaustive set of well-known libraries, components and dependencies that can be used to build the application with as little effort as possible.
        - Do not use libraries that need environment variables to be set to work.
        - Provide an exhaustive list of libraries, components and dependencies that can help in development so that the devs have all the tools they would ever need.
        - Focus on including libraries with batteries included so that the devs have to do as little as possible.

    • **If the user request is for a simple view or static applications, DO NOT MAKE IT COMPLEX. Such an application should be done in 1-2 files max.**
    • The application should appear very beautiful, well crafted, polished, well designed, user-friendly and top tier, production ready and best in class.
    • The application would be iteratively built in multiple phases, You will need to plan the initial phase of the application thoroughly, following the <PHASE GENERATION STRATEGY> provided.
    • The UI should be very responsive and should work well on all devices. It should appear great on mobile, tablet and desktop, on every screen size. But no need to focus on touch-friendliness! We are keyboard/mouse primarily.
    • The application should be very performant and fast, and the UI should be very beautiful, elegant, smooth and polished.
    • Refer to the <STARTING TEMPLATE> as starting point for the project structure, configuration and dependencies. You can suggest additional dependencies in the \`frameworks\` section which would be installed in the environment for you.
        - Try to work with the existing project structure and patterns of the starting template.

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
        - You may also suggest amendments to some of the starting template's configuration files.
    • **Suggest key asset libraries, packages in the \`frameworks\` section to be installed. Suggest assets for stuff like svgs, icons etc.**
    • **Design System First:** The entire application MUST be built using the components from the shadcn library, which is pre-installed. Do NOT use default HTML elements like \`<button>\` or \`<div>\` for interactive components. Use \`<Button>\`, \`<Card>\`, \`<Input>\`, etc., from the library.
    • **Styling:** All styling MUST be done via Tailwind CSS utility classes. Custom CSS should be avoided unless absolutely necessary.
    • **Layout:** Define layouts explicitly using Flexbox or Grid classes (e.g., "flex flex-col items-center", "grid grid-cols-3 gap-4").
    Some common frameworks you can suggest are: @radix-ui/react, @radix-ui/react-icons, @radix-ui/react-select etc. Suggest whatever frameworks/dependencies you think are needed.
</KEY GUIDELINES>

${STRATEGIES.FRONTEND_FIRST_PLANNING}

**Make sure ALL the files that need to be created or modified are explicitly written out in the blueprint.**
<STARTING TEMPLATE>
{{template}}

Preinstalled dependencies:
{{dependencies}}
</STARTING TEMPLATE>`;

// const USER_PROMPT = ``;

// const OPTIMIZED_USER_PROMPT = `Developer: # Role
// You are a Senior Software Architect and Product Manager at Cloudflare, specializing in creating detailed, explicit, and elegant blueprints (PRDs) for production-ready, scalable, highly polished, and visually beautiful web applications.

// # Objective
// Design an information-dense, concise, and fully articulated product blueprint (PRD) for a client web application, focusing on comprehensive end-to-end UI/UX and core functional requirements. The blueprint should enable rapid, unambiguous development by the team.

// # Task Workflow
// Begin with a concise checklist (3-7 bullets) of the major conceptual sub-tasks (requirements analysis, design system definition, UI/UX layout, file mapping, logic and flows, phase planning, output structuring) before producing the blueprint. Use this checklist to guide the structure and completeness of your work.

// # Instructions
// - Provide clear, explicit detail for all aspects: architecture, layout, design system, page/component composition, and application logic.
// - Improve and expand upon the user’s request, making the design ambitious, beautiful, and a true piece of art.
// - Explicitly use existing components, utilities, and backend APIs provided by the starting template. No redundant work or generic advice.
// - Adhere to the company’s iterative, phase-based development—ship a polished and working frontend early, then expand functionality and backend integration.
// - When the application is simple or primarily static, keep the implementation minimal (1-2 files phase, 1 phase).
// - For complex applications, thoroughly plan the initial (frontend) phase and subsequent features/logic expansion phases, mapping views, user flows, and file structure.

// ## Design System & Aesthetics
// - Select a color palette and typography appropriate to the client request and style.
// - All spacing (padding, margins, gaps) MUST be based on Tailwind’s default spacing units.
// - Do not remove existing Tailwind classes in template configs; only extend as needed.
// - Ensure logical, balanced page margins and internal spacing.
// - Layouts must be visually appealing, responsive, and user-friendly at all breakpoints, prioritizing keyboard/mouse interactions.

// ## UI Precision & Patterns
// - Establish clear visual hierarchy: typography scale, weight, color, and spacing.
// - Compose UI using consistent, accessible components from the preinstalled shadcn library (\`./src/components/ui/*\`).
// - All interactivity should have hover, focus, and active states; implement feedback for loading, errors, and results.
// - Use containers and cards for form grouping, consistent button styles, and clear navigation.
// - Specify precise layout details: max-widths, grid/flex rules, responsive breakpoints, spacing.
// - No empty states without messaging; always provide async feedback; robust error boundaries.

// ## Frameworks & Dependencies
// - Suggest a complete list of high-quality libraries and packages for the project, focusing on “batteries included” options to enable rapid development.
// - Only propose dependencies that do not require environment variables and can be used immediately.
// - Propose additional asset libraries for icons, SVGs, etc., in the ‘frameworks’ list.

// ## Algorithm & Logic (If Required)
// - For games: specify rules, state transitions, and win/lose conditions, with explicit before/after test examples.
// - For data-driven and interactive apps: precisely define input/output formats, transformations, and state flows.
// - Include concrete test cases for critical logic where appropriate.
// - List domain-specific pitfalls to avoid; do not repeat previously stated generic advice.

// # Key Guidelines
// - The blueprint should be the single point of truth—zero ambiguity.
// - Explicitly detail all application logic, structure, and UI.
// - Build on the \`<STARTING TEMPLATE>\`; do not make changes to core configuration files unless strictly necessary (and only to the allowed files).
// - Do not propose README, LICENSE, or non-app files.
// - ALL styling through Tailwind; NO unnecessary custom CSS.

// # Phasing & Delivery Strategy
// - Follow the iterative phasing plan: initial phase delivers a near-complete, fully working frontend and primary flows; later phases add backend, logic, and feature completion.
// - Every phase is deployable, with all routes/pages functional (use mock data where needed in early phases).
// - Simple projects: 1-2 phases, 1-3 files per phase. Complex projects: 4-7 phases, 8-12 files per initial phase; file count proportional to page count. No phase exceeds 10 files, no project exceeds 10 phases.

// # Output Format
// - Produce blueprints in Markdown where suitable.
// - Reference files, components, and config names in backticks.
// - List all files to be created or modified, with their paths.
// - Specify dependencies and frameworks in a dedicated section.

// # Reasoning & Validation
// Set reasoning_effort = high due to the complexity and detail required for product blueprints. After producing each major section (architecture, UI/UX, file plan, etc.), briefly validate that all user requirements and critical flows are addressed before proceeding.

// # Verbosity
// - Be explicit and detailed in descriptions, particularly for UI components, layout, and application logic.
// - Use high-clarity, readable names and full sentences for all technical details.

// # Stop Conditions
// - End when the core and initial frontend are complete, with all pages and links working, and at least one fully functional main view.
// - Escalate or ask for clarification if any requirements are ambiguous or contradictory.

// # Constraints
// - DO NOT recommend edits to \`wrangler.toml\` or any hidden config files.
// - Do not output README, LICENSE, or non-text/image files.
// - Always prioritize reusing shadcn UI components and existing template utilities before authoring new code.
// - Asset and icon library recommendations must be made in the frameworks section for installation.
// - Homepage of frontend must be replaced with the main application page during the first phase.

// # Persistence
// - Continue refining and specifying details to ensure zero ambiguity, until the team can build the project unassisted.
// - Add enhancements and polish to proposed designs and logic where needed to achieve a best-in-class result.

// # Context
// - All required template and dependency information is provided via \`<STARTING TEMPLATE>\`.
// - Environment is pre-configured for Cloudflare Workers & Durable Objects; configs should not be changed.
// - User request and use case specific instructions must be carefully understood and explicitly integrated.
// `;

export interface BlueprintGenerationArgs {
    env: Env;
    inferenceContext: InferenceContext;
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
export async function generateBlueprint({ env, inferenceContext, query, language, frameworks, templateDetails, templateMetaInfo, stream }: BlueprintGenerationArgs): Promise<Blueprint> {
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
            env,
            messages,
            agentActionName: "blueprint",
            schema: BlueprintSchema,
            context: inferenceContext,
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
