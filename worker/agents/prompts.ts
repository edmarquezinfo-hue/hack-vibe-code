import { RuntimeError, RuntimeErrorSchema, StaticAnalysisResponse, TemplateDetails, TemplateFileSchema } from "../services/sandbox/sandboxTypes";
import { TemplateRegistry } from "./inferutils/schemaFormatters";
import z from 'zod';
import { Blueprint, BlueprintSchema, ClientReportedErrorSchema, ClientReportedErrorType, FileOutputType, PhaseConceptSchema, PhaseConceptType } from "./schemas";
import { TemplateSelection } from "./planning/templateSelector";
import { IssueReport } from "./domain/values/IssueReport";
import { SCOFFormat } from "./code-formats/scof";

export const PROMPT_UTILS = {
    serializeTemplate(template?: TemplateDetails, forCodegen: boolean = true): string {
        if (template) {
            // const filesText = JSON.stringify(tpl.files, null, 2);
            const filesText = TemplateRegistry.markdown.serialize(
                { files: template.files.filter(f => !f.file_path.includes('package.json')) },
                z.object({ files: z.array(TemplateFileSchema) })
            );
            // const indentedFilesText = filesText.replace(/^(?=.)/gm, '\t\t\t\t'); // Indent each line with 4 spaces
            return `
<TEMPLATE DETAILS>
The following are the details (structures and files) of the starting boilerplate template, on which the project is based.

Name: ${template.name}
Frameworks: ${template.frameworks?.join(', ')}

${forCodegen ? `` : `
<TEMPLATE_CORE_FILES>
**SHADCN COMPONENTS, Error boundary components and use-toast hook ARE PRESENT AND INSTALLED BUT EXCLUDED FROM THESE FILES DUE TO CONTEXT SPAM**
${filesText}
</TEMPLATE_CORE_FILES>`}

<TEMPLATE_FILE_TREE>
**Use these files as a reference for the file structure, components and hooks that are present**
${JSON.stringify(template.fileTree, null, 2)}
</TEMPLATE_FILE_TREE>

Apart from these files, All SHADCN Components are present in ./src/components/ui/* and can be imported from there, example: import { Button } from "@/components/ui/button";
**Please do not rewrite these components, just import them and use them**

Template Usage Instructions: 
${template.description.usage}

</TEMPLATE DETAILS>`;
        } else {
            return `
<START_FROM_SCRATCH>
No starter template is available—design the entire structure yourself. You need to write all the configuration files, package.json, and all the source code files from scratch.
You are allowed to install stuff. Be very careful with the versions of libraries and frameworks you choose.
For an example typescript vite project,
The project should support the following commands in package.json to run the application:
"scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "npm run build && vite preview",
    "deploy": "npm run build && wrangler deploy",
    "cf-typegen": "wrangler types"
}
and provide a preview url for the application.

</STAåRT_FROM_SCRATCH>`;
        }
    },

    serializeErrors(errors: RuntimeError[]): string {
        if (errors && errors.length > 0) {
            // Just combine all the rawOutput of errors
            const errorsSerialized = errors.map(e => e.rawOutput ? e.rawOutput : TemplateRegistry.markdown.serialize(e, RuntimeErrorSchema))
            // Truncate each error to 1000 characters
            const truncatedErrors = errorsSerialized.map(e => e.slice(0, 1000)).join('\n\n');
            console.log('Errors:', truncatedErrors);
            return truncatedErrors;
        } else {
            return 'N/A';
        }
    },

    serializeStaticAnalysis(staticAnalysis: StaticAnalysisResponse): string {
        return `<lint_issues>
${staticAnalysis.lint?.rawOutput || 'N/A'}
</lint_issues>
<typecheck_issues>
${staticAnalysis.typecheck?.rawOutput || 'N/A'}
</typecheck_issues>`
    },

    serializeClientReportedErrors(errors: ClientReportedErrorType[]): string {
        if (errors && errors.length > 0) {
            const errorsText = TemplateRegistry.markdown.serialize(
                { errors },
                z.object({ errors: z.array(ClientReportedErrorSchema) })
            );
            console.log('Client Reported Errors:', errorsText);
            return errorsText;
        } else {
            return 'N/A';
        }
    },

    verifyPrompt(prompt: string): string {
        // If any of the '{{variables}}' are not replaced, throw an error
        // if (prompt.includes('{{')) {
        //     throw new Error(`Prompt contains un-replaced variables: ${prompt}`);
        // }
        return prompt;
    },

    serializeFiles(files: FileOutputType[]): string {
        // TemplateRegistry.markdown.serialize({ files: files }, z.object({ files: z.array(FileOutputSchema) }))
        // return files.map(file => {
        //     return `File: ${file.file_path}\nPurpose: ${file.file_purpose}\nContents: ${file.file_contents}`;
        // }).join('\n');
        // Use scof format
        return new SCOFFormat().serialize(files.map(file => {
            return {
                ...file,
                format: 'full_content'
            }
        }));
    },

    REACT_RENDER_LOOP_PREVENTION: `<REACT_RENDER_LOOP_PREVENTION>
In React, “Maximum update depth exceeded” means something in your component tree is setting state in a way that immediately triggers another render, which sets state again… and you've created a render→setState→render loop. React aborts after ~50 nested updates and throws this error.
Here's how and why it happens most often and what to do about it.

# Why it happens (typical patterns)

  * **State update during render**

    \`\`\`tsx
    function Bad() {
        const [n, setN] = useState(0);
        setN(n + 1); // ❌ runs on every render -> infinite loop
        return <div>{n}</div>;
    }
    \`\`\`

  * **useEffect without a dependency array**

    \`\`\`tsx
    // BAD CODE ❌ This effect runs after every render, causing an infinite loop.
    function BadCounter() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        setCount(prevCount => prevCount + 1);
      }); // No dependency array
      return <div>{count}</div>;
    }
    \`\`\`

  * **useEffect with a self-dependency and unconditional set**

    \`\`\`tsx
    // BAD CODE ❌ The filters object is a new reference on every render.
    // The effect runs, calls setFilters, which creates a new reference, which triggers the effect again.
    useEffect(() => {
        setFilters({ ...filters }); // new object each time
    }, [filters]); // ❌ changing filters causes effect, which changes filters again
    \`\`\`

  * **Parent/child feedback loop via props**

      * Child effect updates parent state → parent rerenders → child gets new props → child effect runs again, etc.

  * **useLayoutEffect that sets state synchronously**

      * Same as useEffect loops, but before paint, so it blows up faster.

  * **Derived state that always changes**

      * This happens when a dependency for a hook is an object or array that is re-created on every single render.

    \`\`\`tsx
    // BAD CODE ❌ The \`computed\` object is a new identity on every render.
    const [v, setV] = useState(0);
    const computed = { v };
    useEffect(() => { setV(v); }, [computed]);
    \`\`\`

      * This is very common with state management libraries like Zustand or Redux if not used carefully.

    \`\`\`tsx
    // BAD CODE ❌ useGameStore selector creates a new object reference on every render.
    const { score, bestScore } = useGameStore((state) => ({
      score: state.score,
      bestScore: state.bestScore,
    }));
    \`\`\`

  * **LLM-generated code smells**

      * Unconditional setters in effects, “mirror props to state” patterns, setting state inside \`useMemo\`/\`useCallback\`, or subscribing inside render.

# How to avoid it (quick checklist)

  * **Never set state during render.** Only in event handlers, effects, or async callbacks.

    \`\`\`tsx
    // GOOD CODE ✅ State is updated inside an event handler, not during render.
    function GoodButton() {
      const [toggled, setToggled] = useState(false);
      const handleClick = () => {
        setToggled(!toggled); // Safe: only runs on user interaction.
      };
      return <button onClick={handleClick}>Toggle</button>;
    }
    \`\`\`

  * **Give effects correct dependencies** and make updates **conditional**.

    \`\`\`tsx
    // GOOD CODE ✅ Effect only runs if \`userId\` changes.
    function UserData({ userId }) {
      const [user, setUser] = useState(null);
      useEffect(() => {
        if (userId) { // Conditional logic inside the effect
          fetchUser(userId).then(data => setUser(data));
        }
      }, [userId]); // Dependency array prevents the loop
      return <div>{user ? user.name : 'Loading...'}</div>;
    }
    \`\`\`

  * **Avoid “prop → state” mirrors** unless you can prove it stabilizes (or derive on the fly). This anti-pattern often causes loops.

    \`\`\`tsx
    // BAD CODE ❌ This creates a loop if the parent re-renders for any reason.
    function BadMirror({ propValue }) {
      const [localState, setLocalState] = useState(propValue);
      useEffect(() => {
        setLocalState(propValue);
      }, [propValue]);
      return <div/>;
    }

    // GOOD CODE ✅ Derive the value directly during render. No state or effects needed.
    function GoodDerived({ propValue }) {
      const derivedValue = propValue.toUpperCase();
      return <div>{derivedValue}</div>;
    }
    \`\`\`

  * **Stabilize identities**: memoize objects/arrays passed as props or used as dependencies.

    \`\`\`tsx
    // GOOD CODE ✅ \`useMemo\` stabilizes the object, \`useCallback\` stabilizes the function.
    const config = useMemo(() => ({ a, b }), [a, b]);
    const handleClick = useCallback(() => {
      // do something
    }, [dep1, dep2]);

    // GOOD CODE ✅ For Zustand/Redux, select primitive values individually.
    const score = useGameStore((state) => state.score);
    const bestScore = useGameStore((state) => state.bestScore);
    \`\`\`

  * **Use functional updates** and equality guards to prevent no-op loops.

    \`\`\`tsx
    // GOOD CODE ✅ Prevents a re-render if the next state is the same as the previous.
    setState(prev => prev === next ? prev : next);
    \`\`\`

  * **Prefer refs for non-UI data** that shouldn't cause rerenders.

    \`\`\`tsx
    // GOOD CODE ✅ Updating a ref does not trigger a re-render.
    const latest = useRef(value);
    latest.current = value;
    \`\`\`

  * **Break parent↔child cycles**: lift state to one place, or pass callbacks that are idempotent/guarded.

  * **For layout work**, use \`useEffect\` instead of \`useLayoutEffect\` unless you truly need sync, and still guard updates.

  * **State within Recursive Components**

    - **BAD CODE ❌**: Never initialize state inside a component that calls itself. Each recursive call creates a new, independent state, which can lead to unpredictable behavior and infinite loops when combined with layout-aware parent components.
      \`\`\`tsx
      // BAD CODE ❌ Each FolderTree instance has its own state.
      function FolderTree({ folders }) {
        const [expanded, setExpanded] = useState(new Set()); // New state on every level!
        
        return (
          <div>
            {folders.map(f => (
              <FolderTree key={f.id} folders={f.children} />
            ))}
          </div>
        );
      }
      \`\`\`

    - **GOOD CODE ✅**: Lift the state up to the first non-recursive parent component and pass the state and its setter down as props. This creates a single source of truth.
      \`\`\`tsx
      // GOOD CODE ✅ State is managed by the parent.
      function FolderTree({ folders, expanded, onToggle }) {
        return (
          <div>
            {folders.map(f => (
              <FolderTree key={f.id} folders={f.children} expanded={expanded} onToggle={onToggle} />
            ))}
          </div>
        );
      }

      function Sidebar() {
        const [expanded, setExpanded] = useState(new Set()); // ✅ State is here
        const handleToggle = (id) => { /* logic to update set */ };

        return <FolderTree folders={allFolders} expanded={expanded} onToggle={handleToggle} />;
      }
      \`\`\`
    
    - Some more examples: 
    \`\`\`
    // INCORRECT ❌
    const { items, selectedFolderId, selectFolder } = useFilesStore(state => ({
        items: state.items,
        selectedFolderId: state.selectedFolderId,
        selectFolder: state.selectFolder,
    }));
    \`\`\`

    \`\`\`
    // CORRECT ✅
    const items = useFilesStore(state => state.items);
    const selectedFolderId = useFilesStore(state => state.selectedFolderId);
    const selectFolder = useFilesStore(state => state.selectFolder);
    \`\`\`
</REACT_RENDER_LOOP_PREVENTION>`,

    COMMON_PITFALLS: `<AVOID COMMON PITFALLS>
    **TOP 6 MISSION-CRITICAL RULES (FAILURE WILL CRASH THE APP):**
    1. **DEPENDENCY VALIDATION:** Use ONLY dependencies verifiably installed in the project, as listed in <DEPENDENCIES>. Cross-check every import against available dependencies.
    2. **IMPORT & EXPORT INTEGRITY:** Ensure every component, function, or variable is correctly defined and imported properly (and exported properly). Mismatched default/named imports will cause crashes.
    3. **NO RUNTIME ERRORS:** Write robust, fault-tolerant code. Handle all edge cases gracefully with fallbacks. Never throw uncaught errors that can crash the application.
    4. **NO UNDEFINED VALUES/PROPERTIES/FUNCTIONS/COMPONENTS etc:** Ensure all variables, functions, and components are defined before use. Never use undefined values. If you use something that isn't already defined, you need to define it.
    5. **STATE UPDATE INTEGRITY:** Never call state setters directly during the render phase; all state updates must originate from event handlers or useEffect hooks to prevent infinite loops.
    6: **STATE SELECTOR STABILITY:** When using state management libraries (Zustand, Redux), always select primitive values individually. Never return a new object or array from a single selector, as this creates unstable references and will cause infinite render loops.

    **ENHANCED RELIABILITY PATTERNS:**
    •   **State Management:** Handle loading/success/error states for async operations. Initialize state with proper defaults, never undefined. Use functional updates for dependent state.
    •   **Type Safety:** Define interfaces for props/state/API responses. Check null/undefined before property access. Validate array length before element access. Rely on \`?\` operator for properties that might be undefined.
    •   **Component Safety:** Use error boundaries for components that might fail. Provide fallbacks for conditional content. Use stable, unique keys for lists.
    •   **Performance:** Use React.memo, useMemo, useCallback to prevent unnecessary re-renders. Define event handlers outside render or use useCallback.
    •   **Object Literals**: NEVER duplicate property names. \`{name: "A", age: 25, name: "B"}\` = compilation error

    **ALGORITHMIC PRECISION & LOGICAL REASONING:**
    •   **Mathematical Accuracy:** For games/calculations, implement precise algorithms step-by-step. Test edge cases mathematically (grid boundaries, array indices, coordinate transformations).
    •   **Game Logic Systems:** Break complex logic into smaller, testable functions. For positioning systems, validate coordinates at each step. For collision/merge systems, handle all possible states.
    •   **Array/Grid Operations:** When manipulating 2D grids or arrays, verify index calculations, boundary checks, and transformation logic. Use clear variable names for coordinates (row, col, x, y).
    •   **State Transitions:** For complex state changes (like game moves), implement pure functions that transform state predictably. Test each transformation independently.
    •   **Algorithm Verification:** Before implementing complex algorithms, mentally trace through examples. For games like 2048, manually verify tile movements, merges, and positioning logic.

    **FRAMEWORK & SYNTAX SPECIFICS:**
    •   Framework compatibility: Pay attention to version differences (Tailwind v3 vs v4, React Router versions)
    •   No environment variables: App deploys serverless - avoid libraries requiring env vars unless they support defaults
    •   Next.js best practices: Follow latest patterns to prevent dev server rendering issues
    •   Tailwind classes: Verify all classes exist in tailwind.config.js (e.g., avoid undefined classes like \`border-border\`)
    •   Component exports: Export all components properly, avoid mixing default/named imports
    •   UI spacing: Ensure proper padding/margins, avoid left-aligned layouts without proper spacing

    **PROPER IMPORTS**:
       - **Importing React and other libraries should be done correctly.**

    **CRITICAL SYNTAX ERRORS - PREVENT AT ALL COSTS:**
    1. **IMPORT SYNTAX**: Always use correct import syntax. NEVER write \`import */styles/globals.css'\` - use \`import './styles/globals.css'\`
    2. **UNDEFINED VARIABLES**: Always import/define variables before use. \`cn is not defined\` = missing \`import { cn } from './lib/utils'\`

    **PRE-CODE VALIDATION CHECKLIST:**
    Before writing any code, mentally verify:
    - All imports use correct syntax and paths. Be cautious about named vs default imports wherever needed.
    - All variables are defined before use  
    - No setState calls in useEffect or any other lifecycle method
    - All Tailwind classes exist in config
    - External dependencies are available

    # Few more heuristics:
        **IF** you receive a TypeScript error "cannot be used as a JSX component" for a component \`<MyComponent />\`, **AND** the error says its type is \`'typeof import(...)'\`, **THEN** the import statement for \`MyComponent\` is wrong.
        **The fix is to change the import from a default to a named import.**
        **From this:**
        \`\`\`
        import MyComponent from 'some-library';
        \`\`\`

        **To this:**

        \`\`\`
        import { MyComponent } from 'some-library';
        \`\`\`

        Applying this rule to your situation will fix both the type-check errors and the browser's runtime error.

</AVOID COMMON PITFALLS>`,
    STYLE_GUIDE: `<STYLE_GUIDE>
    • Use 2 spaces for indentation
    • Use single quotes for strings
    • Use double quotes for JSX attributes
    • Use semicolons for statements
    • **Always use named exports and imports**
</STYLE_GUIDE>
`,
    COMMON_DEP_DOCUMENTATION: `<COMMON DEPENDENCY DOCUMENTATION>
    • **The @xyflow/react package doesn't export a default ReactFlow, it exports named imports.**
        - Don't import like this:
        \`import ReactFlow from '@xyflow/react';\`
        Doing this would cause a runtime error and the only hint you would get is a lint message: 'ReactFlow' cannot be used as a JSX component. Its type 'typeof import(...)' is not a valid JSX element type

        - Import like this:
        \`import { ReactFlow } from '@xyflow/react';\`


</COMMON DEPENDENCY DOCUMENTATION>
`,
    COMMANDS: `<SETUP COMMANDS>
    • **Provide explicit commands to install necessary dependencies ONLY.** DO NOT SUGGEST MANUAL CHANGES. These commands execute directly.
    • **Dependency Versioning:**
        - **Use specific, known-good major versions.** Avoid relying solely on 'latest' (unless you are unsure) which can introduce unexpected breaking changes.
        - Always suggest a known recent compatible stable major version. If unsure which version might be available, don't specify any version.
        - Example: \`npm install react@18 react-dom@18\`
        - List commands to add dependencies separately, one command per dependency for clarity.
    • **Format:** Provide ONLY the raw command(s) without comments, explanations, or step numbers, in the form of a list
    • **Execution:** These run *before* code generation begins.

Example:
\`\`\`sh
bun add react@18
bun add react-dom@18
bun add zustand@4
bun add immer@9
bun add shadcn@2
bun add @geist-ui/react@1
\`\`\`
</SETUP COMMANDS>
`,
    CODE_CONTENT_FORMAT: `<CODE CONTENT GENERATION RULES> 
    The generated content for any file should be one of the following formats: \`full_content\` or \`unified_diff\`.

    - **When working on an existing (previously generated) file and the scope of changes would be smaller than a unified diff, use \`unified_diff\` format.**
    - **When writing an entirely new file, or the scope of changes would be bigger than a unified diff, use \`full_content\` format.**
    - **Do not use \`unified_diff\` for modifying untouched template files.**
    - **Make sure to choose the format so as to minimize the total length of response.**

    <RULES FOR \`full_content\`>
        • **Content Format:** Provide the complete and raw content of the file. Do not escape or wrap the content in any way.
        • **Example:**
            \`\`\`
                function myFunction() {
                    console.log('Hello, world!');
                }
            \`\`\`
    </RULES FOR \`full_content\`>

    <RULES FOR \`unified_diff\`>
        • **Content Format:** Provide the diff of the file. Do not escape or wrap the content in any way.
        • **Usage:** Use this format when working to modify an existing file and it would be smaller to represent the diff than the full content.
        
        **Diff Format Rules:**
            • Return edits similar to diffs that \`diff -U0\` would produce.
            • Do not include the first 2 lines with the file paths.
            • Start each hunk of changes with a \`@@ ... @@\` line.
            • Do not include line numbers like \`diff -U0\` does. The user's patch tool doesn't need them. The user's patch tool needs CORRECT patches that apply cleanly against the current contents of the file!
            • Think carefully and make sure you include and mark all lines that need to be removed or changed as \`-\` lines.
            • Make sure you mark all new or modified lines with \`+\`.
            • Don't leave out any lines or the diff patch won't apply correctly.
            • Indentation matters in the diffs!
            • Start a new hunk for each section of the file that needs changes.
            • Only output hunks that specify changes with \`+\` or \`-\` lines.
            • Skip any hunks that are entirely unchanging \` \` lines.
            • Output hunks in whatever order makes the most sense. Hunks don't need to be in any particular order.
            • When editing a function, method, loop, etc try to use a hunk to replace the *entire* code block. Delete the entire existing version with \`-\` lines and then add a new, updated version with \`+\` lines.  This will help you generate correct code and correct diffs.
            • To move code within a file, use 2 hunks: 1 to delete it from its current location, 1 to insert it in the new location.
        **Example:**

** Instead of low level diffs like this: **
\`\`\`
@@ ... @@
-def factorial(n):
+def factorial(number):
-    if n == 0:
+    if number == 0:
         return 1
     else:
-        return n * factorial(n-1)
+        return number * factorial(number-1)
\`\`\`

**Write high level diffs like this:**

\`\`\`
@@ ... @@
-def factorial(n):
-    if n == 0:
-        return 1
-    else:
-        return n * factorial(n-1)
+def factorial(number):
+    if number == 0:
+        return 1
+    else:
+        return number * factorial(number-1)
\`\`\`

    </RULES FOR \`unified_diff\`>

    When a changes to a file are big or the file itself is small, it is better to use \`full_content\` format, otherwise use \`unified_diff\` format. In the end, you should choose a format that minimizes the total length of response.
</CODE CONTENT GENERATION RULES>
`,
    UI_GUIDELINES: `## UI Precision & Polish Requirements
    • **Visual Hierarchy:** Establish clear information hierarchy using:
        - Size differentiation (text-4xl > text-2xl > text-lg > text-base)
        - Weight variation (font-bold > font-semibold > font-medium > font-normal)
        - Color contrast (primary > secondary > muted colors)
        - Spacing to create logical groupings (larger gaps between sections, smaller within groups)
    • **Component Composition Patterns:**
        - Always wrap form elements in proper containers (Card, Form components)
        - Use consistent button variants: primary for main actions, secondary for supporting actions, outline for tertiary
        - Group related controls using proper spacing and visual separation
        - Implement proper loading and empty states for all dynamic content
    • **Interactive State Management:**
        - ALL interactive elements MUST have hover, focus, and active states
        - Use consistent state indicators (loading spinners, disabled states, success/error feedback)
        - Implement proper keyboard navigation and accessibility states
    • **Layout Precision Standards:**
        - Container max-widths: Use consistent breakpoints (max-w-sm, max-w-md, max-w-lg, max-w-xl, max-w-2xl)
        - Grid layouts: Always specify proper gaps and responsive behavior
        - Flex layouts: Use consistent justify and align patterns
        - Responsive breakpoints: Test mental layout at sm, md, lg, xl breakpoints
    • **Content Presentation:**
        - Never leave empty states without proper messaging
        - Always provide loading indicators for async operations
        - Implement proper error boundaries and fallback UI
        - Use consistent spacing between content blocks (space-y-4, space-y-6, space-y-8)`,
    PROJECT_CONTEXT: `Here is everything you will need for the project:

<PROJECT CONTEXT>

<COMPLETED PHASES>

The following phases have been completed and implemented:

{{phases}}

</COMPLETED PHASES>

<CODEBASE>

Here are all the relevant files in the current codebase:

{{files}}

**THESE DO NOT INCLUDE PREINSTALLED SHADCN COMPONENTS, REDACTED FOR SIMPLICITY. BUT THEY DO EXIST AND YOU CAN USE THEM.**

</CODEBASE>

{{commandsHistory}}

</PROJECT CONTEXT>
`,
}

