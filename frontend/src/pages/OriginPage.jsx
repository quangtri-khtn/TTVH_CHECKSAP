import { useState } from 'react'
import { queryOrigin } from '../api/client'
import DataTable from '../components/DataTable'
import toast from 'react-hot-toast'

const DOC_TYPES = [
  { value: 'PR',   label: 'PR - TTVH (OPRQ)',         db: 'TTVH' },
  { value: 'GRPO', label: 'GRPO - TTVH (OPDN)',        db: 'TTVH' },
  { value: 'AP',   label: 'A/P Invoice - TTVH (OPCH)', db: 'TTVH' },
  { value: 'SO',   label: 'SO - KBMD (ORDR)',           db: 'KBMD' },
  { value: 'AR',   label: 'A/R Invoice - KBMD (OINV)', db: 'KBMD' },
]

export default function OriginPage() {
  const [docTypeKey, setDocTypeKey] = useState('GRPO')
  const [numbers, setNumbers] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const selected = DOC_TYPES.find(d => d.value === docTypeKey)

  const run = async () => {
    const nums = numbers.split(/[\s,;]+/).filter(n => /^\d+$/.test(n))
    if (!nums.length) { toast.error('Nhập ít nhất 1 số chứng từ hợp lệ'); return }
    setLoading(true)
    try {
      const res = await queryOrigin({
        db: selected.db,
        doc_type: selected.value,
        doc_numbers: nums,
      })
      setResult(res.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <h2 className="text-base font-bold text-primary-500">Nguồn Chứng Từ (AUTO / THỦ CÔNG)</h2>

      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">Loại chứng từ</label>
            <select
              className="input w-64"
              value={docTypeKey}
              onChange={e => setDocTypeKey(e.target.value)}
            >
              {DOC_TYPES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Database</label>
            <input className="input w-32 bg-gray-50" readOnly value={`${selected.db} (${selected.db === 'TTVH' ? 'maycha_live' : 'kbmd_live'})`} />
          </div>
          <div className="flex-1 min-w-48">
            <label className="label">Số chứng từ (phân cách bằng dấu phẩy hoặc xuống dòng)</label>
            <textarea
              className="input resize-none h-14"
              placeholder="12345, 12346, 12347"
              value={numbers}
              onChange={e => setNumbers(e.target.value)}
            />
          </div>
          <button className="btn-primary btn" onClick={run} disabled={loading}>
            {loading ? '⏳' : '🔬'} Tra cứu
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {result ? (
          <>
            <DataTable
              columns={result.columns}
              rows={result.rows}
              loading={loading}
              exportName="nguon_chung_tu"
            />
            <p className="text-xs text-gray-400 mt-1">{result.row_count} dòng · {result.duration_ms}ms</p>
          </>
        ) : (
          <div className="card flex items-center justify-center h-40 text-gray-400">
            Nhập số chứng từ và bấm Tra cứu
          </div>
        )}
      </div>
    </div>
  )
}
