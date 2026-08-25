import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { listCloudProjectMembers } from './cloudProjectsApi'
import { listAssignments, setEntryAssignment } from './cloudWorkflowApi'
import type { ProjectMetadata } from '@localizationhub/core'

type Props = { projectId: string; entryId: string; metadata: ProjectMetadata; setMetadata: Dispatch<SetStateAction<ProjectMetadata>>; readOnly: boolean }
export default function EntryAssignmentPanel({ projectId, entryId, metadata, setMetadata, readOnly }: Props) { const [members, setMembers] = useState<{ userId: string; username: string }[]>([]); const [value, setValue] = useState(metadata.assignments[entryId] ?? '')
  useEffect(() => { void Promise.all([listCloudProjectMembers(projectId), listAssignments(projectId)]).then(([projectMembers, assignments]) => { setMembers(projectMembers); const assignment = assignments.find((item) => item.entryId === entryId)?.assigneeUserId ?? ''; setValue(assignment); setMetadata((current) => ({ ...current, assignments: Object.fromEntries(assignments.map((item) => [item.entryId, item.assigneeUserId])) })) }).catch(() => undefined) }, [projectId, entryId, setMetadata])
  return <section className="token-panel"><div className="token-panel-header"><strong>Assignment</strong></div><select value={value} disabled={readOnly} onChange={(event) => { const next = event.target.value; setValue(next); void setEntryAssignment(projectId, entryId, next || null).then(() => setMetadata((current) => { const assignments = { ...current.assignments }; if (next) assignments[entryId] = next; else delete assignments[entryId]; return { ...current, assignments } })) }}>{<option value="">Unassigned</option>}{members.map((member) => <option key={member.userId} value={member.userId}>{member.username}</option>)}</select></section>
}