export const STRATEGIES_UTILS = {
    INITIAL_PHASE_GUIDELINES: `**First Phase: Polished Frontend & Skeleton**
        * **UI & Layout Foundation:** Establish global styles, themes, core layout structure (navigation, headers, footers, sidebars, etc), views/pages and fundamental UI components.
        * **Core Setup:** Define essential types, utilities, custom UI components (if needed), constants.
            - Build up the custom UI components and layout structure required for building the frontend.
            - **Primarily rely on shadcn components from ./src/components/ui/* if available before writing your own components**
        * **Frontend Completion:** Build out all the views/pages with the UI components. We need to deliver a high-fidelity representation of the final frontend UI/UX (You may use mock data for secondary views/pages). Ensure responsiveness and visual polish. Every page and link the application should work.
            - Implement the primary page to completion, with all the components it needs, polished and almost ready with proper links to secondary pages.
            - Implement most of the secondary pages. You can use mock data but actual working functionality is always preferred.
            - In this phase, all the links should work and the application should be visually complete and polished. 404s need to be rare! Make sure all the pages and routes are implemented.
        * **Implement core application logic:** Implement the core application logic and features, atleast for the primary view/page. Strive to make them fully functional (particularly for small-medium projects) but ensure they are robust and handle edge cases. This will help in making the frontend visually complete and polished.
        * **Ensure the primary view/page is visually and functionally complete. Main page should be the last file to be writen in this phase (eg src/pages/index.tsx or src/App.tsx)**
        * **Phase Granularity:** For *simple* applications, the entire functional project might be achievable in a *single phase*. For *more complex* applications, this initial phase will be the foundation of the application, especially the frontend, views and mockups.
        * **Deployable Milestone:** Every phase should be deployable. For the initial phase, we want the frontend to be visually mostly complete and polished with basic functionality.`,
    SUBSEQUENT_PHASE_GUIDELINES: `**Subsequent Phases: Fleshing out & Backend Integration**
        * **Iterative Build:** Add additional functionalities, auth, etc iteratively. Keep implementing application logic and features iteratively.
        * **Implement all views/pages and features:** Implement all views/pages and features that appear in the application or blueprint or user query. Flesh out the application as much as possible.
        * **Backend Integration:** Introduce backend services, state management, and data fetching. Instead of using mock data, make sure to use real data from the backend.
        * **Feature Expansion:** Add new features, components, and pages as needed. Nothing should be left 'coming soon' or 'to be implemented later'. Every button and feature should work.
        * **Scalable Phasing:** The *number* of these subsequent phases depends directly on the application's complexity. Simple apps might need only one refinement phase, while complex apps will require several.
        * **UI/UX:** Enhance, improve and make the application visually complete and polished. Every button and feature should work. The application should be beautiful and a piece of art.
        * **Final Polish & Review:** Conclude with a phase dedicated to final integration checks, robustness, performance tuning, and overall polish.`,
    CODING_GUIDELINES: `**Make sure the product is **FUNCTIONAL** along with **POLISHED***
    **MAKE SURE TO NOT BREAK THE APPLICATION in SUBSEQUENT PHASES. Look out for simple syntax errors and dependencies you use!**
    **The client needs to be provided with a good demoable application after each phase. The initial first phase is the most impressionable phase! Make sure it deploys and renders well.**
    **Make sure the primary page is rendered correctly and as expected after each phase**`,
    CONSTRAINTS: `<PHASE GENERATION CONSTRAINTS>
        **Focus on building the frontend and all the views/pages in the initial 1-2 phases with core functionality and mostly mock data, then fleshing out the application**    
        **Before writing any components of your own, make sure to check the existing components and files in the template, try to use them if possible (for example preinstalled shadcn components)**

        **Applications with single view/page or mostly static content are considered **Simple Projects** and those with multiple views/pages should are considered **Complex Projects** and should be designed accordingly.**
        * **Phase Count:** Aim for a maximum of 1-2 phases for simple applications and 6-9 phases for complex applications. Keep the size of each phase small in terms of number of characters!
        * **File Count:** Aim for a maximum of 1-3 files per phase for simple applications and 8-12 files per phase for complex applications.
        * The number of files in the project should be proportional to the number of views/pages that the project has.
        * Keep the size of codebase as small as possible, write encapsulated and abstracted code that can be reused, maximize code and component reuse and modularity. If a function/component is to be used in multiple files, it should be defined in a shared file.
        **DO NOT WRITE/MODIFY README FILES, LICENSES, ESSENTIAL CONFIG, OR OTHER NON-APPLICATION FILES as they are already configured in the final deployment. You are allowed to modify tailwind.config.js, vite.config.js etc if necessary**
            - Be very careful while working on vite.config.js, tailwind.config.js, etc. as any wrong changes can break the application.
        **DO NOT WRITE pdf files, images, or any other non-text files as they are not supported by the deployment.**

        **Examples**:
            * Building any tic-tac-toe game: Has a single page, simple logic -> **Simple Project** - 1 phase and 1-2 files. Initial phase should yield a perfectly working game.        
            * Building any themed 2048 game: Has a single page, simple logic -> **Simple Project** - 1 phase and 2 files max. Initial phase should yield a perfectly working game.
            * Building a full chess platform: Has multiple pages -> **Complex Project** - 4-5 phases and 5-15 files, with initial phase having around 5-11 files and should have the primary homepage working with mockups for all other views.
            * Building a full e-commerce platform: Has multiple pages -> **Complex Project** - 4-5 phases and 5-15 files max, with initial phase having around 5-11 files and should have the primary homepage working with mockups for all other views.
    </PHASE GENERATION CONSTRAINTS>`,
}

