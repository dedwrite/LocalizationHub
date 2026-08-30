import type {
  ProjectMetadata,
} from '@localizationhub/core'
import './ExtractionSourcePanel.css'

type Props = {
  entryId: string
  metadata: ProjectMetadata
}

/*
 * Compact Source / Origin panel for extracted entries. Shows engine,
 * provenance, and speaker/listener/context where the extraction pipeline
 * retained it. Never shows unsupported fake precision.
 */
export default function ExtractionSourcePanel({ entryId, metadata }: Props) {
  const extraction = metadata.extraction
  const info = extraction?.entries[entryId]

  if (!info) {
    return (
      <div className="extraction-source">
        <p className="muted">This entry has no extraction provenance.</p>
      </div>
    )
  }

  const { origin, context, classification } = info

  return (
    <div className="extraction-source">
      <section className="ex-section">
        <h3 className="ex-heading">Source</h3>
        <dl className="ex-detail">
          <dt>Engine</dt><dd>{extraction.familyLabel}</dd>
          {origin.containerPath && <><dt>Container</dt><dd>{origin.containerPath}</dd></>}
          {origin.resourceName && <><dt>Resource</dt><dd>{origin.resourceName}</dd></>}
          {origin.namespace && <><dt>Namespace</dt><dd>{origin.namespace}</dd></>}
          {origin.key && <><dt>Key</dt><dd>{origin.key}</dd></>}
          {origin.objectType && <><dt>Object type</dt><dd>{origin.objectType}</dd></>}
          {origin.fieldPath && <><dt>Field</dt><dd>{origin.fieldPath}</dd></>}
          {origin.table && <><dt>Table</dt><dd>{origin.table}</dd></>}
          {origin.row && <><dt>Row</dt><dd>{origin.row}</dd></>}
        </dl>
      </section>

      {context && (context.speaker || context.listener || context.listeners?.length || context.scene || context.developerNote) && (
        <section className="ex-section">
          <h3 className="ex-heading">Context</h3>
          <dl className="ex-detail">
            {context.speaker && <><dt>Speaker</dt><dd>{context.speaker}</dd></>}
            {context.listener && <><dt>Listener</dt><dd>{context.listener}{context.listenerGender && context.listenerGender !== 'unknown' ? ` (${context.listenerGender})` : ''}</dd></>}
            {context.listeners && context.listeners.length > 0 && <><dt>Listeners</dt><dd>{context.listeners.join(', ')}</dd></>}
            {context.speakerGender && context.speakerGender !== 'unknown' && <><dt>Speaker gender</dt><dd>{context.speakerGender}</dd></>}
            {context.scene && <><dt>Scene</dt><dd>{context.scene}</dd></>}
            {context.developerNote && <><dt>Developer note</dt><dd>{context.developerNote}</dd></>}
            {context.translatorNote && <><dt>Translator note</dt><dd>{context.translatorNote}</dd></>}
          </dl>
        </section>
      )}

      <section className="ex-section">
        <h3 className="ex-heading">Classification</h3>
        <p className="ex-classification">{classification}</p>
      </section>
    </div>
  )
}
