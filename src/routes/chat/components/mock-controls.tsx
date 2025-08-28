import { useState } from 'react';
import { mockScenarios } from '../mocks/phase-timeline-mock';
import { generateMockFilesForPhases } from '../mocks/file-mock';
import type { PhaseTimelineItem, FileType } from '../hooks/use-chat';

interface MockControlsProps {
  onPhaseTimelineChange: (timeline: PhaseTimelineItem[]) => void;
  onFilesChange: (files: FileType[]) => void;
  isVisible: boolean;
  onToggle: () => void;
}

export function MockControls({ 
  onPhaseTimelineChange, 
  onFilesChange, 
  isVisible, 
  onToggle 
}: MockControlsProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>('Sequential Phases');

  const handleScenarioChange = (scenarioName: string) => {
    setSelectedScenario(scenarioName);
    const generator = mockScenarios[scenarioName as keyof typeof mockScenarios];
    const mockTimeline = generator();
    
    // Generate matching mock files
    const mockFiles = scenarioName === 'Empty Timeline' 
      ? [] 
      : generateMockFilesForPhases();
    
    onPhaseTimelineChange(mockTimeline);
    onFilesChange(mockFiles);
  };

  const clearAll = () => {
    onPhaseTimelineChange([]);
    onFilesChange([]);
    setSelectedScenario('Empty Timeline');
  };

  if (!isVisible) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={onToggle}
          className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded shadow-lg transition-colors"
        >
          Show Mock Controls
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-background dark:bg-card border border-border rounded-lg shadow-lg p-4 z-50 w-80">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">Phase Timeline Mock Controls</h3>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 transition-colors"
        >
          Hide
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Test Scenario
          </label>
          <div className="space-y-2">
            {Object.keys(mockScenarios).map((scenarioName) => (
              <label key={scenarioName} className="flex items-center">
                <input
                  type="radio"
                  name="scenario"
                  value={scenarioName}
                  checked={selectedScenario === scenarioName}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  className="mr-2 text-purple-600"
                />
                <span className="text-sm text-foreground dark:text-foreground">{scenarioName}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-border dark:border-border">
          <button
            onClick={clearAll}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="text-xs text-muted-foreground dark:text-muted-foreground bg-muted/30 dark:bg-muted/20 p-2 rounded">
          <p><strong>Dev Mode:</strong> These controls let you test different phase timeline states without running full code generation.</p>
        </div>
      </div>
    </div>
  );
}
