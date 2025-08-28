import React from 'react';
import { SessionAnalysis, FileProcessingSession } from '../types';
import { Clock, FileText, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface SessionListProps {
  sessions: SessionAnalysis[];
  selectedSession: SessionAnalysis | null;
  selectedFile: FileProcessingSession | null;
  onSelectSession: (session: SessionAnalysis) => void;
  onSelectFile: (file: FileProcessingSession) => void;
}

export default function SessionList({
  sessions,
  selectedSession,
  selectedFile,
  onSelectSession,
  onSelectFile
}: SessionListProps) {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (start: string, end: string) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;
    const durationSec = Math.round(durationMs / 1000);
    return `${durationSec}s`;
  };

  const getFileIcon = (passes: number) => {
    if (passes === 0) return <XCircle className="w-4 h-4 text-gray-400" />;
    if (passes === 1) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <RefreshCw className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Sessions header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-gray-900">Processing Sessions</h2>
        <p className="text-sm text-gray-600 mt-1">{sessions.length} sessions found</p>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sessions.map((session) => (
          <div key={session.traceId} className="border-b border-gray-100">
            <button
              onClick={() => onSelectSession(session)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                selectedSession?.traceId === session.traceId ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 truncate">
                  {session.traceId.substring(0, 8)}...
                </span>
                <span className="text-xs text-gray-500 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(session.startTime)}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div className="text-center">
                  <div className="font-medium text-gray-900">{session.filesProcessed.length}</div>
                  <div>Files</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-900">{session.totalPasses}</div>
                  <div>Passes</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-900">
                    {formatDuration(session.startTime, session.endTime)}
                  </div>
                  <div>Duration</div>
                </div>
              </div>

              {/* Success rate */}
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Success Rate</span>
                  <span>
                    {session.totalPasses > 0 
                      ? Math.round((session.successfulFixes / session.totalPasses) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{
                      width: `${session.totalPasses > 0 
                        ? (session.successfulFixes / session.totalPasses) * 100
                        : 0}%`
                    }}
                  />
                </div>
              </div>
            </button>

            {/* Files in selected session */}
            {selectedSession?.traceId === session.traceId && (
              <div className="bg-gray-50 border-t border-gray-200">
                {session.fileProcessingSessions.map((fileSession) => (
                  <button
                    key={fileSession.filePath}
                    onClick={() => onSelectFile(fileSession)}
                    className={`w-full p-3 text-left hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0 ${
                      selectedFile?.filePath === fileSession.filePath ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {getFileIcon(fileSession.totalPasses)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {fileSession.filePath.split('/').pop()}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {fileSession.filePath}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        {fileSession.totalPasses} {fileSession.totalPasses === 1 ? 'pass' : 'passes'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
