import { useEffect, useMemo, useState } from 'react'
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

export const EMOTION_TREND_CHART_HEIGHT_PX = 260

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

const PERIOD_HINT: Record<Period, string> = {
  day: '最近 7 天，每天一条',
  week: '本月分 4 周',
  month: '最近 12 个月',
}

const PERIOD_FOOTNOTE: Record<Period, string> = {
  day: '「日」为本地最近 7 个自然日；当日有点选才有分值。分数由标签折算（开心偏高、低落偏低），仅供参考。',
  week: '「周」为当前自然月内 4 段周汇总（约每 7 天一段）；该段有反馈才有分值。分数由标签折算，仅供参考。',
  month: '「月」为最近 12 个自然月；当月有反馈才有分值。分数由标签折算，仅供参考。',
}

function readCssColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
  return v || fallback
}

function accentAreaFill(accent: string): string {
  const m = accent.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)$/)
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.16)`
  return 'rgba(139, 92, 246, 0.16)'
}

export function EmotionTrendChart({ records }: EmotionTrendChartProps) {
  const [period, setPeriod] = useState<Period>('day')
  const [chartChrome, setChartChrome] = useState(() => ({
    grid: 'rgba(148, 163, 184, 0.22)',
    muted: 'rgb(100, 116, 139)',
    accent: 'rgb(124, 58, 237)',
  }))

  useEffect(() => {
    const sync = () => {
      setChartChrome({
        grid: readCssColor('--sk-divider', 'rgba(148, 163, 184, 0.22)'),
        muted: readCssColor('--sk-text-muted', 'rgb(100, 116, 139)'),
        accent: readCssColor('--sk-accent', 'rgb(124, 58, 237)'),
      })
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => obs.disconnect()
  }, [])

  const { chartData, periodAllEmpty } = useMemo(() => {
    const agg =
      period === 'day'
        ? aggregateEmotionDay(records)
        : period === 'week'
          ? aggregateEmotionWeek(records)
          : aggregateEmotionMonth(records)
    return {
      periodAllEmpty: agg.values.every((v) => v == null),
      chartData: {
        labels: agg.labels,
        datasets: [
          {
            label: '情绪倾向（均分）',
            data: agg.values,
            borderColor: chartChrome.accent,
            backgroundColor: accentAreaFill(chartChrome.accent),
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 4,
            spanGaps: true,
          },
        ],
      },
    }
  }, [period, records, chartChrome])

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
          grid: { color: chartChrome.grid },
          ticks: { stepSize: 1, color: chartChrome.muted },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: chartChrome.muted,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: period === 'month' ? 12 : period === 'week' ? 4 : 7,
          },
        },
      },
    }),
    [period, chartChrome],
  )

  const hasAny = records.length > 0
  const showChart = hasAny && !periodAllEmpty

  return (
    <section className="flex shrink-0 flex-col px-2 py-1.5">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-[color:var(--sk-text-body)]">情绪趋势</h4>
        <div className="sk-segmented shrink-0 text-xs">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              title={PERIOD_HINT[p]}
              onClick={() => setPeriod(p)}
              className={`sk-segmented-btn cursor-pointer px-2 py-1 ${
                period === p ? 'sk-segmented-btn-active' : ''
              }`}
            >
              {p === 'day' ? '日' : p === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>
      </div>
      <div
        className="sk-emotion-trend-chart relative shrink-0 overflow-hidden rounded-lg"
        style={{ height: EMOTION_TREND_CHART_HEIGHT_PX }}
      >
        {showChart ? (
          <div className="absolute inset-0 px-0.5 py-0">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="sk-muted flex h-full items-center justify-center px-3 text-center text-xs leading-relaxed">
            {hasAny
              ? '该时段暂无记录；点选上方情绪标签后会出现在趋势里。'
              : '暂无记录；点击上方情绪标签后会出现在趋势里。'}
          </div>
        )}
      </div>
      <p className="sk-muted mt-0.5 shrink-0 text-[11px] leading-snug">
        {PERIOD_FOOTNOTE[period]}
      </p>
    </section>
  )
}
