// A019: API client. Auth tokens come from Clerk's session, not localStorage.
//
// In a regular browser/Capacitor build, ClerkProvider exposes
// window.Clerk after hydration. We fetch a fresh JWT for each API call —
// Clerk caches and refreshes the underlying session, so this is cheap.
// On a 401 we retry once after a short delay (covers the gap when Clerk
// is mid-refresh), then bounce the user to /sign-in.

// Mobile builds always hit Railway — the device has no localhost:8001.
// NEXT_PUBLIC_API_URL only affects web/dev builds; in mobile builds it's
// ignored so a developer-local `.env.local` can't leak into the APK.
export const API_BASE =
  process.env.NEXT_PUBLIC_MOBILE === 'true'
    ? 'https://web-production-cea9.up.railway.app'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

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

// A021: every request carries the user's IANA tz name so the backend can
// resolve local_date correctly when logging climbs. Browser/Capacitor
// both expose Intl. Failure (older WebViews, mocked envs) → silently
// drop the header, backend falls back to UTC.
function getTimezoneHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return { 'X-User-Timezone': tz };
  } catch {
    // ignore
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
  const tzHeader = getTimezoneHeader();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...tzHeader,
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
      throw new ApiError(401, 'Session expired. Please sign in again.');
    }
    throw new ApiError(
      401,
      'The server rejected an active session. Retry in a few minutes; if it persists, the backend Clerk credentials may not be configured.',
    );
  }

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, data.detail || 'Server error');
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

// A021.4 — chip filter values. Backend accepts the same three on
// done_filter and project_filter query params (Phase 2 work).
export type DoneFilter = 'all' | 'only' | 'exclude';
export type ProjectFilter = 'all' | 'only' | 'exclude';

export interface ClimbSearchResult {
  uuid: string;
  name: string;
  setter: string;
  grade: string;
  angle: number;
  ascensionist_count: number;
  quality_average: number;
  /** A021.4 — populated only when the request is authenticated AND the
   *  backend found a user_climbs row for this (uuid, angle). Discovery
   *  uses it to render ⚡/✓/☆ icons on each card. */
  user_state?: UserClimbState | null;
}

// B020: /api/climbs/search now returns an envelope so the client can
// surface an overflow banner when total_count > climbs.length without a
// second request.
export interface ClimbSearchResponse {
  climbs: ClimbSearchResult[];
  total_count: number;
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
  // A022 — when true, restrict to benchmark climbs at the selected angle.
  benchmark?: boolean;
  sort?: SortField;
  limit?: number;
  // A021.4 — chip filter params. Omit or pass 'all' to skip the filter
  // server-side. Authenticated requests only; backend ignores them
  // when the JWT is absent.
  done_filter?: DoneFilter;
  project_filter?: ProjectFilter;
}

export async function searchClimbs(
  params: ClimbSearchParams,
): Promise<ClimbSearchResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.angle !== undefined) qs.set('angle', String(params.angle));
  if (params.grade_min !== undefined) qs.set('grade_min', String(params.grade_min));
  if (params.grade_max !== undefined) qs.set('grade_max', String(params.grade_max));
  if (params.min_ascents !== undefined) qs.set('min_ascents', String(params.min_ascents));
  if (params.min_quality !== undefined) qs.set('min_quality', String(params.min_quality));
  if (params.moves && params.moves !== 'any') qs.set('moves', params.moves);
  if (params.benchmark) qs.set('benchmark', 'true');
  if (params.sort) qs.set('sort', params.sort);
  if (params.done_filter && params.done_filter !== 'all') qs.set('done_filter', params.done_filter);
  if (params.project_filter && params.project_filter !== 'all') qs.set('project_filter', params.project_filter);
  // B020: backend default is now 500 (hard cap). Callers omit `limit`
  // unless they specifically want a smaller window (e.g. autocomplete).
  if (params.limit !== undefined) qs.set('limit', String(params.limit));

  // A021: route through apiFetch so the Clerk JWT + X-User-Timezone are
  // attached. Backend uses the JWT to overlay user_state on each result.
  return apiFetch<ClimbSearchResponse>(`/api/climbs/search?${qs.toString()}`);
}

export async function getClimbDetail(
  uuid: string,
  angle?: number,
): Promise<ClimbDetail> {
  const qs = angle !== undefined ? `?angle=${angle}` : '';
  return apiFetch<ClimbDetail>(`/api/climbs/${uuid}${qs}`);
}

