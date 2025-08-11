/**
 * Comprehensive Fuzzy Matching Debugger
 * 
 * This script analyzes why the search-replace diff system found 9 matches
 * for a specific search block, causing ambiguity and failure to apply the diff.
 */

import { 
    MatchingStrategy, 
    applyDiff
} from './worker/agents/diff-formats/search-replace';

// Raw content from the failing case
const RAW_CODE = `import { useEffect, useRef } from 'react';
import { useFileStore } from './use-files';
import { FileNode } from '@/lib/types/file';
export const useKeyboardNavigation = (nodes: FileNode[], viewMode: 'grid' | 'list') => {
  const { selectedFileIds, toggleSelection, clearSelection } = useFileStore.getState();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const focusableItems = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>('[data-node-id]')
      );
      if (focusableItems.length === 0) return;
      const activeElement = document.activeElement as HTMLElement;
      const currentIndex = focusableItems.findIndex(item => item === activeElement);
      let nextIndex = -1;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (viewMode === 'grid') {
            const itemRect = focusableItems[currentIndex]?.getBoundingClientRect();
            if (!itemRect) break;
            // Find item directly below
            let bestCandidate = -1;
            let minDistance = Infinity;
            for (let i = 0; i < focusableItems.length; i++) {
              if (i === currentIndex) continue;
              const candidateRect = focusableItems[i].getBoundingClientRect();
              if (candidateRect.top > itemRect.bottom) {
                const distance = Math.sqrt(Math.pow(candidateRect.left - itemRect.left, 2) + Math.pow(candidateRect.top - itemRect.bottom, 2));
                if (distance < minDistance) {
                  minDistance = distance;
                  bestCandidate = i;
                }
              }
            }
            nextIndex = bestCandidate !== -1 ? bestCandidate : currentIndex;
          } else { // list view
            nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : currentIndex;
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (viewMode === 'grid') {
             const itemRect = focusableItems[currentIndex]?.getBoundingClientRect();
            if (!itemRect) break;
            // Find item directly above
            let bestCandidate = -1;
            let minDistance = Infinity;
            for (let i = 0; i < focusableItems.length; i++) {
              if (i === currentIndex) continue;
              const candidateRect = focusableItems[i].getBoundingClientRect();
              if (candidateRect.bottom < itemRect.top) {
                const distance = Math.sqrt(Math.pow(candidateRect.left - itemRect.left, 2) + Math.pow(candidateRect.top - itemRect.bottom, 2));
                if (distance < minDistance) {
                  minDistance = distance;
                  bestCandidate = i;
                }
              }
            }
            nextIndex = bestCandidate !== -1 ? bestCandidate : currentIndex;
          } else { // list view
            nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (viewMode === 'grid') {
            nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : currentIndex;
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (viewMode === 'grid') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
          }
          break;
        case 'Home':
            e.preventDefault();
            nextIndex = 0;
            break;
        case 'End':
            e.preventDefault();
            nextIndex = focusableItems.length - 1;
            break;
        case 'a':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                const allIds = nodes.map(n => n.id);
                clearSelection();
                allIds.forEach(id => toggleSelection(id, true));
            }
            break;
      }
      if (nextIndex !== -1 && nextIndex < focusableItems.length) {
        focusableItems[nextIndex].focus();
        if (!e.shiftKey) {
            clearSelection();
        }
        toggleSelection(focusableItems[nextIndex].dataset.nodeId!, true);
      }
    };
    const container = containerRef.current;
    container?.addEventListener('keydown', handleKeyDown);
    return () => {
      container?.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, viewMode, selectedFileIds, toggleSelection, clearSelection]);
  return containerRef;
};`;

// The problematic search block from the LLM diff
const PROBLEMATIC_SEARCH_BLOCK = `    case 'ArrowDown':
      e.preventDefault();
      if (viewMode === 'grid') {
      const itemRect = focusableItems[currentIndex]?.getBoundingClientRect();
      if (!itemRect) break;
      // Find item directly below
      let bestCandidate = -1;
      let minDistance = Infinity;
      for (let i = 0; i < focusableItems.length; i++) {
  if (i === currentIndex) continue;
  const candidateRect = focusableItems[i].getBoundingClientRect();
  if (candidateRect.top > itemRect.bottom) {
  const distance = Math.sqrt(Math.pow(candidateRect.left - itemRect.left, 2) + Math.pow(candidateRect.top - itemRect.bottom, 2));
  if (distance < minDistance) {
    minDistance = distance;
    bestCandidate = i;
  }
  }
      }
      }
      nextIndex = bestCandidate !== -1 ? bestCandidate : currentIndex;
      } else { // list view
      nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : currentIndex;
      }`;

