import {
  useEffect,
  useRef,
} from 'react'

import {
  EditorState,
} from '@codemirror/state'

import {
  Decoration,
  Direction,
  EditorView,
  keymap,
  placeholder as codeMirrorPlaceholder,
  type DecorationSet,
} from '@codemirror/view'

import {
  defaultKeymap,
  history,
  historyKeymap,
} from '@codemirror/commands'

import {
  extractProtectedTokens,
  type TokenProfileId,
} from '@localizationhub/core'

import './TranslationEditor.css'

type EditorDirection =
  | 'ltr'
  | 'rtl'
  | 'auto'

type TranslationEditorProps = {
  value: string

  tokenProfile:
    TokenProfileId

  direction:
    EditorDirection

  locale?:
    string

  placeholderText?:
    string

  onChange:
    (value: string) => void

  onSave?:
    () => void

  onNextUntranslated?:
    () => void

  onPreviousUntranslated?:
    () => void

  onNext?:
    () => void

  onPrevious?:
    () => void
}

function createTokenDecorations(
  view: EditorView,
  tokenProfile:
    TokenProfileId,
): DecorationSet {
  const text =
    view.state.doc.toString()

  const tokens =
    extractProtectedTokens(
      text,
      tokenProfile,
    )

  const ranges =
    tokens.map(
      (token) =>
        Decoration.mark({
          class:
            'cm-protected-token',

          attributes: {
            dir:
              'ltr',
          },

          bidiIsolate:
            Direction.LTR,
        }).range(
          token.start,
          token.end,
        ),
    )

  return Decoration.set(
    ranges,
    true,
  )
}

function createTokenExtensions(
  tokenProfile:
    TokenProfileId,
) {
  const getDecorations =
    (
      view:
        EditorView,
    ) =>
      createTokenDecorations(
        view,
        tokenProfile,
      )

  return [
    EditorView
      .decorations
      .of(
        getDecorations,
      ),

    EditorView
      .bidiIsolatedRanges
      .of(
        getDecorations,
      ),
  ]
}

