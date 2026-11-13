import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileSpreadsheet, ArrowRight } from 'lucide-react';

export const EvidencePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6">
        <div className="flex items-center space-x-3 text-cyan-400 mb-2">
          <FileSpreadsheet className="w-6 h-6" />
          <h1 className="text-xl font-bold text-white">Evidence Explorer</h1>
        </div>
        <p className="text-sm text-slate-400">
          Browse canonicalized events, raw records verbatim, arrival status flags, and timestamps.
        </p>
        <div className="mt-6 flex justify-end">
          <Link
            to={`/investigations/${id}/timeline`}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium flex items-center space-x-2"
          >
            <span>Proceed to Timeline</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
