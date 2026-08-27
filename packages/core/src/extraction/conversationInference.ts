/*
 * Conversation relationship inference.
 *
 * Builds conversation links (previous/next entry) only when evidence supports
 * it: explicit conversation/node IDs, explicit parent/next references, or an
 * ordered dialogue array. Weak evidence (neighboring rows alone) is not used to
 * confidently group unrelated UI strings.
 */

import type {
  Confidence,
  EntryContext,
} from './types'
import {
  explicitEngine,
  heuristic,
} from './provenance'

export type ConversationGroup = {
  id: string
  entryIds: string[]
  confidence: Confidence
}

/*
 * Group entries that share an explicit conversation/dialogue ID. This is the
 * strongest, most reliable grouping.
 */
export function groupByConversationId(
  entries: Array<{ id: string; context?: EntryContext }>,
): ConversationGroup[] {
  const groups = new Map<string, ConversationGroup>()
  for (const entry of entries) {
    const conversationId = entry.context?.conversationId
    if (!conversationId) continue
    const group = groups.get(conversationId) ?? {
      id: conversationId,
      entryIds: [],
      confidence: 'high' as Confidence,
    }
    group.entryIds.push(entry.id)
    groups.set(conversationId, group)
  }
  return [...groups.values()].filter((group) => group.entryIds.length > 1)
}

/*
 * Link ordered dialogue entries within a shared conversation via
 * `previousEntryId` / `nextEntryId`. Only links entries that share an explicit
 * conversation ID (strong evidence).
 */
export function linkConversationOrder(
  entries: Array<{ id: string; context?: EntryContext; order: number }>,
): void {
  const byConversation = new Map<string, Array<{ id: string; order: number; context: EntryContext }>>()
  for (const entry of entries) {
    const conversationId = entry.context?.conversationId
    if (!conversationId || !entry.context) continue
    const list = byConversation.get(conversationId) ?? []
    list.push({ id: entry.id, order: entry.order, context: entry.context })
    byConversation.set(conversationId, list)
  }

  for (const list of byConversation.values()) {
    list.sort((a, b) => a.order - b.order)
    for (let i = 0; i < list.length; i++) {
      const current = list[i]
      if (i > 0) {
        current.context.previousEntryId = list[i - 1].id
        current.context.conversationProvenance = explicitEngine('high')
      }
      if (i < list.length - 1) {
        current.context.nextEntryId = list[i + 1].id
      }
    }
  }
}

/*
 * Infer conversation grouping from an ordered array of dialogue records where
 * adjacent entries share the same speaker/listener (structural inference).
 * Lower confidence than explicit IDs, and never used to group UI strings.
 */
export function inferConversationFromAdjacency(
  entries: Array<{ id: string; context?: EntryContext; order: number }>,
  classification: (entry: { id: string; context?: EntryContext }) => boolean,
): ConversationGroup[] {
  const groups: ConversationGroup[] = []
  let current: ConversationGroup | null = null

  const ordered = [...entries].sort((a, b) => a.order - b.order)
  for (const entry of ordered) {
    const isDialogue = classification(entry)
    if (!isDialogue || !entry.context) {
      current = null
      continue
    }
    if (!current) {
      current = { id: `conversation-adjacent-${entry.id}`, entryIds: [entry.id], confidence: 'low' }
      groups.push(current)
      continue
    }
    const prev = ordered.find((e) => e.id === current!.entryIds[current!.entryIds.length - 1])
    const sameCast =
      prev?.context?.speaker === entry.context.speaker &&
      prev?.context?.listener === entry.context.listener
    if (sameCast) {
      current.entryIds.push(entry.id)
    } else {
      current = { id: `conversation-adjacent-${entry.id}`, entryIds: [entry.id], confidence: 'low' }
      groups.push(current)
    }
  }

  return groups.filter((group) => group.entryIds.length > 1).map((group) => ({
    ...group,
    confidence: heuristic('low').confidence,
  }))
}
