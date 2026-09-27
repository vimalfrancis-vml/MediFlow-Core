const rawEnvUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || '';
const API_BASE_URL = rawEnvUrl
  ? (rawEnvUrl.endsWith('/api/v1') ? rawEnvUrl : `${rawEnvUrl}/api/v1`)
  : '/api/v1';


export interface UserItem {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roleId?: string;
  isActive: boolean;
  departmentId?: string;
  roleRef?: {
    id: string;
    code: string;
    displayName: string;
    description?: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
    displayName?: string;
  };
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  displayName?: string;
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

export interface RoleItem {
  id: string;
  code: string;
  displayName: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
  };
}

export interface TerminologyItem {
  id: string;
  category: string;
  key: string;
  label: string;
  description?: string | null;
}

export interface WorkflowStepItem {
  id?: string;
  stepName: string;
  order: number;
  approverRole: string;
  approverDepartmentId?: string | null;
  allowDynamicForwarding?: boolean;
  isFinal?: boolean;
  approverDepartment?: {
    id: string;
    name: string;
    code: string;
    displayName?: string;
  };
}

export interface WorkflowTemplateItem {
  id: string;
  name: string;
  requestType: string;
  version: number;
  isActive: boolean;
  description?: string | null;
  steps: WorkflowStepItem[];
  _count?: {
    requests: number;
  };
  createdAt: string;
}

export interface RecipientItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleRef?: {
    displayName: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
    displayName?: string;
  };
}

export interface AuditLogListItem {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  requestId?: string | null;
  request?: {
    id: string;
    referenceNumber: string;
    title: string;
    type: string;
    status: string;
  } | null;
  actor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    roleRef?: {
      displayName: string;
    };
    department?: {
      name: string;
      code: string;
      displayName?: string;
    };
  } | null;
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
  actorId?: string;
  actor?: {
    id?: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
}

export interface PurchaseDetailItem {
  id: string;
  requestId: string;
  vendorName?: string | null;
  itemDescription: string;
  quantity: number;
  estimatedCost: number;
  budgetCode?: string | null;
  justification: string;
}

export interface MaintenanceDetailItem {
  id: string;
  requestId: string;
  location: string;
  equipmentName: string;
  issueDescription: string;
  urgencyLevel: string;
}

export interface LeaveDetailItem {
  id: string;
  requestId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  coveringStaff?: string | null;
}

