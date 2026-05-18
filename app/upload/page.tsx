'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import AuthGuard from '@/components/AuthGuard';
import { uploadVideo, ApiError } from '@/app/lib/api';

const MAX_SIZE = 500 * 1024 * 1024; // 500MB

function UploadContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    setError('');
    if (rejectedFiles && (rejectedFiles as Array<{errors: Array<{code: string}>}>).length > 0) {
      const rejection = (rejectedFiles as Array<{errors: Array<{code: string}>}>)[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File troppo grande. Max 500MB.');
      } else {
        setError('Formato non supportato. Usa MP4, MOV o WebM.');
      }
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/webm': ['.webm'],
    },
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled: uploading,
  });

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setUploading(true);
    setProgress(0);

    // Simulate progress (fetch doesn't support upload progress natively)
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 90));
    }, 300);

    try {
      const video = await uploadVideo(file, title || undefined);
      setProgress(100);
      clearInterval(progressInterval);
      setTimeout(() => router.push(`/videos/detail?id=${video.id}`), 500);
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      setUploading(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Upload failed. Please retry.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-4 pt-safe pb-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-black text-[#FF6B35]">CLIMBRITZ</Link>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
            &larr; Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Upload a video</h1>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            isDragActive
              ? 'border-[#FF6B35] bg-[#FF6B35]/10'
              : file
              ? 'border-green-500/50 bg-green-500/5'
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'
          }`}
        >
          <input {...getInputProps()} />

          {file ? (
            <div>
              <div className="text-4xl mb-3">&#9989;</div>
              <p className="text-white font-semibold text-lg">{file.name}</p>
              <p className="text-zinc-400 text-sm mt-1">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              {!uploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-3 text-sm text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Change file
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="text-5xl mb-4">🎬</div>
              <p className="text-white font-semibold text-lg mb-1">
                Drag your video here
              </p>
              <p className="text-zinc-400 text-sm">
                or click to select
              </p>
              <p className="text-zinc-600 text-xs mt-3">
                MP4, MOV, WebM &bull; Max 500MB
              </p>
            </div>
          )}
        </div>

        {/* Title */}
        {file && !uploading && (
          <div className="mt-4">
            <label className="block text-sm text-zinc-400 mb-1.5">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Slab session V4, Red problem gym"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B35] transition-colors"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Uploading…</span>
              <span className="text-[#FF6B35] font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF6B35] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload button */}
        {file && !uploading && (
          <button
            onClick={handleUpload}
            className="mt-6 w-full py-3.5 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold rounded-xl transition-colors text-lg"
          >
            Upload and analyze
          </button>
        )}
      </main>
    </div>
  );
}

export default function UploadPage() {
  return (
    <AuthGuard>
      <UploadContent />
    </AuthGuard>
  );
}
