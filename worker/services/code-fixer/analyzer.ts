/**
 * General Purpose TypeScript Analyzer for Cloudflare Workers
 * Uses @ts-morph/bootstrap for comprehensive in-memory TypeScript analysis
 * Automatically handles TypeScript lib files without filesystem access
 */

import { createProject, ts } from '@ts-morph/bootstrap';
import { CodeIssue, LintSeverity } from '../sandbox/sandboxTypes';

export interface AnalyzerOptions {
    /** Whether to include JSX support for .tsx files */
    enableJSX?: boolean;
    /** Whether to enable strict mode checking */
    strictMode?: boolean;
    /** Target ECMAScript version */
    target?: string;
}

export interface AnalyzerResult {
    issues: CodeIssue[];
    summary: {
        errorCount: number;
        warningCount: number;
        infoCount: number;
        totalCount: number;
    };
    success: boolean;
}

/**
 * General Purpose TypeScript Analyzer
 * Uses @ts-morph/bootstrap for proper in-memory TypeScript analysis
 * This is the architectural solution instead of targeted/piecemeal approaches
 */
export class TypeScriptAnalyzer {
    private options: AnalyzerOptions;

    constructor(options: AnalyzerOptions = {}) {
        this.options = {
            enableJSX: true,
            strictMode: false,
            target: 'ES2022',
            ...options
        };
    }

    /**
     * Analyze a single TypeScript file using the general purpose @ts-morph/bootstrap approach
     */
    public async analyzeFile(fileName: string, content: string, options?: AnalyzerOptions): Promise<AnalyzerResult> {
        try {
            const mergedOptions = { ...this.options, ...options };
            const issues = await this.performGeneralPurposeAnalysis(fileName, content, mergedOptions);
            const summary = this.calculateSummary(issues);

            return {
                issues,
                summary,
                success: summary.errorCount === 0
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown analysis error';
            return {
                issues: [{
                    message: `Analysis failed: ${errorMessage}`,
                    filePath: fileName,
                    line: 1,
                    column: 1,
                    severity: 'error' as LintSeverity,
                    ruleId: 'ANALYSIS_ERROR',
                    source: 'TypeScript Analyzer'
                }],
                summary: {
                    errorCount: 1,
                    warningCount: 0,
                    infoCount: 0,
                    totalCount: 1
                },
                success: false
            };
        }
    }

    /**
     * General purpose analysis using @ts-morph/bootstrap
     * This is the proper architectural solution for in-memory TypeScript analysis
     */
    private async performGeneralPurposeAnalysis(fileName: string, content: string, options: AnalyzerOptions): Promise<CodeIssue[]> {
        // Create a project with in-memory file system using @ts-morph/bootstrap
        // Use exact standard TypeScript configuration to ensure all globals are loaded
        const project = await createProject({ 
            useInMemoryFileSystem: true,
            compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                lib: ['lib.es2022.full.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.webworker.d.ts'],
                strict: options.strictMode || false,
                jsx: options.enableJSX && fileName.endsWith('.tsx') ? ts.JsxEmit.React : ts.JsxEmit.None,
                allowJs: true,
                skipLibCheck: false,
                noEmit: true,
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                typeRoots: [],
                types: []
            }
        });

        // Add the source file to the in-memory project
        const sourceFile = project.createSourceFile(fileName, content);
        
        // Create TypeScript program for comprehensive analysis
        const program = project.createProgram();
        
        // Get comprehensive diagnostics using TypeScript's built-in analysis
        const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile.getSourceFile());
        
