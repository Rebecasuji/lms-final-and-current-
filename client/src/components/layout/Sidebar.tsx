import { useAuth } from '@/context/AuthContext';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  History,
  User,
  LogOut,
  Users,
  CheckSquare,
  XSquare,
  BarChart3,
  Building2,
  Lock
} from 'lucide-react';

import logoUrl from '@assets/Screenshot_2025-10-15_183825_1765652253224.png';

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  const employeeLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/dashboard' },
    { icon: FileText, label: 'Apply Leave', path: '/employee/apply-leave' },
    { icon: Lock, label: 'Permission', path: '/employee/permission' },
    { icon: History, label: 'Leave History', path: '/employee/history' },
    { icon: User, label: 'Profile', path: '/employee/profile' },
    { icon: BarChart3, label: 'My Report', path: `/admin/individual-report/${user?.id || ''}` },
  ];

  const adminLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: FileText, label: 'Apply Leave', path: '/employee/apply-leave' },
    { icon: Lock, label: 'Permission', path: '/employee/permission' },
    { icon: CheckSquare, label: 'View Leaves', path: '/admin/view-leaves' },
    { icon: Lock, label: 'View Permissions', path: '/admin/view-permissions' },
    { icon: Building2, label: 'Departments', path: '/admin/departments' },
    { icon: Users, label: 'Employees', path: '/admin/employees' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/charts' },
    { icon: CheckSquare, label: 'Approved Leaves', path: '/admin/approved-leaves' },
    { icon: Lock, label: 'Approved Permissions', path: '/admin/approved-permissions' },
    { icon: FileText, label: 'Reports', path: '/reports' },
  ];

  const hrLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/dashboard' },
    { icon: CheckSquare, label: 'Approve Leaves', path: '/admin/view-leaves' },
    { icon: Lock, label: 'View Permissions', path: '/admin/view-permissions' },
    { icon: FileText, label: 'Apply Leave', path: '/employee/apply-leave' },
    { icon: History, label: 'Leave History', path: '/employee/history' },
    { icon: User, label: 'Profile', path: '/employee/profile' },
    { icon: CheckSquare, label: 'Approved Leaves', path: '/admin/approved-leaves' },
    { icon: Lock, label: 'Approved Permissions', path: '/admin/approved-permissions' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
  ];

  const links = user?.role === 'Admin' ? adminLinks : (user?.role === 'HR' ? hrLinks : employeeLinks);

  const getInitials = (name?: string, code?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return code ? code.slice(0, 2).toUpperCase() : '';
  };

  return (
    <aside className="w-64 h-screen bg-[#1A3DB1] dark:bg-[#0F172A] flex flex-col fixed left-0 top-0 z-50 shadow-xl transition-all duration-300">
      <div className="p-6 flex items-center justify-center border-b border-white/10">
        <img src={logoUrl} alt="Knockturn Logo" className="h-12 w-auto object-contain mix-blend-screen" />
      </div>

      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {links.map((link) => (
          <Link key={link.path} href={link.path}>
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group cursor-pointer border-l-4",
                isActive(link.path)
                  ? "bg-white/20 dark:bg-blue-500/15 text-white border-white/20 dark:border-blue-500 shadow-md"
                  : "text-white/70 dark:text-slate-400 border-transparent hover:text-white hover:bg-white/10 dark:hover:bg-white/5"
              )}
            >
              <link.icon className={cn("w-5 h-5", isActive(link.path) ? "text-white" : "text-white/70 dark:text-slate-400 group-hover:text-white")} />
              <span className="font-medium">{link.label}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/10 text-xs font-bold text-white">
            {getInitials(user?.name, user?.code)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/60">{user?.id}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 py-2 rounded-md transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
