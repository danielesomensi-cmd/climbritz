'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { getVideo, Video, FormAnalysis, ImprovementItem, ApiError } from '@/app/lib/api';

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-semibold">{score}/10</span>
      </div>
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF6B35] rounded-full transition-all"
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

function ImpressionBadge({ impression }: { impression: string }) {
  const colors: Record<string, string> = {
    flash: 'bg-green-500/20 border-green-500/40 text-green-400',
    onsight: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
    projecting: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
    working: 'bg-red-500/20 border-red-500/40 text-red-400',
  };
  const labels: Record<string, string> = {
    flash: 'Flash',
    onsight: 'Onsight',
    projecting: 'Projecting',
    working: 'Working',
  };
  const key = impression.toLowerCase();
  return (
    <span className={`inline-block px-4 py-1.5 border rounded-xl text-sm font-bold uppercase ${colors[key] || 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
      {labels[key] || impression}
    </span>
  );
}

function AnalysisResults({ analysis }: { analysis: FormAnalysis }) {
  if (analysis.error === 'not_kilter_board') {
    return (
      <div className="bg-zinc-900 border border-yellow-500/30 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">&#9888;&#65039;</div>
        <h2 className="text-lg font-semibold text-white mb-2">Non Kilter Board</h2>
        <p className="text-zinc-400">{analysis.message || 'Questo video non sembra mostrare una Kilter Board.'}</p>
      </div>
    );
  }

  const isNewFormat = 'improvements' in analysis || 'hip_positioning_score' in analysis;

  return (
    <div className="space-y-4">
      {analysis.overall_impression && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <p className="text-sm text-zinc-400 mb-2">Impressione</p>
          <ImpressionBadge impression={analysis.overall_impression} />
        </div>
      )}

      {!isNewFormat && analysis.overall_grade_estimate && (
        <div className="bg-zinc-900 border border-[#FF6B35]/40 rounded-2xl p-6 text-center">
          <p className="text-sm text-zinc-400 mb-2">Grado stimato</p>
          <span className="inline-block px-6 py-3 bg-[#FF6B35] text-white text-3xl font-black rounded-xl">
            {analysis.overall_grade_estimate}
          </span>
        </div>
      )}

      {analysis.summary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wide mb-3">Valutazione</h3>
          <p className="text-zinc-200 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {(analysis.technique_score || analysis.body_tension_score || analysis.footwork_score) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wide mb-4">Punteggi</h3>
          <div className="space-y-3">
            {analysis.technique_score && <ScoreBar label="Tecnica" score={analysis.technique_score} />}
            {analysis.body_tension_score && <ScoreBar label="Tensione corporea" score={analysis.body_tension_score} />}
            {analysis.footwork_score && <ScoreBar label="Footwork" score={analysis.footwork_score} />}
            {analysis.hip_positioning_score && <ScoreBar label="Posizione fianchi" score={analysis.hip_positioning_score} />}
            {analysis.power_management_score && <ScoreBar label="Gestione potenza" score={analysis.power_management_score} />}
          </div>
        </div>
      )}

      {analysis.strengths && analysis.strengths.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">Punti di forza</h3>
          <ul className="space-y-2">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-zinc-300">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.improvements && analysis.improvements.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">Da migliorare</h3>
          <div className="space-y-4">
            {analysis.improvements.map((item: ImprovementItem, i: number) => (
              <div key={i} className="border-l-2 border-yellow-500/40 pl-4">
                <p className="text-zinc-200 text-sm">{item.issue}</p>
                <p className="text-zinc-400 text-sm mt-1">&#8594; {item.fix}</p>
                <p className="text-[#FF6B35] text-sm mt-1">Drill: {item.drill}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isNewFormat && analysis.weaknesses && analysis.weaknesses.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">Da migliorare</h3>
          <ul className="space-y-2">
            {analysis.weaknesses.map((w: string, i: number) => (
              <li key={i} className="flex items-start gap-3 text-zinc-300">
                <span className="text-yellow-400 mt-0.5">&#9888;&#65039;</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isNewFormat && analysis.drills_recommended && analysis.drills_recommended.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wide mb-3">Esercizi consigliati</h3>
          <ul className="space-y-2">
            {analysis.drills_recommended.map((drill: string, i: number) => (
              <li key={i} className="flex items-start gap-3 text-zinc-300">
                <span className="text-[#FF6B35]">&#8226;</span>
                <span>{drill}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isNewFormat && analysis.next_steps && (
        <div className="bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wide mb-2">Prossimo passo</h3>
          <p className="text-zinc-200 leading-relaxed">{analysis.next_steps}</p>
        </div>
      )}
    </div>
  );
}

function VideoContent() {
  const searchParams = useSearchParams();
  const videoId = searchParams?.get('id') ?? '';
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVideo = useCallback(async () => {
    if (!videoId) return null;
    try {
      const data = await getVideo(videoId);
      setVideo(data);
      return data;
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  useEffect(() => {
    if (!video || video.processing_status !== 'processing') return;
    const interval = setInterval(async () => {
      const updated = await fetchVideo();
      if (updated && updated.processing_status !== 'processing') {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [video?.processing_status, fetchVideo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Video non trovato</p>
          <Link href="/dashboard" className="text-[#FF6B35] hover:underline">Torna alla dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-black text-[#FF6B35]">KILTER UP</Link>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">&larr; Dashboard</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white truncate">{video.title || video.filename || 'Video'}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {new Date(video.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {video.grade_attempted && <span className="ml-3 text-zinc-400">Grado tentato: {video.grade_attempted}</span>}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        {video.processing_status === 'pending' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">&#127916;</div>
            <h2 className="text-lg font-semibold text-white mb-2">Video in coda</h2>
            <p className="text-zinc-400">L&apos;analisi partir&agrave; a breve...</p>
          </div>
        )}

        {video.processing_status === 'processing' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#FF6B35]/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Analisi in corso</h2>
            <p className="text-zinc-400">Gemini sta analizzando la tua tecnica...</p>
          </div>
        )}

        {video.processing_status === 'failed' && (
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">&#10060;</div>
            <h2 className="text-lg font-semibold text-white mb-2">Analisi fallita</h2>
            <p className="text-zinc-400 mb-6">Si &egrave; verificato un errore durante l&apos;analisi del video.</p>
            <Link href="/upload" className="px-8 py-3 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold rounded-xl transition-colors inline-block">
              Carica un nuovo video
            </Link>
          </div>
        )}

        {video.processing_status === 'completed' && video.form_analysis && (
          <AnalysisResults analysis={video.form_analysis} />
        )}
      </main>
    </div>
  );
}

export default function VideoDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <AuthGuard>
        <VideoContent />
      </AuthGuard>
    </Suspense>
  );
}