export const STRATEGIES = {
    FRONTEND_FIRST_PLANNING: `<PHASES GENERATION STRATEGY>
    **STRATEGY: Scalable, Demoable Frontend and core application First / Iterative Feature Addition later**
    The project would be developed live: The user (client) would be provided a preview link after each phase. This is our rapid development and delivery paradigm.
    The core principle is to establish a visually complete and polished frontend presentation early on with core functionalities implemented, before layering in more advanced functionality and fleshing out the backend.
    The goal is to build and demo a functional and beautiful product as fast as early on as possible.
    **Each phase should be self-contained, deployable and demoable.**
    The number of phases and files per phase should scale based on the number of views/pages and complexity of the application, layed out as follows:

    ${STRATEGIES_UTILS.INITIAL_PHASE_GUIDELINES}

    ${STRATEGIES_UTILS.SUBSEQUENT_PHASE_GUIDELINES}

    ${STRATEGIES_UTILS.CONSTRAINTS}

    **Make sure to implement all the features and functionality requested by the user and more. The application should be fully complete by the end of the last phase. There should be no compromises**
    **This is a Cloudflare Workers & Durable Objects project. The environment is preconfigured. Absolutely DO NOT Propose changes to wrangler.toml or any other config files. These config files are hidden from you but they do exist.**
    **The Homepage of the frontend is a dummy page. It should be replaced with the primary page of the application in the initial phase.**
</PHASES GENERATION STRATEGY>`, 
FRONTEND_FIRST_CODING: `<PHASES GENERATION STRATEGY>
    **STRATEGY: Scalable, Demoable Frontend and core application First / Iterative Feature Addition later**
    The project would be developed live: The user (client) would be provided a preview link after each phase. This is our rapid development and delivery paradigm.
    The core principle is to establish a visually complete and polished frontend presentation early on with core functionalities implemented, before layering in more advanced functionality and fleshing out the backend.
    The goal is to build and demo a functional and beautiful product as fast as early on as possible.
    **Each phase should be self-contained, deployable and demoable**

    ${STRATEGIES_UTILS.INITIAL_PHASE_GUIDELINES}

    ${STRATEGIES_UTILS.SUBSEQUENT_PHASE_GUIDELINES}

    ${STRATEGIES_UTILS.CODING_GUIDELINES}

    **Make sure to implement all the features and functionality requested by the user and more. The application should be fully complete by the end of the last phase. There should be no compromises**
</PHASES GENERATION STRATEGY>`, 
}

