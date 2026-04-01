const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

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
