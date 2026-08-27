import { useState, type ReactNode } from 'react'
import './EditorInspector.css'

type InspectorTab = 'workflow' | 'quality' | 'comments' | 'history' | 'source'
type Props = { render: (tab: InspectorTab) => ReactNode }

export default function EditorInspector({ render }: Props) {
  const [tab, setTab] = useState<InspectorTab>('workflow')
  const [collapsed, setCollapsed] = useState(false)
  return <aside className={`editor-inspector ${collapsed ? 'collapsed' : ''}`}>
    <div className="editor-inspector-heading"><strong>Inspector</strong><button type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? 'Show' : 'Hide'}</button></div>
    {!collapsed && <><nav className="editor-inspector-tabs" aria-label="Entry inspector">{(['workflow', 'quality', 'comments', 'history', 'source'] as const).map((item) => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav><div className="editor-inspector-content">{render(tab)}</div></>}
  </aside>
}
