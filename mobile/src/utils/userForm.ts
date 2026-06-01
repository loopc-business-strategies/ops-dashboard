import type { AdminUser, UserPayload } from '@/src/api/users'
import type { UserFormState, UserRole } from '@/src/constants/admin'
import { EMPTY_USER_FORM } from '@/src/constants/admin'

export function userToForm(user: AdminUser): UserFormState {
  return {
    name: user.name || '',
    fullName: user.fullName || '',
    password: '',
    role: (user.role as UserRole) || 'department_user',
    department: user.department || '',
    allowedModules: user.allowedModules || [],
    assignedTasks: (user.assignedTasks || []).join(', '),
    title: user.title || '',
    phone: user.phone || '',
    location: user.location || '',
    timezone: user.timezone || 'Africa/Johannesburg',
    employeeCode: user.employeeCode || '',
    notes: user.notes || '',
  }
}

export function formToPayload(form: UserFormState, isEdit: boolean): UserPayload {
  const payload: UserPayload = {
    name: form.name.trim(),
    fullName: form.fullName.trim(),
    role: form.role,
    department: form.department,
    allowedModules: form.allowedModules,
    assignedTasks: form.assignedTasks.split(',').map((s) => s.trim()).filter(Boolean),
    title: form.title.trim(),
    phone: form.phone.trim(),
    location: form.location.trim(),
    timezone: form.timezone.trim() || 'Africa/Johannesburg',
    employeeCode: form.employeeCode.trim(),
    notes: form.notes.trim(),
  }
  if (!isEdit || form.password.trim()) {
    payload.password = form.password.trim()
  }
  return payload
}

export function validateUserForm(form: UserFormState, isEdit: boolean): string | null {
  if (!form.name.trim()) return 'Username is required.'
  if (!isEdit && form.password.length < 8) return 'Password must be at least 8 characters.'
  if (isEdit && form.password && form.password.length < 8) return 'Reset password must be at least 8 characters.'
  if ((form.role === 'department_head' || form.role === 'department_user') && !form.department) {
    return 'Department is required for department roles.'
  }
  return null
}

export { EMPTY_USER_FORM }
