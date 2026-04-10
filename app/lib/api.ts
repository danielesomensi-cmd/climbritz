const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_MOBILE === 'true'
    ? 'https://web-production-cea9.up.railway.app'
    : 'http://localhost:8001');

// --- Token management ---

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('kilter_token');
}

export function setToken(token: string) {
  localStorage.setItem('kilter_token', token);
}

export function clearToken() {
  localStorage.removeItem('kilter_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// --- Error class ---

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// --- Fetch wrapper ---

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Sessione scaduta. Effettua di nuovo il login.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }));
    throw new ApiError(response.status, data.detail || 'Errore del server');
  }

  // 204 No Content (e.g. DELETE)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// --- Types ---

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  full_name: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImprovementItem {
  issue: string;
  fix: string;
  drill: string;
}

export interface FormAnalysis {
  // New format (B007+)
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
  // Old format fields (backward compat with pre-B007 records)
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

// --- Auth API ---

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setToken(res.access_token);
  return res;
}

export async function register(data: RegisterRequest): Promise<User> {
  return apiFetch<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMe(): Promise<User> {
  return apiFetch<User>('/api/auth/me');
}

// --- Video API ---

export async function uploadVideo(file: File, title?: string, gradeAttempted?: string): Promise<Video> {
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

// --- Climb / Discovery API ---

export type SortField = 'popularity' | 'quality' | 'grade_asc' | 'grade_desc';

export interface ClimbSearchResult {
  uuid: string;
  name: string;
  setter: string;
  grade: string;        // "6a/V3"
  angle: number;
  ascensionist_count: number;
  quality_average: number;
}

export interface HoldPosition {
  placement_id: number;
  role: string;         // 'start' | 'middle' | 'finish' | 'foot_only'
  x: number | null;
  y: number | null;
  set_id: number | null; // 1 = Bolt Ons (handholds), 20 = Screw Ons (footholds)
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
  /** Optional name query. Omit for browse-by-filter mode (B012). */
  q?: string;
  angle?: number;
  grade_min?: number;
  grade_max?: number;
  min_ascents?: number;
  min_quality?: number;
  sort?: SortField;
  limit?: number;
}

/**
 * Unauthenticated climb search. Discovery is the free tier, so no
 * Authorization header is required — we call the raw fetch path directly
 * so we don't accidentally trigger the 401 → /login redirect baked into
 * apiFetch when no token is present.
 */
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