function TranslationEditor({
  value,

  tokenProfile,

  direction,

  locale,

  placeholderText =
    'Enter translation...',

  onChange,

  onSave,

  onNextUntranslated,

  onPreviousUntranslated,

  onNext,

  onPrevious,
}: TranslationEditorProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const viewRef =
    useRef<EditorView | null>(
      null,
    )

  const onChangeRef =
    useRef(
      onChange,
    )

  const onSaveRef =
    useRef(
      onSave,
    )

  const onNextUntranslatedRef =
    useRef(
      onNextUntranslated,
    )

  const onPreviousUntranslatedRef =
    useRef(
      onPreviousUntranslated,
    )

  const onNextRef =
    useRef(
      onNext,
    )

  const onPreviousRef =
    useRef(
      onPrevious,
    )

  useEffect(
    () => {
      onChangeRef.current =
        onChange
    },
    [
      onChange,
    ],
  )

  useEffect(
    () => {
      onSaveRef.current =
        onSave
    },
    [
      onSave,
    ],
  )

  useEffect(
    () => {
      onNextUntranslatedRef.current =
        onNextUntranslated
    },
    [
      onNextUntranslated,
    ],
  )

  useEffect(
    () => {
      onPreviousUntranslatedRef.current =
        onPreviousUntranslated
    },
    [
      onPreviousUntranslated,
    ],
  )

  useEffect(
    () => {
      onNextRef.current =
        onNext
    },
    [
      onNext,
    ],
  )

  useEffect(
    () => {
      onPreviousRef.current =
        onPrevious
    },
    [
      onPrevious,
    ],
  )

  useEffect(
    () => {
      const container =
        containerRef.current

      if (!container) {
        return
      }

      const tokenExtensions =
        createTokenExtensions(
          tokenProfile,
        )

      const contentAttributes:
        Record<string, string> = {
          dir:
            direction,

          spellcheck:
            'true',
        }

      if (
        locale
      ) {
        contentAttributes.lang =
          locale
      }

      const textAlign =
        direction === 'rtl'
          ? 'right'
          : direction === 'ltr'
            ? 'left'
            : 'start'

      const state =
        EditorState.create({
          doc:
            value,

          extensions: [
            history(),

            keymap.of([
              /*
               * Save Project
               */
              {
                key:
                  'Mod-s',

                preventDefault:
                  true,

                run:
                  () => {
                    onSaveRef
                      .current
                      ?.()

                    return true
                  },
              },

              /*
               * Next untranslated.
               */
              {
                key:
                  'Mod-Enter',

                preventDefault:
                  true,

                run:
                  () => {
                    onNextUntranslatedRef
                      .current
                      ?.()

                    return true
                  },
              },

              /*
               * Previous untranslated.
               */
              {
                key:
                  'Shift-Mod-Enter',

                preventDefault:
                  true,

                run:
                  () => {
                    onPreviousUntranslatedRef
                      .current
                      ?.()

                    return true
                  },
              },

              /*
               * Normal entry navigation.
               */
              {
                key:
                  'Alt-ArrowDown',

                preventDefault:
                  true,

                run:
                  () => {
                    onNextRef
                      .current
                      ?.()

                    return true
                  },
              },

              {
                key:
                  'Alt-ArrowUp',

                preventDefault:
                  true,

                run:
                  () => {
                    onPreviousRef
                      .current
                      ?.()

                    return true
                  },
              },

              ...defaultKeymap,

              ...historyKeymap,
            ]),

            EditorView
              .contentAttributes
              .of(
                contentAttributes,
              ),

            codeMirrorPlaceholder(
              placeholderText,
            ),

            ...tokenExtensions,

            EditorView
              .updateListener
              .of(
                (
                  update,
                ) => {
                  if (
                    !update.docChanged
                  ) {
                    return
                  }

                  const nextValue =
                    update.state.doc
                      .toString()

                  onChangeRef.current(
                    nextValue,
                  )
                },
              ),

            EditorView.lineWrapping,

            EditorView.theme({
              '&': {
                height:
                  '100%',

                backgroundColor:
                  'transparent',
              },

              '.cm-scroller': {
                overflow:
                  'auto',

                fontFamily:
                  'inherit',
              },

              '.cm-content': {
                minHeight:
                  '220px',

                padding:
                  '18px',

                caretColor:
                  '#f1f2f5',

                direction,

                textAlign,
              },

              '.cm-line': {
                direction,

                textAlign,

                lineHeight:
                  '1.9',
              },

              '.cm-cursor': {
                borderLeftColor:
                  '#f1f2f5',
              },

              '.cm-selectionBackground':
                {
                  backgroundColor:
                    'rgba(109, 93, 252, 0.28) !important',
                },

              '&.cm-focused .cm-selectionBackground':
                {
                  backgroundColor:
                    'rgba(109, 93, 252, 0.34) !important',
                },

              '&.cm-focused': {
                outline:
                  'none',
              },
            }),
          ],
        })

      const view =
        new EditorView({
          state,

          parent:
            container,
        })

      viewRef.current =
        view

      return () => {
        view.destroy()

        viewRef.current =
          null
      }
    },
    [
      tokenProfile,
      direction,
      locale,
      placeholderText,
    ],
  )

  useEffect(
    () => {
      const view =
        viewRef.current

      if (!view) {
        return
      }

      const currentValue =
        view.state.doc
          .toString()

      if (
        currentValue === value
      ) {
        return
      }

      view.dispatch({
        changes: {
          from:
            0,

          to:
            view.state.doc.length,

          insert:
            value,
        },
      })
    },
    [
      value,
    ],
  )

  return (
    <div className="translation-editor-shell">
      <div
        className={
          `translation-editor direction-${direction}`
        }
        ref={
          containerRef
        }
      />

      <div
        className="editor-shortcuts"
        aria-label="Editor shortcuts"
      >
        <div className="editor-shortcut">
          <kbd>
            Ctrl
          </kbd>

          <span>
            +
          </span>

          <kbd>
            S
          </kbd>

          <span className="shortcut-label">
            Save
          </span>
        </div>

        <span className="shortcut-divider" />

        <div className="editor-shortcut">
          <kbd>
            Ctrl
          </kbd>

          <span>
            +
          </span>

          <kbd>
            Enter
          </kbd>

          <span className="shortcut-label">
            Next Untranslated
          </span>
        </div>

        <span className="shortcut-divider" />

        <div className="editor-shortcut">
          <kbd>
            Ctrl
          </kbd>

          <span>
            +
          </span>

          <kbd>
            Shift
          </kbd>

          <span>
            +
          </span>

          <kbd>
            Enter
          </kbd>

          <span className="shortcut-label">
            Previous Untranslated
          </span>
        </div>

        <span className="shortcut-divider" />

        <div className="editor-shortcut">
          <kbd>
            Alt
          </kbd>

          <span>
            +
          </span>

          <kbd>
            ↓
          </kbd>

          <span className="shortcut-label">
            Next
          </span>
        </div>

        <div className="editor-shortcut">
          <kbd>
            Alt
          </kbd>

          <span>
            +
          </span>

          <kbd>
            ↑
          </kbd>

          <span className="shortcut-label">
            Previous
          </span>
        </div>
      </div>
    </div>
  )
}

export default TranslationEditor