// The complete diff from the log
const COMPLETE_DIFF = `
<<<<<<< SEARCH
    case 'ArrowDown':
      e.preventDefault();
      if (viewMode === 'grid') {
      const itemRect = focusableItems[currentIndex]?.getBoundingClientRect();
      if (!itemRect) break;
      // Find item directly below
      let bestCandidate = -1;
      let minDistance = Infinity;
      for (let i = 0; i < focusableItems.length; i++) {
  if (i === currentIndex) continue;
  const candidateRect = focusableItems[i].getBoundingClientRect();
  if (candidateRect.top > itemRect.bottom) {
  const distance = Math.sqrt(Math.pow(candidateRect.left - itemRect.left, 2) + Math.pow(candidateRect.top - itemRect.bottom, 2));
  if (distance < minDistance) {
    minDistance = distance;
    bestCandidate = i;
  }
  }
      }
      }
      nextIndex = bestCandidate !== -1 ? bestCandidate : currentIndex;
      } else { // list view
      nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : currentIndex;
      }
=======
    case 'ArrowDown':
      e.preventDefault();
      if (viewMode === 'grid') {
        const itemRect = focusableItems[currentIndex]?.getBoundingClientRect();
        if (!itemRect) break;
        // Find item directly below
        let bestCandidate = -1;
        let minDistance = Infinity;
        for (let i = 0; i < focusableItems.length; i++) {
          if (i === currentIndex) continue;
          const candidateRect = focusableItems[i].getBoundingClientRect();
          if (candidateRect.top > itemRect.bottom) {
            const distance = Math.sqrt(Math.pow(candidateRect.left - itemRect.left, 2) + Math.pow(candidateRect.top - itemRect.bottom, 2));
            if (distance < minDistance) {
              minDistance = distance;
              bestCandidate = i;
            }
          }
        }
        nextIndex = bestCandidate !== -1 ? bestCandidate : currentIndex;
      } else { // list view
        nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : currentIndex;
      }
>>>>>>> REPLACE

# Fix undefined variable 'bestCandidate' in ArrowUp case


<<<<<<< SEARCH
    case 'ArrowUp':
      e.preventDefault();
      if (viewMode === 'grid') {
       const itemRect = focusableItems[currentIndex]?.getBoundingClientRect();
      if (!itemRect) break;
      // Find item directly above
      let bestCandidate = -1;
      let minDistance = Infinity;
      for (let i = 0; i < focusableItems.length; i++) {
  if (i === currentIndex) continue;
  const candidateRect = focusableItems[i].getBoundingClientRect();
  if (candidateRect.bottom < itemRect.top) {
  const distance = Math.sqrt(Math.pow(candidateRect.left - itemRect.left, 2) + Math.pow(candidateRect.top - itemRect.bottom, 2));
  if (distance < minDistance) {
    minDistance = distance;
    bestCandidate = i;
  }
  }
      }
      }
      nextIndex = bestCandidate !== -1 ? bestCandidate : currentIndex;
      } else { // list view
      nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
      }
=======
    case 'ArrowUp':
      e.preventDefault();
      if (viewMode === 'grid') {
        const itemRect = focusableItems[currentIndex]?.getBoundingClientRect();
        if (!itemRect) break;
        // Find item directly above
        let bestCandidate = -1;
        let minDistance = Infinity;
        for (let i = 0; i < focusableItems.length; i++) {
          if (i === currentIndex) continue;
          const candidateRect = focusableItems[i].getBoundingClientRect();
          if (candidateRect.bottom < itemRect.top) {
            const distance = Math.sqrt(Math.pow(candidateRect.left - itemRect.left, 2) + Math.pow(candidateRect.top - itemRect.bottom, 2));
            if (distance < minDistance) {
              minDistance = distance;
              bestCandidate = i;
            }
          }
        }
        nextIndex = bestCandidate !== -1 ? bestCandidate : currentIndex;
      } else { // list view
        nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
      }
>>>>>>> REPLACE


# Fix bracket formatting and indentation issues


<<<<<<< SEARCH
    case 'a':
      if (e.metaKey || e.ctrlKey) {
  e.preventDefault();
  const allIds = nodes.map(n => n.id);
  clearSelection();
  allIds.forEach(id => toggleSelection(id, true));
      }
=======
    case 'a':
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const allIds = nodes.map(n => n.id);
        clearSelection();
        allIds.forEach(id => toggleSelection(id, true));
      }
>>>>>>> REPLACE


# Fix event listener cleanup and hook dependency consistency


<<<<<<< SEARCH
  const container = containerRef.current;
  container?.addEventListener('keydown', handleKeyDown);
  return () => {
    container?.removeEventListener('keydown', handleKeyDown);
  };
  }, [nodes, viewMode, selectedFileIds, toggleSelection, clearSelection]);
=======
  const container = containerRef.current;
  container?.addEventListener('keydown', handleKeyDown);
  return () => {
    container?.removeEventListener('keydown', handleKeyDown);
  };
  }, [nodes, viewMode, selectedFileIds, toggleSelection, clearSelection]);
>>>>>>> REPLACE
`;

