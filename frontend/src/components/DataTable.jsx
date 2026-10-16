import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import * as XLSX from 'xlsx'

const FLAG_COLORS = {
  'Có': 'bg-red-100 text-red-700 font-semibold',
  'GRPO Tự động (AUTO)': 'bg-green-100 text-green-700',
  'GRPO Làm tay (TẠO TAY)': 'bg-orange-100 text-orange-700',
  'Đã xuất': 'bg-green-100 text-green-700',
  'Chưa xuất': 'bg-yellow-100 text-yellow-700',
  'Chưa có GRPO': 'bg-red-100 text-red-600',
  'Đã có GRPO': 'bg-green-100 text-green-600',
  'Chưa có A/R': 'bg-red-100 text-red-600',
  'Đã có A/R': 'bg-green-100 text-green-600',
  'AUTO': 'bg-blue-100 text-blue-700',
  'TẠO TAY': 'bg-orange-100 text-orange-700',
}

const STAGE_COLORS = {
  PR: 'bg-purple-100 text-purple-800',
  PO: 'bg-blue-100 text-blue-800',
  SO: 'bg-cyan-100 text-cyan-800',
  DO: 'bg-teal-100 text-teal-800',
  AR: 'bg-green-100 text-green-800',
  GRPO: 'bg-indigo-100 text-indigo-800',
  AP: 'bg-amber-100 text-amber-800',
  ARCM: 'bg-red-100 text-red-800',
  APCM: 'bg-rose-100 text-rose-800',
  IP: 'bg-emerald-100 text-emerald-800',
  OP: 'bg-orange-100 text-orange-800',
}

function CellValue({ value, col }) {
  if (value == null || value === '') return <span className="text-gray-300">—</span>
  const s = String(value)

  if (col === 'Stage') {
    return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${STAGE_COLORS[s] || 'bg-gray-100 text-gray-700'}`}>{s}</span>
  }

  const colorClass = FLAG_COLORS[s]
  if (colorClass) {
    return <span className={`px-1.5 py-0.5 rounded text-xs ${colorClass}`}>{s}</span>
  }

  if (s.startsWith('AUTO')) return <span className="text-blue-700 font-medium">{s}</span>
  if (s.startsWith('TẠO TAY')) return <span className="text-orange-700">{s}</span>

  return <span>{s}</span>
}

export default function DataTable({ columns = [], rows = [], loading = false, exportName = 'export' }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [quickFilter, setQuickFilter] = useState('all')

  const filteredRows = useMemo(() => {
    if (quickFilter === 'po_no_so') return rows.filter(r => r['PO Number'] && !r['SO Number'])
    if (quickFilter === 'ar_no_grpo') return rows.filter(r => r['AR Number'] && !r['GRPO Number'])
    if (quickFilter === 'ar_invoiced') return rows.filter(r => r['Customer Ref No'])
    if (quickFilter === 'ar_not_invoiced') return rows.filter(r => r['AR Number'] && !r['Customer Ref No'])
    return rows
  }, [rows, quickFilter])

  const colDefs = useMemo(() =>
    columns.map((col) => ({
      id: col,
      accessorKey: col,
      header: col,
      cell: (info) => <CellValue value={info.getValue()} col={col} />,
    })), [columns])

  const table = useReactTable({
    data: filteredRows,
    columns: colDefs,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `${exportName}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const hasPilotFilters = rows.some(r => 'PO Number' in r || 'AR Number' in r)

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="input w-56"
          placeholder="Tìm kiếm..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
        {hasPilotFilters && (
          <div className="flex gap-1 flex-wrap">
            {[
              ['all', 'Tất cả'],
              ['po_no_so', 'PO chưa có SO'],
              ['ar_no_grpo', 'AR chưa có GRPO'],
              ['ar_invoiced', 'AR đã xuất HĐ'],
              ['ar_not_invoiced', 'AR chưa xuất HĐ'],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setQuickFilter(val)}
                className={`btn text-xs py-1 ${quickFilter === val ? 'btn-primary' : 'btn-secondary'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {table.getFilteredRowModel().rows.length.toLocaleString()} dòng
          </span>
          <button className="btn-secondary btn" onClick={exportExcel}>
            📥 Xuất Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-gray-500">
            <div className="spinner" />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            Không có dữ liệu
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      className="th cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && ' ↑'}
                        {header.column.getIsSorted() === 'desc' && ' ↓'}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="td">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
