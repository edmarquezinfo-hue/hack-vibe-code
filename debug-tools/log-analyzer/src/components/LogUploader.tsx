import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface LogUploaderProps {
  onLogUpload: (content: string) => void;
  disabled?: boolean;
}

export default function LogUploader({ onLogUpload, disabled }: LogUploaderProps) {
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      onLogUpload(content);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please try again.');
    }

    // Reset input
    event.target.value = '';
  }, [onLogUpload]);

  return (
    <div className="relative">
      <input
        type="file"
        accept=".log,.txt,.logold"
        onChange={handleFileUpload}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        id="log-upload"
      />
      <label
        htmlFor="log-upload"
        className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium transition-colors ${
          disabled
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-50 hover:border-gray-400 cursor-pointer'
        }`}
      >
        {disabled ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
            Processing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload Log File
          </>
        )}
      </label>
    </div>
  );
}
