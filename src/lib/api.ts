/**
 * Typed client for primal-be. Base URL from EXPO_PUBLIC_API_URL; when it's
 * unset (design/preview builds, or auth hasn't landed yet) every call resolves
 * to MOCK data so screens stay buildable and navigable.
 *
 * Auth seam: `setAccessToken` is called by the auth workstream once the
 * Decane session exchange lands. Until then the mock path carries the UI.
 */

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export interface AccountSummary {
  accountNumber: string | null;
  bankName: string | null;
  provisioned: boolean;
}

export interface Me {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string;
  tier: number;
  onboardingStep: string;
  account: AccountSummary;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

const MOCK_ME: Me = {
  id: "mock",
  email: "you@primal.app",
  firstName: "Primal",
  lastName: "User",
  country: "NG",
  tier: 1,
  onboardingStep: "complete",
  account: { accountNumber: null, bankName: null, provisioned: false },
};

const MOCK_PROVISIONED: AccountSummary = {
  accountNumber: "9012345678",
  bankName: "Rubies MFB",
  provisioned: true,
};

export const usingMockApi = API_URL === "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => null)) as
    | ({ message?: string; code?: string } & Record<string, unknown>)
    | null;

  if (!res.ok) {
    throw new ApiError(
      body?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.code,
    );
  }
  return body as T;
}

// In-memory mock state so provisioning "sticks" while navigating.
let mockAccount: AccountSummary = MOCK_ME.account;

export async function getMe(): Promise<Me> {
  if (usingMockApi) return { ...MOCK_ME, account: mockAccount };
  return request<Me>("/v1/account/me");
}

export async function provisionAccount(): Promise<AccountSummary> {
  if (usingMockApi) {
    // Simulate the provider round-trip so the pending UI is visible.
    await new Promise((r) => setTimeout(r, 900));
    mockAccount = MOCK_PROVISIONED;
    return mockAccount;
  }
  return request<AccountSummary>("/v1/account/provision", { method: "POST" });
}
