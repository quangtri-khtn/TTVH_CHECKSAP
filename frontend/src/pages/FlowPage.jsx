/**
 * Màn hình Luồng Bán / Luồng Trả (dùng chung, nhận props type).
 * Layout: bảng chính phía trên, 2 panel check PO/SO phía dưới.
 */
import { useState } from 'react'
import { format, subDays } from 'date-fns'
import DataTable from '../components/DataTable'
import CheckPanel from '../components/CheckPanel'
import { getSalesFlow, getSalesItemFlow, getReturnsFlow, getReturnsItemFlow } from '../api/client'

const API_MAP = {
  sales:        getSalesFlow,
  sales_item:   getSalesItemFlow,
  returns:      getReturnsFlow,
  returns_item: getReturnsItemFlow,
}

const TITLE_MAP = {
  sales:        'Luồng Bán (Tổng hợp)',
  sales_item:   'Luồng Bán (Chi tiết Item)',
  returns:      'Luồng Trả (Tổng hợp)',
  returns_item: 'Luồng Trả (Chi tiết Item)',
}

const EXPORT_MAP = {
  sales:        'luong_ban',
  sales_item:   'luong_ban_item',
  returns:      'luong_tra',
  returns_item: 'luong_tra_item',
}

export default function FlowPage({ type = 'sales' }) {
  const defaultDate = format(subDays(new Date(), 30), 'yyyyMMdd')
  const [dateFrom, setDateFrom] = useState(defaultDate)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await API_MAP[type]({ date_from: dateFrom })
      setResult(res.data)
    } finally {
      setLoading(false)
    }
  }

  const isReturn = type.startsWith('returns')
  const hasItem = type.endsWith('item')

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-base font-bold text-primary-500">{TITLE_MAP[type]}</h2>
        <div className="flex items-center gap-2 ml-auto">
          <label className="label mb-0">Từ ngày</label>
          <input
            type="text"
            className="input w-32"
            placeholder="YYYYMMDD"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            maxLength={8}
          />
          <button className="btn-primary btn" onClick={run} disabled={loading}>
            {loading ? '⏳ Đang tải...' : '🔍 Tải dữ liệu'}
          </button>
          {result && (
            <span className="text-xs text-gray-500">
              {result.row_count.toLocaleString()} dòng · {result.duration_ms}ms
            </span>
          )}
        </div>
      </div>

      {/* Main grid - 50% height */}
      <div className="flex-1 min-h-0">
        <DataTable
          columns={result?.columns || []}
          rows={result?.rows || []}
          loading={loading}
          exportName={EXPORT_MAP[type]}
        />
      </div>

      {/* Bottom panels - 2 cols */}
      <div className="grid grid-cols-2 gap-4" style={{ height: '40%' }}>
        <CheckPanel type="po_grpo" />
        <CheckPanel type="so_ar" />
      </div>
    </div>
  )
}
