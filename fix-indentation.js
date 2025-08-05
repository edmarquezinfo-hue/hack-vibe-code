#!/usr/bin/env node

/**
 * Smart Indentation Standardization Script
 * Converts all 2-space and tab indentation to 4-space standard
 * Detects current indentation style and safely handles mixed/inconsistent files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TARGET_INDENT = '    '; // 4 spaces
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html', '.vue', '.yaml', '.yml'];
const IGNORE_PATTERNS = [
    'node_modules',
    'dist',
    '.git',
    'coverage',
    'build',
    '.vscode',
    '.next',
    'vendor'
];

// Results tracking
const results = {
    totalFiles: 0,
    processedFiles: 0,
    convertedFiles: 0,
    skippedFiles: 0,
    mixedIndentFiles: [],
    errorFiles: [],
    stats: {
        '2-space': 0,
        '4-space': 0,
        'tab': 0,
        'mixed': 0,
        'no-indent': 0
    }
};

/**
 * Detect the predominant indentation style in a file
 */
function detectIndentationStyle(content) {
    const lines = content.split('\n');
    const indentCounts = {
        '2-space': 0,
        '4-space': 0,
        'tab': 0,
        'mixed': 0
    };
    
    let totalIndentedLines = 0;
    const indentPatterns = [];
    
    for (const line of lines) {
        if (line.trim() === '') continue; // Skip empty lines
        
        const match = line.match(/^(\s+)/);
        if (!match) continue; // No indentation
        
        const indent = match[1];
        indentPatterns.push(indent);
        totalIndentedLines++;
        
        // Analyze indentation type
        if (indent.includes('\t')) {
            if (indent.includes(' ')) {
                indentCounts.mixed++;
            } else {
                indentCounts.tab++;
            }
        } else {
            // Pure spaces - check if it's consistent with 2 or 4 space pattern
            const spaceCount = indent.length;
            if (spaceCount % 4 === 0) {
                indentCounts['4-space']++;
            } else if (spaceCount % 2 === 0) {
                indentCounts['2-space']++;
            } else {
                indentCounts.mixed++;
            }
        }
    }
    
    if (totalIndentedLines === 0) {
        return { style: 'no-indent', confidence: 1.0, patterns: [] };
    }
    
    // Find the predominant style
    let maxCount = 0;
    let predominantStyle = 'mixed';
    
    for (const [style, count] of Object.entries(indentCounts)) {
        if (count > maxCount) {
            maxCount = count;
            predominantStyle = style;
        }
    }
    
    const confidence = maxCount / totalIndentedLines;
    
    // If confidence is too low or mixed, mark as mixed
    if (confidence < 0.7 || indentCounts.mixed > totalIndentedLines * 0.3) {
        predominantStyle = 'mixed';
    }
    
    return {
        style: predominantStyle,
        confidence,
        patterns: indentPatterns,
        counts: indentCounts,
        totalLines: totalIndentedLines
    };
}

/**
 * Convert file indentation to 4-space standard
 */
function convertIndentation(content, detectedStyle) {
    const lines = content.split('\n');
    const convertedLines = [];
    
    for (const line of lines) {
        if (line.trim() === '') {
            convertedLines.push(''); // Keep empty lines as-is
            continue;
        }
        
        const match = line.match(/^(\s*)(.*$)/);
        if (!match) {
            convertedLines.push(line);
            continue;
        }
        
        const [, indent, content] = match;
        let newIndent = '';
        
        if (detectedStyle.style === '2-space') {
            // Convert 2-space to 4-space (multiply by 2)
            const spaceCount = indent.length;
            const indentLevel = spaceCount / 2;
            newIndent = TARGET_INDENT.repeat(indentLevel);
        } else if (detectedStyle.style === 'tab') {
            // Convert tabs to 4-space
            const tabCount = indent.replace(/[^ ]/g, '').length + (indent.match(/\t/g) || []).length;
            newIndent = TARGET_INDENT.repeat(tabCount);
        } else if (detectedStyle.style === '4-space') {
            // Already 4-space, keep as-is
            newIndent = indent;
        } else if (detectedStyle.style === 'mixed') {
            // For mixed files, try to normalize intelligently
            newIndent = normalizeMixedIndentation(indent);
        }
        
        convertedLines.push(newIndent + content);
    }
    
    return convertedLines.join('\n');
}

/**
 * Normalize mixed indentation by converting tabs to spaces first, then standardizing
 */
function normalizeMixedIndentation(indent) {
    // First convert all tabs to 4 spaces
    let normalized = indent.replace(/\t/g, '    ');
    
    // Then try to standardize to 4-space increments
    const spaceCount = normalized.length;
    const indentLevel = Math.round(spaceCount / 2); // Assume 2-space was intended
    
    return TARGET_INDENT.repeat(indentLevel);
}

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
    const ext = path.extname(filePath);
    return FILE_EXTENSIONS.includes(ext);
}

