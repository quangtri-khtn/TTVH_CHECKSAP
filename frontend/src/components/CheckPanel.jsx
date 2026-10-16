/**
 * Panel "Check PO → GRPO" hoặc "Check SO → A/R" dùng chung.
 */
import { useState } from 'react'
import { checkPoGrpo, checkSoAr } from '../api/client'
import DataTable from './DataTable'
import toast from 'react-hot-toast'

export default function CheckPanel({ type = 'po_grpo' }) {
  const isPoGrpo = type === 'po_grpo'
  const [db, setDb] = useState(isPoGrpo ? 'TTVH' : 'KBMD')
  const [numbers, setNumbers] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    const nums = numbers.split(/[\s,;]+/).filter(n => /^\d+$/.test(n))
    if (!nums.length) { toast.error('Nhập số hợp lệ'); return }
    setLoading(true)
    try {
      const fn = isPoGrpo ? checkPoGrpo : checkSoAr
      const key = isPoGrpo ? 'po_numbers' : 'so_numbers'
      const res = await fn({ db, [key]: nums })
      setResult(res.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-3 flex flex-col gap-3">
      <h3 className="font-semibold text-primary-500 text-sm">
        {isPoGrpo ? 'Kiểm tra PO → GRPO' : 'Kiểm tra SO → A/R'}
      </h3>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="label">Database</label>
          <select className="input w-40" value={db} onChange={e => setDb(e.target.value)}>
            <option value="TTVH">TTVH (maycha_live)</option>
            <option value="KBMD">KBMD (kbmd_live)</option>
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label">{isPoGrpo ? 'Số PO' : 'Số SO'} (phân cách bởi dấu phẩy/xuống dòng)</label>
          <textarea
            className="input resize-none h-16"
            placeholder={isPoGrpo ? '95000, 95001, 95002' : '40000, 40001'}
            value={numbers}
            onChange={e => setNumbers(e.target.value)}
          />
        </div>
        <button className="btn-primary btn" onClick={run} disabled={loading}>
          {loading ? '...' : '▶ Kiểm tra'}
        </button>
      </div>
      {result && (
        <div className="flex-1 overflow-auto">
          <DataTable
            columns={result.columns}
            rows={result.rows}
            exportName={isPoGrpo ? 'check_po_grpo' : 'check_so_ar'}
          />
          <p className="text-xs text-gray-400 mt-1">{result.row_count} dòng · {result.duration_ms}ms</p>
        </div>
      )}
    </div>
  )
}
