/**
 * Results management system
 * Handles saving, loading, and organizing benchmark results
 */

import type { IResultsManager } from '../core/interfaces/benchmark.js';
import type { ComprehensiveBenchmarkResults, ModelResult } from '../core/types/benchmark.js';
import { CLIUtils } from '../utils/cli.js';
import { FILE_CONFIG } from '../core/constants/config.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

export class ResultsManager implements IResultsManager {
    constructor(private outputDir: string) {
        this.ensureOutputDirectory();
    }

    async saveResults(results: ComprehensiveBenchmarkResults): Promise<string> {
        try {
            const timestamp = this.formatTimestamp(new Date(results.timestamp));
            const filename = `${FILE_CONFIG.RESULT_FILE_PREFIX}-${timestamp}${FILE_CONFIG.FILE_EXTENSION}`;
            const filepath = join(this.outputDir, filename);

            // Convert any Map objects to plain objects for JSON serialization
            const serializable = this.makeSerializable(results);

            writeFileSync(filepath, JSON.stringify(serializable, null, 2));
            
            CLIUtils.log('info', `Results saved to: ${filepath}`);
            return filepath;

        } catch (error: any) {
            CLIUtils.log('error', `Failed to save results: ${error.message}`);
            throw error;
        }
    }

    async saveModelResult(result: ModelResult): Promise<string> {
        try {
            const timestamp = this.formatTimestamp(new Date());
            const safeModelName = result.modelId.replace(/[^a-zA-Z0-9]/g, '-');
            const filename = `${FILE_CONFIG.DETAILED_RESULT_PREFIX}-${result.categoryId}-${safeModelName}-${result.iteration}-${timestamp}${FILE_CONFIG.FILE_EXTENSION}`;
            const filepath = join(this.outputDir, filename);

            const detailedResult = {
                ...result,
                savedAt: new Date().toISOString(),
                benchmarkMetadata: {
                    category: result.category,
                    model: result.modelName,
                    iteration: result.iteration,
                    improvement: result.improvement,
                    executionTime: result.executionTime
                }
            };

            writeFileSync(filepath, JSON.stringify(detailedResult, null, 2));
            
            CLIUtils.log('debug', `Detailed result saved to: ${filename}`);
            return filepath;

        } catch (error: any) {
            CLIUtils.log('error', `Failed to save model result: ${error.message}`);
            throw error;
        }
    }

    async loadPreviousResults(timestamp?: string): Promise<ComprehensiveBenchmarkResults | null> {
        try {
            if (timestamp) {
                const filename = `${FILE_CONFIG.RESULT_FILE_PREFIX}-${timestamp}${FILE_CONFIG.FILE_EXTENSION}`;
                const filepath = join(this.outputDir, filename);
                
                if (existsSync(filepath)) {
                    const content = readFileSync(filepath, 'utf-8');
                    return JSON.parse(content);
                }
            } else {
                // Load most recent results
                const results = await this.listResults();
                if (results.length > 0) {
                    const mostRecent = results[0]; // listResults returns sorted by date desc
                    const filepath = join(this.outputDir, mostRecent);
                    const content = readFileSync(filepath, 'utf-8');
                    return JSON.parse(content);
                }
            }

            return null;

        } catch (error: any) {
            CLIUtils.log('error', `Failed to load previous results: ${error.message}`);
            return null;
        }
    }

    async listResults(): Promise<string[]> {
        try {
            if (!existsSync(this.outputDir)) {
                return [];
            }

            const files = readdirSync(this.outputDir);
            const resultFiles = files
                .filter(file => 
                    file.startsWith(FILE_CONFIG.RESULT_FILE_PREFIX) && 
                    file.endsWith(FILE_CONFIG.FILE_EXTENSION)
                )
                .sort((a, b) => {
                    // Sort by filename (which contains timestamp) in descending order
                    return b.localeCompare(a);
                });

            return resultFiles;

        } catch (error: any) {
            CLIUtils.log('error', `Failed to list results: ${error.message}`);
            return [];
        }
    }

    /**
     * Get summary of all available results
     */
    async getResultsSummary(): Promise<Array<{
        filename: string;
        timestamp: string;
        totalTests: number;
        averageImprovement: number;
        bestModel: string;
    }>> {
        try {
            const resultFiles = await this.listResults();
            const summaries = [];

            for (const filename of resultFiles.slice(0, 10)) { // Limit to 10 most recent
                try {
                    const filepath = join(this.outputDir, filename);
                    const content = readFileSync(filepath, 'utf-8');
                    const results: ComprehensiveBenchmarkResults = JSON.parse(content);

                    summaries.push({
                        filename,
                        timestamp: results.timestamp,
                        totalTests: results.overallStats.totalTests,
                        averageImprovement: results.overallStats.averageImprovement,
                        bestModel: results.overallStats.bestModel
                    });

                } catch (error) {
                    CLIUtils.log('warn', `Failed to read result file ${filename}: ${error}`);
                }
            }

            return summaries;

        } catch (error: any) {
            CLIUtils.log('error', `Failed to get results summary: ${error.message}`);
            return [];
        }
    }

    /**
     * Clean up old result files (keep only the most recent N)
     */
    async cleanupOldResults(keepCount: number = 50): Promise<number> {
        try {
            const resultFiles = await this.listResults();
            
            if (resultFiles.length <= keepCount) {
                return 0; // Nothing to clean up
            }

            const filesToDelete = resultFiles.slice(keepCount);
            let deletedCount = 0;

            for (const filename of filesToDelete) {
                try {
                    const filepath = join(this.outputDir, filename);
                    const { unlinkSync } = await import('fs');
                    unlinkSync(filepath);
                    deletedCount++;
                } catch (error) {
                    CLIUtils.log('warn', `Failed to delete ${filename}: ${error}`);
                }
            }

            if (deletedCount > 0) {
                CLIUtils.log('info', `Cleaned up ${deletedCount} old result files`);
            }

            return deletedCount;

        } catch (error: any) {
            CLIUtils.log('error', `Failed to cleanup old results: ${error.message}`);
            return 0;
        }
    }

    private ensureOutputDirectory(): void {
        try {
            if (!existsSync(this.outputDir)) {
                mkdirSync(this.outputDir, { recursive: true });
                CLIUtils.log('debug', `Created output directory: ${this.outputDir}`);
            }
        } catch (error: any) {
            CLIUtils.log('error', `Failed to create output directory: ${error.message}`);
            throw error;
        }
    }

    private formatTimestamp(date: Date): string {
        // Format: YYYY-MM-DD_HH-mm-ss
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    }

    private makeSerializable(obj: any): any {
        if (obj instanceof Map) {
            return Object.fromEntries(obj.entries());
        } else if (Array.isArray(obj)) {
            return obj.map(item => this.makeSerializable(item));
        } else if (obj && typeof obj === 'object') {
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.makeSerializable(value);
            }
            return result;
        }
        return obj;
    }
}