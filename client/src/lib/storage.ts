import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { format } from 'date-fns';
import { User, LeaveRequest, Role, INITIAL_LEAVES, INITIAL_USERS } from './data';

// Backwards-compatible synchronous getter for places that still call
// `getStoredUsers()` synchronously. This returns the initial in-memory
// user list until the app is fully migrated to async DB calls.
export function getStoredUsers(): User[] {
  return INITIAL_USERS;
}

export async function getAllUsersAsync(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    
    return (data || []).map((u: any) => {
       const dbRole = (u.role || 'employee').toString().toLowerCase();
       const mappedRole: Role = dbRole === 'admin' ? 'Admin' : dbRole === 'hr' ? 'HR' : 'Employee';
       return {
         id: String(u.user_id || u.username || ''),
         code: u.username || u.user_id || '',
         name: u.name || u.username || '',
         role: mappedRole,
         designation: u.designation || '',
         email: u.email || undefined,
       };
    });
  } catch (err) {
    console.error('Error fetching all users async:', err);
    return INITIAL_USERS;
  }
}

export function updateUser(id: string, updatedData: Partial<User>) {
  const updated = INITIAL_USERS.map(u => u.id === id ? { ...u, ...updatedData } : u);
  return updated;
}

export function deleteUser(id: string) {
  const filtered = INITIAL_USERS.filter(u => u.id !== id);
  return filtered;
}

const LEAVES_KEY = 'knockturn_leaves';

// ============================================================================
// LEAVES - Query Supabase `leaves` table
// ============================================================================

export async function getStoredLeaves(): Promise<LeaveRequest[]> {
  try {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leaves from Supabase', error);
      throw error;
    }

    // Map Supabase leaves to LeaveRequest format
    const mapped = (data || []).map((row: any) => ({
      id: String(row.id),
      employeeId: String(row.user_id || ''),
      // prefer `username` column if present, then `employee_name`, then `name`
      employeeName: row.username || row.employee_name || row.name || '',
      // prefer explicit employee_code, otherwise fall back to user_id
      employeeCode: row.employee_code || row.user_id || '',
      type: row.leave_type || '',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      duration: row.leave_duration_type || 'Full Day',
      description: row.reason || '',
      status: row.status || 'Pending',
      attachment: row.attachment || undefined,
      reasonForAction: row.reason_for_action || undefined,
      actionBy: row.action_by || undefined,
      actionDate: row.action_date || undefined,
      appliedDate: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      odFromTime: row.od_from_time || undefined,
      odToTime: row.od_to_time || undefined,
    }));

    // Enrich mapped rows: if employeeName is missing or looks like an ID (e.g., E0053),
    // fetch the real `name` from `users` and replace it so UI shows human names.
    const needs = mapped
      .filter(r => !r.employeeName || /^E\d{3,}$/.test(r.employeeName) || r.employeeName === r.employeeCode)
      .map(r => r.employeeId)
      .filter(Boolean);

    if (needs.length > 0) {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('user_id,name,username')
          .in('user_id', needs);

        const userMap: Record<string, any> = {};
        (users || []).forEach((u: any) => { userMap[u.user_id] = u; });

        return mapped.map(m => {
          const u = userMap[m.employeeId];
          if (u && u.name && u.name !== '' && u.name !== m.employeeId) {
            return { ...m, employeeName: u.name };
          }
          return m;
        });
      } catch (e) {
        console.error('Error enriching leave names:', e);
        return mapped;
      }
    }

    return mapped;
  } catch (err) {
    console.error('Error fetching leaves:', err);
    return INITIAL_LEAVES;
  }
}

export async function addLeaveRequest(leave: LeaveRequest) {
  try {
    const response = await fetch('/api/apply-leave', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leave)
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to submit leave request');
    }

    return result.data;
  } catch (err) {
    console.error('Error in addLeaveRequest (exception):', err);
    throw err;
  }
}

export async function updateLeaveStatus(
  id: string,
  status: LeaveRequest['status'],
  actionBy: string,
  reason?: string
) {
  try {
    // 1) Update the leave row status
    const { data: updatedLeave, error: updateErr } = await supabase
      .from('leaves')
      .update({ status, action_by: actionBy, action_date: new Date(), reason_for_action: reason || null })
      .eq('id', parseInt(id))
      .select();

    if (updateErr) {
      console.error('Error updating leave status in Supabase:', updateErr);
      throw updateErr;
    }

    // 2) Insert an approval record into the approvals table for audit
    const { data: approvalData, error: approvalErr } = await supabase
      .from('approvals')
      .insert({
        request_type: 'leave',
        request_id: parseInt(id),
        admin_status: status,
        admin_approved_by: actionBy,
        admin_approved_at: new Date(),
        comments: reason || null,
      })
      .select();

    if (approvalErr) {
      console.error('Error inserting approval for leave in Supabase:', approvalErr);
      // don't throw here — leave update succeeded; return both pieces
    }

    return { updatedLeave, approvalData };
  } catch (err) {
    console.error('Error in updateLeaveStatus:', err);
    throw err;
  }
}

