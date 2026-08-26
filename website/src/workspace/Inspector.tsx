import { useEffect, useMemo, useState } from 'react'
import {
  addComment, addProjectTag, findTranslationMemory, glossaryIssues, listActivity, listAssignments, listComments, metadata, resolveComment, restoreActivity, setAssignment, toggleEntryTag, type ProjectSnapshot,
} from '../appApi'
import ConfirmDialog from './ConfirmDialog'

type InspectorTab = 'workflow' | 'quality' | 'comments' | 'assignments' | 'history' | 'tags' | 'memory' | 'glossary'

type InspectorProps = {
  projectId: string
  entry: any
  snapshot: ProjectSnapshot
  draft: any
  writable: boolean
  currentUserId: string
  members: any[]
  setDraft: (value: any) => void
  setSnapshot: (value: ProjectSnapshot) => void
  onNotice: (value: string) => void
  onRestore: () => void
}

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'workflow', label: 'Workflow' },
  { id: 'quality', label: 'Quality' },
  { id: 'comments', label: 'Comments' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'history', label: 'History' },
  { id: 'tags', label: 'Tags' },
  { id: 'memory', label: 'Memory' },
  { id: 'glossary', label: 'Glossary' },
]

export default function Inspector(props: InspectorProps) {
  const { projectId, entry, snapshot, draft, writable, currentUserId, members, setDraft, setSnapshot, onNotice, onRestore } = props
  const [tab, setTab] = useState<InspectorTab>('workflow')
  const [comments, setComments] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')

  const entryId = entry?.id ?? ''
  const data = useMemo(() => metadata(draft), [draft])
  const suggestions = useMemo(() => findTranslationMemory(entry?.source ?? entry?.key ?? '', data.translationMemory), [entry, data])
  const glossary = useMemo(() => glossaryIssues(entry?.source ?? '', entry?.translation ?? '', data.glossary), [entry, data])

  useEffect(() => {
    let active = true
    listComments(projectId, entryId).then((value) => active && setComments(value)).catch(() => undefined)
    listAssignments(projectId).then((value) => active && setAssignments(value)).catch(() => undefined)
    listActivity(projectId, entryId).then((value) => active && setActivity(value)).catch(() => undefined)
    return () => { active = false }
  }, [projectId, entryId, snapshot.revision])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const assignment = assignments.find((item) => item.entryId === entryId)

  async function assignTo(userId: string | null) {
    await run(async () => {
      await setAssignment(projectId, entryId, userId)
      setAssignments(await listAssignments(projectId))
    })
  }

  async function restore(activityId: string) {
    await run(async () => {
      const result = await restoreActivity(projectId, activityId, snapshot.revision)
      setSnapshot({ ...snapshot, revision: result.revision })
      setDraft(structuredClone(result.project))
      onRestore()
      onNotice('Entry restored.')
    })
  }

  function toggleTag(tagId: string) {
    if (!writable) return
    setDraft((current: any) => {
      const next = structuredClone(current)
      next.metadata = toggleEntryTag(metadata(current), entryId, tagId)
      return next
    })
  }

  return (
    <div className="inspector">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`inspector-tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="inspector-content">
        {tab === 'workflow' && (
          <WorkflowTab entry={entry} writable={writable} />
        )}

        {tab === 'quality' && (
          <QualityTab entry={entry} draft={draft} />
        )}

        {tab === 'comments' && (
          <div className="inspector-section">
            <h3>Comments</h3>
            {comments.length === 0 && <p className="muted">No comments on this entry.</p>}
            {comments.map((item) => (
              <div key={item.id} className="comment-item">
                <span className="comment-meta">{item.authorName || 'Collaborator'} · {new Date(item.createdAt).toLocaleString()}</span>
                <p>{item.body}</p>
                {writable && <button className="link-button" onClick={() => run(async () => { await resolveComment(projectId, item.id, !item.resolved); setComments(await listComments(projectId, entryId)) })}>{item.resolved ? 'Reopen' : 'Resolve'}</button>}
              </div>
            ))}
            {writable && (
              <form className="comment-form" onSubmit={(event) => { event.preventDefault(); if (comment.trim()) run(async () => { await addComment(projectId, entryId, comment.trim()); setComment(''); setComments(await listComments(projectId, entryId)) }) }}>
                <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" aria-label="Add a comment" />
                <button disabled={busy}>Comment</button>
              </form>
            )}
          </div>
        )}

        {tab === 'assignments' && (
          <div className="inspector-section">
            <h3>Assignment</h3>
            {assignment ? (
              <p>Currently assigned to <strong>{members.find((m) => m.id === assignment.assigneeUserId)?.username || 'a member'}</strong></p>
            ) : (
              <p className="muted">Unassigned.</p>
            )}
            {writable && (
              <div className="assign-options">
                <button onClick={() => assignTo(null)}>Unassign</button>
                {members.filter((m) => m.id !== currentUserId).map((member) => (
                  <button key={member.id} onClick={() => assignTo(member.id)}>Assign to {member.username}</button>
                ))}
                {members.length === 0 && <p className="muted">No other members to assign.</p>}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="inspector-section">
            <h3>History</h3>
            {activity.length === 0 && <p className="muted">No activity for this entry.</p>}
            {activity.map((item) => (
              <div key={item.id} className="history-item">
                <span className="comment-meta">{item.actorName || 'Collaborator'} · {new Date(item.createdAt).toLocaleString()}</span>
                <p>{item.kind}</p>
                {writable && <button className="link-button" onClick={() => setConfirmRestore(item.id)}>Restore</button>}
              </div>
            ))}
          </div>
        )}

        {tab === 'tags' && (
          <div className="inspector-section">
            <h3>Tags</h3>
            <div className="chip-list">
              {data.tags.map((tag) => {
                const active = data.entryTags[entryId]?.includes(tag.id)
                return (
                  <button key={tag.id} className={`chip ${active ? 'active' : ''}`} disabled={!writable} onClick={() => toggleTag(tag.id)}>
                    {tag.label}
                  </button>
                )
              })}
            </div>
            {data.tags.length === 0 && <p className="muted">No project tags yet.</p>}
            {writable && (
              <form className="comment-form" onSubmit={(event) => { event.preventDefault(); if (newTag.trim()) { setDraft((current: any) => ({ ...current, metadata: addProjectTag(metadata(current), newTag.trim()) })); setNewTag('') } }}>
                <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="New tag label" aria-label="New tag label" />
                <button disabled={!newTag.trim()}>Add tag</button>
              </form>
            )}
          </div>
        )}

        {tab === 'memory' && (
          <div className="inspector-section">
            <h3>Translation Memory</h3>
            {suggestions.length === 0 && <p className="muted">No matching memory entries.</p>}
            {suggestions.map((suggestion, index) => (
              <div key={index} className="memory-item">
                <span className="memory-score">{Math.round(suggestion.score * 100)}%</span>
                <p><strong>{suggestion.source}</strong></p>
                <p className="muted">{suggestion.translation}</p>
                {writable && <button className="link-button" onClick={() => setDraft((current: any) => { const next = structuredClone(current); const idx = next.entries.findIndex((e: any) => e.id === entryId); if (idx >= 0) next.entries[idx].translation = suggestion.translation; return next })}>Apply</button>}
              </div>
            ))}
          </div>
        )}

        {tab === 'glossary' && (
          <div className="inspector-section">
            <h3>Glossary</h3>
            {glossary.length === 0 && <p className="muted">No glossary issues.</p>}
            {glossary.map((issue, index) => (
              <div key={index} className="glossary-item">
                <p><strong>{issue.term.sourceTerm}</strong>{issue.forbidden ? ' · forbidden term used' : ' · preferred term missing'}</p>
                {issue.term.preferredTranslation && <p className="muted">Use: {issue.term.preferredTranslation}</p>}
              </div>
            ))}
            {data.glossary.length > 0 && (
              <div className="glossary-list">
                {data.glossary.map((term, index) => <span key={index} className="glossary-term">{term.sourceTerm} → {term.preferredTranslation || '—'}</span>)}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmRestore && (
        <ConfirmDialog
          title="Restore entry"
          body="Restore this entry from the selected activity version? This will overwrite the current translation."
          confirmLabel="Restore"
          danger
          onConfirm={() => { restore(confirmRestore); setConfirmRestore(null) }}
          onCancel={() => setConfirmRestore(null)}
        />
      )}
    </div>
  )
}

function WorkflowTab({ entry, writable }: { entry: any; writable: boolean }) {
  const status = entry?.translation ? 'translated' : 'untranslated'
  return (
    <div className="inspector-section">
      <h3>Workflow</h3>
      <dl className="detail-list">
        <dt>Status</dt><dd>{status}</dd>
        <dt>Entry key</dt><dd>{entry?.key || entry?.id}</dd>
      </dl>
      {!writable && <p className="muted">You have read-only access.</p>}
    </div>
  )
}

function QualityTab({ entry, draft }: { entry: any; draft: any }) {
  const data = metadata(draft)
  const issues = entry ? glossaryIssues(entry.source ?? '', entry.translation ?? '', data.glossary) : []
  return (
    <div className="inspector-section">
      <h3>Quality</h3>
      {(!entry || entry.translation === '') && <p className="muted">Untranslated entries have no quality issues yet.</p>}
      {issues.length === 0 && entry?.translation && <p className="muted">No glossary issues detected.</p>}
      {issues.map((issue, index) => (
        <div key={index} className="qa-item"><p>{issue.term.sourceTerm}{issue.forbidden ? ' — forbidden translation used' : ' — preferred term missing'}</p></div>
      ))}
    </div>
  )
}
