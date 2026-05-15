import { useMemo, useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import {
  aggregateEmotionDay,
  aggregateEmotionMonth,
  aggregateEmotionWeek,
  type EmotionRecord,
} from '@sidekick/core'

type Period = 'day' | 'week' | 'month'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

type EmotionTrendChartProps = {
  records: EmotionRecord[]
}

export function EmotionTrendChart({ records }: EmotionTrendChartProps) {
  const [period, setPeriod] = useState<Period>('day')

  const { chartData, dayAllEmpty } = useMemo(() => {
    const agg =
      period === 'day'
        ? aggregateEmotionDay(records)
        : period === 'week'
          ? aggregateEmotionWeek(records)
          : aggregateEmotionMonth(records)
    const dayAllEmpty =
      period === 'day' && agg.values.every((v) => v == null)
    return {
      dayAllEmpty,
      chartData: {
        labels: agg.labels,
        datasets: [
          {
            label: '情绪倾向（均分）',
            data: agg.values,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            spanGaps: true,
          },
        ],
      },
    }
  }, [period, records])

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y
              if (v == null || Number.isNaN(v)) return '无记录'
              return `约 ${v.toFixed(1)} 分（示意）`
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 6,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
        },
        x: {
          grid: { display: false },
          ticks:
            period === 'day'
              ? { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
              : {},
        },
      },
    }),
    [period],
  )

  const hasAny = records.length > 0

  return (
    <section className="mt-4 flex h-full min-h-0 flex-col rounded-xl border border-slate-200 p-3">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h4 className="text-sm font-medium">情绪趋势</h4>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
          <button
            type="button"
            title="仅统计本地今天，横轴为 0–23 时"
            onClick={() => setPeriod('day')}
            className={`rounded-md px-2 py-1 ${period === 'day' ? 'bg-white shadow-sm' : ''}`}
          >
            日
          </button>
          <button
            type="button"
            title="本自然周周一至周日，有反馈的日期才有分值"
            onClick={() => setPeriod('week')}
            className={`rounded-md px-2 py-1 ${period === 'week' ? 'bg-white shadow-sm' : ''}`}
          >
            周
          </button>
          <button
            type="button"
            title="从今天往前四周汇总"
            onClick={() => setPeriod('month')}
            className={`rounded-md px-2 py-1 ${period === 'month' ? 'bg-white shadow-sm' : ''}`}
          >
            月
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {hasAny ? (
          <div className="h-full min-h-[11rem]">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="flex h-full min-h-[11rem] items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-500">
            暂无记录；点击上方情绪标签后会出现在趋势里。
          </div>
        )}
      </div>
      <p className="mt-2 shrink-0 text-xs text-slate-500">
        {period === 'day'
          ? `「日」只看本地今天，横轴为 0–23 时，有反馈的时段才有分值。${
              dayAllEmpty && hasAny
                ? '今天若尚无点，说明今天还没有情绪记录；以往某天的记录请点「周」查看。'
                : ''
            }分数由标签折算（开心偏高、低落偏低），仅供参考。`
          : period === 'week'
            ? '「周」横轴为本自然周（周一至周日）；只在当天点选过情绪时该日才有分值，未选日无点（例如今天周三但周二未反馈，则周二不会出现数据）。分数由标签折算（开心偏高、低落偏低），仅供参考。'
            : '「月」为从今天往前四周的汇总；分数由反馈标签折算（开心偏高、低落偏低），仅供参考。'}
      </p>
    </section>
  )
}
