/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageRole } from './aigateway';
import {
  ZodTypeAny,
  ZodFirstPartyTypeKind,
  AnyZodObject,
  ZodObject,
  ZodArray,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodEffects,
} from "zod";

/**
 * Walk a Zod schema node and return:
 *  • a string (if .describe(...) was applied on that node), or
 *  • an array [ ... ] (if it’s an array of something), or
 *  • a nested object { ... } (if it’s a ZodObject),
 *  • or undefined (if nothing was described anywhere in that branch).
 */
function schemaToDescriptionOrNested(
  schema: ZodTypeAny
): string | Array<any> | Record<string, any> | undefined {
  const def: any = (schema as any)._def;


  // 2) If it’s a wrapper (optional / nullable / default / effects), unwrap and recurse
  switch (def?.typeName as ZodFirstPartyTypeKind) {
    case ZodFirstPartyTypeKind.ZodOptional:
      return schemaToDescriptionOrNested((schema as ZodOptional<any>)._def.innerType);

    case ZodFirstPartyTypeKind.ZodNullable:
      return schemaToDescriptionOrNested((schema as ZodNullable<any>)._def.innerType);

    case ZodFirstPartyTypeKind.ZodDefault:
      return schemaToDescriptionOrNested((schema as ZodDefault<any>)._def.innerType);

    case ZodFirstPartyTypeKind.ZodEffects:
      return schemaToDescriptionOrNested((schema as ZodEffects<any>)._def.schema);
  }

  // 3) If it’s an array, unwrap the element type and recurse, returning [innerResult]
  if (def?.typeName === ZodFirstPartyTypeKind.ZodArray) {
    const arrDef = (schema as ZodArray<any>)._def;
    const itemSchema = arrDef.type; // the ZodTypeAny for elements
    const innerDesc = schemaToDescriptionOrNested(itemSchema);

    // If the element branch returned undefined, there was no .describe in that subtree—so return undefined.
    if (innerDesc === undefined) {
      return undefined;
    }
    // Otherwise, wrap it in a single‐element array to show “this field is an array of …”
    return [innerDesc];
  }

  // 1) If this node has a .describe("…"), return that description immediately
  if (def?.description) {
    return def.description as string;
  }

  // 4) If it’s an object, walk into each property and build a nested Record<key, descOrNested>
  if (def?.typeName === ZodFirstPartyTypeKind.ZodObject) {
    const obj = schema as AnyZodObject;
    const shape = (obj as ZodObject<any>)._def.shape();
    const result: Record<string, any> = {};

    for (const key of Object.keys(shape)) {
      result[key] = schemaToDescriptionOrNested(shape[key]);
    }

    return result;
  }

  // 5) Nothing to describe here, and not an object or array we care about—return undefined.
  return undefined;
}

/**
 * Given a ZodObject<…>, return a plain JS object whose keys match
 * the original ZodObject’s keys, and whose values are either:
 *  • a string (if that field/schema branch had a .describe()),
 *  • an array [ … ] (if it was an array whose element‐type had descriptions),
 *  • a nested Record<string, …> (if it was a nested object),
 *  • or undefined (if no .describe() was found anywhere underneath).
 */
export function zodObjectToDescriptions(
  obj: AnyZodObject
): Record<string, string | Array<any> | Record<string, any> | undefined> {
  const shape = (obj as ZodObject<any>)._def.shape();
  const out: Record<string, any> = {};

  for (const key of Object.keys(shape)) {
    out[key] = schemaToDescriptionOrNested(shape[key]);
  }

  return out;
}



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
