# App Builder Log Analyzer

A comprehensive tool for analyzing logs from your app builder system to understand the effectiveness of automated code fixes. This tool extracts original and fixed code, shows diffs, tracks multiple passes per file, and uses OpenAI to analyze whether fixes improved code quality.

## Features

### 🔍 **Log Parsing & Analysis**
- Parses complex log files with structured data extraction
- Identifies processing sessions and trace IDs
- Extracts original vs fixed code blocks
- Captures diff information and code reviews
- Tracks multiple passes per file with full history

### 📊 **Visual Analytics Dashboard**
- Side-by-side code comparison with syntax highlighting
- Interactive navigation between processing passes
- Success rate tracking and performance metrics
- Common issue pattern identification
- Processing time analysis and performance insights

### 🤖 **AI-Powered Quality Assessment**
- OpenAI integration for automated code quality analysis
- Compares original vs fixed code effectiveness
- Generates quality scores and improvement suggestions
- Identifies whether fixes were better, worse, or similar
- Batch analysis for multiple files and passes

### 🎯 **Key Insights**
- **Fix Success Rate**: Overall effectiveness of automated fixes
- **Most Fixed Files**: Files requiring the most iterations
- **Common Issues**: Patterns in code problems and fixes
- **Processing Performance**: Time analysis and optimization opportunities
- **Quality Distribution**: AI assessment of fix effectiveness

## Quick Start

### 1. Install Dependencies
```bash
cd log-analyzer
npm install
```

### 2. Set OpenAI API Key (Optional)
- Open the app and go to Settings
- Enter your OpenAI API key for AI-powered analysis
- Key is stored locally and never sent to our servers

### 3. Run the Application
```bash
npm run dev
```

### 4. Upload Log File
- Click "Upload Log File" in the header
- Select your `.log`, `.logold`, or `.txt` file
- The tool automatically parses and displays the data

## Usage Guide

### Navigation
- **Sessions Tab**: Browse processing sessions and files
- **Analytics Tab**: View comprehensive dashboard with insights
- **Settings Tab**: Configure OpenAI API key and preferences

### Analyzing Files
1. **Select a Session**: Choose from the left sidebar
2. **Pick a File**: Select a file that underwent fixes
3. **Navigate Passes**: Use arrow buttons to move between fix iterations
4. **Compare Code**: Toggle between Diff, Before, and After views
5. **AI Analysis**: Click "Analyze with AI" for quality assessment

### Understanding the Data

#### **Log Structure**
The tool recognizes these key patterns:
- `Applied search replace diff to file: [filepath]`
- `Starting smart diff application...`
- `Diff:` sections with actual code changes
- `final content (pass X):` showing results after fixes
- Trace IDs for session correlation

#### **Pass Analysis**
Each processing pass includes:
- **Timestamp**: When the fix was applied
- **Status**: Successfully applied or failed
- **Code Review**: Automated analysis of issues found
- **Diff**: Before/after code comparison
- **AI Assessment**: Quality evaluation (if enabled)

#### **Quality Metrics**
- **Better**: Fix improved code quality
- **Worse**: Fix degraded code quality  
- **Similar**: Minimal impact on code quality
- **Score**: 0-100 quality assessment

## Log File Requirements

The tool expects log files with this structure:

```
2025-08-10T03:07:48.107Z INFO RealtimeCodeFixer[RealtimeCodeFixer#undefined] trace:739cd85d: Applied search replace diff to file: src/components/Example.tsx

Diff:
<code_review>
1. Code structure and components:
   - Component analysis...
2. Critical issues identified:
   - Issue details...
3. React hooks analysis:
   - Hook usage analysis...
4. Proposed fixes rationale
   - Fix reasoning...
</code_review>

final content (pass 1):
[fixed code content]
```

## Architecture

### Core Components
- **LogParser**: Extracts structured data from log files
- **OpenAIAnalyzer**: AI-powered code quality assessment
- **SessionList**: Navigation interface for sessions and files
- **FileViewer**: Side-by-side code comparison with pass navigation
- **AnalyticsPanel**: Comprehensive insights dashboard

### Data Flow
1. **Upload** → Log file content read
2. **Parse** → Structured data extraction
3. **Analyze** → Optional OpenAI quality assessment
4. **Visualize** → Interactive dashboard and comparisons

## Customization

### Adding New Log Patterns
Extend `LogParser.ts` to handle additional log formats:

```typescript
// In parseLogEntries method
const customPattern = line.match(/YOUR_PATTERN_HERE/);
if (customPattern) {
  // Handle custom pattern
}
```

### Custom Analysis Prompts
Modify `OpenAIAnalyzer.ts` to adjust AI analysis:

```typescript
// In buildAnalysisPrompt method
const prompt = `Your custom analysis prompt...`;
```

## Troubleshooting

### Common Issues

**No Data Displayed**
- Ensure log file matches expected format
- Check browser console for parsing errors
- Verify file is not empty or corrupted

**OpenAI Analysis Fails**
- Verify API key is correct and active
- Check internet connection
- Ensure sufficient OpenAI credits

**Performance Issues**
- Large log files may take time to process
- Consider splitting very large files
- Close unnecessary browser tabs

### Debug Mode
Enable debug logging by adding to localStorage:
```javascript
localStorage.setItem('debug', 'true');
```

## Contributing

This tool is designed to be extensible. Key areas for enhancement:

1. **Additional Log Formats**: Support for different log structures
2. **Export Features**: PDF reports, CSV data export
3. **Real-time Monitoring**: Live log streaming and analysis
4. **Advanced Filtering**: Search and filter capabilities
5. **Team Features**: Collaborative analysis and sharing

## Technical Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Visualization**: Recharts, react-diff-viewer
- **AI Analysis**: OpenAI GPT-4
- **Build Tool**: Vite
- **Icons**: Lucide React

## License

MIT License - Feel free to use and modify for your needs.

---

**Need Help?** Check the browser console for detailed error messages and parsing information.
