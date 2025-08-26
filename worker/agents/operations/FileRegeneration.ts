import { FileGenerationOutputType } from '../schemas';
import { AgentOperation, OperationOptions } from '../operations/common';
import { RealtimeCodeFixer } from '../assistants/realtimeCodeFixer';
import { FileOutputType } from '../schemas';
import { AGENT_CONFIG } from '../inferutils/config';

export interface FileRegenerationInputs {
    file: FileOutputType;
    issues: string[];
    retryIndex: number;
}

const SYSTEM_PROMPT = `You are a Senior Software Engineer at Cloudflare's Incident Response Team. Your task is to fix specific issues in individual files while preserving all existing functionality and interfaces.`

const USER_PROMPT = `<PATCH FILE: {{filePath}}>
================================
Here is some relevant context:
<user_query>
{{query}}
</user_query>

You are only provided with this file to fix.
================================

Here's the file you need to fix:
<file_to_fix>
<file_info>
Path: {{filePath}}
Purpose: {{filePurpose}}
</file_info>

<fileContents>
{{fileContents}}
</fileContents>
</file_to_fix>

**Identified Issues Requiring Patch:**
{{issues}}

## TASK:
Fix the specific issues listed below in {{filePath}} using the SEARCH/REPLACE format. Address ONLY the reported problems.

## EXAMPLE FIXES:

**Example 1 - Runtime Error:**
Issue: "Cannot read property 'length' of undefined"
<fix>
# Add null check for undefined array

\`\`\`
<<<<<<< SEARCH
if (items.length > 0) {
  return items.map(item => item.id);
}
=======
if (items && items.length > 0) {
  return items.map(item => item.id);
}
>>>>>>> REPLACE
\`\`\`
</fix>

**Example 2 - Infinite Loop:**
Issue: "Maximum update depth exceeded"
<fix>
# Add dependency array to useEffect

\`\`\`
<<<<<<< SEARCH
useEffect(() => {
  setCount(count + 1);
});
=======
useEffect(() => {
  setCount(count + 1);
}, []);
>>>>>>> REPLACE
\`\`\`
</fix>

## FIX RULES:
- Use exact SEARCH/REPLACE format shown above
- SEARCH section must match existing code exactly (including whitespace)
- Fix ONLY the specific issues listed
- Preserve all existing functionality and exports
- No TODO comments or placeholders
- Production-ready code only`;

export class FileRegenerationOperation extends AgentOperation<FileRegenerationInputs, FileGenerationOutputType> {    
    async execute(
        inputs: FileRegenerationInputs,
        options: OperationOptions
    ): Promise<FileGenerationOutputType> {
        try {
            
            // Use realtime code fixer to fix the file
            const realtimeCodeFixer = new RealtimeCodeFixer(options.env, options.inferenceContext, false, undefined, AGENT_CONFIG.fileRegeneration, SYSTEM_PROMPT, USER_PROMPT);
            const fixedFile = await realtimeCodeFixer.run(
                inputs.file, {
                    previousFiles: options.context.allFiles,
                    query: options.context.query,
                    blueprint: options.context.blueprint,
                    template: options.context.templateDetails
                },
                undefined,
                inputs.issues,
                5
            );

            return {
                ...fixedFile,
                format: "full_content"
            };
        } catch (error) {
            throw error;
        }
    }
}
