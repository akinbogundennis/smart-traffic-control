import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import Panel from '../common/Panel.jsx'
import { DIRECTIONS } from '../../utils/constants.js'

// Live performance charts (prompt section 3C/10): waiting time, queue length,
// and throughput over time, plus current demand by direction. All data comes
// from the engine's recorded history / sensor readings.

const GRID = '#2d3a4a'
const AXIS = '#93a1b3'

export default function LiveCharts({ snap }) {
  const history = snap?.history ?? []
  const demandData = DIRECTIONS.map((d) => ({
    dir: d[0].toUpperCase() + d.slice(1),
    queue: snap?.readings?.[d]?.queueLength ?? 0,
  }))

  return (
    <Panel title="Performance Over Time" icon={TrendingUp}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChartBox title="Average waiting time (s)">
          <AreaChart data={history}>
            <defs>
              <linearGradient id="wait" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5bb8ff" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#5bb8ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke={AXIS} fontSize={10} unit="s" />
            <YAxis stroke={AXIS} fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="avgWait" stroke="#5bb8ff" fill="url(#wait)" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ChartBox>

        <ChartBox title="Total queue length (cars)">
          <LineChart data={history}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke={AXIS} fontSize={10} unit="s" />
            <YAxis stroke={AXIS} fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="queue" stroke="#ffd23f" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartBox>

        <ChartBox title="Throughput (veh/hr)">
          <LineChart data={history}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke={AXIS} fontSize={10} unit="s" />
            <YAxis stroke={AXIS} fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="throughput" stroke="#3ddc84" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartBox>

        <ChartBox title="Current demand by direction (queued)">
          <BarChart data={demandData}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="dir" stroke={AXIS} fontSize={10} />
            <YAxis stroke={AXIS} fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(91,184,255,0.08)' }} />
            <Bar dataKey="queue" fill="#5bb8ff" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartBox>
      </div>
    </Panel>
  )
}

function ChartBox({ title, children }) {
  return (
    <div>
      <div className="text-xs text-muted mb-2">{title}</div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: '#1b2430',
  border: '1px solid #2d3a4a',
  borderRadius: 8,
  fontSize: 12,
  color: '#e6ecf3',
}
