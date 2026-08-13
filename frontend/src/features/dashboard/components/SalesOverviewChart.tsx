import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency, formatShortDate } from '../format'
import type { DailySalesPoint } from '../types/dashboard'

export interface SalesOverviewChartProps {
  data: DailySalesPoint[]
}

// Matches --color-primary in frontend/src/index.css -- the app's single
// existing accent, reused here instead of introducing a separate chart
// palette for a one-series chart.
const SERIES_COLOR = '#4f46e5'

interface TooltipPayloadEntry {
  payload: DailySalesPoint
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload

  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-ink">{formatShortDate(point.date)}</p>
      <p className="mt-1 text-ink-muted">
        Ingresos: <span className="text-ink">{formatCurrency(point.revenue)}</span>
      </p>
    </div>
  )
}

export function SalesOverviewChart({ data }: SalesOverviewChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fill: '#64748b', fontSize: 12 }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => formatCurrency(value)}
          tick={{ fill: '#64748b', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
        <Bar
          dataKey="revenue"
          fill={SERIES_COLOR}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
