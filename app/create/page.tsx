'use client';

// A031 — hold editor ("AI Create"). Works on a draft {name, grade, angle,
// holds[]} handed over via sessionStorage (draft-storage.ts) from:
//   /generate "Edit" (mode new, pre-loaded remix) ·
//   /generate "Start from blank" (mode new, empty board) ·
//   /my-problems/detail "Edit holds" (mode edit → PATCH).
// Interaction = palette + paint: pick a role chip, tap holds on the board.
// Pure transition rules live in editor-state.ts (jest-covered). Role colors
// come from kilter-protocol.PLACEMENT_ROLES — the single source of truth.
// Live BLE: when a board is connected, every paint debounces a sendLEDs
// (300ms, same pattern as the A014 Next/Prev auto-send). Native-only.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  patchMyClimb,
  saveMyClimb,
  ApiError,
} from '@/app/lib/api';
import { GRADES } from '@/app/lib/grades';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BoardMap, { type Placement } from '@/components/BoardMap';
import { useBle } from '@/components/BleProvider';
import { PLACEMENT_ROLES } from '@/lib/ble/kilter-protocol';
import { climbToLedCommands } from '../discover/detail/climb-to-leds';
import placementsData from '@/app/data/placements_12x12.json';
import {
  clearCreateDraft,
  loadCreateDraft,
  type CreateDraft,
  type DraftHold,
} from './draft-storage';
import {
  draftToFrames,
  paintHold,
  validateDraft,
  type PaletteRole,
} from './editor-state';

const PLACEMENTS = placementsData as Placement[];

const ROLE_ID: Record<string, number> = {
  start: 12,
  middle: 13,
  finish: 14,
  foot_only: 15,
};

// '#' + canonical hex from the BLE protocol table — no hexes redeclared.
function roleColor(role: string): string {
  return `#${PLACEMENT_ROLES[ROLE_ID[role]]}`;
}

const PALETTE: Array<{ role: PaletteRole; label: string }> = [
  { role: 'start', label: 'Start' },
  { role: 'middle', label: 'Middle' },
  { role: 'finish', label: 'Finish' },
  { role: 'foot_only', label: 'Foot' },
  { role: 'erase', label: 'Erase' },
];

const ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const PAINT_BLE_DEBOUNCE_MS = 300;

const BLANK_DRAFT: CreateDraft = {
  mode: 'new',
  name: '',
  grade: null,
  angle: 40,
  holds: [],
  timestamp: 0,
};

export default function CreatePage() {
  return (
    <AuthGuard>
      <CreatePageInner />
    </AuthGuard>
  );
}