        // Convert TypeScript diagnostics to CodeIssue format
        return diagnostics
            .filter(diagnostic => !this.shouldFilterDiagnostic(diagnostic))
            .map(diagnostic => this.convertDiagnosticToCodeIssue(diagnostic, fileName));
    }

    /**
     * Filter diagnostics to avoid false positives while maintaining comprehensive analysis
     */
    private shouldFilterDiagnostic(diagnostic: ts.Diagnostic): boolean {
        const messageText = typeof diagnostic.messageText === 'string' 
            ? diagnostic.messageText 
            : this.flattenDiagnosticMessageText(diagnostic.messageText);

        // Filter import-related diagnostics for standalone analysis
        if (this.isImportRelatedDiagnostic(diagnostic)) {
            return true;
        }

        // Filter TypeScript internal/compiler diagnostics
        if (messageText.includes('TypeScript') || 
            messageText.includes('compiler') ||
            messageText.includes('tsconfig') ||
            messageText.includes('lib ')) {
            return true;
        }

        return false;
    }

    /**
     * Check if diagnostic is related to imports (which we ignore for standalone analysis)
     */
    private isImportRelatedDiagnostic(diagnostic: ts.Diagnostic): boolean {
        const messageText = typeof diagnostic.messageText === 'string' 
            ? diagnostic.messageText 
            : this.flattenDiagnosticMessageText(diagnostic.messageText);

        // Common import-related error codes and patterns
        const importRelatedCodes = [2307, 2344, 2345, 2346, 2347, 2349, 2306, 1260];
        if (importRelatedCodes.includes(diagnostic.code)) {
            return true;
        }

        const importPatterns = [
            'Cannot find module',
            'Module not found',
            'Cannot resolve module',
            'import',
            'require',
            'from \''
        ];

        return importPatterns.some(pattern => messageText.includes(pattern));
    }

    /**
     * Convert TypeScript diagnostic to CodeIssue format
     */
    private convertDiagnosticToCodeIssue(diagnostic: ts.Diagnostic, fileName: string): CodeIssue {
        const messageText = typeof diagnostic.messageText === 'string' 
            ? diagnostic.messageText 
            : this.flattenDiagnosticMessageText(diagnostic.messageText);

        let line = 1;
        let column = 1;

        if (diagnostic.file && diagnostic.start !== undefined) {
            const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            line = position.line + 1;
            column = position.character + 1;
        }

        return {
            message: messageText,
            filePath: fileName,
            line,
            column,
            severity: this.convertDiagnosticSeverity(diagnostic.category),
            ruleId: `TS${diagnostic.code}`,
            source: 'TypeScript Compiler'
        };
    }

    /**
     * Flatten TypeScript diagnostic message text
     */
    private flattenDiagnosticMessageText(messageText: ts.DiagnosticMessageChain): string {
        let result = messageText.messageText;
        if (messageText.next) {
            for (const next of messageText.next) {
                result += ' ' + this.flattenDiagnosticMessageText(next);
            }
        }
        return result;
    }

    /**
     * Convert TypeScript diagnostic severity to our severity format
     */
    private convertDiagnosticSeverity(category: ts.DiagnosticCategory): LintSeverity {
        switch (category) {
            case ts.DiagnosticCategory.Error:
                return 'error';
            case ts.DiagnosticCategory.Warning:
                return 'warning';
            case ts.DiagnosticCategory.Suggestion:
                return 'info';
            case ts.DiagnosticCategory.Message:
                return 'info';
            default:
                return 'error';
        }
    }



    /**
     * Batch analyze multiple files
     */
    public async analyzeFiles(files: Array<{ fileName: string; content: string }>, options?: AnalyzerOptions): Promise<AnalyzerResult> {
        const allIssues: CodeIssue[] = [];
        let hasErrors = false;

        for (const file of files) {
            const result = await this.analyzeFile(file.fileName, file.content, options);
            allIssues.push(...result.issues);
            if (!result.success) {
                hasErrors = true;
            }
        }

        const summary = this.calculateSummary(allIssues);

        return {
            issues: allIssues,
            summary,
            success: !hasErrors && summary.errorCount === 0
        };
    }

    /**
     * Calculate issue summary statistics
     */
    private calculateSummary(issues: CodeIssue[]) {
        const summary = {
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            totalCount: issues.length
        };

        for (const issue of issues) {
            switch (issue.severity) {
                case 'error':
                    summary.errorCount++;
                    break;
                case 'warning':
                    summary.warningCount++;
                    break;
                case 'info':
                    summary.infoCount++;
                    break;
            }
        }

        return summary;
    }
}

/**
 * Convenience function to analyze a single file
 */
export async function analyzeTypeScriptFile(
    fileName: string, 
    content: string, 
    options?: AnalyzerOptions
): Promise<AnalyzerResult> {
    const analyzer = new TypeScriptAnalyzer(options);
    return analyzer.analyzeFile(fileName, content, options);
}

/**
 * Convenience function to analyze multiple files
 */
export async function analyzeTypeScriptFiles(
    files: Array<{ fileName: string; content: string }>,
    options?: AnalyzerOptions
): Promise<AnalyzerResult> {
    const analyzer = new TypeScriptAnalyzer(options);
    return analyzer.analyzeFiles(files, options);
}