/**
 * Check if path should be ignored
 */
function shouldIgnorePath(filePath) {
    return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

/**
 * Process a single file
 */
async function processFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const detection = detectIndentationStyle(content);
        
        results.totalFiles++;
        results.stats[detection.style]++;
        
        console.log(`📁 ${path.relative(__dirname, filePath)}`);
        console.log(`   Style: ${detection.style} (${(detection.confidence * 100).toFixed(1)}% confidence)`);
        
        if (detection.totalLines > 0) {
            console.log(`   Lines: ${detection.totalLines} indented lines`);
            console.log(`   Counts: ${JSON.stringify(detection.counts)}`);
        }
        
        if (detection.style === 'mixed') {
            results.mixedIndentFiles.push({
                path: filePath,
                detection,
                relative: path.relative(__dirname, filePath)
            });
            
            console.log(`   ⚠️  Mixed indentation detected - attempting smart conversion`);
            
            // Try to fix mixed indentation
            const convertedContent = convertIndentation(content, detection);
            
            // Verify the conversion improved consistency
            const newDetection = detectIndentationStyle(convertedContent);
            if (newDetection.style === '4-space' && newDetection.confidence > 0.8) {
                fs.writeFileSync(filePath, convertedContent);
                results.convertedFiles++;
                console.log(`   ✅ Successfully converted mixed indentation to 4-space`);
            } else {
                results.skippedFiles++;
                console.log(`   ❌ Could not safely convert mixed indentation - skipped`);
            }
        } else if (detection.style === '2-space' || detection.style === 'tab') {
            const convertedContent = convertIndentation(content, detection);
            fs.writeFileSync(filePath, convertedContent);
            results.convertedFiles++;
            console.log(`   ✅ Converted from ${detection.style} to 4-space`);
        } else if (detection.style === '4-space') {
            console.log(`   ✅ Already using 4-space indentation`);
        } else if (detection.style === 'no-indent') {
            console.log(`   ℹ️  No indentation detected`);
        }
        
        results.processedFiles++;
        console.log('');
        
    } catch (error) {
        results.errorFiles.push({ path: filePath, error: error.message });
        console.error(`❌ Error processing ${filePath}: ${error.message}`);
    }
}

/**
 * Recursively find all files to process
 */
function findFiles(dir) {
    const files = [];
    
    function traverse(currentDir) {
        if (shouldIgnorePath(currentDir)) return;
        
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            
            if (shouldIgnorePath(fullPath)) continue;
            
            if (entry.isDirectory()) {
                traverse(fullPath);
            } else if (entry.isFile() && shouldProcessFile(fullPath)) {
                files.push(fullPath);
            }
        }
    }
    
    traverse(dir);
    return files;
}

/**
 * Print summary report
 */
function printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 INDENTATION STANDARDIZATION SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 PROCESSING STATS:`);
    console.log(`   Total files found: ${results.totalFiles}`);
    console.log(`   Files processed: ${results.processedFiles}`);
    console.log(`   Files converted: ${results.convertedFiles}`);
    console.log(`   Files skipped: ${results.skippedFiles}`);
    console.log(`   Files with errors: ${results.errorFiles.length}`);
    
    console.log(`\n🎯 INDENTATION STYLES DETECTED:`);
    for (const [style, count] of Object.entries(results.stats)) {
        if (count > 0) {
            console.log(`   ${style}: ${count} files`);
        }
    }
    
    if (results.mixedIndentFiles.length > 0) {
        console.log(`\n⚠️  FILES WITH MIXED INDENTATION (${results.mixedIndentFiles.length}):`);
        for (const file of results.mixedIndentFiles) {
            console.log(`   ${file.relative} (confidence: ${(file.detection.confidence * 100).toFixed(1)}%)`);
        }
    }
    
    if (results.errorFiles.length > 0) {
        console.log(`\n❌ FILES WITH ERRORS (${results.errorFiles.length}):`);
        for (const file of results.errorFiles) {
            console.log(`   ${path.relative(__dirname, file.path)}: ${file.error}`);
        }
    }
    
    console.log(`\n✅ Indentation standardization complete!`);
    console.log(`   ${results.convertedFiles} files converted to 4-space indentation`);
    
    if (results.skippedFiles > 0) {
        console.log(`   ${results.skippedFiles} files skipped due to safety concerns`);
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🔧 Smart Indentation Standardization Script');
    console.log('Converting all indentation to 4-space standard...\n');
    
    const startDir = process.argv[2] || __dirname;
    const files = findFiles(startDir);
    
    console.log(`Found ${files.length} files to process\n`);
    
    for (const file of files) {
        await processFile(file);
    }
    
    printSummary();
}

// Execute if run directly
if (process.argv[1] === __filename || process.argv[1].endsWith('fix-indentation.js')) {
    main().catch(console.error);
}
