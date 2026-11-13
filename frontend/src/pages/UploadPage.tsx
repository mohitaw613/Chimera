import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud,
  FileCode,
  ArrowRight,
  Hash,
  X,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';

interface UploadResultFile {
  file_id: string;
  filename: string;
  sha256: string;
  rows_total: number;
  rows_ok: number;
  rows_flagged: number;
  rows_failed: number;
  errors?: Array<{ row: number; reason: string }>;
}

export const UploadPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResultFile[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!investigationId || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await api.uploadFiles(investigationId, formData);
      setResults(res.files || []);
      setSelectedFiles([]);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Upload failed';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Bar */}
      <div className="card-glow rounded-2xl p-6">
        <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
          <Link to="/" className="hover:text-slate-200">Investigations</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-blue-400 font-mono">#{investigationId}</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Upload Evidence Logs</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Ingest multi-source forensic logs in CSV, JSON, or JSONL format. Files are hashed with SHA-256 for cryptographic integrity.
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="card-glow rounded-2xl p-8 text-center transition-all border-2 border-dashed border-cyber-800 hover:border-blue-500/50 relative cursor-pointer"
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".csv,.json,.jsonl"
          onChange={handleFileChange}
          className="sr-only"
        />
        <label htmlFor="file-input" className="cursor-pointer block">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold text-white block">
            Choose telemetry log files or drag & drop here
          </span>
          <span className="text-xs text-slate-400 block mt-1">
            Supported formats: CSV, JSON, JSONL • Max 25 MB per file
          </span>
        </label>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="card-glow rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-cyber-800 pb-2">
            <span>Staged Files ({selectedFiles.length})</span>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-rose-400 hover:underline text-xs"
            >
              Clear all
            </button>
          </div>
          <div className="divide-y divide-cyber-800">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="font-mono text-white">{file.name}</span>
                  <span className="text-slate-500 font-mono">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {uploading ? 'Processing & Hashing…' : 'Upload & Ingest'}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {uploadError}
        </div>
      )}

      {/* Ingestion Results Table */}
      {results && (
        <div className="card-glow rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ingestion Complete</span>
            </div>
            <button
              onClick={() => navigate(`/investigations/${investigationId}/evidence`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 shadow-md shadow-blue-500/20"
            >
              <span>Explore Evidence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {results.map((f) => (
              <div key={f.file_id} className="p-4 rounded-xl bg-cyber-950 border border-cyber-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white">{f.filename}</span>
                  <span className="font-mono text-emerald-400 font-bold">{f.rows_ok} valid records</span>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-400 truncate">
                  <Hash className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="truncate">{f.sha256}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
