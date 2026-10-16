import { useState } from 'react'
import { format, subDays } from 'date-fns'
import { getGrpoOverPo } from '../api/client'
import DataTable from '../components/DataTable'

export default function GrpoOverPoPage() {
  const [db, setDb] = useState('TTVH')
  const [dateFrom, setDateFrom] = useState('20260901')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await getGrpoOverPo({ db, date_from: dateFrom })
      setResult(res.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <h2 className="text-base font-bold text-primary-500">GRPO Vượt PO (Tolerance)</h2>

      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">Database</label>
          <select className="input w-44" value={db} onChange={e => setDb(e.target.value)}>
            <option value="TTVH">TTVH (maycha_live)</option>
            <option value="KBMD">KBMD (kbmd_live)</option>
          </select>
        </div>
        <div>
          <label className="label">Từ ngày (YYYYMMDD)</label>
          <input
            className="input w-32"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            maxLength={8}
          />
        </div>
        <button className="btn-primary btn" onClick={run} disabled={loading}>
          {loading ? '⏳ Đang tải...' : '⚠️ Tải dữ liệu'}
        </button>
        {result && (
          <span className="text-xs text-gray-500 ml-2">
            {result.row_count.toLocaleString()} dòng · {result.duration_ms}ms
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          columns={result?.columns || []}
          rows={result?.rows || []}
          loading={loading}
          exportName="grpo_vuot_po"
        />
      </div>
    </div>
  )
}