// --- A021: Logs / user_climbs API ---

export type LogResultType = 'flash' | 'send' | 'attempt';
export type BestResult = 'flash' | 'send';

export interface ClimbLogResponse {
  id: string;
  user_id: string;
  climb_uuid: string;
  angle: number;
  local_date: string;
  result_type: LogResultType;
  attempts_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserClimbState {
  climb_uuid: string;
  angle: number;
  is_project: boolean;
  best_result: BestResult | null;
  last_logged_at: string | null;
}

export interface UserClimbDetail {
  state: UserClimbState | null;
  recent_logs: ClimbLogResponse[];
}

export interface LogCreateResponse {
  log: ClimbLogResponse;
  user_state: UserClimbState;
}

/** Create or upgrade today's log. Returns the persisted log + updated
 *  user_climbs row in one envelope so the UI doesn't need a follow-up GET. */
export async function createLog(
  climbUuid: string,
  angle: number,
  resultType: LogResultType,
): Promise<LogCreateResponse> {
  return apiFetch<LogCreateResponse>('/api/logs', {
    method: 'POST',
    body: JSON.stringify({
      climb_uuid: climbUuid,
      angle,
      result_type: resultType,
    }),
  });
}

export async function deleteLog(logId: string): Promise<void> {
  return apiFetch<void>(`/api/logs/${logId}`, { method: 'DELETE' });
}

/** Get current user state for a climb at an angle, plus the most recent
 *  N logs (default 20 server-side). Used by LogSection + RecentLogs. */
export async function getUserClimb(
  climbUuid: string,
  angle: number,
): Promise<UserClimbDetail> {
  return apiFetch<UserClimbDetail>(
    `/api/user-climbs/${climbUuid}?angle=${angle}`,
  );
}

/** Toggle the project flag. Always submits the desired state explicitly
 *  rather than asking the server to flip — keeps client/server agreement
 *  predictable if a request retries. */
export async function patchUserClimbProject(
  climbUuid: string,
  angle: number,
  isProject: boolean,
): Promise<UserClimbState> {
  return apiFetch<UserClimbState>(
    `/api/user-climbs/${climbUuid}/project`,
    {
      method: 'PATCH',
      body: JSON.stringify({ angle, is_project: isProject }),
    },
  );
}

// --- A021.5 — /history page: sessions / pyramid / trend ---

export interface SessionClimb {
  climb_uuid: string;
  angle: number;
  result_type: LogResultType;
  attempts_count: number;
  log_id: string;
  climb_name: string | null;
  grade: string | null;
}

export interface SessionResponse {
  date: string;
  total_climbs: number;
  sends: number;
  flashes: number;
  attempts: number;
  climbs: SessionClimb[];
}

export type PyramidResultFilter = 'flash' | 'send_or_better' | 'all';

export interface PyramidEntry {
  grade_band: string;
  count: number;
}

export interface TrendEntry {
  week_start: string;
  flash_count: number;
  send_count: number;
  attempt_count: number;
}

function buildDateRangeQs(
  dateFrom?: string,
  dateTo?: string,
  extra?: Record<string, string | undefined>,
): string {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set('from', dateFrom);
  if (dateTo) qs.set('to', dateTo);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) qs.set(k, v);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** GET /api/logs/sessions — daily session summaries. Each climb in the
 *  list carries name + grade resolved server-side from BoardLib. */
export async function getSessions(
  dateFrom?: string,
  dateTo?: string,
): Promise<SessionResponse[]> {
  return apiFetch<SessionResponse[]>(
    `/api/logs/sessions${buildDateRangeQs(dateFrom, dateTo)}`,
  );
}

/** GET /api/stats/pyramid — counts grouped by grade band. */
export async function getPyramid(
  dateFrom?: string,
  dateTo?: string,
  resultFilter: PyramidResultFilter = 'send_or_better',
): Promise<PyramidEntry[]> {
  return apiFetch<PyramidEntry[]>(
    `/api/stats/pyramid${buildDateRangeQs(dateFrom, dateTo, {
      result_filter: resultFilter,
    })}`,
  );
}

/** GET /api/stats/trend — counts by ISO week (Monday-anchored). */
export async function getTrend(
  dateFrom?: string,
  dateTo?: string,
): Promise<TrendEntry[]> {
  return apiFetch<TrendEntry[]>(
    `/api/stats/trend${buildDateRangeQs(dateFrom, dateTo)}`,
  );
}
