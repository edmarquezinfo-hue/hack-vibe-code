import { LogEntry, DiffInfo, CodeReviewInfo, FileProcessingSession, SessionAnalysis } from '../types';

export class LogParser {
  private logs: string;

  constructor(logs: string) {
    this.logs = logs;
  }

  /**
   * Parse the entire log file and extract structured data
   */
  parse(): SessionAnalysis[] {
    const lines = this.logs.split('\n');
    const entries = this.parseLogEntries(lines);
    const sessions = this.groupByTraceId(entries);
    
    return sessions.map(session => this.createSessionAnalysis(session));
  }

  /**
   * Parse individual log lines into LogEntry objects
   */
  private parseLogEntries(lines: string[]): LogEntry[] {
    const entries: LogEntry[] = [];
    let currentEntry: Partial<LogEntry> | null = null;
    let multiLineBuffer = '';
    let inDiffSection = false;
    let inCodeReviewSection = false;
    let inFinalContentSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse timestamp and log level
      const logMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(INFO|ERROR|WARN|DEBUG)\s+(.+)/);
      
      if (logMatch) {
        // Save previous entry if exists
        if (currentEntry) {
          this.finalizePreviousEntry(currentEntry, entries, multiLineBuffer);
        }

        // Start new entry
        currentEntry = {
          timestamp: logMatch[1],
          level: logMatch[2] as 'INFO' | 'ERROR' | 'WARN' | 'DEBUG',
          message: logMatch[3]
        };

        // Extract trace ID
        const traceMatch = logMatch[3].match(/trace:([a-f0-9]+)/);
        if (traceMatch) {
          currentEntry.traceId = traceMatch[1];
        }

        // Extract component name
        const componentMatch = logMatch[3].match(/(\w+)\[[\w#]+\]/);
        if (componentMatch) {
          currentEntry.component = componentMatch[1];
        }

        // Extract file path from diff application messages
        const diffMatch = logMatch[3].match(/Applied search replace diff to file: (.+)/);
        if (diffMatch) {
          currentEntry.filePath = diffMatch[1];
          currentEntry.action = 'diff_applied';
        }

        multiLineBuffer = '';
        inDiffSection = false;
        inCodeReviewSection = false;
        inFinalContentSection = false;
      } 
      // Handle special markers
      else if (line.includes('Diff:')) {
        inDiffSection = true;
        inCodeReviewSection = false;
        inFinalContentSection = false;
        multiLineBuffer = '';
      }
      else if (line.includes('<code_review>')) {
        inCodeReviewSection = true;
        inDiffSection = false;
        inFinalContentSection = false;
        multiLineBuffer = '';
      }
      else if (line.includes('final content (pass')) {
        inFinalContentSection = true;
        inDiffSection = false;
        inCodeReviewSection = false;
        multiLineBuffer = '';
        
        // Extract pass number
        const passMatch = line.match(/final content \(pass (\d+)\):/);
        if (passMatch && currentEntry) {
          currentEntry.passNumber = parseInt(passMatch[1]);
        }
      }
      else if (line.includes('-------------------------')) {
        // Separator line - process accumulated buffer
        if (currentEntry && multiLineBuffer.trim()) {
          if (inDiffSection) {
            currentEntry.diff = this.parseDiffInfo(multiLineBuffer);
          } else if (inCodeReviewSection) {
            currentEntry.codeReview = this.parseCodeReview(multiLineBuffer);
          } else if (inFinalContentSection) {
            currentEntry.finalContent = multiLineBuffer.trim();
          }
        }
        multiLineBuffer = '';
        inDiffSection = false;
        inCodeReviewSection = false;
        inFinalContentSection = false;
      }
      // Accumulate multi-line content
      else if (inDiffSection || inCodeReviewSection || inFinalContentSection) {
        multiLineBuffer += line + '\n';
      }
    }

    // Handle final entry
    if (currentEntry) {
      this.finalizePreviousEntry(currentEntry, entries, multiLineBuffer);
    }

    return entries;
  }

  private finalizePreviousEntry(currentEntry: Partial<LogEntry>, entries: LogEntry[], multiLineBuffer: string) {
    if (multiLineBuffer.trim() && currentEntry.action === 'diff_applied') {
      if (currentEntry.finalContent === undefined) {
        currentEntry.finalContent = multiLineBuffer.trim();
      }
    }
    
    if (this.isValidLogEntry(currentEntry)) {
      entries.push(currentEntry as LogEntry);
    }
  }

  private isValidLogEntry(entry: Partial<LogEntry>): entry is LogEntry {
    return !!(entry.timestamp && entry.level && entry.component && entry.message);
  }

  /**
   * Parse diff information from multi-line buffer
   */
  private parseDiffInfo(content: string): DiffInfo {
    const searchBlocks: string[] = [];
    const replaceBlocks: string[] = [];
    
    // Look for SEARCH/REPLACE blocks
    const searchReplacePattern = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let match;
    
    while ((match = searchReplacePattern.exec(content)) !== null) {
      searchBlocks.push(match[1]);
      replaceBlocks.push(match[2]);
    }

    return {
      searchBlocks,
      replaceBlocks,
      rawDiff: content,
      applied: !content.includes('SearchReplaceNoExactMatch')
    };
  }

  /**
   * Parse code review information
   */
  private parseCodeReview(content: string): CodeReviewInfo {
    const sections = {
      codeStructure: '',
      criticalIssues: [] as string[],
      hooksAnalysis: '',
      fixesRationale: ''
    };

    // Extract structured information from code review
    const structureMatch = content.match(/1\.\s*Code structure[^:]*:([\s\S]*?)(?=\n\s*\d+\.|\n\s*<\/code_review>|$)/);
    if (structureMatch) {
      sections.codeStructure = structureMatch[1].trim();
    }

    const issuesMatch = content.match(/2\.\s*Critical issues[^:]*:([\s\S]*?)(?=\n\s*\d+\.|\n\s*<\/code_review>|$)/);
    if (issuesMatch) {
      const issueText = issuesMatch[1].trim();
      sections.criticalIssues = issueText.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim());
    }

    const hooksMatch = content.match(/3\.\s*React hooks[^:]*:([\s\S]*?)(?=\n\s*\d+\.|\n\s*<\/code_review>|$)/);
    if (hooksMatch) {
      sections.hooksAnalysis = hooksMatch[1].trim();
    }

    const rationaleMatch = content.match(/4\.\s*Proposed fixes rationale[^:]*:([\s\S]*?)(?=\n\s*\d+\.|\n\s*<\/code_review>|$)/);
    if (rationaleMatch) {
      sections.fixesRationale = rationaleMatch[1].trim();
    }

    return {
      ...sections,
      rawReview: content
    };
  }

