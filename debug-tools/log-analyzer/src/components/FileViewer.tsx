import { useState } from 'react';
import { FileProcessingSession, OpenAIAnalysis } from '../types';
import { ChevronLeft, ChevronRight, Brain, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { createPatch } from 'diff';

interface FileViewerProps {
  fileSession: FileProcessingSession;
  analysis?: OpenAIAnalysis[];
  onAnalyze: () => void;
  loading: boolean;
}

export default function FileViewer({ fileSession, analysis, onAnalyze, loading }: FileViewerProps) {
  const [currentPassIndex, setCurrentPassIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'diff' | 'before' | 'after'>('diff');

  const currentPass = fileSession.passes[currentPassIndex];
  const previousPass = currentPassIndex > 0 ? fileSession.passes[currentPassIndex - 1] : null;
  const beforeContent = previousPass?.afterContent || fileSession.initialContent || '';
  const afterContent = currentPass?.afterContent || '';

  const currentAnalysis = analysis?.find(a => a.passNumber === currentPass?.passNumber);

  const getQualityBadge = (quality: 'better' | 'worse' | 'similar') => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    switch (quality) {
      case 'better':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>
          <CheckCircle className="w-3 h-3 mr-1" />
          Better
        </span>;
      case 'worse':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>
          <XCircle className="w-3 h-3 mr-1" />
          Worse
        </span>;
      case 'similar':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
          <AlertCircle className="w-3 h-3 mr-1" />
          Similar
        </span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {fileSession.filePath.split('/').pop()}
            </h2>
            <p className="text-sm text-gray-600 truncate">{fileSession.filePath}</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              {fileSession.totalPasses} {fileSession.totalPasses === 1 ? 'pass' : 'passes'}
            </span>
            <button
              onClick={onAnalyze}
              disabled={loading || !!analysis}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Brain className="w-4 h-4 mr-2" />
              {loading ? 'Analyzing...' : analysis ? 'Analyzed' : 'Analyze with AI'}
            </button>
          </div>
        </div>

        {/* Pass navigation */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPassIndex(Math.max(0, currentPassIndex - 1))}
              disabled={currentPassIndex === 0}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-sm font-medium text-gray-900">
              Pass {currentPassIndex + 1} of {fileSession.passes.length}
            </span>
            
            <button
              onClick={() => setCurrentPassIndex(Math.min(fileSession.passes.length - 1, currentPassIndex + 1))}
              disabled={currentPassIndex === fileSession.passes.length - 1}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-300">
            <button
              onClick={() => setViewMode('diff')}
              className={`px-3 py-1 text-sm font-medium rounded-l-lg ${
                viewMode === 'diff' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Diff
            </button>
            <button
              onClick={() => setViewMode('before')}
              className={`px-3 py-1 text-sm font-medium border-l border-gray-300 ${
                viewMode === 'before' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Before
            </button>
            <button
              onClick={() => setViewMode('after')}
              className={`px-3 py-1 text-sm font-medium border-l border-gray-300 rounded-r-lg ${
                viewMode === 'after' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              After
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex">
        {/* Main code view */}
        <div className="flex-1 flex flex-col">
          {/* Pass metadata */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-2 ${currentPass?.applied ? 'text-green-600' : 'text-red-600'}`}>
                  {currentPass?.applied ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    {currentPass?.applied ? 'Successfully Applied' : 'Failed to Apply'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(currentPass?.timestamp || '').toLocaleString()}
                </span>
              </div>
              
              {currentAnalysis && (
                <div className="flex items-center space-x-3">
                  {getQualityBadge(currentAnalysis.quality)}
                  <span className={`text-sm font-medium ${getScoreColor(currentAnalysis.score)}`}>
                    {currentAnalysis.score}/100
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Code display */}
          <div className="flex-1 overflow-auto">
            {viewMode === 'diff' && (
              <div className="grid grid-cols-2 gap-4 p-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Before (Original)</h3>
                  <pre className="bg-red-50 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-red-200">
                    {beforeContent || 'No original content available'}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">After (Fixed)</h3>
                  <pre className="bg-green-50 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-green-200">
                    {afterContent || 'No fixed content available'}
                  </pre>
                </div>
                {/* Show patch diff below */}
                <div className="col-span-2 mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Unified Diff</h3>
                  <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                    {createPatch('file', beforeContent || '', afterContent || '', 'before', 'after')}
                  </pre>
                </div>
              </div>
            )}

            {viewMode === 'before' && (
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Original Code</h3>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                  {beforeContent || 'No original content available'}
                </pre>
              </div>
            )}

            {viewMode === 'after' && (
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Fixed Code</h3>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                  {afterContent || 'No fixed content available'}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Analysis sidebar */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Analysis</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Code Review */}
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Code Review</h4>
              {currentPass?.codeReview ? (
                <div className="space-y-3">
                  {currentPass.codeReview.codeStructure && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-1">Structure</h5>
                      <p className="text-xs text-gray-600">{currentPass.codeReview.codeStructure}</p>
                    </div>
                  )}
                  {currentPass.codeReview.criticalIssues.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-1">Issues Found</h5>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {currentPass.codeReview.criticalIssues.map((issue, index) => (
                          <li key={index} className="flex items-start space-x-1">
                            <span className="text-red-500">•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {currentPass.codeReview.fixesRationale && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-1">Fix Rationale</h5>
                      <p className="text-xs text-gray-600">{currentPass.codeReview.fixesRationale}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No code review available</p>
              )}
            </div>

            {/* AI Analysis */}
            {currentAnalysis && (
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">AI Quality Assessment</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="text-xs font-medium text-gray-700 mb-1">Reasoning</h5>
                    <p className="text-xs text-gray-600">{currentAnalysis.reasoning}</p>
                  </div>
                  
                  {currentAnalysis.suggestions.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-1">Suggestions</h5>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {currentAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start space-x-1">
                            <span className="text-blue-500">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!currentAnalysis && !loading && (
              <div className="p-4 text-center">
                <Brain className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-2">No AI analysis available</p>
                <button
                  onClick={onAnalyze}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Run AI Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
