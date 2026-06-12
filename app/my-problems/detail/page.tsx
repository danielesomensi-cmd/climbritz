'use client';

// A030 — My Problems detail: board visualization + BLE light-up + logging,
// reusing the exact /discover/detail stack (ClimbBoardView, ClimbBleControls,
// LogSection, RecentLogs — generated holds resolve positions from static
// data, same as /generate). Inline tap-to-edit for name + grade (PATCH on
// blur), delete with confirm. Query-param routing (Capacitor-safe).

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  deleteMyClimb,
  getMyClimbDetail,
  getUserClimb,
  patchMyClimb,
  type MyClimbDetail,
  type UserClimbDetail,
} from '@/app/lib/api';
import ClimbBoardView, { ROLE_COLORS } from '@/components/ClimbBoardView';
import ClimbBleControls from '@/components/ClimbBleControls';
import GradeDisplay from '@/components/GradeDisplay';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import PageHeader from '@/components/ui/PageHeader';
import LoadingState from '@/components/ui/LoadingState';
import LogSection from '@/components/LogSection';
import RecentLogs from '@/components/RecentLogs';
import { climbToLedCommands } from '../../discover/detail/climb-to-leds';

const ROLE_LABELS: Record<string, string> = {
  start: 'Start',
  middle: 'Middle',
  finish: 'Finish',
  foot_only: 'Foot',
};

export default function MyProblemDetailPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="min-h-dvh bg-zinc-950" />}>
        <MyProblemDetailPageInner />
      </Suspense>
    </AuthGuard>
  );
}

function MyProblemDetailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uuid = searchParams?.get('id') ?? '';

  const [problem, setProblem] = useState<MyClimbDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userClimb, setUserClimb] = useState<UserClimbDetail | null>(null);

  // Inline edit state — tap to edit, PATCH on blur.
  const [editingName, setEditingName] = useState(false);
  const [editingGrade, setEditingGrade] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftGrade, setDraftGrade] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMyClimbDetail(uuid)
      .then((data) => {
        if (!cancelled) setProblem(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load problem');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uuid]);

  // A021 stack — user_climb state (logs) for LogSection/RecentLogs.
  useEffect(() => {
    if (!uuid || !problem) {
      setUserClimb(null);
      return;
    }
    let cancelled = false;
    getUserClimb(uuid, problem.angle)
      .then((data) => {
        if (!cancelled) setUserClimb(data);
      })
      .catch(() => {
        if (!cancelled) setUserClimb(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uuid, problem]);

  const ledCommands = useMemo(
    () => (problem ? climbToLedCommands(problem.holds) : []),
    [problem],
  );

  const roleCounts = problem
    ? problem.holds.reduce<Record<string, number>>((acc, h) => {
        acc[h.role] = (acc[h.role] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  const commitName = async () => {
    setEditingName(false);
    if (!problem) return;
    const name = draftName.trim();
    if (!name || name === problem.name) return;
    try {
      const updated = await patchMyClimb(problem.uuid, { name });
      setProblem({ ...problem, name: updated.name });
    } catch {
      // keep the old name on failure — silent, the field just reverts
    }
  };

  const commitGrade = async () => {
    setEditingGrade(false);
    if (!problem) return;
    const grade = draftGrade.trim();
    if (!grade || grade === problem.grade) return;
    try {
      const updated = await patchMyClimb(problem.uuid, { grade });
      setProblem({ ...problem, grade: updated.grade });
    } catch {
      // revert silently
    }
  };

  const handleDelete = async () => {
    if (!problem || deleting) return;
    if (!window.confirm(`Delete “${problem.name}”? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMyClimb(problem.uuid);
      router.push('/my-problems');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
      <PageHeader
        back={{ href: '/my-problems', label: 'My Problems', testid: 'back-link' }}
      />

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {loading && (
          <div data-testid="detail-loading">
            <LoadingState />
          </div>
        )}

        {error && (
          <div data-testid="detail-error" className="text-center py-12 text-red-400">
            {error}
          </div>
        )}

        {problem && (
          <>
            {/* Title block — tap name/grade to edit (PATCH on blur). */}
            <div className="flex items-start gap-4">
              {editingGrade ? (
                <input
                  data-testid="grade-input"
                  autoFocus
                  value={draftGrade}
                  onChange={(e) => setDraftGrade(e.target.value)}
                  onBlur={commitGrade}
                  onKeyDown={(e) => e.key === 'Enter' && commitGrade()}
                  className="w-20 bg-zinc-800 border border-orange-500 rounded px-2 py-2 text-sm text-white"
                />
              ) : (
                <button
                  type="button"
                  data-testid="grade-edit-btn"
                  onClick={() => {
                    setDraftGrade(problem.grade ?? '');
                    setEditingGrade(true);
                  }}
                  title="Tap to edit grade"
                >
                  <GradeDisplay grade={problem.grade ?? '?'} size="lg" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <input
                    data-testid="name-input"
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => e.key === 'Enter' && commitName()}
                    className="w-full bg-zinc-800 border border-orange-500 rounded px-2 py-1 text-xl font-bold text-white"
                  />
                ) : (
                  <h1
                    className="text-xl font-bold truncate cursor-pointer"
                    data-testid="problem-name"
                    onClick={() => {
                      setDraftName(problem.name);
                      setEditingName(true);
                    }}
                    title="Tap to edit name"
                  >
                    {problem.name}
                  </h1>
                )}
                <div className="text-sm text-zinc-400">
                  AI-generated · {problem.angle}° ·{' '}
                  {problem.ascent_count}{' '}
                  {problem.ascent_count === 1 ? 'ascent' : 'ascents'}
                </div>
              </div>
            </div>

            {/* BLE — same control bar as /discover/detail. */}
            <ClimbBleControls ledCommands={ledCommands} climbKey={problem.uuid} />

            {/* A021 logging — flash/send/attempt + project toggle. */}
            <LogSection
              climbUuid={problem.uuid}
              angle={problem.angle}
              detail={userClimb}
              onMutated={(next) => {
                setUserClimb(next);
                // Keep the header ascent count live after a log.
                getMyClimbDetail(problem.uuid)
                  .then((fresh) =>
                    setProblem((p) => (p ? { ...p, ascent_count: fresh.ascent_count } : p)),
                  )
                  .catch(() => {});
              }}
            />

            <div className="mx-auto max-w-[280px]">
              <ClimbBoardView holds={problem.holds} />
            </div>

            {/* Role legend */}
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: ROLE_COLORS[role] }}
                  />
                  <span className="text-zinc-300">
                    {label}
                    {roleCounts[role] ? ` (${roleCounts[role]})` : ''}
                  </span>
                </div>
              ))}
            </div>

            {userClimb && userClimb.recent_logs.length > 0 && (
              <RecentLogs logs={userClimb.recent_logs} limit={10} />
            )}

            <button
              type="button"
              data-testid="delete-btn"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full py-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete problem'}
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
