import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { UploadCloud, ArrowRight } from 'lucide-react';

export const UploadPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6">
        <div className="flex items-center space-x-3 text-cyan-400 mb-2">
          <UploadCloud className="w-6 h-6" />
          <h1 className="text-xl font-bold text-white">Upload Evidence Logs</h1>
        </div>
        <p className="text-sm text-slate-400">
          Upload forensic logs in CSV, JSON, or JSONL format. Files will be SHA-256 fingerprinted and canonicalized.
        </p>
        <div className="mt-6 border-2 border-dashed border-cyber-700 rounded-xl p-10 text-center hover:border-cyan-500/50 transition-colors">
          <UploadCloud className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">Drag & drop forensic log files or click to browse</p>
          <p className="text-xs text-slate-500 mt-1">Supported formats: .csv, .json, .jsonl (up to 25 MB)</p>
        </div>
        <div className="mt-6 flex justify-end">
          <Link
            to={`/investigations/${id}/evidence`}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium flex items-center space-x-2"
          >
            <span>Proceed to Evidence Explorer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