export interface GeneralSystemPromptBuilderParams {
    query: string,
    templateDetails: TemplateDetails,
    dependencies: Record<string, string>,
    forCodegen: boolean,
    blueprint?: Blueprint,
    language?: string,
    frameworks?: string[],
    templateMetaInfo?: TemplateSelection,
}

export function generalSystemPromptBuilder(
    prompt: string,
    params: GeneralSystemPromptBuilderParams
): string {
    let formattedPrompt = prompt
        .replaceAll('{{query}}', params.query)
        .replaceAll('{{template}}', PROMPT_UTILS.serializeTemplate(params.templateDetails, params.forCodegen))
        .replaceAll('{{dependencies}}', JSON.stringify(params.dependencies || []))
    
    if (params.blueprint) {
        formattedPrompt = formattedPrompt.replaceAll('{{blueprint}}', TemplateRegistry.markdown.serialize(params.blueprint, BlueprintSchema))
            .replaceAll('{{blueprintDependencies}}', params.blueprint.frameworks.join(', '));
    }

    if (params.language) {
        formattedPrompt = formattedPrompt.replaceAll('{{language}}', params.language);
    }
    if (params.frameworks) {
        formattedPrompt = formattedPrompt.replaceAll('{{frameworks}}', params.frameworks.join(', '));
    }
    if (params.templateMetaInfo) {
        formattedPrompt = formattedPrompt.replaceAll('{{usecaseSpecificInstructions}}', params.templateMetaInfo ? getUsecaseSpecificInstructions(params.templateMetaInfo) : '');
    }
    return PROMPT_UTILS.verifyPrompt(formattedPrompt);
}

