/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageRole } from './aigateway';


/**
 * Create a standard user message with content
 */
export function createUserMessage(content: string) {
    return {
        role: 'user' as MessageRole,
        content
    };
}

/**
 * Create a standard system message with content
 */
export function createSystemMessage(content: string) {
    return {
        role: 'system' as MessageRole,
        content
    };
}

/**
 * Create a standard assistant message with content
 */
export function createAssistantMessage(content: string) {
    return {
        role: 'assistant' as MessageRole,
        content
    };
}

export function formatFileTree(node: any) {
    const formatNode = (node: any) => {
      if (node.type === 'file') {
        return null; // We'll handle files separately
      }
  
      const directory = {
        full_path: node.path, // Use the last segment as the name
        files: [] as string[],
        sub_directories: [] as any[]
      };
  
      for (const child of node.children || []) {
        if (child.type === 'file') {
          directory.files.push(child.path.split('/').pop());
        } else if (child.type === 'directory') {
          const subDir = formatNode(child);
          if (subDir) {
            directory.sub_directories.push(subDir);
          }
        }
      }
  
      return directory;
    };
  
    return formatNode(node);
}

/**
 * Parses a string containing code gen
 * @param input - The raw input string.
 * @returns A parsed string
 */
export function cleanFileMetadata(input: string): string {
    const delimiter = '```'; 
    input = input.trim(); 
    const startQuotes = input.startsWith(delimiter);
    const endQuotes = input.endsWith(delimiter);
    if (!startQuotes) return input;
    const content = input.substring(3, endQuotes ? input.length - 3 : undefined).trim();
    // remove ts,tsx,js,jsx at the start of the string
    const regex = /^(ts|tsx|js|jsx|typescript)\s*/;
    const malformed = /^x\n/;
    return content.replace(regex, '').replace(malformed, '');
}



export interface CodeEdit {
    filePath: string;
    search: string;
    replacement: string;
}
export type BroadcastFn = (payload: CodeEdit) => void;
export class CodeEditStreamer {
    /** Text not yet broken into a full line (could end mid-line). */
    private tail = '';

    private filePath: string | null = null;
    private section: 'SEARCH' | 'REPLACE' | null = null;
    private searchLines: string[] = [];
    private replaceLines: string[] = [];

    constructor(private broadcast: BroadcastFn) { }

    /**
     * Feed a new chunk from `onChunk()`; emits edits on the fly.
     */
    feed(chunk: string): void {
        this.tail += chunk;

        // Process complete lines as they arrive
        let nl: number;
        while ((nl = this.tail.indexOf('\n')) !== -1) {
            // Grab the line (strip final '\n' and an optional '\r')
            let line = this.tail.slice(0, nl);
            this.tail = this.tail.slice(nl + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);

            this.consumeLine(line);
        }
    }

    /**
     * Call at the very end (after infer() resolves) in case the stream
     * ended without a trailing newline.
     */
    flush(): void {
        if (this.tail) {
            this.consumeLine(this.tail);
            this.tail = '';
        }
    }

    /* -------------------------------------------------------------- *
     * Line-by-line state machine                                      *
     * -------------------------------------------------------------- */
    private consumeLine(line: string): void {
        // 1️⃣ Waiting for a file path
        if (this.filePath === null) {
            const trimmed = line.trim();
            if (
                !trimmed ||
                trimmed.startsWith('<<<<<<<') ||
                trimmed.startsWith('=======') ||
                trimmed.startsWith('>>>>>>>') ||
                trimmed.startsWith('```') ||
                trimmed.startsWith('---') 
            ) {
                return; // ignore noise / blank lines
            }
            this.filePath = trimmed;
            return;
        }

        // 2️⃣ Expecting <<<<<<< SEARCH
        if (this.section === null) {
            if (line.startsWith('<<<<<<<')) {
                this.section = 'SEARCH';
            }
            return; // ignore anything else until we see the marker
        }

        // 3️⃣ Collecting SEARCH lines
        if (this.section === 'SEARCH') {
            if (line.startsWith('=======')) {
                this.section = 'REPLACE';
            } else {
                this.searchLines.push(line);
            }
            return;
        }

        // 4️⃣ Collecting REPLACE lines
        if (this.section === 'REPLACE') {
            if (line.startsWith('>>>>>>>')) {
                // ✅ Completed block – emit it
                this.broadcast({
                    filePath: this.filePath,
                    search: this.searchLines.join('\n'),
                    replacement: this.replaceLines.join('\n'),
                });

                // 🔄 Reset for the next block
                this.filePath = null;
                this.section = null;
                this.searchLines = [];
                this.replaceLines = [];
            } else {
                this.replaceLines.push(line);
            }
        }
    }
}