// Utility functions to help analyze the matching
function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ')
              .replace(/^\s+|\s+$/gm, '')
              .trim();
}

function calculateSimilarity(a: string, b: string): number {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    return (maxLength - levenshteinDistance(a, b)) / maxLength;
}

function levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const substitution = matrix[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                substitution
            );
        }
    }
    
    return matrix[b.length][a.length];
}

// Custom fuzzy matcher that tracks all candidates
function findAllFuzzyMatches(content: string, searchText: string, threshold: number = 0.8): Array<{
    similarity: number;
    startLine: number;
    endLine: number;
    matchedText: string;
    location: string;
}> {
    const searchLines = searchText.split('\n');
    const contentLines = content.split('\n');
    const matches: Array<{
        similarity: number;
        startLine: number;
        endLine: number;
        matchedText: string;
        location: string;
    }> = [];
    
    console.log(`🔍 Searching for ${searchLines.length} lines in ${contentLines.length} total lines`);
    console.log(`📏 Search text normalized length: ${normalizeWhitespace(searchText).length} chars`);
    
    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
        const candidate = contentLines.slice(i, i + searchLines.length).join('\n');
        const similarity = calculateSimilarity(
            normalizeWhitespace(candidate), 
            normalizeWhitespace(searchText)
        );
        
        if (similarity >= threshold) {
            const location = `Lines ${i + 1}-${i + searchLines.length}`;
            matches.push({
                similarity,
                startLine: i,
                endLine: i + searchLines.length,
                matchedText: candidate,
                location
            });
            
            console.log(`✅ Match ${matches.length}: ${location}, similarity: ${(similarity * 100).toFixed(1)}%`);
        } else if (similarity >= 0.6) { // Show near-misses too
            const location = `Lines ${i + 1}-${i + searchLines.length}`;
            console.log(`❌ Near-miss: ${location}, similarity: ${(similarity * 100).toFixed(1)}% (below threshold)`);
        }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
}

// Function to extract and display key patterns
function analyzePatterns(text: string): {
    keyPhrases: string[];
    repeatedPatterns: Map<string, number>;
    structuralElements: string[];
} {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const keyPhrases: string[] = [];
    const repeatedPatterns = new Map<string, number>();
    const structuralElements: string[] = [];
    
    // Extract key phrases (lines with meaningful content)
    for (const line of lines) {
        if (line.includes('const ') || line.includes('let ') || line.includes('if (') || 
            line.includes('for (') || line.includes('case ') || line.includes('break') ||
            line.includes('return') || line.includes('getBoundingClientRect') ||
            line.includes('Math.sqrt') || line.includes('distance')) {
            keyPhrases.push(line);
        }
        
        // Count repeated patterns
        const pattern = line.replace(/\d+/g, 'N').replace(/\w+/g, 'X'); // Abstract pattern
        repeatedPatterns.set(pattern, (repeatedPatterns.get(pattern) || 0) + 1);
        
        // Extract structural elements
        if (line.includes('{') || line.includes('}') || line.includes('case ') || 
            line.includes('break') || line.includes('if (') || line.includes('for (')) {
            structuralElements.push(line);
        }
    }
    
    return { keyPhrases, repeatedPatterns, structuralElements };
}

