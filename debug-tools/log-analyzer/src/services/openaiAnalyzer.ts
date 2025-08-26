import OpenAI from 'openai';
import { OpenAIAnalysis, FilePass } from '../types';

export class OpenAIAnalyzer {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY || '',
      dangerouslyAllowBrowser: true
    });
  }

  /**
   * Analyze if the code fixes were better or worse than the original
   */
  async analyzeCodeQuality(
    filePath: string,
    beforeContent: string,
    afterContent: string,
    codeReview: string,
    diff: string,
    passNumber: number
  ): Promise<OpenAIAnalysis> {
    const prompt = this.buildAnalysisPrompt(filePath, beforeContent, afterContent, codeReview, diff);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer analyzing the quality of automated code fixes. Provide detailed analysis of whether the fixes improved or degraded the code quality.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseAnalysisResponse(content, filePath, passNumber);
    } catch (error) {
      console.error('OpenAI Analysis Error:', error);
      return {
        filePath,
        passNumber,
        quality: 'similar',
        reasoning: 'Analysis failed due to API error',
        score: 50,
        suggestions: []
      };
    }
  }

  /**
   * Build the analysis prompt for OpenAI
   */
  private buildAnalysisPrompt(
    filePath: string,
    beforeContent: string,
    afterContent: string,
    codeReview: string,
    diff: string
  ): string {
    return `
Analyze the quality of this automated code fix for file: ${filePath}

ORIGINAL CODE:
\`\`\`
${beforeContent || 'No original content available'}
\`\`\`

FIXED CODE:
\`\`\`
${afterContent}
\`\`\`

AUTOMATED CODE REVIEW:
${codeReview}

DIFF APPLIED:
${diff}

Please analyze whether the fixed code is better, worse, or similar compared to the original code. Consider:

1. **Code Quality**: Is the code more readable, maintainable, and following best practices?
2. **Functionality**: Does the fix address real issues or introduce new problems?
3. **Performance**: Are there performance implications?
4. **Security**: Are there security improvements or concerns?
5. **Type Safety**: Is TypeScript usage improved?
6. **React Best Practices**: Are React patterns and hooks used correctly?

Provide your analysis in this exact format:

QUALITY: [better|worse|similar]
SCORE: [0-100 numeric score]
REASONING: [Detailed explanation of your assessment]
SUGGESTIONS: [List specific improvements, one per line starting with "-"]

Be objective and focus on concrete technical improvements or regressions.
`;
  }

  /**
   * Parse the OpenAI response into structured analysis
   */
  private parseAnalysisResponse(content: string, filePath: string, passNumber: number): OpenAIAnalysis {
    const qualityMatch = content.match(/QUALITY:\s*(better|worse|similar)/i);
    const scoreMatch = content.match(/SCORE:\s*(\d+)/);
    const reasoningMatch = content.match(/REASONING:\s*([\s\S]*?)(?=SUGGESTIONS:|$)/);
    const suggestionsMatch = content.match(/SUGGESTIONS:\s*([\s\S]*?)$/);

    const quality = qualityMatch?.[1]?.toLowerCase() as 'better' | 'worse' | 'similar' || 'similar';
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
    const reasoning = reasoningMatch?.[1]?.trim() || 'No detailed reasoning provided';
    
    const suggestions = suggestionsMatch?.[1]
      ?.split('\n')
      ?.filter(line => line.trim().startsWith('-'))
      ?.map(line => line.trim().substring(1).trim())
      ?.filter(suggestion => suggestion.length > 0) || [];

    return {
      filePath,
      passNumber,
      quality,
      reasoning,
      score: Math.max(0, Math.min(100, score)),
      suggestions
    };
  }

  /**
   * Batch analyze multiple passes for a file
   */
  async analyzeBatch(
    filePath: string,
    passes: FilePass[],
    initialContent?: string
  ): Promise<OpenAIAnalysis[]> {
    const analyses: OpenAIAnalysis[] = [];
    
    let previousContent = initialContent || '';
    
    for (const pass of passes) {
      const analysis = await this.analyzeCodeQuality(
        filePath,
        previousContent,
        pass.afterContent || '',
        pass.codeReview.rawReview,
        pass.diff.rawDiff,
        pass.passNumber
      );
      
      analyses.push(analysis);
      previousContent = pass.afterContent || previousContent;
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return analyses;
  }

  /**
   * Generate summary insights from multiple analyses
   */
  generateSummaryInsights(analyses: OpenAIAnalysis[]): {
    overallTrend: 'improving' | 'degrading' | 'mixed';
    averageScore: number;
    bestPass: OpenAIAnalysis | null;
    worstPass: OpenAIAnalysis | null;
    commonIssues: string[];
    recommendations: string[];
  } {
    if (analyses.length === 0) {
      return {
        overallTrend: 'mixed',
        averageScore: 0,
        bestPass: null,
        worstPass: null,
        commonIssues: [],
        recommendations: []
      };
    }

    const averageScore = analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length;
    const bestPass = analyses.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    const worstPass = analyses.reduce((worst, current) => 
      current.score < worst.score ? current : worst
    );

    // Determine overall trend
    const improvements = analyses.filter(a => a.quality === 'better').length;
    const degradations = analyses.filter(a => a.quality === 'worse').length;
    
    let overallTrend: 'improving' | 'degrading' | 'mixed';
    if (improvements > degradations) {
      overallTrend = 'improving';
    } else if (degradations > improvements) {
      overallTrend = 'degrading';
    } else {
      overallTrend = 'mixed';
    }

    // Extract common issues and recommendations
    const allSuggestions = analyses.flatMap(a => a.suggestions);
    const suggestionCounts = allSuggestions.reduce((counts, suggestion) => {
      const key = suggestion.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const commonIssues = Object.entries(suggestionCounts)
      .filter(([, count]) => count >= Math.ceil(analyses.length * 0.3))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([suggestion]) => suggestion);

    const recommendations = [
      ...new Set(analyses.flatMap(a => a.suggestions).slice(0, 10))
    ];

    return {
      overallTrend,
      averageScore,
      bestPass,
      worstPass,
      commonIssues,
      recommendations
    };
  }
}