function CreatePageInner() {
  const router = useRouter();
  // Read the hand-off draft ONCE on mount; missing/stale → blank board.
  const [draft] = useState<CreateDraft>(() => loadCreateDraft() ?? BLANK_DRAFT);

  const [holds, setHolds] = useState<DraftHold[]>(draft.holds);
  const [name, setName] = useState(draft.name);
  const [grade, setGrade] = useState<string>(draft.grade ?? '');
  const [angle, setAngle] = useState(draft.angle);
  const [activeRole, setActiveRole] = useState<PaletteRole>('start');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const isEdit = draft.mode === 'edit';
  const validation = validateDraft(holds);

  const holdColors = useMemo(() => {
    const colors: Record<number, string> = {};
    for (const h of holds) colors[h.placement_id] = roleColor(h.role);
    return colors;
  }, [holds]);

  const handleHoldTap = (placement: Placement) => {
    const next = paintHold(holds, placement.placement_id, placement.set_id, activeRole);
    if (next === holds) return; // no-op (e.g. hand role on a screw-on)
    setHolds(next);
    setDirty(true);
  };

  // Live BLE — debounce a send after each paint, only while connected.
  const { status, sendLEDs } = useBle();
  const isConnected = status === 'connected' || status === 'sending';
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (!isConnected || holds.length === 0) return;
    const timer = setTimeout(() => {
      sendLEDs(
        climbToLedCommands(
          holds.map((h) => ({
            placement_id: h.placement_id,
            role: h.role,
            x: null,
            y: null,
            set_id: null,
          })),
        ),
      );
    }, PAINT_BLE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [holds, isConnected, sendLEDs]);

  const handleClearAll = () => {
    if (holds.length === 0) return;
    if (!window.confirm('Clear all holds?')) return;
    setHolds([]);
    setDirty(true);
  };

  const handleCancel = () => {
    if (dirty && !window.confirm('Discard your changes?')) return;
    clearCreateDraft();
    router.push(isEdit ? `/my-problems/detail?id=${draft.uuid}` : '/generate');
  };

  const handleSave = async () => {
    if (!validation.valid || saving) return;
    if (isEdit && draft.hasLogs) {
      if (!window.confirm('Holds will change; your existing logs stay attached. Save?')) {
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    const frames = draftToFrames(holds);
    const trimmedName = name.trim();
    try {
      let uuid: string;
      if (isEdit && draft.uuid) {
        await patchMyClimb(draft.uuid, {
          frames,
          ...(trimmedName ? { name: trimmedName } : {}),
          ...(grade ? { grade } : {}),
        });
        uuid = draft.uuid;
      } else {
        const saved = await saveMyClimb({
          frames,
          angle,
          seed_climb_uuid: draft.seed_climb_uuid ?? undefined,
          // Empty name → server proposes one (v1 behavior).
          ...(trimmedName ? { name: trimmedName } : {}),
          ...(grade ? { grade } : {}),
        });
        uuid = saved.uuid;
      }
      clearCreateDraft();
      router.push(`/my-problems/detail?id=${uuid}`);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Save failed — try again');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
      <PageHeader
        back={{
          href: isEdit ? `/my-problems/detail?id=${draft.uuid}` : '/generate',
          label: isEdit ? 'Back' : 'AI Create',
          testid: 'back-link',
        }}
        title={isEdit ? 'Edit problem' : 'Create problem'}
      />

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Name + grade + angle */}
        <Card className="p-4 space-y-3" data-testid="editor-meta">
          <input
            data-testid="editor-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            maxLength={60}
            placeholder="Problem name (leave empty for an AI name)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-base font-semibold text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              data-testid="editor-grade"
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setDirty(true);
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-white"
            >
              <option value="">Grade — set later</option>
              {GRADES.map((g) => (
                <option key={g.difficulty} value={`${g.font}/${g.v}`}>
                  {g.font} / {g.v}
                </option>
              ))}
            </select>
            <select
              data-testid="editor-angle"
              value={angle}
              onChange={(e) => {
                setAngle(Number(e.target.value));
                setDirty(true);
              }}
              // Angle is part of the logging key (uuid, angle) — changing it
              // on an existing problem would orphan logs, so edit mode pins it.
              disabled={isEdit}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-white disabled:opacity-60"
            >
              {ANGLES.map((a) => (
                <option key={a} value={a}>
                  {a}°
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Board — tap to paint the selected role */}
        <BoardMap
          placements={PLACEMENTS}
          holdColors={holdColors}
          onHoldClick={handleHoldTap}
        />

        {/* Palette */}
        <div
          data-testid="editor-palette"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {PALETTE.map(({ role, label }) => {
            const selected = activeRole === role;
            const color = role === 'erase' ? undefined : roleColor(role);
            return (
              <button
                key={role}
                type="button"
                data-testid={`palette-${role}`}
                aria-pressed={selected}
                onClick={() => setActiveRole(role)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  selected
                    ? 'border-orange-500 bg-zinc-800 text-white'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {color ? (
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ) : (
                  <span aria-hidden>✕</span>
                )}
                {label}
              </button>
            );
          })}
        </div>

        {isConnected && (
          <p className="text-xs text-center text-emerald-400" data-testid="editor-ble-live">
            Board connected — holds light up as you paint.
          </p>
        )}

        {/* Validation */}
        {!validation.valid && (
          <ul data-testid="editor-validation" className="text-xs text-amber-400 space-y-0.5 text-center">
            {validation.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {saveError && (
          <p data-testid="editor-save-error" className="text-sm text-red-400 text-center">
            {saveError}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            data-testid="editor-save"
            onClick={handleSave}
            loading={saving}
            disabled={!validation.valid}
          >
            Save
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              data-testid="editor-clear"
              onClick={handleClearAll}
              disabled={holds.length === 0}
            >
              Clear all
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              data-testid="editor-cancel"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
