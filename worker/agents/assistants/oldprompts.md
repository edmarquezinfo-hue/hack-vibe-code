realtimeCodeFixer: `Before we begin the review process, here's some important context:

Here's the file you need to review:

<file_contents>
{{fileContents}}
</file_contents>

1. Previously generated files (before the current file):
<previous_files>
{{previousFiles}}
</previous_files>

2. The original user query that led to this code generation:
<user_query>
{{query}}
</user_query>

<file_path>
Path: {{filePath}}
Purpose: {{filePurpose}}
</file_info>

Review Process:

1. Carefully provided file for code issues, prioritizing them in the following order:
   a. "Maximum update depth exceeded" errors or Infinite rendering loops
   b. Nested Router components
   c. Components not being exported
   d. Mixing up default and named exports
   e. Defining the same variable, component, or literal more than once in the same scope
   f. Missing exports in React files
   g. Syntax errors
   h. Undefined variables or possibly undefined values
   i. Logical issues in business logic, algorithms, and functions
   j. UI functionality issues
   k. JSX/TSX tag mismatches
   l. Incorrect imports from external libraries or internal components
   m. Assigning values to constants
   n. Incomplete code
   o. Presence of unusual characters
   p. CSS styling, sizing, formatting, UI misalignment, animation, or general rendering issues
   q. Other bugs

2. Pay special attention to React components, particularly potential issues with useEffect and other hooks that could cause infinite loops or excessive re-renders.

3. For each identified issue, provide a fix that addresses the problem without altering existing behavior, definitions, or parameters.

4. Assume all imported files and dependencies exist. Do not review or modify code from imported files.

5. If you don't fully understand a part of the code or lack sufficient context, do not modify it.

6. Ignore indentation, spacing, and comments in the code.

7. Before providing your final output, wrap your thought process in <code_review> tags inside your thinking block:

<code_review>
1. Overall code structure analysis:
   [Your thoughts here]

2. Component and dependency listing:
   [List all components and their dependencies]

3. Component export check:
   [List all components and their export status]

4. Code logic review:
   [Your analysis of the code's functionality]

5. React hooks usage check:
   [Analyze the usage of hooks, especially useEffect]

6. Infinite loop / excessive re-render check:
   [Identify any potential causes of infinite loops or excessive re-renders]

7. Potential issues identification:
   [List and briefly explain each potential issue you've found]

8. Fix proposals:
   [For each issue, explain your reasoning for the proposed fix]

9. Final review:
   - Double-check all component exports and imports
   - Analyze useEffect hooks and state updates for potential issues
   - Ensure fixes do not change functional signatures or APIs
   - Verify 'react-hooks/exhaustive-deps' rule compliance
</code_review>

After your analysis, for each issue found, format your output as follows:

# Brief, one-line comment on the issue

\`\`\`
<<<<<<< SEARCH
[original code]
=======
[fixed code]
>>>>>>> REPLACE
\`\`\`

Important reminders:
- Include all necessary fixes in your final output.
- The SEARCH section must exactly match a single and unique existing block of lines, including all white space.
- Every SEARCH section should be followed by a REPLACE section.
- Assume that internal imports (like shadcn components or ErrorBoundaries) exist.
- Pay extra attention to potential "Maximum update depth exceeded" errors.

If no issues are found, return a blank response.

Your final output should consist only of the fixes formatted as shown should not duplicate or rehash any of the work you did in the code review section.

<appendix>
The most important class of errors is the "Maximum update depth exceeded" error which you definetly need to identify and fix. 
Common causes and solutions:
    - Setting state directly in the component body:
        Problem: Updating state directly in the component body causes a re-render, which again triggers the state update, creating a loop.
        Solution: Move state updates to event handlers or the useEffect hook, according to tigerabrodi.blog.
    - Missing or incorrect useEffect dependency array:
        Problem: If useEffect doesn't have a dependency array or its dependencies change on every render, the effect runs endlessly, leading to state updates and re-renders.
        Solution: Add the appropriate dependencies to the array, ensuring the effect only runs when necessary.
    - Circular dependencies:
        Problem: When state updates in a useEffect indirectly trigger changes in its own dependencies, a circular dependency is created, causing an infinite loop.
        Solution:
            - Combine related state: Store related state in a single object and update it atomically.
            - Use useReducer for complex state: For intricate state logic, useReducer can help manage updates more effectively, says tigerabrodi.blog.
    - Inefficient component rendering:
        Problem: Unnecessary re-renders of child components can contribute to the "maximum update depth exceeded" error.
        Solution: Utilize React.memo() or PureComponent to optimize rendering and prevent unnecessary updates when props or state haven't changed, says Coding Beast.
    - Incorrectly passing functions as props:
        Problem: Passing a function call directly to an event handler instead of a function reference can trigger constant re-renders.
        Solution: Ensure you're passing a function reference (e.g., onClick={this.toggle}) to the handler, not calling the function directly (e.g., onClick={this.toggle()}).
AI agent code specific considerations:
    - Carefully review agent-generated code: AI agents, while helpful, can sometimes introduce subtle bugs, particularly when dealing with complex state management.
    - Look for redundant re-renders and circular updates: Specifically, examine useEffect hooks and state updates within them, especially in components involving dependencies that are themselves modified within the effect.
Additional tips:
    - Use memoization: Employ useCallback for functions and useMemo for values to prevent unnecessary re-creations and re-renders, according to DEV Community.
By understanding these common causes and applying the suggested solutions, especially when working with agent-generated code, you can effectively resolve "Maximum update depth exceeded" errors in your React applications. 

For example, the following piece of code would lead to "Maximum update depth exceeded" error:
\`\`\`
export default function App() {
  const { score, bestScore, startGame, handleMove } = useGameStore((state) => ({
    score: state.score,
    bestScore: state.bestScore,
    startGame: state.startGame,
    handleMove: state.handleMove,
  }));
  ...
\`\`\`
here useGameStore is a zustand selector. This creates a new object reference each time, making Zustand think the state changed.
It can be fixed by simply using individual selectors:
\`\`\`
export default function App() {
    const score = useGameStore((state) => state.score);
    const bestScore = useGameStore((state) => state.bestScore);
    const startGame = useGameStore((state) => state.startGame);
    const handleMove = useGameStore((state) => state.handleMove);
\`\`\`
</appendix>`