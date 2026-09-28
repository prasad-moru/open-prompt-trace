import { useRef, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { Layers, GitCompareArrows } from 'lucide-react'
import type { PromptProfileState } from '../hooks/usePromptProfile'
import { TokenVisualization } from './TokenVisualization'
import { PrunedDiff } from './PrunedDiff'

export function ProfilerPanel({ state }: { state: PromptProfileState }) {
  const [tab, setTab] = useState(0)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const changeTab = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - tab
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 1
    else return
    event.preventDefault()
    setTab(next)
    buttons.current[next]?.focus()
  }
  return (
    <section className="card profiler-panel" aria-label="Prompt analysis" aria-busy={state.status === 'initializing' || state.status === 'profiling'}>
      <div className="analysis-tabs" role="tablist" aria-label="Analysis view">
        {[{ label: 'Token Stream & Heatmap', Icon: Layers }, { label: 'Pruned Diff', Icon: GitCompareArrows }].map(({ label, Icon }, index) => (
          <button key={label} ref={(element) => { buttons.current[index] = element }} id={`analysis-tab-${index}`} type="button" role="tab"
            aria-selected={tab === index} aria-controls={`analysis-panel-${index}`} tabIndex={tab === index ? 0 : -1}
            className={clsx('analysis-tab', { active: tab === index })} onClick={() => setTab(index)} onKeyDown={changeTab}>
            <Icon size={15} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`analysis-panel-${tab}`} aria-labelledby={`analysis-tab-${tab}`} tabIndex={0} className="analysis-content">
        {tab === 0 ? <TokenVisualization state={state} /> : state.profile
          ? <PrunedDiff key={state.profile.rawText} profile={state.profile} />
          : <p className={state.error ? 'error panel-status' : 'panel-status'} role={state.error ? 'alert' : 'status'}>{state.error ?? (state.status === 'initializing' ? 'Initializing WASM…' : 'Profiling…')}</p>}
      </div>
    </section>
  )
}