export function issuesPromptFormatter(issues: IssueReport): string {
    return `<RUNTIME ERRORS>
Take a thorough look and address them in this phase:
${PROMPT_UTILS.serializeErrors(issues.runtimeErrors || [])}
</RUNTIME ERRORS>
<CLIENT REPORTED ERRORS>
These may be false positives. But take a thorough look and address them in this phase.
${PROMPT_UTILS.serializeClientReportedErrors(issues.clientErrors || [])}
</CLIENT REPORTED ERRORS>
<LINT ERRORS>
These may be just cosmetics but they are worth addressing. Please address them in this phase.
${PROMPT_UTILS.serializeStaticAnalysis(issues.staticAnalysis)}
</LINT ERRORS>`
}


export const USER_PROMPT_FORMATTER = {
    PROJECT_CONTEXT: (phases: PhaseConceptType[], files: FileOutputType[], commandsHistory: string[]) => {
        let prompt = PROMPT_UTILS.PROJECT_CONTEXT
            .replaceAll('{{phases}}', TemplateRegistry.markdown.serialize({ phases: phases }, z.object({ phases: z.array(PhaseConceptSchema) })))
            .replaceAll('{{files}}', PROMPT_UTILS.serializeFiles(files))

        if (commandsHistory.length > 0) {
            prompt = prompt.replaceAll('{{commandsHistory}}', `<COMMANDS HISTORY>

The following commands have been executed successfully in the project environment so far (These may not include the ones that are currently pending):

${commandsHistory.join('\n')}

</COMMANDS HISTORY>`);
        }
        
        return PROMPT_UTILS.verifyPrompt(prompt);
    },
};

