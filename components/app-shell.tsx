'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  LayoutDashboard,
  CheckSquare,
  LogOut,
  ChevronDown,
  UserCog,
  User,
  Users,
  Inbox,
  ListChecks,
  Search,
  Bell,
  KeyRound,
} from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isManager = user.persona === 'manager';
  const isOwner = user.persona === 'owner';
  const navItems = isManager
    ? [
        { href: '/dashboard', label: 'Profiles', icon: LayoutDashboard },
        { href: '/my-team', label: 'My Team', icon: Users },
        { href: '/roles', label: 'Roles Catalog', icon: UserCog },
        { href: '/manager/role-requests', label: 'Role Requests', icon: Inbox },
      ]
    : isOwner
      ? [
          { href: '/validations', label: 'Validations', icon: CheckSquare },
          { href: '/owner/role-requests', label: 'Role Requests', icon: ListChecks },
          { href: '/owner/access-requests', label: 'Access Requests', icon: Shield },
        ]
      : [
          { href: '/my-space', label: 'My Space', icon: User },
        ];

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))]">
      {/* Sidebar */}
      <aside className="w-56 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.08]">
          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <KeyRound className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="block font-bold text-[15px] tracking-tight text-white">HIVE</span>
            <span className="block text-[10px] text-slate-400 tracking-wide">ACCESS MANAGEMENT</span>
          </div>
        </div>
        <nav className="flex-1 py-5 px-3 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace</p>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-700/70 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-8 w-8 border-2 border-blue-400/30">
              <AvatarFallback className="bg-blue-600 text-xs font-semibold">
                {user.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-white/60 capitalize">{user.persona}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-[hsl(var(--border))] flex items-center justify-between px-7 shrink-0">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              aria-label="Search"
              placeholder="Search an account, application..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex items-center gap-4">
            <button aria-label="Notifications" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">
              <Bell className="h-4 w-4" />
            </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-semibold bg-[hsl(var(--primary))] text-white">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{user.persona}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-auto px-7 py-7 bg-[hsl(var(--background))]">
          {children}
        </main>
      </div>
    </div>
  );
}
