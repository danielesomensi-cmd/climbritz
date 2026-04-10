'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { getVideos, clearToken, Video } from '@/app/lib/api';

const STATUS_BADGE: Record<Video['processing_status'], { bg: string; label: string }> = {
  pending:    { bg: 'bg-yellow-500', label: 'In attesa' },
  processing: { bg: 'bg-blue-500',   label: 'Analisi...' },
  completed:  { bg: 'bg-green-500',  label: 'Completato' },
  failed:     { bg: 'bg-red-500',    label: 'Errore' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function DashboardContent() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVideos()
      .then(setVideos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-[#FF6B35]">KILTER UP</Link>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Esci
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">I tuoi video</h1>
          <Link
            href="/upload"
            className="px-4 py-2.5 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            + Carica video
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-xl font-semibold text-white mb-2">Nessun video ancora</h2>
            <p className="text-zinc-400 mb-6">
              Carica il tuo primo video di arrampicata per ricevere un&apos;analisi AI della tua tecnica.
            </p>
            <Link
              href="/upload"
              className="inline-block px-6 py-3 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold rounded-xl transition-colors"
            >
              Carica il tuo primo video
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => {
              const badge = STATUS_BADGE[video.processing_status];
              return (
                <Link
                  key={video.id}
                  href={`/videos/detail?id=${video.id}`}
                  className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white font-medium truncate">
                          {video.title || video.filename || 'Video'}
                        </span>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold text-white ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-zinc-500">
                        <span>{formatDate(video.created_at)}</span>
                        {video.file_size && <span>{formatSize(video.file_size)}</span>}
                      </div>
                    </div>
                    {(video.form_analysis?.overall_impression || video.form_analysis?.overall_grade_estimate) && (
                      <div className="ml-4 px-3 py-1.5 bg-[#FF6B35]/20 border border-[#FF6B35]/40 rounded-xl">
                        <span className="text-[#FF6B35] font-bold text-sm uppercase">
                          {video.form_analysis.overall_impression || video.form_analysis.overall_grade_estimate}
                        </span>
                      </div>
                    )}
                    <svg className="ml-3 w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
