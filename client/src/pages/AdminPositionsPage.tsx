import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type AdminPositionItem,
  type DepartmentItem,
  type DepartmentPositionItem,
} from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { AdminNav } from '../components/AdminNav';
import { LoadingState } from '../components/LoadingState';
import { CreateEditPositionModal } from '../components/department/CreateEditPositionModal';
import { DeactivatePositionModal } from '../components/department/DeactivatePositionModal';

export default function AdminPositionsPage() {
  const [positions, setPositions] = useState<AdminPositionItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [positionModal, setPositionModal] = useState<{
    isOpen: boolean;
    position: DepartmentPositionItem | null;
    departmentId?: string;
    departmentName?: string;
  }>({
    isOpen: false,
    position: null,
  });
  const [selectedPosForDeactivate, setSelectedPosForDeactivate] = useState<DepartmentPositionItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [posRes, deptRes] = await Promise.all([
        api.getAllPositions({
          search: search || undefined,
          departmentId: selectedDeptId || undefined,
          isActive: statusFilter ? statusFilter === 'active' : undefined,
        }),
        api.getDepartments(),
      ]);

      setPositions(posRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load cross-department positions.');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedDeptId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotification = (message: string, type: 'success' | 'warning' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 6000);
  };

  const totalPositions = positions.length;
  const activePositions = positions.filter((p) => p.isActive).length;
  const inactivePositions = positions.filter((p) => !p.isActive).length;
  const uniqueDeptsWithPositions = new Set(positions.map((p) => p.departmentId)).size;

  return (
    <DashboardLayout title="E-Office" brandPrefix="Admin" nav={<AdminNav />}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Hospital Positions Oversight
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Centralized governance of organizational job titles across all hospital departments.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            if (departments.length > 0) {
              const targetDept = departments[0];
              setPositionModal({
                isOpen: true,
                position: null,
                departmentId: targetDept.id,
                departmentName: targetDept.displayName || targetDept.name,
              });
            } else {
              showNotification('No departments available.', 'warning');
            }
          }}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>+ Create Position</span>
        </button>
      </div>

      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between mb-4 ${
            notification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  notification.type === 'warning'
                    ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                    : 'M5 13l4 4L19 7'
                }
              />
            </svg>
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Architectural Governance Notice */}
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs mb-6 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-xs">
          <p className="font-bold text-white text-sm">Centralized System Governance, Decentralized Department Management</p>
          <p className="text-slate-300 mt-1 leading-relaxed">
            Heads of Department (HODs) have authority to manage routine job titles and staff assignments within their specific department. Administrators maintain cross-organizational oversight, can create or edit positions across all departments, and retain emergency override capabilities. Hospital positions are organizational titles only and do not alter E-Office system roles or workflow authority.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Positions
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalPositions}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Across all departments</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Active
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activePositions}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Available for placement</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Departments with Positions
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{uniqueDeptsWithPositions}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Of {departments.length} total departments</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Inactive
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{inactivePositions}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Deactivated titles</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search positions by title..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white min-w-[200px]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName || d.name} ({d.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white min-w-[140px]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {isLoading && positions.length === 0 ? (
        <LoadingState message="Loading hospital positions oversight..." />
      ) : error && positions.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-rose-200">
          <p className="text-rose-600 mb-3 text-sm">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Position Title</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Active Staff</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <p className="font-semibold text-sm">No positions found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your filters or click "+ Create Position".
                      </p>
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Department */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{pos.departmentName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {pos.departmentCode}
                          </span>
                        </div>
                      </td>

                      {/* Position Title */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {pos.name}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {pos.description || <span className="text-slate-400 italic">None</span>}
                      </td>

                      {/* Active Assignees */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{pos.activeEmployeeCount}</span>
                        <span className="text-[11px] text-slate-500 ml-1">assigned</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {pos.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPositionModal({
                                isOpen: true,
                                position: {
                                  id: pos.id,
                                  departmentId: pos.departmentId,
                                  name: pos.name,
                                  description: pos.description,
                                  isActive: pos.isActive,
                                  version: pos.version,
                                  activeEmployeeCount: pos.activeEmployeeCount,
                                  activePrimaryCount: 0,
                                  activeActingCount: 0,
                                  createdAt: pos.createdAt,
                                  updatedAt: pos.updatedAt,
                                },
                                departmentId: pos.departmentId,
                                departmentName: pos.departmentName,
                              });
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            Edit
                          </button>
                          {pos.isActive && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPosForDeactivate({
                                  id: pos.id,
                                  departmentId: pos.departmentId,
                                  name: pos.name,
                                  description: pos.description,
                                  isActive: pos.isActive,
                                  version: pos.version,
                                  activeEmployeeCount: pos.activeEmployeeCount,
                                  activePrimaryCount: 0,
                                  activeActingCount: 0,
                                  createdAt: pos.createdAt,
                                  updatedAt: pos.updatedAt,
                                });
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateEditPositionModal
        isOpen={positionModal.isOpen}
        position={positionModal.position}
        departmentName={positionModal.departmentName}
        departmentId={positionModal.departmentId}
        onClose={() => setPositionModal({ isOpen: false, position: null })}
        onSuccess={(warning) => {
          loadData();
          if (warning) {
            showNotification(warning, 'warning');
          } else {
            showNotification(
              positionModal.position ? 'Position updated successfully.' : 'Position created successfully.'
            );
          }
        }}
      />

      <DeactivatePositionModal
        isOpen={Boolean(selectedPosForDeactivate)}
        position={selectedPosForDeactivate}
        onClose={() => setSelectedPosForDeactivate(null)}
        onSuccess={() => {
          loadData();
          showNotification('Position deactivated successfully.');
        }}
      />
    </DashboardLayout>
  );
}