// Main debugging function
function debugFuzzyMatching() {
    console.log('🚀 FUZZY MATCHING DEBUGGER');
    console.log('=' .repeat(80));
    
    // 1. Analyze the search block
    console.log('\n📊 SEARCH BLOCK ANALYSIS');
    console.log('=' .repeat(40));
    const searchAnalysis = analyzePatterns(PROBLEMATIC_SEARCH_BLOCK);
    console.log(`🔑 Key phrases found: ${searchAnalysis.keyPhrases.length}`);
    searchAnalysis.keyPhrases.forEach((phrase, i) => {
        console.log(`   ${i + 1}. ${phrase}`);
    });
    
    console.log(`\n🔄 Repeated patterns in search block:`);
    Array.from(searchAnalysis.repeatedPatterns.entries())
        .filter(([_, count]) => count > 1)
        .forEach(([pattern, count]) => {
            console.log(`   ${count}x: ${pattern}`);
        });
    
    // 2. Find all fuzzy matches
    console.log('\n🎯 FUZZY MATCHING RESULTS (threshold: 0.8)');
    console.log('=' .repeat(40));
    const allMatches = findAllFuzzyMatches(RAW_CODE, PROBLEMATIC_SEARCH_BLOCK, 0.8);
    
    console.log(`\n📈 Found ${allMatches.length} matches above 80% similarity threshold`);
    
    if (allMatches.length === 0) {
        console.log('❌ No matches found - trying lower threshold...');
        const lowerMatches = findAllFuzzyMatches(RAW_CODE, PROBLEMATIC_SEARCH_BLOCK, 0.6);
        console.log(`📈 Found ${lowerMatches.length} matches above 60% similarity threshold`);
        
        lowerMatches.slice(0, 5).forEach((match, i) => {
            console.log(`\n🔍 Match ${i + 1} (${match.location}):`);
            console.log(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`);
            console.log(`   Preview: ${match.matchedText.substring(0, 100)}...`);
        });
    } else {
        // 3. Analyze each match in detail
        console.log('\n📋 DETAILED MATCH ANALYSIS');
        console.log('=' .repeat(40));
        
        allMatches.forEach((match, i) => {
            console.log(`\n🔍 MATCH ${i + 1} - ${match.location}`);
            console.log(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`);
            console.log(`   Full text:`);
            console.log(match.matchedText.split('\n').map((line, idx) => 
                `      ${(match.startLine + idx + 1).toString().padStart(3)}: ${line}`
            ).join('\n'));
            
            // Show what makes this similar
            const matchAnalysis = analyzePatterns(match.matchedText);
            const commonPhrases = searchAnalysis.keyPhrases.filter(phrase => 
                matchAnalysis.keyPhrases.some(mPhrase => 
                    calculateSimilarity(normalizeWhitespace(phrase), normalizeWhitespace(mPhrase)) > 0.7
                )
            );
            
            console.log(`   🎯 Common key phrases: ${commonPhrases.length}`);
            commonPhrases.slice(0, 3).forEach(phrase => {
                console.log(`      - ${phrase}`);
            });
        });
    }
    
    // 4. Analyze why there are so many matches
    console.log('\n🤔 WHY SO MANY MATCHES?');
    console.log('=' .repeat(40));
    
    // Look for repeated code patterns in the original file
    const fileAnalysis = analyzePatterns(RAW_CODE);
    console.log('🔍 Repeated patterns in the entire file:');
    
    const significantPatterns = Array.from(fileAnalysis.repeatedPatterns.entries())
        .filter(([_, count]) => count >= 3)
        .sort(([,a], [,b]) => b - a);
        
    significantPatterns.slice(0, 10).forEach(([pattern, count]) => {
        console.log(`   ${count}x: ${pattern}`);
    });
    
    // Check for specific problematic phrases
    const problematicPhrases = [
        'getBoundingClientRect',
        'Math.sqrt',
        'Math.pow',
        'minDistance',
        'bestCandidate',
        'candidateRect',
        'itemRect',
        'distance <'
    ];
    
    console.log('\n🚨 Potentially confusing repeated phrases:');
    problematicPhrases.forEach(phrase => {
        try {
            const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const occurrences = (RAW_CODE.match(new RegExp(escapedPhrase, 'g')) || []).length;
            if (occurrences > 1) {
                console.log(`   "${phrase}": ${occurrences} occurrences`);
            }
        } catch (e) {
            console.log(`   "${phrase}": regex error, skipping`);
        }
    });
    
    // 5. Suggestions for improvement
    console.log('\n💡 IMPROVEMENT SUGGESTIONS');
    console.log('=' .repeat(40));
    
    console.log('1. 🎯 Increase specificity by including more unique context');
    console.log('   - Include surrounding case statements or unique variable names');
    console.log('   - Add function signature or class context');
    
    console.log('\n2. 📏 Adjust similarity thresholds');
    console.log('   - Current fuzzy threshold: 0.8 (80%)');
    console.log('   - Consider dynamic thresholds based on content length');
    console.log('   - Penalize matches with high structural similarity but different semantics');
    
    console.log('\n3. 🧠 Improve pattern matching');
    console.log('   - Weight unique identifiers higher than common patterns');
    console.log('   - Consider semantic similarity, not just textual similarity');
    console.log('   - Use AST-based matching for code blocks');
    
    console.log('\n4. 🚫 Better ambiguity detection');
    console.log('   - Check for matches in different logical contexts');
    console.log('   - Consider indentation levels and nesting structure');
    console.log('   - Validate that matches make semantic sense');
    
    // 6. Test the IMPROVED search-replace system
    console.log('\n🧪 TESTING IMPROVED DIFF APPLICATION');
    console.log('=' .repeat(40));
    
    try {
        // Test with original threshold (should fail with 9+ matches)
        console.log('\n🔍 TESTING WITH ORIGINAL THRESHOLD (0.8):');
        const originalResult = applyDiff(RAW_CODE, COMPLETE_DIFF, {
            strict: false,
            enableTelemetry: true,
            matchingStrategies: [
                MatchingStrategy.EXACT,
                MatchingStrategy.WHITESPACE_INSENSITIVE,
                MatchingStrategy.INDENTATION_PRESERVING,
                MatchingStrategy.FUZZY
            ],
            fuzzyThreshold: 0.8
        });
        
        console.log(`   Total blocks: ${originalResult.results.blocksTotal}`);
        console.log(`   Applied: ${originalResult.results.blocksApplied}`);
        console.log(`   Failed: ${originalResult.results.blocksFailed}`);
        
        // Test with realtimeCodeFixer threshold (0.87) - should work better with improvements
        console.log('\n🔍 TESTING WITH REALTIME CODE FIXER THRESHOLD (0.87):');
        const improvedResult = applyDiff(RAW_CODE, COMPLETE_DIFF, {
            strict: false,
            enableTelemetry: true,
            matchingStrategies: [
                MatchingStrategy.EXACT,
                MatchingStrategy.WHITESPACE_INSENSITIVE,
                MatchingStrategy.INDENTATION_PRESERVING,
                MatchingStrategy.FUZZY
            ],
            fuzzyThreshold: 0.87
        });
        
        console.log(`   Total blocks: ${improvedResult.results.blocksTotal}`);
        console.log(`   Applied: ${improvedResult.results.blocksApplied}`);
        console.log(`   Failed: ${improvedResult.results.blocksFailed}`);
        
        // Show improvement comparison
        console.log('\n📊 IMPROVEMENT COMPARISON:');
        const originalSuccess = originalResult.results.blocksApplied / originalResult.results.blocksTotal;
        const improvedSuccess = improvedResult.results.blocksApplied / improvedResult.results.blocksTotal;
        
        console.log(`   Original success rate: ${(originalSuccess * 100).toFixed(1)}% (${originalResult.results.blocksApplied}/${originalResult.results.blocksTotal})`);
        console.log(`   Improved success rate: ${(improvedSuccess * 100).toFixed(1)}% (${improvedResult.results.blocksApplied}/${improvedResult.results.blocksTotal})`);
        
        if (improvedSuccess > originalSuccess) {
            console.log(`   ✅ IMPROVEMENT: +${((improvedSuccess - originalSuccess) * 100).toFixed(1)}% success rate`);
        } else if (improvedSuccess === originalSuccess) {
            console.log(`   ➡️  MAINTAINED: Same success rate (no degradation)`);
        } else {
            console.log(`   ❌ REGRESSION: -${((originalSuccess - improvedSuccess) * 100).toFixed(1)}% success rate`);
        }
        
        // Show detailed analysis of any remaining failures
        if (improvedResult.results.failedBlocks.length > 0) {
            console.log(`\n🚫 REMAINING FAILED BLOCKS WITH IMPROVEMENTS:`);
            improvedResult.results.failedBlocks.forEach((block, i) => {
                console.log(`   ${i + 1}. ${block.error}`);
                console.log(`      Search preview: ${block.search.substring(0, 100)}...`);
                
                // Check if this is still an ambiguity issue
                if (block.error.includes('ambiguous') || block.error.includes('similar matches')) {
                    console.log(`      🔍 Analysis: Still ambiguous - may need higher threshold or more context`);
                } else if (block.error.includes('No match found')) {
                    console.log(`      🔍 Analysis: No match found - may be exact matching issue`);
                } else {
                    console.log(`      🔍 Analysis: Other error type`);
                }
            });
        } else {
            console.log(`\n🎉 SUCCESS: All blocks applied successfully with improvements!`);
        }
        
        if (improvedResult.results.warnings.length > 0) {
            console.log(`\n⚠️  Warnings from improved system:`);
            improvedResult.results.warnings.forEach(warning => console.log(`   - ${warning}`));
        }
        
    } catch (error) {
        console.error('💥 Error applying diff:', error);
    }
}

// Export the debugger function
export { debugFuzzyMatching };

// Auto-run the debugger
debugFuzzyMatching();
