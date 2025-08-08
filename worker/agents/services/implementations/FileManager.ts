import { IFileManager } from '../interfaces/IFileManager';
import { IStateManager } from '../interfaces/IStateManager';
import { FileOutputType } from '../../schemas';
import { TemplateDetails } from '../../../services/sandbox/sandboxTypes';

/**
 * Manages file operations for code generation
 * Handles both template and generated files
 */
export class FileManager implements IFileManager {
    constructor(
        private stateManager: IStateManager
    ) {}

    getTemplateFile(path: string): { file_path: string; file_contents: string } | null {
        const state = this.stateManager.getState();
        return state.templateDetails?.files?.find(file => file.file_path === path) || null;
    }

    getGeneratedFile(path: string): FileOutputType | null {
        const state = this.stateManager.getState();
        return state.generatedFilesMap[path] || null;
    }

    getAllFiles(): FileOutputType[] {
        const state = this.stateManager.getState();
        const templateFiles = state.templateDetails?.files.map(file => ({
            file_path: file.file_path,
            file_contents: file.file_contents,
            file_purpose: 'Boilerplate template file'
        })) || [];
        
        // Filter out template files that have been overridden
        const nonOverriddenTemplateFiles = templateFiles.filter(
            file => !state.generatedFilesMap[file.file_path]
        );
        
        return [
            ...nonOverriddenTemplateFiles,
            ...Object.values(state.generatedFilesMap)
        ];
    }

    saveGeneratedFile(file: FileOutputType): void {
        const state = this.stateManager.getState();
        this.stateManager.setState({
            ...state,
            generatedFilesMap: {
                ...state.generatedFilesMap,
                [file.file_path]: {
                    ...file,
                    last_hash: '',
                    last_modified: Date.now(),
                    unmerged: []
                }
            }
        });
    }

    saveGeneratedFiles(files: FileOutputType[]): void {
        const state = this.stateManager.getState();
        const newFilesMap = { ...state.generatedFilesMap };
        
        for (const file of files) {
            newFilesMap[file.file_path] = {
                ...file,
                last_hash: '',
                last_modified: Date.now(),
                unmerged: []
            };
        }
        
        this.stateManager.setState({
            ...state,
            generatedFilesMap: newFilesMap
        });
    }

    getFileContents(path: string): string {
        const generatedFile = this.getGeneratedFile(path);
        if (generatedFile) {
            return generatedFile.file_contents;
        }
        
        const templateFile = this.getTemplateFile(path);
        return templateFile?.file_contents || '';
    }

    fileExists(path: string): boolean {
        return !!this.getGeneratedFile(path) || !!this.getTemplateFile(path);
    }

    getGeneratedFilePaths(): string[] {
        const state = this.stateManager.getState();
        return Object.keys(state.generatedFilesMap);
    }

    getTemplateDetails(): TemplateDetails | undefined {
        const state = this.stateManager.getState();
        return state.templateDetails;
    }

    getGeneratedFilesMap(): Record<string, FileOutputType> {
        const state = this.stateManager.getState();
        return state.generatedFilesMap;
    }
}