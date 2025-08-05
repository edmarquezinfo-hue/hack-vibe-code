// export interface CompleteFileObject {
//     file_path: string;
//     file_contents: string;
// }

import { FileGenerationOutputType } from "../schemas";

// export interface FileObject extends CompleteFileObject {
//     format: 'full_content' | 'unified_diff';
// }

/**
 * A Chunk of llm output can contain partial contents of multiple files
 * the chunk can be very large and therefore multiple entire files can be present in the chunk
 * along with the partial ending contents of the last file and the beginning contents of the next file
 */

// export interface ParsedChunk {
//     file_path: string;
//     chunk: string;
//     isPartial: boolean;
//     // Maybe add more fields? or change the structure
// }

export interface ParsingState {
    // Custom parsing state to be implemented
}

export interface CodeGenerationStreamingState {
    // Accumulator for the raw chunk stream
    accumulator: string;
    // Completed files map, file path -> FileObject
    completedFiles: Map<string, FileGenerationOutputType>;
    parsingState: ParsingState;
}

export abstract class CodeGenerationFormat {
    constructor() { 
    }

    // Parse a raw streaming chunk, identifying file paths and content
    // Maintain state in CodeGenerationStreamingState.
    // Return the updated state. Maintain all the state in the state object, do not use any global variables.
    // After the last chunk, completedFiles will contain all the files that were generated.
    // onFileOpen, onFileChunk, onFileClose are callbacks to be called sequentially while parsing the chunk from the llm output
    abstract parseStreamingChunks(
        chunk: string, 
        state: CodeGenerationStreamingState,
        onFileOpen: (file_path: string) => void,    // To be called when a new file is opened
        onFileChunk: (file_path: string, chunk: string, format: 'full_content' | 'unified_diff') => void,    // To be called to pass the chunk of a file
        onFileClose: (file_path: string) => void    // To be called when a file is closed
    ): CodeGenerationStreamingState;

    // Serialize FileObject array to a string
    abstract serialize(files: FileGenerationOutputType[]): string;

    // Deserialize a string to FileObject array
    abstract deserialize(serialized: string): FileGenerationOutputType[];

    // Prompt instructions for code generation in the format
    abstract formatInstructions(): string;
}

/*

Use familiar shell patterns for multi-file code generation:

FILE CREATION:
# Creating new file: filename.ext
cat > filename.ext << 'EOF'
[file content here]
EOF

UNIFIED DIFF PATCHES:
# Applying diff to file: filename.ext
cat << 'EOF' | patch filename.ext
@@ -1,3 +1,3 @@
 function example() {
-    old line
+    new line
 }
EOF

IMPORTANT RULES:
1. Command-line paths (cat > filename) ALWAYS override comment paths
2. Use single quotes around EOF markers for consistency
3. Ensure proper line endings and EOF markers
4. Large chunks may contain multiple complete files
5. Format supports streaming with partial file updates

This format enables real-time file generation with websocket callbacks for:
- FILE_GENERATING (when file operation starts)
- FILE_CHUNK_GENERATED (for partial content updates)  
- FILE_GENERATED (when file is completed)`;
*/