const getStyleInstructions = (style: TemplateSelection['styleSelection']): string => {
    switch (style) {
        case `Brutalism`:
            return `
**Style Name: Brutalism**
- Characteristics: Raw aesthetics, often with bold vibrant colors on light background, large typography, large elements.
- Philosophy: Emphasizes honesty and simplicity, Non-grid, asymmetrical layouts that ignore traditional design hierarchy.
- Example Elements: Large, blocky layouts, heavy use of whitespace, unconventional navigation patterns.
`;
        case 'Retro':
            return `
**Style Name: Retro**
- Characteristics: Early-Internet graphics, pixel art, 3D objects, or glitch effects.
- Philosophy: Nostalgia-driven, aiming to evoke the look and feel of 90s or early 2000s web culture.
- Example Elements: Neon palettes, grainy textures, gradient meshes, and quirky fonts.`;
        case 'Illustrative':
            return `
**Style Name: Illustrative**
- Characteristics: Custom illustrations, sketchy graphics, and playful
- Philosophy: Human-centered, whimsical, and expressive.
- Cartoon-style characters, brushstroke fonts, animated SVGs.
- Heading Font options: Playfair Display, Fredericka the Great, Great Vibes 
            `
//         case 'Neumorphism':
//             return `
// **Style Name: Neumorphism (Soft UI)**
// - Use a soft pastel background, high-contrast accent colors for functional elements e.g. navy, coral, or bright blue. Avoid monochrome UIs
// - Light shadow (top-left) and dark shadow (bottom-right) to simulate extrusion or embedding, Keep shadows subtle but visible to prevent a washed-out look.
// - Avoid excessive transparency in text — keep readability high.
// - Integrate glassmorphism subtly`;
        case `Kid_Playful`:
            return `
**Style Name: Kid Playful**
- Bright, contrasting colors
- Stylized illustrations resembling 2D animation or children's book art
- Smooth, rounded shapes and clean borders—no gradients or realism
- Similar to Pablo Stanley, Burnt Toast Creative, or Outline-style art.
- Children’s book meets modern web`
        case 'Minimalist Design':
            return `
**Style Name: Minimalist Design**
Characteristics: Clean layouts, lots of white space, limited color palettes, and simple typography.
Philosophy: "Less is more." Focuses on clarity and usability.
Example Elements: Monochrome schemes, subtle animations, grid-based layouts.
** Apply a gradient background or subtle textures to the hero section for depth and warmth.
`
    }
    return `
** Apply a gradient background or subtle textures to the hero section for depth and warmth.
** Choose a modern sans-serif font like Inter, Sora, or DM Sans
** Use visual contrast: white or light background, or very soft gradient + clean black text.
    `
};

