'use client';

// Field diagnostics for the board link: what the app detected on connect
// (picked vs advertised name, API level, write characteristic properties),
// the outcome of the last write, manual write-mode switch, and a "Try all"
// run that sends the same pattern with every API level × write mode combo,
// 5 s each, so whoever stands at the wall can say which one lights it.

import { useEffect, useRef, useState } from 'react';
import { useBle } from '@/components/BleProvider';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  getBleDiagnostics,
  setWriteMode,
  type BleDiagnostics,
  type WriteMode,
} from '@/lib/ble/kilter-board-service';
import type { EncoderHold } from '@/lib/ble/kilter-protocol';

const STEP_MS = 5000;

export const COMBOS: Array<{ apiLevel: number; writeMode: WriteMode }> = [
  { apiLevel: 2, writeMode: 'withResponse' },
  { apiLevel: 3, writeMode: 'withResponse' },
  { apiLevel: 2, writeMode: 'withoutResponse' },
  { apiLevel: 3, writeMode: 'withoutResponse' },
];

const MODE_LABEL: Record<WriteMode, string> = {
  withResponse: 'with response',
  withoutResponse: 'without response',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function DiagnosticsPanel({ holds }: { holds: EncoderHold[] }) {
  const { connectedDevice, sendLEDs, setProtocol } = useBle();
  const deviceId = connectedDevice?.deviceId ?? null;
  const [diag, setDiag] = useState<BleDiagnostics | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const cancelledRef = useRef(false);

  // Live view of the service caches (they change on every write).
  useEffect(() => {
    if (!deviceId) {
      setDiag(null);
      return;
    }
    const read = () => setDiag(getBleDiagnostics(deviceId));
    read();
    const id = setInterval(read, 500);
    return () => clearInterval(id);
  }, [deviceId]);

  useEffect(() => () => {
    cancelledRef.current = true;
  }, []);

  if (!deviceId || !diag) return null;

  const toggleWriteMode = () => {
    setWriteMode(deviceId, diag.writeMode === 'withResponse' ? 'withoutResponse' : 'withResponse');
    setDiag(getBleDiagnostics(deviceId));
  };

  const tryAll = async () => {
    const initial = { apiLevel: diag.apiLevel, writeMode: diag.writeMode };
    setDone(false);
    for (let i = 0; i < COMBOS.length; i++) {
      if (cancelledRef.current) return;
      setStep(i);
      setProtocol(COMBOS[i].apiLevel);
      setWriteMode(deviceId, COMBOS[i].writeMode);
      await sendLEDs(holds);
      await sleep(STEP_MS);
    }
    setProtocol(initial.apiLevel);
    setWriteMode(deviceId, initial.writeMode);
    setStep(null);
    setDone(true);
  };

  const running = step !== null;
  const lw = diag.lastWrite;

  return (
    <Card className="mb-4 p-3 text-xs" data-testid="ble-diagnostics">
      <div className="mb-2 text-sm font-semibold">Diagnostics</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-text-tertiary">
        <dt>Picked name</dt>
        <dd className="text-text-primary break-all">{diag.pickedName ?? '—'}</dd>
        <dt>Advertised</dt>
        <dd className="text-text-primary break-all">{diag.advertisedName ?? '—'}</dd>
        <dt>API level</dt>
        <dd className="text-text-primary">v{diag.apiLevel}</dd>
        <dt>Write mode</dt>
        <dd className="text-text-primary">{MODE_LABEL[diag.writeMode]}</dd>
        <dt>Write props</dt>
        <dd className="text-text-primary break-all" data-testid="ble-diag-props">{diag.writeProps}</dd>
        <dt>Last write</dt>
        <dd className={lw ? (lw.ok ? 'text-emerald-400' : 'text-red-400') : 'text-text-primary'} data-testid="ble-diag-last">
          {lw
            ? `${lw.ok ? 'OK' : 'FAILED'} · v${lw.apiLevel} · ${MODE_LABEL[lw.writeMode]} · ${lw.chunks} chunks · ${lw.ms} ms${lw.error ? ` · ${lw.error}` : ''}`
            : 'none yet'}
        </dd>
      </dl>

      {running && (
        <div className="mt-3 rounded bg-amber-900/40 p-2 text-base font-bold text-amber-200" data-testid="ble-diag-step">
          Step {step + 1}/{COMBOS.length}: API v{COMBOS[step].apiLevel} · {MODE_LABEL[COMBOS[step].writeMode]}
          <div className="text-xs font-normal">Is the board lit now? Note the step number.</div>
        </div>
      )}
      {done && !running && (
        <div className="mt-3 text-amber-200">Done — tell which step (1–4) lit the board.</div>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={toggleWriteMode} disabled={running}>
          Write: {MODE_LABEL[diag.writeMode]} ⇄
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => void tryAll()}
          disabled={running || holds.length === 0}
          data-testid="ble-diag-try-all"
        >
          Try all 4
        </Button>
      </div>
    </Card>
  );
}
