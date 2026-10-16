import { useState, useEffect } from 'react'
import { getConnections, createConnection, updateConnection, deleteConnection, testConnection } from '../api/client'
import toast from 'react-hot-toast'

function ConnectionForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', server: '', username: '', password: '', is_default: false })
  const [testing, setTesting] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const test = async () => {
    setTesting(true)
    try {
      const res = await testConnection({ server: form.server, username: form.username, password: form.password })
      toast.success(`Kết nối thành công!\n${res.data.version}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="font-semibold text-primary-500">{initial ? 'Chỉnh sửa kết nối' : 'Thêm kết nối mới'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tên kết nối</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ví dụ: SQL Server chính" />
        </div>
        <div>
          <label className="label">Server (IP hoặc hostname)</label>
          <input className="input" value={form.server} onChange={e => set('server', e.target.value)} placeholder="172.16.4.10" />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={form.username} onChange={e => set('username', e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} />
        Đặt làm kết nối mặc định
      </label>
      <div className="flex gap-2">
        <button className="btn-secondary btn" onClick={test} disabled={testing}>
          {testing ? '⏳' : '🔌'} Test kết nối
        </button>
        <button className="btn-primary btn" onClick={() => onSave(form)}>💾 Lưu</button>
        {onCancel && <button className="btn-secondary btn" onClick={onCancel}>Hủy</button>}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [conns, setConns] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editConn, setEditConn] = useState(null)

  const load = async () => {
    const res = await getConnections()
    setConns(res.data)
  }

  useEffect(() => { load() }, [])

  const save = async (form) => {
    if (editConn) {
      await updateConnection(editConn.id, form)
      toast.success('Đã cập nhật kết nối')
    } else {
      await createConnection(form)
      toast.success('Đã thêm kết nối')
    }
    setShowForm(false)
    setEditConn(null)
    load()
  }

  const del = async (id) => {
    if (!confirm('Xóa kết nối này?')) return
    await deleteConnection(id)
    toast.success('Đã xóa')
    load()
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-primary-500">Cài Đặt Kết Nối SQL Server</h2>
        <button className="btn-primary btn" onClick={() => { setShowForm(true); setEditConn(null) }}>
          + Thêm kết nối
        </button>
      </div>

      {(showForm || editConn) && (
        <ConnectionForm
          initial={editConn}
          onSave={save}
          onCancel={() => { setShowForm(false); setEditConn(null) }}
        />
      )}

      <div className="flex flex-col gap-2">
        {conns.length === 0 && (
          <div className="card p-6 text-center text-gray-400">
            Chưa có kết nối nào. Thêm kết nối SQL Server để bắt đầu.
          </div>
        )}
        {conns.map(c => (
          <div key={c.id} className="card p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{c.name}</span>
                {c.is_default && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">Mặc định</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{c.server} · {c.username}</div>
            </div>
            <button className="btn-secondary btn text-xs" onClick={() => { setEditConn(c); setShowForm(false) }}>
              ✏️ Sửa
            </button>
            <button className="btn-danger btn text-xs" onClick={() => del(c.id)}>
              🗑 Xóa
            </button>
          </div>
        ))}
      </div>

      <div className="card p-4 mt-2">
        <h3 className="font-semibold text-sm mb-2">Hướng dẫn Copy query files</h3>
        <p className="text-xs text-gray-600 leading-relaxed">
          Copy các file query từ <code className="bg-gray-100 px-1 rounded">Check Pilot Tool\</code> vào thư mục{' '}
          <code className="bg-gray-100 px-1 rounded">web check Pilot\backend\queries\</code>:
        </p>
        <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc list-inside">
          <li>Query_Purchase_Sale_Combined.txt</li>
          <li>Query_Purchase_Sale_Combined_NoItem.txt</li>
          <li>Query_Return_Combined.txt</li>
          <li>Query_Return_Combined_NoItem.txt</li>
          <li>Query_Monitor_GRPO_Vuot_PO_TTVH.txt (từ Query_Khac/)</li>
          <li>Query_Monitor_GRPO_Vuot_PO_KBMD.txt (từ Query_Khac/)</li>
        </ul>
      </div>
    </div>
  )
}
