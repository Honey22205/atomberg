import React from 'react';
import { Shield, Users, Activity, Video, Radio, PhoneCall } from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: 'lobby' | 'agent-dashboard' | 'customer-join' | 'admin-dashboard') => void;
  activeSessionId: string | null;
  serverConnected: boolean;
}

export default function Header({ currentView, onNavigate, activeSessionId, serverConnected }: HeaderProps) {
  return (
    <header className="bg-zinc-900/70 backdrop-blur-md border-b border-zinc-800 text-zinc-100 sticky top-0 z-50 px-6 py-3.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_#f97316]" />
            <span className="font-black text-lg tracking-tight uppercase text-zinc-100">
              VISICALL <span className="text-orange-500 font-extrabold text-sm ml-0.5 tracking-wider font-mono">vRTC</span>
            </span>
          </div>
          <div className="h-6 w-px bg-zinc-800 hidden md:block" />
          <div className="hidden md:flex flex-col">
            <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest leading-none">TELECOM GATEWAY</span>
            <span className="text-[10px] font-mono text-zinc-400 mt-0.5">SECURE MESH BACKEND</span>
          </div>
        </div>

        {/* Global Connection Badge */}
        <div className="flex items-center gap-2.5 bg-zinc-950 px-3.5 py-1.5 rounded border border-zinc-800 text-[11px] font-medium font-mono text-zinc-300">
          <span className={`h-2.5 w-2.5 rounded-full ${serverConnected ? 'bg-orange-500 shadow-[0_0_6px_#f97316]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'}`} />
          <span className="uppercase text-zinc-400 tracking-wider">
            {serverConnected ? 'GATEWAY: ONLINE' : 'GATEWAY: OFFLINE'}
          </span>
          {activeSessionId && (
            <>
              <span className="text-zinc-850 mx-1">|</span>
              <span className="text-orange-400 text-[10px] flex items-center gap-1 uppercase tracking-wider">
                <Radio className="w-3 h-3 animate-pulse text-orange-500" />
                SESSION: {activeSessionId}
              </span>
            </>
          )}
        </div>

        {/* Navigation / Role Switchers */}
        <nav className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded border border-zinc-800">
          <button
            id="nav-agent-dashboard"
            onClick={() => onNavigate('agent-dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              currentView === 'agent-dashboard' || currentView === 'lobby'
                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/30 shadow-sm'
                : 'text-zinc-500 border border-transparent hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Agent Console</span>
          </button>

          <button
            id="nav-customer-join"
            onClick={() => onNavigate('customer-join')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              currentView === 'customer-join'
                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/30 shadow-sm'
                : 'text-zinc-500 border border-transparent hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customer Join</span>
          </button>

          <button
            id="nav-admin-dashboard"
            onClick={() => onNavigate('admin-dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              currentView === 'admin-dashboard'
                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/30 shadow-sm'
                : 'text-zinc-500 border border-transparent hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Ops</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
