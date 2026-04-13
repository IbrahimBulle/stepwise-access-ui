const API_BASE = import.meta.env.VITE_API_BASE || "https://mental-health-hub-ue25.onrender.com";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  language: string;
  role: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem("auth_token");
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem("auth_token", token);
    else localStorage.removeItem("auth_token");
  }

  getToken() {
    return this.token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.message || "Request failed");
    }

    return res.json();
  }

  // Auth
  register(data: { name: string; email: string; password: string; language: string; role: string }) {
    return this.request<AuthResponse>("POST", "/api/auth/register", data);
  }

  login(data: { email: string; password: string }) {
    return this.request<AuthResponse>("POST", "/api/auth/login", data);
  }

  getMe() {
    return this.request<AuthUser>("GET", "/api/me");
  }

  // Dashboard
  getDashboardSummary() {
    return this.request<any>("GET", "/api/dashboard/summary");
  }

  // Checkins
  createCheckin(data: { mood: number; stress: number; anxiety: number; sleep_hours: number; note: string; phq9_answers?: number[] }) {
    return this.request<any>("POST", "/api/checkins", data);
  }

  getCheckins() {
    return this.request<any[]>("GET", "/api/checkins");
  }

  // Journal
  createJournal(data: { entry: string }) {
    return this.request<any>("POST", "/api/journal", data);
  }

  getJournal() {
    return this.request<any[]>("GET", "/api/journal");
  }

  // Reminders
  createReminder(data: { title: string; schedule_time: string }) {
    return this.request<any>("POST", "/api/reminders", data);
  }

  getReminders() {
    return this.request<any[]>("GET", "/api/reminders");
  }

  // Appointments
  createAppointment(data: { therapist: string; session_mode: string; appointment_time: string }) {
    return this.request<any>("POST", "/api/appointments", data);
  }

  getAppointments() {
    return this.request<any[]>("GET", "/api/appointments");
  }

  // Community
  createCommunityMessage(data: { room: string; message: string }) {
    return this.request<any>("POST", "/api/community/messages", data);
  }

  getCommunityMessages(room?: string) {
    const q = room ? `?room=${encodeURIComponent(room)}` : "";
    return this.request<any[]>("GET", `/api/community/messages${q}`);
  }

  // Rewards
  getRewards() {
    return this.request<any>("GET", "/api/rewards");
  }

  redeemRewards(amount_points: number) {
    return this.request<any>("POST", "/api/rewards/redeem", { amount_points });
  }

  // Resources
  getResources() {
    return this.request<any[]>("GET", "/api/resources");
  }

  // AI Assistant
  askAI(data: { prompt: string; language: string }) {
    return this.request<any>("POST", "/api/ai/assistant", data);
  }

  // CHW
  getCHWLink() {
    return this.request<any>("GET", "/api/chw/link");
  }

  linkCHW(data: { chw_name: string; phone: string; region: string; chw_user_id?: number }) {
    return this.request<any>("POST", "/api/chw/link", data);
  }

  getCHWDirectory() {
    return this.request<any[]>("GET", "/api/chw/directory");
  }

  getCHWCaseload() {
    return this.request<any>("GET", "/api/chw/caseload");
  }

  // Admission
  startAdmission(data: { phq9_answers: number[]; mood?: number; stress?: number; anxiety?: number; sleep_hours?: number; note?: string }) {
    return this.request<any>("POST", "/api/admissions/start", data);
  }

  // Language
  updateLanguage(language: string) {
    return this.request<any>("POST", "/api/me/language", { language });
  }
}

export const api = new ApiClient();
export type { AuthUser, AuthResponse };
