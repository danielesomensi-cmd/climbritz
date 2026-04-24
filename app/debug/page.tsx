'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '@/app/lib/api';

interface TestResult {
  name: string;
  url: string;
  status: 'pending' | 'ok' | 'fail';
  httpStatus?: number;
  body?: string;
  error?: string;
  errorStack?: string;
  durationMs?: number;
}

const TESTS: { name: string; url: string }[] = [
  { name: 'Railway /health', url: 'https://web-production-cea9.up.railway.app/health' },
  { name: 'Railway /api/climbs/stats', url: 'https://web-production-cea9.up.railway.app/api/climbs/stats' },
  { name: 'External HTTPS (jsonplaceholder)', url: 'https://jsonplaceholder.typicode.com/todos/1' },
  { name: 'API_BASE /health', url: `${API_BASE}/health` },
  { name: 'httpbin (no CORS)', url: 'https://httpbin.org/get' },
];

function getEnvInfo(): Record<string, string> {
  const info: Record<string, string> = {};
  info['API_BASE'] = API_BASE;
  info['window.location.href'] = typeof window !== 'undefined' ? window.location.href : 'SSR';
  info['window.location.origin'] = typeof window !== 'undefined' ? window.location.origin : 'SSR';
  info['window.location.protocol'] = typeof window !== 'undefined' ? window.location.protocol : 'SSR';
  info['navigator.userAgent'] = typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR';
  info['Capacitor defined'] = typeof window !== 'undefined' ? String(!!(window as any).Capacitor) : 'SSR';
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const cap = (window as any).Capacitor;
    info['Capacitor.platform'] = cap.getPlatform?.() ?? cap.platform ?? 'unknown';
    info['Capacitor.isNativePlatform'] = String(cap.isNativePlatform?.() ?? 'unknown');
  }
  return info;
}

async function runTest(url: string): Promise<Omit<TestResult, 'name'>> {
  const start = Date.now();
  try {
    const res = await fetch(url, { mode: 'cors' });
    const duration = Date.now() - start;
    let body = '';
    try {
      body = await res.text();
      if (body.length > 300) body = body.slice(0, 300) + '…';
    } catch {
      body = '(could not read body)';
    }
    return {
      url,
      status: res.ok ? 'ok' : 'fail',
      httpStatus: res.status,
      body,
      durationMs: duration,
    };
  } catch (e: any) {
    const duration = Date.now() - start;
    return {
      url,
      status: 'fail',
      error: `${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`,
      errorStack: e?.stack?.slice(0, 500),
      durationMs: duration,
    };
  }
}

export default function DebugPage() {
  const [results, setResults] = useState<TestResult[]>(
    TESTS.map((t) => ({ ...t, status: 'pending' as const })),
  );
  const [envInfo, setEnvInfo] = useState<Record<string, string>>({});
  const [noCorsFetchResult, setNoCorsFetchResult] = useState<string>('pending');
  const [xhrResult, setXhrResult] = useState<string>('pending');

  useEffect(() => {
    setEnvInfo(getEnvInfo());

    // Run all fetch tests
    TESTS.forEach((test, idx) => {
      runTest(test.url).then((r) => {
        setResults((prev) => {
          const next = [...prev];
          next[idx] = { name: test.name, ...r };
          return next;
        });
      });
    });

    // Test fetch with no-cors mode
    fetch('https://web-production-cea9.up.railway.app/health', { mode: 'no-cors' })
      .then((res) => {
        setNoCorsFetchResult(`opaque response, type=${res.type}, status=${res.status}`);
      })
      .catch((e: any) => {
        setNoCorsFetchResult(`${e?.name}: ${e?.message}`);
      });

    // Test XMLHttpRequest as alternative to fetch
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://web-production-cea9.up.railway.app/health');
      xhr.onload = () => {
        setXhrResult(`status=${xhr.status} body=${xhr.responseText.slice(0, 200)}`);
      };
      xhr.onerror = () => {
        setXhrResult(`onerror fired, status=${xhr.status}, statusText=${xhr.statusText}`);
      };
      xhr.ontimeout = () => {
        setXhrResult('timeout');
      };
      xhr.timeout = 10000;
      xhr.send();
    } catch (e: any) {
      setXhrResult(`throw: ${e?.name}: ${e?.message}`);
    }
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-safe px-4 pb-4 font-mono text-xs">
      <div className="max-w-lg mx-auto space-y-4">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          &larr; Home
        </Link>
        <h1 className="text-xl font-bold text-yellow-400">Network Diagnostic</h1>

        {/* Environment */}
        <section className="bg-zinc-900 rounded-lg p-3 space-y-1">
          <h2 className="text-sm font-bold text-zinc-300 mb-2">Environment</h2>
          {Object.entries(envInfo).map(([k, v]) => (
            <div key={k} className="break-all">
              <span className="text-zinc-500">{k}:</span>{' '}
              <span className="text-green-300">{v}</span>
            </div>
          ))}
        </section>

        {/* Fetch tests */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">Fetch Tests (mode: cors)</h2>
          {results.map((r) => (
            <div
              key={r.name}
              className={`rounded-lg p-3 border ${
                r.status === 'pending'
                  ? 'border-zinc-700 bg-zinc-900'
                  : r.status === 'ok'
                    ? 'border-green-700 bg-green-950'
                    : 'border-red-700 bg-red-950'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold">
                  {r.status === 'pending' ? '⏳' : r.status === 'ok' ? '✅' : '❌'} {r.name}
                </span>
                {r.durationMs !== undefined && (
                  <span className="text-zinc-500">{r.durationMs}ms</span>
                )}
              </div>
              <div className="text-zinc-400 break-all">{r.url}</div>
              {r.httpStatus !== undefined && (
                <div className="mt-1">
                  HTTP {r.httpStatus}
                </div>
              )}
              {r.body && (
                <div className="mt-1 text-zinc-300 break-all">{r.body}</div>
              )}
              {r.error && (
                <div className="mt-1 text-red-300 break-all">{r.error}</div>
              )}
              {r.errorStack && (
                <details className="mt-1">
                  <summary className="text-zinc-500 cursor-pointer">Stack trace</summary>
                  <pre className="text-red-400 whitespace-pre-wrap break-all mt-1">
                    {r.errorStack}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </section>

        {/* no-cors test */}
        <section className="bg-zinc-900 rounded-lg p-3">
          <h2 className="text-sm font-bold text-zinc-300 mb-1">
            fetch /health (mode: no-cors)
          </h2>
          <div className="break-all text-zinc-300">{noCorsFetchResult}</div>
        </section>

        {/* XHR test */}
        <section className="bg-zinc-900 rounded-lg p-3">
          <h2 className="text-sm font-bold text-zinc-300 mb-1">
            XMLHttpRequest /health
          </h2>
          <div className="break-all text-zinc-300">{xhrResult}</div>
        </section>

        <p className="text-zinc-600 text-center pt-4">
          Screenshot this page and share for debugging.
        </p>
      </div>
    </main>
  );
}