// ============================================================================
// PERMISSIONS - Query Supabase `permissions` table
// ============================================================================

export interface PermissionRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  type: 'Late Entry Permission' | 'Early Exit Permission' | 'Personal Work Permission' | 'Emergency Permission';
  startTime: string;
  endTime: string;
  date: string;
  reason: string;
  additionalInfo?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedDate: string;
  actionBy?: string;
  actionDate?: string;
  reasonForAction?: string;
  isLOPApplicable?: boolean;
  durationMinutes?: number;
}

// Helper function to calculate duration in minutes between two time strings (HH:mm format)
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  try {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;
    return Math.max(0, endTotalMin - startTotalMin);
  } catch {
    return 0;
  }
}

// Helper function to get monthly permission count for an employee
export async function getMonthlyPermissionCount(
  employeeId: string,
  date: string
): Promise<number> {
  try {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // Fetch all permissions for this employee with Pending/Approved status
    const { data: allPermissions, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('user_id', employeeId)
      .in('status', ['Pending', 'Approved']);

    if (error) {
      console.error('Error counting monthly permissions:', error);
      return 0;
    }

    if (!allPermissions || allPermissions.length === 0) {
      return 0;
    }

    // Filter by month - use permission_date if available, fall back to created_at
    const monthCount = allPermissions.filter((p: any) => {
      const dateToCheck = p.permission_date ? new Date(p.permission_date) : new Date(p.created_at);
      return dateToCheck.getFullYear() === year && dateToCheck.getMonth() === month;
    }).length;

    return monthCount;
  } catch (err) {
    console.error('Error in getMonthlyPermissionCount:', err);
    return 0;
  }
}

export async function getStoredPermissions(): Promise<PermissionRequest[]> {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching permissions from Supabase', error);
      throw error;
    }

    const DB_TO_DISPLAY: Record<string, PermissionRequest['type']> = {
      late_entry: 'Late Entry Permission',
      early_exit: 'Early Exit Permission',
      personal_work: 'Personal Work Permission',
      emergency: 'Emergency Permission',
    };

    return (data || []).map((row: any) => {
      const startTime = row.from_time || '';
      const endTime = row.to_time || '';
      const durationMinutes = calculateDurationMinutes(startTime, endTime);

      return {
        id: String(row.id),
        employeeId: String(row.user_id || ''),
        employeeName: row.username || row.employee_name || row.name || '',
        employeeCode: row.employee_code || row.user_id || '',
        type: DB_TO_DISPLAY[row.permission_type] || row.permission_type,
        startTime,
        endTime,
        date: row.permission_date || row.created_at ? format(new Date(row.permission_date || row.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        reason: row.reason || '',
        additionalInfo: row.additional_info || undefined,
        status: row.status || 'Pending',
        appliedDate: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        actionBy: row.action_by || undefined,
        actionDate: row.action_date || undefined,
        reasonForAction: row.reason_for_action || undefined,
        isLOPApplicable: row.is_lop_applicable === true,
        durationMinutes,
      };
    });
  } catch (err) {
    console.error('Error fetching permissions:', err);
    return [];
  }
}

export async function addPermissionRequest(permission: PermissionRequest) {
  try {
    const DISPLAY_TO_DB: Record<PermissionRequest['type'], string> = {
      'Late Entry Permission': 'late_entry',
      'Early Exit Permission': 'early_exit',
      'Personal Work Permission': 'personal_work',
      'Emergency Permission': 'emergency',
    };

    const dbType = DISPLAY_TO_DB[permission.type] || permission.type;

    const safePerm: any = {
      user_id: permission.employeeId,
      ...(permission.employeeCode ? { username: permission.employeeCode } : {}),
      permission_type: dbType,
      from_time: permission.startTime,
      to_time: permission.endTime,
      permission_date: permission.date,
      reason: permission.reason,
      additional_info: permission.additionalInfo || null,
      is_lop_applicable: permission.isLOPApplicable || false,
    };

    const fullPerm: any = {
      ...safePerm,
      ...(permission.employeeName ? { employee_name: permission.employeeName, name: permission.employeeName } : {}),
    };

    let respPerm = await supabase.from('permissions').insert(safePerm).select();
    if (respPerm.error) {
      const errMsg = String(respPerm.error.message || '');
      if (!/column .* does not exist/i.test(errMsg) && !/Could not find the .* column/i.test(errMsg)) {
        respPerm = await supabase.from('permissions').insert(fullPerm).select();
      }
    }

    if (respPerm.error) {
      console.error('Error adding permission to Supabase after retry:', respPerm.error);
      throw respPerm.error;
    }

    return respPerm.data;
  } catch (err) {
    console.error('Error in addPermissionRequest:', err);
    throw err;
  }
}

export async function updatePermissionStatus(
  id: string,
  status: 'Approved' | 'Rejected',
  actionBy?: string,
  reason?: string
) {
  try {
    // 1) Update the permission row status
    const { data: updatedPermission, error: updateErr } = await supabase
      .from('permissions')
      .update({ status, action_by: actionBy || null, action_date: new Date(), reason_for_action: reason || null })
      .eq('id', parseInt(id))
      .select();

    if (updateErr) {
      console.error('Error updating permission status in Supabase:', updateErr);
      throw updateErr;
    }

    // 2) Insert an approval record for audit
    const { data: approvalData, error: approvalErr } = await supabase
      .from('approvals')
      .insert({
        request_type: 'permission',
        request_id: parseInt(id),
        admin_status: status,
        admin_approved_by: actionBy || null,
        admin_approved_at: new Date(),
        comments: reason || null,
      })
      .select();

    if (approvalErr) {
      console.error('Error inserting approval for permission in Supabase:', approvalErr);
      // don't throw here — the permission was updated
    }

    return { updatedPermission, approvalData };
  } catch (err) {
    console.error('Error in updatePermissionStatus:', err);
    throw err;
  }
}

// ============================================================================
// LEAVE BALANCE - Calculate from approved leaves
// ============================================================================

export interface LeaveBalance {
  casual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
}

export async function getLeaveBalance(employeeCode: string, employeeId?: string): Promise<LeaveBalance> {
  try {
    const leaves = await getStoredLeaves();
    const normalizedQueryCode = employeeCode?.toLowerCase();
    const normalizedQueryId = employeeId?.toLowerCase();

    const employeeLeaves = leaves.filter(
      l => {
        const leaveCode = l.employeeCode?.toLowerCase();
        const leaveId = l.employeeId?.toLowerCase();

        return (
          (leaveCode === normalizedQueryCode || leaveCode === normalizedQueryId) ||
          (leaveId === normalizedQueryId || leaveId === normalizedQueryCode)
        ) && l.status === 'Approved';
      }
    );

    const calculateDays = (start: string, end: string) => {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
      const diffTime = Math.abs(e.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    };

    const casualUsed = employeeLeaves
      .filter(l => l.type === 'Casual')
      .reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);

    const sickUsed = employeeLeaves
      .filter(l => l.type === 'Sick')
      .reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);

    return {
      casual: {
        total: 10,
        used: casualUsed,
        remaining: Math.max(0, 10 - casualUsed)
      },
      sick: {
        total: 5,
        used: sickUsed,
        remaining: Math.max(0, 5 - sickUsed)
      }
    };
  } catch (err) {
    console.error('Error calculating leave balance:', err);
    return { casual: { total: 10, used: 0, remaining: 10 }, sick: { total: 5, used: 0, remaining: 5 } };
  }
}

