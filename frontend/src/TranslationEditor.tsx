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
} from './tokens'

import './TranslationEditor.css'

type TranslationEditorProps = {
  value: string

  tokenProfile:
    TokenProfileId

  onChange:
    (value: string) => void
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

          /*
           * مهم للـDOM نفسه.
           *
           * الـToken يظهر LTR حتى
           * داخل سطر عربي RTL.
           */
          attributes: {
            dir:
              'ltr',
          },

          /*
           * والأهم:
           *
           * هذا يخبر خوارزمية
           * CodeMirror نفسها أن
           * هذا النطاق LTR isolate.
           */
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
  /*
   * نفس الـDecorationSet لازم:
   *
   * 1. يظهر بصريًا.
   * 2. يدخل في bidiIsolatedRanges.
   *
   * غير كذا CodeMirror قد يعرض
   * punctuation مثل % بمكان خاطئ
   * داخل النص العربي.
   */
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
    EditorView.decorations.of(
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
  onChange,
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

  /*
   * نخزن أحدث onChange
   * بدون إعادة إنشاء المحرر
   * كل مرة React يعمل render.
   */
  useEffect(
    () => {
      onChangeRef.current =
        onChange
    },
    [
      onChange,
    ],
  )

  /*
   * ننشئ CodeMirror.
   *
   * لو تغير Token Profile
   * نعيد إنشاءه عشان Decorations
   * تستخدم profile الجديد.
   */
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

      const state =
        EditorState.create({
          doc:
            value,

          extensions: [
            history(),

            keymap.of([
              ...defaultKeymap,
              ...historyKeymap,
            ]),

            /*
             * الاتجاه الأساسي
             * لمحرر الترجمة عربي.
             *
             * هذا يؤثر على العرض فقط،
             * ولا يضيف Unicode controls
             * إلى النص المحفوظ.
             */
            EditorView
              .contentAttributes
              .of({
                dir:
                  'rtl',

                lang:
                  'ar',

                spellcheck:
                  'true',
              }),

            /*
             * Protected Token
             * decorations + bidi
             * isolation.
             */
            ...tokenExtensions,

            /*
             * مزامنة CodeMirror
             * مع React.
             */
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

            /*
             * Theme الأساسي للمحرر.
             *
             * أغلب الشكل موجود
             * أيضًا في
             * TranslationEditor.css.
             */
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

                direction:
                  'rtl',

                textAlign:
                  'right',
              },

              '.cm-line': {
                direction:
                  'rtl',

                textAlign:
                  'right',

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
    ],
  )

  /*
   * لو React غير القيمة من الخارج
   * مثل:
   *
   * - اختيار Entry جديد
   * - فتح مشروع
   * - تحميل ترجمة محفوظة
   *
   * نزامن CodeMirror.
   */
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
    <div
      className="translation-editor"
      ref={
        containerRef
      }
    />
  )
}

export default TranslationEditor