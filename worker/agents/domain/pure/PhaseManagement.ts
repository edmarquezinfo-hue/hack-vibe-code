import { PhaseConceptType, FileOutputType } from '../../schemas';

/**
 * Phase and file management utilities
 * Tracks phase progress and manages file collections
 */
export class PhaseManagement {
    /**
     * Calculate total files including generated and planned
     */
    static getTotalFiles(
        generatedFilesCount: number,
        nextPhaseFiles: PhaseConceptType | undefined
    ): number {
        const planned = nextPhaseFiles?.files?.length || 0;
        return generatedFilesCount + planned;
    }

    /**
     * Calculate progress information
     */
    static getProgress(
        generatedFilesMap: Record<string, FileOutputType>,
        totalFiles: number
    ) {
        const generatedFiles = Object.keys(generatedFilesMap);
        const summary = `Generated ${generatedFiles.length} out of ${totalFiles} files so far.`;

        return {
            text_explaination: summary,
            generated_code: Object.values(generatedFilesMap).map(file => ({
                file_path: file.file_path,
                file_contents: file.file_contents,
                file_purpose: file.file_purpose
            })),
            total_files: totalFiles
        };
    }
}