  /**
   * Group log entries by trace ID
   */
  private groupByTraceId(entries: LogEntry[]): LogEntry[][] {
    const groups = new Map<string, LogEntry[]>();
    
    for (const entry of entries) {
      if (entry.traceId) {
        if (!groups.has(entry.traceId)) {
          groups.set(entry.traceId, []);
        }
        groups.get(entry.traceId)!.push(entry);
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Create session analysis from grouped entries
   */
  private createSessionAnalysis(entries: LogEntry[]): SessionAnalysis {
    if (entries.length === 0) {
      throw new Error('Cannot create session analysis from empty entries');
    }

    const traceId = entries[0].traceId || 'unknown';
    const fileGroups = this.groupEntriesByFile(entries);
    const fileProcessingSessions = fileGroups.map(group => this.createFileProcessingSession(group));

    // Calculate timing
    const timestamps = entries.map(e => new Date(e.timestamp).getTime());
    const startTime = new Date(Math.min(...timestamps)).toISOString();
    const endTime = new Date(Math.max(...timestamps)).toISOString();

    // Calculate statistics
    const totalPasses = fileProcessingSessions.reduce((sum, session) => sum + session.totalPasses, 0);
    const successfulFixes = entries.filter(e => e.diff?.applied === true).length;
    const failedFixes = entries.filter(e => e.diff?.applied === false).length;
    const filesProcessed = [...new Set(entries.filter(e => e.filePath).map(e => e.filePath!))];

    return {
      traceId,
      startTime,
      endTime,
      filesProcessed,
      totalPasses,
      successfulFixes,
      failedFixes,
      fileProcessingSessions
    };
  }

  /**
   * Group entries by file path
   */
  private groupEntriesByFile(entries: LogEntry[]): LogEntry[][] {
    const groups = new Map<string, LogEntry[]>();
    
    for (const entry of entries) {
      if (entry.filePath) {
        if (!groups.has(entry.filePath)) {
          groups.set(entry.filePath, []);
        }
        groups.get(entry.filePath)!.push(entry);
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Create file processing session from file-grouped entries
   */
  private createFileProcessingSession(entries: LogEntry[]): FileProcessingSession {
    if (entries.length === 0) {
      throw new Error('Cannot create file processing session from empty entries');
    }

    const filePath = entries[0].filePath!;
    const traceId = entries[0].traceId || 'unknown';
    
    // Sort entries by timestamp
    entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const passes = entries
      .filter(e => e.action === 'diff_applied')
      .map((entry, index) => ({
        passNumber: entry.passNumber || index + 1,
        timestamp: entry.timestamp,
        diff: entry.diff || { searchBlocks: [], replaceBlocks: [], rawDiff: '', applied: false },
        codeReview: entry.codeReview || { codeStructure: '', criticalIssues: [], hooksAnalysis: '', fixesRationale: '', rawReview: '' },
        beforeContent: undefined, // We'll need to reconstruct this
        afterContent: entry.finalContent,
        applied: entry.diff?.applied || false
      }));

    return {
      filePath,
      traceId,
      passes,
      totalPasses: passes.length,
      initialContent: undefined, // First pass before content
      finalContent: passes[passes.length - 1]?.afterContent
    };
  }
}
