// A019: API client. Auth tokens come from Clerk's session, not localStorage.
//
// In a regular browser/Capacitor build, ClerkProvider exposes
// window.Clerk after hydration. We fetch a fresh JWT for each API call —
// Clerk caches and refreshes the underlying session, so this is cheap.
// On a 401 we retry once after a short delay (covers the gap when Clerk
// is mid-refresh), then bounce the user to /sign-in.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_MOBILE === 'true'
    ? 'https://web-production-cea9.up.railway.app'
    : 'http://localhost:8001');

// --- Error class ---

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// --- Clerk JWT attachment ---

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const token = await window.Clerk?.session?.getToken();
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // ClerkProvider not yet mounted, or session expired — proceed
    // without an Authorization header. The backend will return 401
    // and the redirect-to-sign-in path below will fire.
  }
  return {};
}

// --- Fetch wrapper ---

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };

  // FormData lets the browser pick the multipart boundary itself.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 && !isRetry && typeof window !== 'undefined') {
    // Clerk may be mid-refresh. Wait a beat, retry once before deciding.
    await new Promise((r) => setTimeout(r, 500));
    return apiFetch<T>(path, options, true);
  }

  if (response.status === 401 && typeof window !== 'undefined') {
    // Defensive: only redirect to /sign-in if Clerk has hydrated AND
    // confirms the user is signed out. If Clerk says we ARE signed in
    // and the backend still returned 401, this is a backend misconfig
    // (e.g. Railway missing CLERK_JWKS_URL — backend silently ignores
    // valid Bearer tokens). Redirecting would put the user in a
    // /sign-in ↔ /dashboard loop because Clerk re-redirects an
    // authenticated user out of /sign-in back to a protected page that
    // 401s again. Surface the error instead.
    const clerkUser = window.Clerk?.user;
    const trulySignedOut = clerkUser === null;
    if (trulySignedOut) {
      window.location.href = '/sign-in';
      throw new ApiError(401, 'Sessione scaduta. Effettua di nuovo il login.');
    }
    throw new ApiError(
      401,
      'Il server ha rifiutato una sessione attiva. Riprova fra qualche minuto; se persiste, le credenziali Clerk del backend potrebbero non essere configurate.',
    );
  }

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ detail: 'Errore sconosciuto' }));
    throw new ApiError(response.status, data.detail || 'Errore del server');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// --- Types — Video / Climb / Hold (unchanged from pre-A019) ---

export interface ImprovementItem {
  issue: string;
  fix: string;
  drill: string;
}

export interface FormAnalysis {
  is_kilter_board?: boolean;
  error?: string;
  message?: string;
  technique_score?: number;
  body_tension_score?: number;
  footwork_score?: number;
  hip_positioning_score?: number;
  power_management_score?: number;
  summary?: string;
  strengths?: string[];
  improvements?: ImprovementItem[];
  overall_impression?: string;
  overall_grade_estimate?: string;
  weaknesses?: string[];
  drills_recommended?: string[];
  next_steps?: string;
  [key: string]: unknown;
}

export interface Video {
  id: string;
  user_id: string;
  filename: string | null;
  file_size: number | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  form_analysis: FormAnalysis | null;
  created_at: string;
  completed_at: string | null;
  title: string | null;
  grade_attempted: string | null;
}

// --- Video API ---

export async function uploadVideo(
  file: File,
  title?: string,
  gradeAttempted?: string,
): Promise<Video> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (gradeAttempted) formData.append('grade_attempted', gradeAttempted);

  return apiFetch<Video>('/api/videos/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getVideo(videoId: string): Promise<Video> {
  return apiFetch<Video>(`/api/videos/${videoId}`);
}

export async function getVideos(page = 1, perPage = 20): Promise<Video[]> {
  return apiFetch<Video[]>(`/api/videos?page=${page}&per_page=${perPage}`);
}

export async function deleteVideo(videoId: string): Promise<void> {
  return apiFetch<void>(`/api/videos/${videoId}`, { method: 'DELETE' });
}

// --- Climb / Discovery API (unauthenticated — Discovery is the free tier) ---

export type SortField = 'popularity' | 'quality' | 'grade_asc' | 'grade_desc';

export type MovesFilter = 'any' | 'le5' | '6-7' | '8-10' | 'gt10';

export interface ClimbSearchResult {
  uuid: string;
  name: string;
  setter: string;
  grade: string;
  angle: number;
  ascensionist_count: number;
  quality_average: number;
}

export interface HoldPosition {
  placement_id: number;
  role: string;
  x: number | null;
  y: number | null;
  set_id: number | null;
}

export interface ClimbStats {
  angle: number;
  grade: string;
  difficulty: number;
  ascensionist_count: number;
  quality_average: number;
}

export interface ClimbDetail {
  uuid: string;
  name: string;
  setter: string;
  description: string;
  holds: HoldPosition[];
  stats: ClimbStats[];
}

export interface ClimbSearchParams {
  q?: string;
  angle?: number;
  grade_min?: number;
  grade_max?: number;
  min_ascents?: number;
  min_quality?: number;
  moves?: MovesFilter;
  sort?: SortField;
  limit?: number;
}

export async function searchClimbs(
  params: ClimbSearchParams,
): Promise<ClimbSearchResult[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.angle !== undefined) qs.set('angle', String(params.angle));
  if (params.grade_min !== undefined) qs.set('grade_min', String(params.grade_min));
  if (params.grade_max !== undefined) qs.set('grade_max', String(params.grade_max));
  if (params.min_ascents !== undefined) qs.set('min_ascents', String(params.min_ascents));
  if (params.min_quality !== undefined) qs.set('min_quality', String(params.min_quality));
  if (params.moves && params.moves !== 'any') qs.set('moves', params.moves);
  if (params.sort) qs.set('sort', params.sort);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/api/climbs/search?${qs.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'Search failed' }));
    throw new ApiError(res.status, data.detail || 'Search failed');
  }
  return res.json();
}

export async function getClimbDetail(
  uuid: string,
  angle?: number,
): Promise<ClimbDetail> {
  const qs = angle !== undefined ? `?angle=${angle}` : '';
  const res = await fetch(`${API_BASE}/api/climbs/${uuid}${qs}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'Climb not found' }));
    throw new ApiError(res.status, data.detail || 'Climb not found');
  }
  return res.json();
}
