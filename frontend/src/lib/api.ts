import type { AuthResponse, LoginAs, Role, User } from '../types';

// Production API runs on Render.
// VITE_API_URL can override this value when configured in Vercel.
const API = (
  import.meta.env.VITE_API_URL ||
  'https://wave-login.onrender.com'
).replace(/\/$/, '');

let token = localStorage.getItem('wave_token');

export const setToken = (value: string | null) => {
  token = value;

  if (value) {
    localStorage.setItem('wave_token', value);
  } else {
    localStorage.removeItem('wave_token');
  }
};

export const isSessionError = (error: unknown) =>
  String((error as any)?.message || error) === '__SESSION_EXPIRED__';

/**
 * Generic API request helper.
 *
 * Important authentication behavior:
 *
 * 1. 401 from the LOGIN endpoint:
 *    → Invalid username/email or password
 *    → Do NOT clear the existing token
 *    → Do NOT trigger session-expired event
 *
 * 2. 401 from an already authenticated API:
 *    → JWT is invalid/expired
 *    → Clear the token
 *    → Trigger session-expired event
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  isAuthRequest = false,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      'Cannot reach Wave API. Please check the deployed Wave backend.',
    );
  }

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }

  if (!response.ok) {
    /*
     * LOGIN FAILURE
     *
     * A 401 returned while trying to log in means the
     * credentials are incorrect.
     *
     * This is NOT a session-expired situation because
     * the user has not successfully authenticated yet.
     */
    if (response.status === 401 && isAuthRequest) {
      const detail = Array.isArray(data.detail)
        ? data.detail.map((x: any) => x.msg).join(', ')
        : data.detail;

      throw new Error(
        detail || 'Invalid username/email or password',
      );
    }

    /*
     * SESSION EXPIRY
     *
     * A 401 from a protected endpoint means the existing
     * JWT is invalid, expired, or no longer accepted.
     */
    if (response.status === 401) {
      setToken(null);

      window.dispatchEvent(
        new Event('wave:session-expired'),
      );

      throw new Error('__SESSION_EXPIRED__');
    }

    const detail = Array.isArray(data.detail)
      ? data.detail.map((x: any) => x.msg).join(', ')
      : data.detail;

    if (
      response.status >= 500 &&
      (!detail || detail === 'Internal Server Error')
    ) {
      throw new Error(
        'Wave server error (500). Check the FastAPI backend logs.',
      );
    }

    throw new Error(
      detail || `Request failed (${response.status})`,
    );
  }

  return data as T;
}

export const api = {
  /*
   * LOGIN
   */
  login: (body: {
    username_or_email: string;
    password: string;
    login_as: LoginAs;
  }) =>
    request<AuthResponse>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      true,
    ),

  /*
   * SIGNUP
   */
  signup: (body: object) =>
    request<AuthResponse>(
      '/api/v1/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      true,
    ),

  /*
   * CURRENT USER
   */
  me: () =>
    request<User>('/api/v1/me'),

  /*
   * USERS
   */
  users: () =>
    request<User[]>('/api/v1/users'),

  createUser: (body: object) =>
    request<User>(
      '/api/v1/users',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  updateUser: (id: number, body: object) =>
    request<User>(
      `/api/v1/users/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    ),

  deleteUser: (id: number) =>
    request(
      `/api/v1/users/${id}`,
      {
        method: 'DELETE',
      },
    ),

  /*
   * ROLE ASSIGNMENT
   */
  assignRole: (id: number, role: string) =>
    request<User>(
      `/api/v1/users/${id}/roles?role_name=${encodeURIComponent(role)}`,
      {
        method: 'POST',
      },
    ),

  deleteRoleAssignment: (id: number, roleId: number) =>
    request<User>(
      `/api/v1/users/${id}/roles/${roleId}`,
      {
        method: 'DELETE',
      },
    ),

  /*
   * ADMINS
   */
  admins: () =>
    request<User[]>('/api/v1/admins'),

  createAdmin: (body: object) =>
    request<User>(
      '/api/v1/admins',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  updateAdmin: (id: number, body: object) =>
    request<User>(
      `/api/v1/admins/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    ),

  deleteAdmin: (id: number) =>
    request(
      `/api/v1/admins/${id}`,
      {
        method: 'DELETE',
      },
    ),

  /*
   * ROLES
   */
  roles: () =>
    request<Role[]>('/api/v1/roles'),

  createRole: (body: object) =>
    request<Role>(
      '/api/v1/roles',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  updateRole: (id: number, body: object) =>
    request<Role>(
      `/api/v1/roles/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    ),

  deleteRole: (id: number) =>
    request(
      `/api/v1/roles/${id}`,
      {
        method: 'DELETE',
      },
    ),
};