import React, { useState, useCallback } from 'react';
import { LogParser } from './parser/logParser';
import { SessionAnalysis, FileProcessingSession, OpenAIAnalysis } from './types';
import { OpenAIAnalyzer } from './services/openaiAnalyzer';
import LogUploader from './components/LogUploader';
import SessionList from './components/SessionList';
import FileViewer from './components/FileViewer';
import AnalyticsPanel from './components/AnalyticsPanel';
import { FileText, Activity, Settings, Upload } from 'lucide-react';

function App() {
  const [sessions, setSessions] = useState<SessionAnalysis[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionAnalysis | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileProcessingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'analytics' | 'settings'>('sessions');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [analyses, setAnalyses] = useState<Map<string, OpenAIAnalysis[]>>(new Map());

  const handleLogUpload = useCallback(async (logContent: string) => {
    setLoading(true);
    try {
      const parser = new LogParser(logContent);
      const parsedSessions = parser.parse();
      setSessions(parsedSessions);
      
      if (parsedSessions.length > 0) {
        setSelectedSession(parsedSessions[0]);
        if (parsedSessions[0].fileProcessingSessions.length > 0) {
          setSelectedFile(parsedSessions[0].fileProcessingSessions[0]);
        }
      }
    } catch (error) {
      console.error('Error parsing logs:', error);
      alert('Error parsing log file. Please check the format.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAnalyzeFile = useCallback(async (fileSession: FileProcessingSession) => {
    if (!openaiApiKey) {
      alert('Please set your OpenAI API key in settings first.');
      return;
    }

    setLoading(true);
    try {
      const analyzer = new OpenAIAnalyzer(openaiApiKey);
      const fileAnalyses = await analyzer.analyzeBatch(
        fileSession.filePath,
        fileSession.passes,
        fileSession.initialContent
      );
      
      setAnalyses(prev => new Map(prev.set(fileSession.filePath, fileAnalyses)));
    } catch (error) {
      console.error('Error analyzing file:', error);
      alert('Error analyzing file with OpenAI. Please check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }, [openaiApiKey]);

  const renderContent = () => {
    if (sessions.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No log files loaded</h3>
            <p className="text-gray-500">Upload a log file to start analyzing code fixes</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'sessions') {
      return (
        <div className="flex-1 flex">
          <div className="w-1/4 bg-white border-r border-gray-200">
            <SessionList
              sessions={sessions}
              selectedSession={selectedSession}
              selectedFile={selectedFile}
              onSelectSession={setSelectedSession}
              onSelectFile={setSelectedFile}
            />
          </div>
          <div className="flex-1">
            {selectedFile ? (
              <FileViewer
                fileSession={selectedFile}
                analysis={analyses.get(selectedFile.filePath)}
                onAnalyze={() => handleAnalyzeFile(selectedFile)}
                loading={loading}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a file to view</h3>
                  <p className="text-gray-500">Choose a file from the session list to see its fixes and analysis</p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'analytics') {
      return <AnalyticsPanel sessions={sessions} analyses={analyses} />;
    }

    if (activeTab === 'settings') {
      return (
        <div className="flex-1 p-6 bg-gray-50">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Settings</h2>
            
            <div className="mb-6">
              <label htmlFor="openai-key" className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                id="openai-key"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="sk-..."
              />
              <p className="mt-2 text-sm text-gray-500">
                Required for automated code quality analysis. Your key is stored locally and never sent to our servers.
              </p>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">About</h3>
              <p className="text-gray-600">
                This tool analyzes logs from your app builder system to help you understand the effectiveness 
                of automated code fixes. It extracts original and fixed code, shows diffs, tracks multiple 
                passes per file, and uses OpenAI to analyze whether fixes improved code quality.
              </p>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">App Builder Log Analyzer</h1>
            <LogUploader onLogUpload={handleLogUpload} disabled={loading} />
          </div>
          
          {/* Navigation */}
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sessions'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Sessions
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Settings
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      {renderContent()}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-900">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
