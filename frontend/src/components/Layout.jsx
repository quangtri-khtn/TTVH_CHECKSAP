import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/',               label: 'Luồng Bán',           icon: '📦' },
  { to: '/sales-item',     label: 'Luồng Bán (Item)',     icon: '🔍' },
  { to: '/returns',        label: 'Luồng Trả',            icon: '↩️' },
  { to: '/returns-item',   label: 'Luồng Trả (Item)',     icon: '🔎' },
  { to: '/origin',         label: 'Nguồn Chứng Từ',       icon: '🔬' },
  { to: '/grpo-over-po',   label: 'GRPO Vượt PO',         icon: '⚠️' },
  { to: '/settings',       label: 'Cài Đặt',              icon: '⚙️' },
]

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-primary-500 text-white flex flex-col">
        <div className="px-4 py-4 border-b border-primary-600">
          <h1 className="font-bold text-base leading-tight">Check Pilot</h1>
          <p className="text-xs text-blue-200 mt-0.5">SAP B1 Monitor</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
                 ${isActive
                   ? 'bg-white/20 font-semibold'
                   : 'hover:bg-white/10 text-blue-100'}`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-primary-600 text-xs text-blue-300">
          TTVH ↔ KBMD
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
