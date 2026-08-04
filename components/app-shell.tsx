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
  DropdownMenuSeparator,
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
  Inbox,
  ListChecks,
} from 'lucide-react';
import { Persona } from '@/lib/types';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isManager = user.persona === 'manager';
  const isOwner = user.persona === 'owner';
  const isUser = user.persona === 'user';

  const navItems = isManager
    ? [
        { href: '/dashboard', label: 'Profiles', icon: LayoutDashboard },
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
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10">
          <Shield className="h-7 w-7" />
          <span className="font-semibold text-lg tracking-tight">Access Studio</span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-8 w-8 border-2 border-white/20">
              <AvatarFallback className="bg-white/20 text-xs font-semibold">
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
        <header className="h-16 bg-white border-b border-[hsl(var(--border))] flex items-center justify-between px-6 shrink-0">
          <div />
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
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 bg-[hsl(var(--background))]">
          {children}
        </main>
      </div>
    </div>
  );
}
