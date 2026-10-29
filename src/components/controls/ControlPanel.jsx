import {
  Play, Pause, RotateCcw, Gauge, Zap, CloudRain,
  Car, Activity, Settings2,
} from 'lucide-react'
import {
  MODE, WEATHER, WEATHER_KEYS, VOLUME, VOLUME_KEYS, SPEED_OPTIONS, DIRECTIONS,
} from '../../utils/constants.js'
import Panel from '../common/Panel.jsx'

// Operator control panel. Every control maps to a real engine action/config
// change (prompt: "Changes should affect the actual simulation logic").

export default function ControlPanel({
  config, running, speed, snap, showSensors,
  onStart, onPause, onReset, onSpeed, onChange, onEmergency, onToggleSensors,
}) {
  const setVolume = (key) => {
    // Presets set the total arrival rate; "custom" keeps the current rate but
    // lets the operator tune per-direction demand below.
    const patch = { volumeKey: key }
    if (key !== 'custom') patch.totalRate = VOLUME[key].rate
    onChange(patch)
  }

  const setDemand = (dir, value) => {
    onChange({ demand: { ...config.demand, [dir]: value } })
  }

  return (
    <Panel title="Simulation Controls" icon={Settings2} className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5">
        {/* Transport controls */}
        <div className="flex gap-2">
          {running ? (
            <button className="btn-primary flex-1" onClick={onPause}>
              <Pause size={15} /> Pause
            </button>
          ) : (
            <button className="btn-primary flex-1" onClick={onStart}>
              <Play size={15} /> Start
            </button>
          )}
          <button className="btn flex-1" onClick={onReset}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>

        {/* Speed */}
        <Field label="Simulation speed" icon={Gauge}>
          <div className="segmented">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                className={`seg ${speed === s ? 'seg-active' : ''}`}
                onClick={() => onSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </Field>

        {/* Mode */}
        <Field label="Control mode" icon={Activity}>
          <div className="segmented">
            <button
              className={`seg ${config.mode === MODE.FIXED ? 'seg-active' : ''}`}
              onClick={() => onChange({ mode: MODE.FIXED })}
            >
              Fixed-Time
            </button>
            <button
              className={`seg ${config.mode === MODE.ADAPTIVE ? 'seg-active' : ''}`}
              onClick={() => onChange({ mode: MODE.ADAPTIVE })}
            >
              Adaptive
            </button>
          </div>
          <p className="hint">Changing mode resets the run for a clean comparison.</p>
        </Field>

        {/* Weather */}
        <Field label="Weather" icon={CloudRain}>
          <select
            className="input"
            value={config.weatherKey}
            onChange={(e) => onChange({ weatherKey: e.target.value })}
          >
            {WEATHER_KEYS.map((k) => (
              <option key={k} value={k}>{WEATHER[k].label}</option>
            ))}
          </select>
        </Field>

        {/* Volume */}
        <Field label="Traffic volume" icon={Car}>
          <select
            className="input"
            value={config.volumeKey}
            onChange={(e) => setVolume(e.target.value)}
          >
            {VOLUME_KEYS.map((k) => (
              <option key={k} value={k}>{VOLUME[k].label}</option>
            ))}
          </select>
        </Field>

        {/* Directional demand */}
        <Field label="Directional demand">
          <div className="grid grid-cols-2 gap-2">
            {DIRECTIONS.map((dir) => (
              <label key={dir} className="text-xs text-muted capitalize">
                {dir}
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={config.demand[dir] ?? 1}
                  onChange={(e) => setDemand(dir, Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </label>
            ))}
          </div>
          <p className="hint">Relative arrival share per approach (0-4).</p>
        </Field>

        {/* Seed */}
        <Field label="Random seed">
          <input
            className="input"
            type="text"
            value={config.seed}
            onChange={(e) => onChange({ seed: e.target.value })}
          />
          <p className="hint">Same seed + inputs = reproducible run.</p>
        </Field>

        {/* Sensor viz */}
        <label className="flex items-center justify-between text-sm">
          <span className="text-muted">Live sensor visualization</span>
          <input
            type="checkbox"
            checked={showSensors}
            onChange={(e) => onToggleSensors(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
        </label>

        {/* Emergency */}
        <Field label="Emergency vehicle" icon={Zap}>
          <div className="grid grid-cols-2 gap-2">
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                className="btn-danger capitalize"
                onClick={() => onEmergency(dir)}
                disabled={!running}
                title={running ? '' : 'Start the simulation first'}
              >
                {dir}
              </button>
            ))}
          </div>
          {snap?.emergency && (
            <p className="hint text-danger">
              Priority {snap.emergency.granted ? 'granted' : 'requested'} for{' '}
              {snap.emergency.dir.toUpperCase()}
            </p>
          )}
        </Field>
      </div>
    </Panel>
  )
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={13} className="text-muted" />}
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      {children}
    </div>
  )
}