const SAAS_LANDING_INSTRUCTIONS = (style: TemplateSelection['styleSelection']): string => `
** If there is no brand/product name specified, come up with a suitable name
** Include a prominent hero section with a headline, subheadline, and a clear call-to-action (CTA) button above the fold.
** Insert a pricing table with tiered plans if applicable
** Design a footer with key navigation links, company info, social icons, and a newsletter sign-up.
** Add a product feature section using icon-text pairs or cards to showcase 3-6 key benefits.
** Use a clean, modern layout with generous white space and a clear visual hierarchy
** Show the magic live i.e if possible show a small demo of the product. Only if simple and feasible.
** Generate SVG illustrations where absolutely relevant.

Use the following artistic style:
${getStyleInstructions(style)}
`;

const ECOMM_INSTRUCTIONS = (): string => `
** If there is no brand/product name specified, come up with a suitable name
** Include a prominent hero section with a headline, subheadline, and a clear call-to-action (CTA) button above the fold.
** Insert a product showcase section with high-quality images, descriptions, and prices.
** Provide a collapsible sidebar (desktop) or an expandable top bar (tablet/mobile) containing filters (category, price range slider, brand, color swatches), so users can refine results without leaving the page.
** Use a clean, modern layout with generous white space and a clear visual hierarchy
`;

const DASHBOARD_INSTRUCTIONS = (): string => `
** If applicable to user query group Related Controls and Forms into Well-Labeled Cards / Panels
** If applicable to user query offer Quick Actions / Shortcuts for Common Tasks
** If user asked for analytics/visualizations/statistics - Show sparklines, mini line/bar charts, or simple pie indicators for trends 
** If user asked for analytics/visualizations/statistics - Maybe show key metrics in modular cards
** If applicable to user query make It Interactive and Contextual (Filters, Search, Pagination)
** If applicable to user query add a sidebar and or tabs
** Dashboard should be information dense.
`;

export const getUsecaseSpecificInstructions = (selectedTemplate: TemplateSelection): string => {
    switch (selectedTemplate.useCase) {
        case 'SaaS Product Website':
            return SAAS_LANDING_INSTRUCTIONS(selectedTemplate.styleSelection);
        case 'E-Commerce':
            return ECOMM_INSTRUCTIONS();
        case 'Dashboard':
            return DASHBOARD_INSTRUCTIONS();
        default:
            return `Use the following artistic style:
            ${getStyleInstructions(selectedTemplate.styleSelection)}`;
    }
}
