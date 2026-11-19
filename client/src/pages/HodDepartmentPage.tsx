import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type DepartmentEmployeeItem,
  type DepartmentPositionItem,
  type DepartmentEmployeesResponse,
} from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { ApproverNav } from '../components/ApproverNav';
import { LoadingState } from '../components/LoadingState';
import { AddDepartmentEmployeeModal } from '../components/department/AddDepartmentEmployeeModal';
import { ChangeEmployeePositionModal } from '../components/department/ChangeEmployeePositionModal';
import { EmployeePositionHistoryModal } from '../components/department/EmployeePositionHistoryModal';
import { EditDepartmentEmployeeModal } from '../components/department/EditDepartmentEmployeeModal';
import { DeactivateEmployeeModal } from '../components/department/DeactivateEmployeeModal';
import { CreateEditPositionModal } from '../components/department/CreateEditPositionModal';
import { DeactivatePositionModal } from '../components/department/DeactivatePositionModal';
import { TemporaryPasswordModal } from '../components/TemporaryPasswordModal';

export default function HodDepartmentPage() {
  const [activeTab, setActiveTab] = useState<'employees' | 'positions'>('employees');
  const [departmentData, setDepartmentData] = useState<DepartmentEmployeesResponse | null>(null);
  const [positions, setPositions] = useState<DepartmentPositionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // Employee Filters
  const [empSearch, setEmpSearch] = useState('');
  const [empPositionId, setEmpPositionId] = useState('');
  const [empStatus, setEmpStatus] = useState<string>('');

  // Position Filters
  const [posSearch, setPosSearch] = useState('');

  // Modals state
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [selectedEmpForPosition, setSelectedEmpForPosition] = useState<DepartmentEmployeeItem | null>(null);
  const [selectedEmpForHistory, setSelectedEmpForHistory] = useState<DepartmentEmployeeItem | null>(null);
  const [selectedEmpForEdit, setSelectedEmpForEdit] = useState<DepartmentEmployeeItem | null>(null);
  const [selectedEmpForDeactivate, setSelectedEmpForDeactivate] = useState<DepartmentEmployeeItem | null>(null);

  const [positionModal, setPositionModal] = useState<{ isOpen: boolean; position: DepartmentPositionItem | null }>({
    isOpen: false,
    position: null,
  });
  const [selectedPosForDeactivate, setSelectedPosForDeactivate] = useState<DepartmentPositionItem | null>(null);

  // Temporary password modal state
  const [tempPasswordState, setTempPasswordState] = useState<{
    isOpen: boolean;
    userEmail: string;
    temporaryPassword: string;
    expiresAt?: string;
  }>({
    isOpen: false,
    userEmail: '',
    temporaryPassword: '',
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [empRes, posRes] = await Promise.all([
        api.getDepartmentEmployees({
          search: empSearch || undefined,
          positionId: empPositionId || undefined,
          status: empStatus || undefined,
        }),
        api.getDepartmentPositions({
          search: posSearch || undefined,
        }),
      ]);

      setDepartmentData(empRes.data);
      setPositions(posRes.data.positions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load department data.');
    } finally {
      setIsLoading(false);
    }
  }, [empSearch, empPositionId, empStatus, posSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotification = (message: string, type: 'success' | 'warning' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 6000);
  };

  const handleEmployeeCreated = (result: {
    user: any;
    assignedPosition?: any;
    temporaryPassword?: string;
    expiresAt?: string;
  }) => {
    loadData();
    if (result.temporaryPassword) {
      setTempPasswordState({
        isOpen: true,
        userEmail: result.user.email,
        temporaryPassword: result.temporaryPassword,
        expiresAt: result.expiresAt,
      });
    } else {
      showNotification('Employee created successfully.');
    }
  };

  const deptName = departmentData?.department.displayName || departmentData?.department.name || 'Department';
  const deptCode = departmentData?.department.code || '';
  const stats = departmentData?.stats || {
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    invitedEmployees: 0,
  };

  return (
    <DashboardLayout title="E-Office" brandPrefix="HOD" nav={<ApproverNav />}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Department Management
            </h1>
            {deptCode && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {deptCode}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage employees and organizational positions for{' '}
            <strong className="text-slate-800 font-semibold">{deptName}</strong>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPositionModal({ isOpen: true, position: null })}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Create Position</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddEmployeeOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>+ Add Employee</span>
          </button>
        </div>
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Employees
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalEmployees}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Department headcount</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Active
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.activeEmployees}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Currently on duty</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            Invited (Pending)
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.invitedEmployees}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">First-login pending</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Inactive
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.inactiveEmployees}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Soft-deactivated</p>
        </div>
      </div>

      {/* Navigation Tabs (Employees / Positions) */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'employees'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Department Employees</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
              {stats.totalEmployees}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('positions')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'positions'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Department Positions</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
              {positions.length}
            </span>
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && !departmentData ? (
        <LoadingState message="Loading department management data..." />
      ) : error && !departmentData ? (
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
      ) : activeTab === 'employees' ? (
        /* ========================================================
           TAB 1: EMPLOYEES VIEW
           ======================================================== */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search by name, ID, or email..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Position Filter */}
              <select
                value={empPositionId}
                onChange={(e) => setEmpPositionId(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white min-w-[180px]"
              >
                <option value="">All Hospital Positions</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={empStatus}
                onChange={(e) => setEmpStatus(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white min-w-[140px]"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="invited">Invited (Pending)</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Employee Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Primary Position</th>
                    <th className="py-3 px-4">Acting Position</th>
                    <th className="py-3 px-4">System Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departmentData?.employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <p className="font-semibold text-sm">No employees found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Try adjusting your search filters or click "+ Add Employee".
                        </p>
                      </td>
                    </tr>
                  ) : (
                    departmentData?.employees.map((emp) => {
                      const initials = `${emp.firstName?.[0] || 'U'}${emp.lastName?.[0] || ''}`.toUpperCase();
                      const primaryPos = emp.primaryPosition;
                      const actingPos = emp.actingPositions?.[0];

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Employee Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-tight">
                                  {emp.firstName} {emp.lastName}
                                </p>
                                <p className="text-[11px] text-slate-500">{emp.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Employee ID */}
                          <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                            {emp.employeeId}
                          </td>

                          {/* Primary Position */}
                          <td className="py-3 px-4">
                            {primaryPos ? (
                              <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                  {primaryPos.name}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Since {new Date(primaryPos.assignedAt).toLocaleDateString()}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                            )}
                          </td>

                          {/* Acting Position */}
                          <td className="py-3 px-4">
                            {actingPos ? (
                              <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  {actingPos.name} (Acting)
                                </span>
                                {actingPos.endDate && (
                                  <p className="text-[10px] text-amber-700 mt-0.5">
                                    Until {new Date(actingPos.endDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* System Role */}
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {emp.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {emp.status === 'ACTIVE' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            )}
                            {emp.status === 'INVITED' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Invited
                              </span>
                            )}
                            {emp.status === 'INACTIVE' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Inactive
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedEmpForPosition(emp)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                              >
                                Change Position
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedEmpForHistory(emp)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              >
                                History
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedEmpForEdit(emp)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              >
                                Edit
                              </button>
                              {emp.isActive && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedEmpForDeactivate(emp)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================
           TAB 2: POSITIONS VIEW
           ======================================================== */
        <div className="space-y-4">
          {/* Architectural Notice Banner */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-3">
            <svg className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-indigo-950">Architectural Separation: Hospital Positions vs System Roles</p>
              <p className="text-indigo-900 mt-0.5 leading-relaxed">
                Hospital positions are job titles configured within your department (e.g. Staff Nurse, Clinical Resident, Ward Supervisor). They do <strong className="font-semibold text-indigo-950">not</strong> grant E-Office system privileges or workflow approval rights. Workflow approval authority is derived strictly from E-Office system roles assigned by Administrators.
              </p>
            </div>
          </div>

          {/* Positions Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
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
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
                placeholder="Search position titles..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setPositionModal({ isOpen: true, position: null })}
              className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Create Position</span>
            </button>
          </div>

          {/* Positions Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Position Title</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Active Assignees</th>
                    <th className="py-3 px-4">Created</th>
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
                          Click "+ Create Position" to define a new hospital job title for this department.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{pos.name}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {pos.description || <span className="text-slate-400 italic">None</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{pos.activeEmployeeCount}</span>
                            <span className="text-[10px] text-slate-500">
                              ({pos.activePrimaryCount} primary, {pos.activeActingCount} acting)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(pos.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {pos.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPositionModal({ isOpen: true, position: pos })}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                            >
                              Edit / Rename
                            </button>
                            {pos.isActive && (
                              <button
                                type="button"
                                onClick={() => setSelectedPosForDeactivate(pos)}
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
        </div>
      )}

      {/* MODALS */}
      <AddDepartmentEmployeeModal
        isOpen={isAddEmployeeOpen}
        departmentName={deptName}
        departmentId={departmentData?.department.id}
        positions={positions}
        onClose={() => setIsAddEmployeeOpen(false)}
        onSuccess={handleEmployeeCreated}
      />

      <ChangeEmployeePositionModal
        isOpen={Boolean(selectedEmpForPosition)}
        employee={selectedEmpForPosition}
        positions={positions}
        onClose={() => setSelectedEmpForPosition(null)}
        onSuccess={() => {
          loadData();
          showNotification('Hospital position updated successfully.');
        }}
      />

      <EmployeePositionHistoryModal
        isOpen={Boolean(selectedEmpForHistory)}
        employee={selectedEmpForHistory}
        onClose={() => setSelectedEmpForHistory(null)}
      />

      <EditDepartmentEmployeeModal
        isOpen={Boolean(selectedEmpForEdit)}
        employee={selectedEmpForEdit}
        onClose={() => setSelectedEmpForEdit(null)}
        onSuccess={() => {
          loadData();
          showNotification('Employee details updated successfully.');
        }}
      />

      <DeactivateEmployeeModal
        isOpen={Boolean(selectedEmpForDeactivate)}
        employee={selectedEmpForDeactivate}
        onClose={() => setSelectedEmpForDeactivate(null)}
        onSuccess={() => {
          loadData();
          showNotification('Employee deactivated successfully.');
        }}
      />

      <CreateEditPositionModal
        isOpen={positionModal.isOpen}
        position={positionModal.position}
        departmentName={deptName}
        departmentId={departmentData?.department.id}
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

      <TemporaryPasswordModal
        isOpen={tempPasswordState.isOpen}
        userEmail={tempPasswordState.userEmail}
        temporaryPassword={tempPasswordState.temporaryPassword}
        expiresAt={tempPasswordState.expiresAt}
        onClose={() => setTempPasswordState((prev) => ({ ...prev, isOpen: false }))}
      />
    </DashboardLayout>
  );
}
