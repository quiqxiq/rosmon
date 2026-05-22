/* Port 44 icon dari prototype/ui.jsx — inline SVG stroke icons. */

export interface IconDef {
  viewBox?: string
  body: string
}

export const ICONS = {
  Home: { body: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M10 20v-5h4v5"/>' },
  Users: {
    body: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19c.5-3 3.2-5 6.5-5s6 2 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.6 0 5 1.5 5.5 4"/>',
  },
  Ticket: {
    body: '<path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M9 5v14" stroke-dasharray="2 2"/>',
  },
  Wifi: {
    body: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8 15.5a6 6 0 0 1 8 0"/><path d="M11 18.5a1.5 1.5 0 0 1 2 0"/><path d="M2 9.5a14.5 14.5 0 0 1 20 0"/>',
  },
  Activity: { body: '<path d="M3 12h4l3-9 4 18 3-9h4"/>' },
  Network: {
    body: '<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="3" width="6" height="6" rx="1.2"/><rect x="9" y="15" width="6" height="6" rx="1.2"/><path d="M6 9v3a2 2 0 0 0 2 2h2"/><path d="M18 9v3a2 2 0 0 1-2 2h-2"/><path d="M12 12v3"/>',
  },
  Link2: {
    body: '<path d="M9 7h-2a5 5 0 0 0 0 10h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h8"/>',
  },
  Report: {
    body: '<path d="M5 3h11l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M16 3v4h4"/><path d="M8 13l2.5 2.5L15 11"/>',
  },
  Cog: {
    body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a7.6 7.6 0 0 0 0-6l1.5-1.1a1 1 0 0 0 .3-1.3l-1.6-2.8a1 1 0 0 0-1.2-.4l-1.7.7a7.6 7.6 0 0 0-5.2-3l-.3-1.8A1 1 0 0 0 10.2 0H7.6a1 1 0 0 0-1 .8L6.3 2.6a7.6 7.6 0 0 0-5.2 3L-.6 4.9a1 1 0 0 0-1.2.4L-3.4 8a1 1 0 0 0 .3 1.3" transform="translate(2 6)"/>',
  },
  Search: { body: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>' },
  Plus: { body: '<path d="M12 5v14"/><path d="M5 12h14"/>' },
  Filter: { body: '<path d="M3 5h18l-7 8v7l-4-2v-5L3 5Z"/>' },
  Download: { body: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>' },
  Trash: {
    body: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  },
  Edit: { body: '<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>' },
  More: {
    body: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  },
  Power: { body: '<path d="M12 3v10"/><path d="M7.5 6.5a8 8 0 1 0 9 0"/>' },
  Chevron: { body: '<path d="m9 6 6 6-6 6"/>' },
  ChevronDown: { body: '<path d="m6 9 6 6 6-6"/>' },
  ChevronLeft: { body: '<path d="m15 6-6 6 6 6"/>' },
  X: { body: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' },
  Check: { body: '<path d="m4 12 5 5L20 6"/>' },
  Bell: { body: '<path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/>' },
  Sun: {
    body: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M4.2 4.2l1.4 1.4"/><path d="M18.4 18.4l1.4 1.4"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M4.2 19.8l1.4-1.4"/><path d="M18.4 5.6l1.4-1.4"/>',
  },
  Moon: { body: '<path d="M20 14.5A8 8 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>' },
  Copy: {
    body: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3"/>',
  },
  Print: {
    body: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="9" rx="1.5"/><path d="M7 14h10v6H7z"/>',
  },
  Refresh: {
    body: '<path d="M21 11A9 9 0 0 0 6 5.5L3 8"/><path d="M3 4v4h4"/><path d="M3 13a9 9 0 0 0 15 5.5L21 16"/><path d="M21 20v-4h-4"/>',
  },
  Globe: {
    body: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
  },
  Server: {
    body: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r=".5" fill="currentColor"/><circle cx="7" cy="16.5" r=".5" fill="currentColor"/>',
  },
  Boot: { body: '<path d="M12 2v8"/><path d="M5 10h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9Z"/>' },
  Zap: { body: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>' },
  Clock: { body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  Eye: { body: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>' },
  EyeOff: {
    body: '<path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16.5 16.5 0 0 1-3 4"/><path d="M6.5 7.5C3.4 9.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.3-.8"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/>',
  },
  Calendar: {
    body: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  },
  Logout: {
    body: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  },
  Mac: { body: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h.01M11 14h.01M15 14h.01"/>' },
  Up: { body: '<path d="m6 15 6-6 6 6"/>' },
  Down: { body: '<path d="m6 9 6 6 6-6"/>' },
  ArrowUpRight: { body: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>' },
  Sparkles: { body: '<path d="M9 3v4M7 5h4M17 11v4M15 13h4M12 9l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/>' },
  Kick: { body: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>' },
  Lock: { body: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>' },
  Menu: { body: '<path d="M3 6h18M3 12h18M3 18h18"/>' },
} as const satisfies Record<string, IconDef>

export type IconName = keyof typeof ICONS
