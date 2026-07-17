const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface UserItem {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  department?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  hod?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    users: number;
    requests: number;
  };
  users?: UserItem[];
}
export interface LoginResponse {
  status: string;
  data: {
    token: string;
    user: {
      id: string;
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      departmentId: string;
      departmentCode: string;
    };
  };
}

export interface ApiError {
  status: number;
  message: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  actor?: {
    firstName: string;
    lastName: string;
    role: string;
  } | null;
}

export interface RequestItem {
  id: string;
  referenceNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  department: { name: string; code: string };
  workflowTemplate: { 
    name: string;
    steps?: { id: string; stepName: string; order: number; approverRole: string; isFinal: boolean }[];
  };
  currentStep?: { id: string; stepName: string; order: number; approverRole: string; isFinal: boolean };
  requestedById: string;
  auditLogs?: AuditLogItem[];
}

export interface CommentItem {
  id: string;
  comment: string;
  actorId: string;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  fileName: string;
  url: string;
  uploadedById: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  requestId?: string;
  request?: {
    id: string;
    referenceNumber: string;
    title: string;
  };
}

export interface AnalyticsData {
  kpis: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    returned: number;
  };
  distribution: {
    type: { name: string; value: number }[];
    status: { name: string; value: number }[];
  };
  recentActivity: RequestItem[];
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('mediflow_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await (async () => {
    try {
      return await response.json();
    } catch {
      return { message: `Server error (HTTP ${response.status})` };
    }
  })();

  if (!response.ok) {
    throw {
      status: response.status,
      message: data.message || 'An unexpected error occurred.',
    } as ApiError;
  }

  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getMe() {
    return request<{ status: string; data: { user: LoginResponse['data']['user'] } }>('/auth/me');
  },

  getRequests(params?: { search?: string; status?: string; type?: string; page?: number; limit?: number }) {
    let url = '/requests';
    if (params) {
      const qs = new URLSearchParams();
      if (params.search) qs.append('search', params.search);
      if (params.status) qs.append('status', params.status);
      if (params.type) qs.append('type', params.type);
      if (params.page) qs.append('page', params.page.toString());
      if (params.limit) qs.append('limit', params.limit.toString());
      const str = qs.toString();
      if (str) url += `?${str}`;
    }
    return request<{ success: boolean; data: RequestItem[] }>(url);
  },

  getAnalytics() {
    return request<{ success: boolean; data: AnalyticsData }>('/requests/analytics');
  },

  createRequest(payload: { title: string; type: string; priority: string; details?: any }) {
    return request<{ success: boolean; data: RequestItem }>('/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getRequestById(id: string) {
    return request<{ success: boolean; data: RequestItem }>(`/requests/${id}`);
  },

  getComments(requestId: string) {
    return request<{ success: boolean; data: CommentItem[] }>(`/requests/${requestId}/comments`);
  },

  getDocuments(requestId: string) {
    return request<{ success: boolean; data: DocumentItem[] }>(`/requests/${requestId}/documents`);
  },

  addComment(requestId: string, comment: string) {
    return request<{ success: boolean }>(`/requests/${requestId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  },

  uploadDocument(requestId: string, fileName: string, url: string) {
    return request<{ success: boolean }>(`/requests/${requestId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ fileName, url })
    });
  },

  submitRequest(requestId: string) {
    return request<{ success: boolean; data: RequestItem }>(`/requests/${requestId}/submit`, {
      method: 'POST'
    });
  },

  approveRequest(requestId: string, comment?: string) {
    return request<{ success: boolean; data: RequestItem }>(`/requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  },

  rejectRequest(requestId: string, comment: string) {
    return request<{ success: boolean; data: RequestItem }>(`/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  },

  returnForCorrection(requestId: string, comment: string) {
    return request<{ success: boolean; data: RequestItem }>(`/requests/${requestId}/return`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  },

  getUsers() {
    return request<{ success: boolean; data: UserItem[] }>('/users');
  },

  getUserById(id: string) {
    return request<{ success: boolean; data: UserItem }>(`/users/${id}`);
  },

  getDepartments() {
    return request<{ success: boolean; data: DepartmentItem[] }>('/departments');
  },

  getDepartmentById(id: string) {
    return request<{ success: boolean; data: DepartmentItem }>(`/departments/${id}`);
  },

  getNotifications() {
    return request<{ success: boolean; data: NotificationItem[] }>('/notifications');
  },

  markNotificationRead(id: string) {
    return request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PUT' });
  },

  markAllNotificationsRead() {
    return request<{ success: boolean }>('/notifications/read-all', { method: 'PUT' });
  }
};
