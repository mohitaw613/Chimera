import React from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Printer } from 'lucide-react';

export const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 text-cyan-400">
            <FileText className="w-6 h-6" />
            <h1 className="text-xl font-bold text-white">Investigation Findings Report</h1>
          </div>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 text-xs font-medium flex items-center space-x-1.5 border border-cyber-700"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
        <p className="text-sm text-slate-400 mt-2">
          Deterministic synthesis of case findings for Case ID: <span className="font-mono text-cyan-400">{id}</span>.
        </p>
      </div>
    </div>
  );
};
