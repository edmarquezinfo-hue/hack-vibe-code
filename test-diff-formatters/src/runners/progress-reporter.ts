/**
 * Progress reporting system
 * Provides real-time feedback during benchmark execution
 */

import type { IProgressReporter } from '../core/interfaces/benchmark.js';
import type { BenchmarkProgress, ComprehensiveBenchmarkResults } from '../core/types/benchmark.js';
import { CLIUtils } from '../utils/cli.js';

export class ProgressReporter implements IProgressReporter {
    private startTime = performance.now();
    private lastProgress: BenchmarkProgress | null = null;

    reportProgress(progress: BenchmarkProgress): void {
        this.lastProgress = progress;
        const elapsedTime = performance.now() - this.startTime;
        const progressWithTime = { ...progress, elapsedTime };

        // Simple progress logging without spinner
        const percentage = (progress.completedTests / progress.totalTests * 100).toFixed(1);
        
        console.log(`📊 Progress: ${progress.currentCategory} | ${progress.currentModel} | ${percentage}% complete`);

        // Log detailed progress
        if (progress.completedTests > 0) {
            const avgTimePerTest = elapsedTime / progress.completedTests;
            const estimatedRemainingTime = avgTimePerTest * (progress.totalTests - progress.completedTests);
            
            CLIUtils.log('debug', 
                `Progress: ${progress.completedTests}/${progress.totalTests} tests completed (${percentage}%)`
            );
            
            if (estimatedRemainingTime > 10000) { // Only show if > 10 seconds
                CLIUtils.log('debug', 
                    `Estimated remaining time: ${CLIUtils.formatDuration(estimatedRemainingTime)}`
                );
            }
        }

        // Show progress bar periodically
        if (progress.completedTests % 5 === 0 || progress.completedTests === progress.totalTests) {
            this.displayProgressBar(progress);
        }
    }

    reportCompletion(results: ComprehensiveBenchmarkResults): void {
        console.log('\\n' + '='.repeat(60));
        console.log('🎉 BENCHMARK COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        
        console.log(results.summary);
        
        console.log('\\n📁 Results Information:');
        console.log(`   • Timestamp: ${new Date(results.timestamp).toLocaleString()}`);
        console.log(`   • Total Execution Time: ${CLIUtils.formatDuration(results.executionTime)}`);
        console.log(`   • Configuration: ${results.config.algorithms.length} algorithms, ${results.config.models.length} models`);
        
        // Show top improvements
        const allResults = results.categoryResults.flatMap(cat => cat.modelResults);
        const topImprovements = allResults
            .filter(r => r.improvement > 0)
            .sort((a, b) => b.improvement - a.improvement)
            .slice(0, 3);

        if (topImprovements.length > 0) {
            console.log('\\n🏆 Top Improvements:');
            topImprovements.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.modelName} on ${result.category}: +${result.improvement.toFixed(1)}%`);
            });
        }

        console.log('\\n📊 Use the results files for detailed analysis and comparison with future runs.');
    }

    reportError(error: string, context?: Record<string, any>): void {
        console.error('\\n' + '❌'.repeat(20));
        console.error('🚨 BENCHMARK FAILED');
        console.error('❌'.repeat(20));
        console.error(`\\nError: ${error}`);
        
        if (context) {
            console.error('\\nContext:');
            for (const [key, value] of Object.entries(context)) {
                console.error(`   ${key}: ${JSON.stringify(value, null, 2)}`);
            }
        }

        if (this.lastProgress) {
            console.error(`\\nProgress at failure:`);
            console.error(`   • Completed: ${this.lastProgress.completedTests}/${this.lastProgress.totalTests} tests`);
            console.error(`   • Current Category: ${this.lastProgress.currentCategory}`);
            console.error(`   • Current Model: ${this.lastProgress.currentModel}`);
        }

        console.error('\\n💡 Try running with --verbose flag for more detailed error information.');
    }

    startSpinner(message: string = 'Starting benchmark...'): void {
        this.startTime = performance.now();
        console.log(`🚀 ${message}`);
    }

    stopSpinner(): void {
        // No spinner to stop - just a placeholder for interface compatibility
    }

    updateSpinner(message: string): void {
        console.log(`⏳ ${message}`);
    }

    private displayProgressBar(progress: BenchmarkProgress): void {
        const percentage = Math.round((progress.completedTests / progress.totalTests) * 100);
        const barLength = 40;
        const filledLength = Math.round((barLength * progress.completedTests) / progress.totalTests);
        
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        const elapsedTime = CLIUtils.formatDuration(progress.elapsedTime);
        
        console.log(`\\n[${bar}] ${percentage}% | ${progress.completedTests}/${progress.totalTests} tests | ${elapsedTime}`);
        
        if (progress.currentCategory && progress.currentModel) {
            console.log(`Currently testing: ${progress.currentCategory} with ${progress.currentModel} (iteration ${progress.currentIteration}/${progress.totalIterations})`);
        }
    }

    /**
     * Display a summary table of progress by category and model
     */
    displayDetailedProgress(categoryResults: Array<{
        categoryName: string;
        modelResults: Array<{
            modelName: string;
            completed: boolean;
            improvement?: number;
            success?: boolean;
        }>;
    }>): void {
        console.log('\\n📊 Detailed Progress:');
        console.log('-'.repeat(60));
        
        for (const category of categoryResults) {
            console.log(`\\n${category.categoryName}:`);
            
            for (const model of category.modelResults) {
                const status = model.completed 
                    ? (model.success ? '✅' : '❌') 
                    : '⏳';
                const improvement = model.improvement !== undefined 
                    ? `(+${model.improvement.toFixed(1)}%)` 
                    : '';
                
                console.log(`   ${status} ${model.modelName} ${improvement}`);
            }
        }
    }

    /**
     * Show real-time statistics during execution
     */
    showRealTimeStats(stats: {
        averageImprovement: number;
        successfulFixes: number;
        totalAttempts: number;
        bestModel: string;
        worstModel: string;
    }): void {
        console.log('\\n📈 Current Statistics:');
        console.log(`   • Average Improvement: ${stats.averageImprovement.toFixed(1)}%`);
        console.log(`   • Successful Fixes: ${stats.successfulFixes}/${stats.totalAttempts} (${(stats.successfulFixes / stats.totalAttempts * 100).toFixed(1)}%)`);
        console.log(`   • Best Performing Model: ${stats.bestModel}`);
        if (stats.worstModel !== stats.bestModel) {
            console.log(`   • Needs Improvement: ${stats.worstModel}`);
        }
    }
}