// ============================================================================
// ============================================================================
// Upload attachments to Supabase Storage
// ============================================================================

export async function uploadAttachment(
  employeeCode: string,
  file: File
): Promise<string | null> {
  try {
    const fileName = `${employeeCode}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('leave-attachments')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading attachment to Supabase Storage:', error);
      return null;
    }

    // Get public URL
    const { data: publicUrl } = await supabase.storage
      .from('leave-attachments')
      .getPublicUrl(fileName);

    return (publicUrl as any)?.publicUrl || null;
  } catch (err) {
    console.error('Error in uploadAttachment:', err);
    return null;
  }
}

// ============================================================================
// NOTIFICATIONS - helper to collect admin/hr emails for notifications
// ============================================================================
export async function getNotificationEmails() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username,email,role')
      .in('role', ['admin', 'hr']);

    if (error) {
      console.error('Error fetching notification users from Supabase', error);
      return { adminEmails: ['noreply@example.com'], hrEmails: ['noreply@example.com'] };
    }

    const adminEmails: string[] = [];
    const hrEmails: string[] = [];

    (data || []).forEach((u: any) => {
      const email = u.email || (u.username ? `${u.username.toLowerCase()}@example.com` : null);
      if (!email) return;
      if ((u.role || '').toString().toLowerCase() === 'admin') adminEmails.push(email);
      if ((u.role || '').toString().toLowerCase() === 'hr') hrEmails.push(email);
    });

    return {
      adminEmails: adminEmails.length ? adminEmails : ['noreply@example.com'],
      hrEmails: hrEmails.length ? hrEmails : ['noreply@example.com'],
    };
  } catch (err) {
    console.error('Error in getNotificationEmails:', err);
    return { adminEmails: ['noreply@example.com'], hrEmails: ['noreply@example.com'] };
  }
}
