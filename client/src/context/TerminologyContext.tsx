import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type TerminologyItem } from '../services/api';
import { useAuth } from './AuthContext';

interface TerminologyContextType {
  terms: TerminologyItem[];
  isLoading: boolean;
  refreshTerms: () => Promise<void>;
  getStatusLabel: (status?: string | null) => string;
  getRequestTypeLabel: (type?: string | null) => string;
  getTermLabel: (key: string, fallback?: string) => string;
}

const TerminologyContext = createContext<TerminologyContextType | undefined>(undefined);

const DEFAULT_STATUS_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED: 'Returned for Revision',
  CANCELLED: 'Cancelled',
};

const DEFAULT_TYPE_MAP: Record<string, string> = {
  PURCHASE: 'Purchase Request',
  MAINTENANCE: 'Maintenance Work Order',
  LEAVE: 'Leave Application',
};

export const TerminologyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [terms, setTerms] = useState<TerminologyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshTerms = useCallback(async () => {
    if (!user) {
      setTerms([]);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.getTerminologies();
      if (res && res.data) {
        setTerms(res.data);
      }
    } catch {
      // Fallback silently to defaults if unauthorized or offline
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshTerms();
  }, [refreshTerms]);

  const getTermLabel = useCallback((key: string, fallback?: string): string => {
    const found = terms.find((t) => t.key.toUpperCase() === key.toUpperCase());
    if (found && found.label) return found.label;
    return fallback || key;
  }, [terms]);

  const getStatusLabel = useCallback((status?: string | null): string => {
    if (!status) return '—';
    const normalized = status.toUpperCase().replace(/\s+/g, '_');
    const termKey = `STATUS_${normalized}`;
    const found = terms.find((t) => t.key.toUpperCase() === termKey);
    if (found && found.label) return found.label;
    if (DEFAULT_STATUS_MAP[normalized]) return DEFAULT_STATUS_MAP[normalized];
    return status.replace(/_/g, ' ');
  }, [terms]);

  const getRequestTypeLabel = useCallback((type?: string | null): string => {
    if (!type) return '—';
    const normalized = type.toUpperCase().replace(/\s+/g, '_');
    const termKey = `REQUEST_TYPE_${normalized}`;
    const found = terms.find((t) => t.key.toUpperCase() === termKey);
    if (found && found.label) return found.label;
    if (DEFAULT_TYPE_MAP[normalized]) return DEFAULT_TYPE_MAP[normalized];
    return type.replace(/_/g, ' ');
  }, [terms]);

  return (
    <TerminologyContext.Provider
      value={{
        terms,
        isLoading,
        refreshTerms,
        getStatusLabel,
        getRequestTypeLabel,
        getTermLabel,
      }}
    >
      {children}
    </TerminologyContext.Provider>
  );
};

export function useTerminology() {
  const context = useContext(TerminologyContext);
  if (!context) {
    throw new Error('useTerminology must be used within a TerminologyProvider');
  }
  return context;
}
