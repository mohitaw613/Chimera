import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  FileCode,
  ArrowRight,
  ShieldCheck,
  Hash,
  X,
  FileSpreadsheet,
  CheckCircle2,
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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Dynamic Header */}
      <div>
        <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Stage 1: Evidence Ingestion & Cryptographic Fingerprinting</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Upload Forensic Logs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Ingest multi-source forensic logs in CSV, JSON, or JSONL format. CHIMERA computes SHA-256 digests and derives canonical events without discarding malformed records.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="bg-cyber-900 border-2 border-dashed border-cyber-700 hover:border-cyan-500/50 rounded-xl p-8 text-center transition-colors relative"
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
          <UploadCloud className="w-12 h-12 text-cyan-400 mx-auto mb-3 animate-pulse" />
          <span className="text-base font-semibold text-white block">
            Choose forensic log files or drag & drop here
          </span>
          <span className="text-xs text-slate-400 block mt-1">
            Supported formats: CSV, JSON, JSONL • Max 25 MB per file
          </span>
        </label>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-cyber-800 pb-2">
            <span>Staged Files ({selectedFiles.length})</span>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-rose-400 hover:underline normal-case"
            >
              Clear all
            </button>
          </div>
          <div className="divide-y divide-cyber-800">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center space-x-3">
                  <FileCode className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="font-mono text-white text-xs">{file.name}</span>
                  <span className="text-xs text-slate-500 font-mono">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-sm flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{uploading ? 'Processing & Hashing…' : 'Ingest & Compute Fingerprints'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Callout */}
      {uploadError && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-sm text-rose-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div>
            <div className="font-semibold text-white">Ingestion Error</div>
            <div className="text-xs mt-1 text-rose-200">{uploadError}</div>
          </div>
        </div>
      )}

      {/* Ingestion Results Summary */}
      {results && results.length > 0 && (
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden shadow-xl space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Files Successfully Ingested</h2>
            </div>
            <button
              onClick={() => navigate(`/investigations/${investigationId}/evidence`)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20"
            >
              <span>Explore Canonical Events</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-cyber-800">
            {results.map((res) => (
              <div key={res.file_id} className="py-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-sm font-semibold text-white">{res.filename}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {res.rows_ok} valid
                    </span>
                    {res.rows_flagged > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {res.rows_flagged} flagged
                      </span>
                    )}
                    {res.rows_failed > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {res.rows_failed} failed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono bg-cyber-950 p-2 rounded border border-cyber-800">
                  <Hash className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-500">SHA-256:</span>
                  <span className="text-cyan-400 truncate">{res.sha256}</span>
                </div>

                {res.errors && res.errors.length > 0 && (
                  <div className="p-3 rounded bg-rose-500/5 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                    <div className="font-semibold text-rose-200">Parse Errors (Retained for provenance):</div>
                    {res.errors.map((err, i) => (
                      <div key={i} className="font-mono">
                        Row {err.row}: {err.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guidance Note */}
      <div className="p-4 rounded-xl bg-cyber-900 border border-cyber-800 text-xs text-slate-400 flex items-start space-x-3">
        <FileSpreadsheet className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-200">Forensic Integrity Policy:</strong> Raw records are stored verbatim in database columns. Timestamps are parsed to UTC. Delayed logs carry relative arrival tags and are never discarded.
        </div>
      </div>
    </div>
  );
};
