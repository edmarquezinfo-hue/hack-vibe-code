import React, { useMemo } from 'react';
import { SessionAnalysis, OpenAIAnalysis, AnalysisInsights } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Clock, FileText, CheckCircle, XCircle, AlertTriangle, Brain } from 'lucide-react';

interface AnalyticsPanelProps {
  sessions: SessionAnalysis[];
  analyses: Map<string, OpenAIAnalysis[]>;
}

export default function AnalyticsPanel({ sessions, analyses }: AnalyticsPanelProps) {
  const insights = useMemo(() => {
    return generateInsights(sessions, analyses);
  }, [sessions, analyses]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // Chart data preparation
  const filePassesData = insights.mostFixedFiles.slice(0, 10).map(file => ({
    name: file.filePath.split('/').pop(),
    passes: file.passes
  }));

  const successRateData = sessions.map(session => ({
    session: session.traceId.substring(0, 8),
    successRate: session.totalPasses > 0 ? (session.successfulFixes / session.totalPasses) * 100 : 0
  }));

  const qualityDistribution = Array.from(analyses.values()).flat().reduce((acc, analysis) => {
    acc[analysis.quality] = (acc[analysis.quality] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const qualityPieData = Object.entries(qualityDistribution).map(([quality, count]) => ({
    name: quality.charAt(0).toUpperCase() + quality.slice(1),
    value: count
  }));

  const scoreDistribution = Array.from(analyses.values()).flat().map(analysis => ({
    score: Math.floor(analysis.score / 10) * 10,
    count: 1
  })).reduce((acc, curr) => {
    const existing = acc.find(item => item.scoreRange === `${curr.score}-${curr.score + 9}`);
    if (existing) {
      existing.count += curr.count;
    } else {
      acc.push({ scoreRange: `${curr.score}-${curr.score + 9}`, count: curr.count });
    }
    return acc;
  }, [] as Array<{ scoreRange: string; count: number }>);

  const StatCard = ({ title, value, subtitle, icon: Icon, trend }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${
          trend === 'up' ? 'bg-green-100' : trend === 'down' ? 'bg-red-100' : 'bg-blue-100'
        }`}>
          <Icon className={`w-6 h-6 ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-blue-600'
          }`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto custom-scrollbar">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>

        {/* Key Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Files Processed"
            value={insights.totalFilesProcessed}
            icon={FileText}
            trend="neutral"
          />
          <StatCard
            title="Success Rate"
            value={`${insights.fixSuccessRate.toFixed(1)}%`}
            subtitle="Overall fix success"
            icon={CheckCircle}
            trend={insights.fixSuccessRate >= 80 ? 'up' : insights.fixSuccessRate >= 60 ? 'neutral' : 'down'}
          />
          <StatCard
            title="Avg Passes per File"
            value={insights.averagePassesPerFile.toFixed(1)}
            subtitle="Processing iterations"
            icon={Clock}
            trend={insights.averagePassesPerFile <= 2 ? 'up' : 'neutral'}
          />
          <StatCard
            title="AI Analyses"
            value={Array.from(analyses.values()).flat().length}
            subtitle="Quality assessments"
            icon={Brain}
            trend="neutral"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Files with Most Passes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Files with Most Passes</h3>
            {filePassesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filePassesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="passes" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>

          {/* Success Rate by Session */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Success Rate by Session</h3>
            {successRateData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={successRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="session" fontSize={12} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="successRate" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis Insights */}
        {Array.from(analyses.values()).flat().length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Quality Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Quality Assessment</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={qualityPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, value}) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {qualityPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Score Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Score Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scoreRange" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Common Issues and Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Common Issues */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
              Common Issue Patterns
            </h3>
            {insights.commonIssuePatterns.length > 0 ? (
              <ul className="space-y-2">
                {insights.commonIssuePatterns.slice(0, 8).map((pattern, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span className="text-gray-700">{pattern}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No common patterns identified yet</p>
            )}
          </div>

          {/* Processing Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-500" />
              Processing Performance
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Average Time per File</span>
                  <span className="font-medium">{insights.processingTimeAnalysis.averageTimePerFile.toFixed(2)}s</span>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Slowest Files</h4>
                {insights.processingTimeAnalysis.slowestFiles.length > 0 ? (
                  <ul className="space-y-1">
                    {insights.processingTimeAnalysis.slowestFiles.slice(0, 5).map((file, index) => (
                      <li key={index} className="flex justify-between text-xs">
                        <span className="text-gray-600 truncate">{file.filePath.split('/').pop()}</span>
                        <span className="font-medium">{file.processingTime.toFixed(1)}s</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-xs">No timing data available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Insights */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Key Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="font-medium">Best Performing</span>
              </div>
              <p className="text-gray-600">
                {insights.fixSuccessRate >= 80 
                  ? 'High success rate indicates effective fixes'
                  : 'Consider improving fix algorithms'
                }
              </p>
            </div>
            
            <div className="bg-white rounded p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Processing Efficiency</span>
              </div>
              <p className="text-gray-600">
                {insights.averagePassesPerFile <= 2
                  ? 'Most files fixed efficiently in few passes'
                  : 'Some files require multiple iteration cycles'
                }
              </p>
            </div>
            
            <div className="bg-white rounded p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="font-medium">AI Quality</span>
              </div>
              <p className="text-gray-600">
                {Array.from(analyses.values()).flat().length > 0
                  ? 'AI analysis available for quality assessment'
                  : 'Run AI analysis for quality insights'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateInsights(sessions: SessionAnalysis[], analyses: Map<string, OpenAIAnalysis[]>): AnalysisInsights {
  const allFiles = sessions.flatMap(session => session.fileProcessingSessions);
  const filePassCounts = allFiles.map(file => ({
    filePath: file.filePath,
    passes: file.totalPasses
  }));

  const mostFixedFiles = filePassCounts
    .sort((a, b) => b.passes - a.passes)
    .slice(0, 10);

  const totalPasses = sessions.reduce((sum, session) => sum + session.totalPasses, 0);
  const successfulFixes = sessions.reduce((sum, session) => sum + session.successfulFixes, 0);
  const fixSuccessRate = totalPasses > 0 ? (successfulFixes / totalPasses) * 100 : 0;

  const averagePassesPerFile = allFiles.length > 0 
    ? allFiles.reduce((sum, file) => sum + file.totalPasses, 0) / allFiles.length 
    : 0;

  // Calculate processing times (mock data for now since we don't have precise timing)
  const processingTimes = sessions.map(session => {
    const startTime = new Date(session.startTime).getTime();
    const endTime = new Date(session.endTime).getTime();
    const duration = (endTime - startTime) / 1000; // in seconds
    const filesInSession = session.fileProcessingSessions.length;
    return {
      sessionDuration: duration,
      filesProcessed: filesInSession,
      averagePerFile: filesInSession > 0 ? duration / filesInSession : 0
    };
  });

  const averageTimePerFile = processingTimes.length > 0
    ? processingTimes.reduce((sum, time) => sum + time.averagePerFile, 0) / processingTimes.length
    : 0;

  const slowestFiles = allFiles
    .map(file => ({
      filePath: file.filePath,
      processingTime: file.totalPasses * 2.5 // Mock calculation
    }))
    .sort((a, b) => b.processingTime - a.processingTime)
    .slice(0, 5);

  // Extract common issue patterns from code reviews
  const commonIssuePatterns = allFiles
    .flatMap(file => file.passes.flatMap(pass => pass.codeReview.criticalIssues))
    .reduce((acc, issue) => {
      const normalizedIssue = issue.toLowerCase().trim();
      acc[normalizedIssue] = (acc[normalizedIssue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const commonIssuesList = Object.entries(commonIssuePatterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([issue]) => issue);

  return {
    mostFixedFiles,
    fixSuccessRate,
    commonIssuePatterns: commonIssuesList,
    averagePassesPerFile,
    totalFilesProcessed: allFiles.length,
    processingTimeAnalysis: {
      averageTimePerFile,
      slowestFiles
    }
  };
}