export interface AttachmentItem {
  id: string;
  requestId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
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
  department: { name: string; code: string; displayName?: string };
  workflowTemplate: { 
    id?: string;
    name: string;
    version?: number;
    steps?: { id: string; stepName: string; order: number; approverRole: string; approverDepartmentId?: string | null; allowDynamicForwarding?: boolean; isFinal: boolean }[];
  };
  currentStep?: { id: string; stepName: string; order: number; approverRole: string; approverDepartmentId?: string | null; allowDynamicForwarding?: boolean; isFinal: boolean } | null;
  requestedById: string;
  requestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    roleRef?: { displayName: string };
    department?: { id: string; name: string; code: string; displayName?: string };
  };
  assignedToUserId?: string | null;
  assignedToUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    roleRef?: { displayName: string };
    department?: { id: string; name: string; code: string; displayName?: string };
  } | null;
  auditLogs?: AuditLogItem[];
  attachments?: AttachmentItem[];
  purchaseDetail?: PurchaseDetailItem | null;
  maintenanceDetail?: MaintenanceDetailItem | null;
  leaveDetail?: LeaveDetailItem | null;
  canAct?: boolean;
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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
    if (response.status === 401 && endpoint !== '/auth/login') {
      localStorage.removeItem('mediflow_token');
      localStorage.removeItem('mediflow_user');
      sessionStorage.clear();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
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

  editRequest(id: string, payload: { title: string; type: string; priority: string; details?: any }) {
    return request<{ success: boolean; data: RequestItem }>(`/requests/${id}`, {
      method: 'PUT',
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

  // --- Attachments API (Phase 6) ---
  uploadAttachment(requestId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ success: boolean; message: string; data: AttachmentItem }>(
      `/requests/${requestId}/attachments`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  getAttachments(requestId: string) {
    return request<{ success: boolean; data: AttachmentItem[] }>(`/requests/${requestId}/attachments`);
  },

  async fetchAttachmentBlob(requestId: string, attachmentId: string, download = false): Promise<Blob> {
    const token = localStorage.getItem('mediflow_token');
    const url = `${API_BASE_URL}/requests/${requestId}/attachments/${attachmentId}${download ? '?download=true' : ''}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      let msg = 'Failed to fetch attachment file.';
      try {
        const errJson = await res.json();
        if (errJson.message) msg = errJson.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return await res.blob();
  },

  async downloadAttachmentFile(requestId: string, attachmentId: string, originalName: string, download = false) {
    const blob = await this.fetchAttachmentBlob(requestId, attachmentId, download);
    const blobUrl = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } else {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  },

  deleteAttachment(requestId: string, attachmentId: string) {
    return request<{ success: boolean; message: string }>(
      `/requests/${requestId}/attachments/${attachmentId}`,
      {
        method: 'DELETE',
      }
    );
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

  createUser(data: {
    email: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    password?: string;
    role: string;
    departmentId: string;
  }) {
    return request<{ success: boolean; message: string; data: UserItem }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateUser(id: string, data: Partial<UserItem> & { password?: string }) {
    return request<{ success: boolean; message: string; data: UserItem }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getDepartments() {
    return request<{ success: boolean; data: DepartmentItem[] }>('/departments');
  },

  getDepartmentById(id: string) {
    return request<{ success: boolean; data: DepartmentItem }>(`/departments/${id}`);
  },

  createDepartment(data: { name: string; code: string; displayName?: string; hodId?: string | null }) {
    return request<{ success: boolean; message: string; data: DepartmentItem }>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateDepartment(id: string, data: { name?: string; displayName?: string; hodId?: string | null; isActive?: boolean }) {
    return request<{ success: boolean; message: string; data: DepartmentItem }>(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  setDepartmentStatus(id: string, isActive: boolean) {
    return request<{ success: boolean; message: string; data: DepartmentItem }>(`/departments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  updateDepartmentHod(departmentId: string, hodId: string | null) {
    return request<{ success: boolean; message: string; data: DepartmentItem }>(`/departments/${departmentId}/hod`, {
      method: 'PUT',
      body: JSON.stringify({ hodId }),
    });
  },

  // --- Roles API ---
  getRoles(isActive?: boolean) {
    let url = '/roles';
    if (isActive !== undefined) url += `?isActive=${isActive}`;
    return request<{ success: boolean; data: RoleItem[] }>(url);
  },

  getRoleById(id: string) {
    return request<{ success: boolean; data: RoleItem }>(`/roles/${id}`);
  },

  updateRole(id: string, data: { displayName?: string; description?: string; isActive?: boolean }) {
    return request<{ success: boolean; message: string; data: RoleItem }>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // --- Terminology API ---
  getTerminologies() {
    return request<{ success: boolean; data: TerminologyItem[] }>('/terminology');
  },

  updateTerminology(key: string, label: string) {
    return request<{ success: boolean; message: string; data: TerminologyItem }>(`/terminology/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ label }),
    });
  },

  // --- Workflows API ---
  getWorkflows(filter?: { requestType?: string; isActive?: boolean }) {
    let url = '/workflows';
    if (filter) {
      const qs = new URLSearchParams();
      if (filter.requestType) qs.append('requestType', filter.requestType);
      if (filter.isActive !== undefined) qs.append('isActive', filter.isActive.toString());
      const str = qs.toString();
      if (str) url += `?${str}`;
    }
    return request<{ success: boolean; data: WorkflowTemplateItem[] }>(url);
  },

  getWorkflowById(id: string) {
    return request<{ success: boolean; data: WorkflowTemplateItem }>(`/workflows/${id}`);
  },

  createWorkflow(data: { name: string; requestType: string; description?: string; steps: WorkflowStepItem[] }) {
    return request<{ success: boolean; message: string; data: WorkflowTemplateItem }>('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createWorkflowVersion(id: string, data: { name?: string; description?: string; steps: WorkflowStepItem[] }) {
    return request<{ success: boolean; message: string; data: WorkflowTemplateItem }>(`/workflows/${id}/version`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  archiveWorkflow(id: string) {
    return request<{ success: boolean; message: string; data: WorkflowTemplateItem }>(`/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Dynamic Forwarding API ---
  getEligibleRecipients(requestId: string) {
    return request<{ success: boolean; data: RecipientItem[] }>(`/requests/${requestId}/recipients`);
  },

  forwardRequest(requestId: string, targetUserId: string, comment?: string) {
    return request<{ success: boolean; message: string; data: any }>(`/requests/${requestId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, comment }),
    });
  },

  // --- Audit Logs API ---
  getAuditLogs(params?: { action?: string; actorId?: string; requestId?: string; search?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) {
    let url = '/audit-logs';
    if (params) {
      const qs = new URLSearchParams();
      if (params.action) qs.append('action', params.action);
      if (params.actorId) qs.append('actorId', params.actorId);
      if (params.requestId) qs.append('requestId', params.requestId);
      if (params.search) qs.append('search', params.search);
      if (params.startDate) qs.append('startDate', params.startDate);
      if (params.endDate) qs.append('endDate', params.endDate);
      if (params.page) qs.append('page', params.page.toString());
      if (params.limit) qs.append('limit', params.limit.toString());
      const str = qs.toString();
      if (str) url += `?${str}`;
    }
    return request<{ success: boolean; data: { items: AuditLogListItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } } }>(url);
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
