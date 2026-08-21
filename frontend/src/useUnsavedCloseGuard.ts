import {
  useEffect,
  useRef,
} from 'react'

import {
  getCurrentWindow,
} from '@tauri-apps/api/window'

import {
  confirmUnsavedChanges,
} from './confirmUnsavedChanges'

export function useUnsavedCloseGuard(
  isDirty: boolean,
) {
  /*
   * نخزن آخر قيمة لـisDirty
   * داخل ref.
   *
   * كذا ما نحتاج نفك ونركب
   * window listener مع كل حرف.
   */
  const isDirtyRef =
    useRef(
      isDirty,
    )

  /*
   * إذا المستخدم وافق على الإغلاق
   * نحتاج نتجاوز الـguard مرة واحدة
   * حتى ما ندخل loop.
   */
  const allowCloseRef =
    useRef(
      false,
    )

  useEffect(
    () => {
      isDirtyRef.current =
        isDirty
    },
    [
      isDirty,
    ],
  )

  useEffect(
    () => {
      const appWindow =
        getCurrentWindow()

      let disposed =
        false

      let unlisten:
        (() => void) | undefined

      async function attachListener() {
        unlisten =
          await appWindow.onCloseRequested(
            async (
              event,
            ) => {
              /*
               * نحن من طلبنا الإغلاق
               * بعد موافقة المستخدم.
               */
              if (
                allowCloseRef.current
              ) {
                return
              }

              /*
               * ما فيه تغييرات؟
               * خل النافذة تقفل طبيعي.
               */
              if (
                !isDirtyRef.current
              ) {
                return
              }

              /*
               * فيه تغييرات:
               * نوقف الإغلاق مؤقتًا.
               */
              event.preventDefault()

              const canClose =
                await confirmUnsavedChanges(
                  true,
                )

              if (
                !canClose
              ) {
                return
              }

              /*
               * المستخدم اختار
               * Discard Changes.
               */
              allowCloseRef.current =
                true

              try {
                /*
                 * destroy() يقفل النافذة
                 * مباشرة بعد الموافقة،
                 * بدون إعادة رحلة
                 * close-request المعتادة.
                 */
                await appWindow.destroy()
              } catch (
                error
              ) {
                console.error(
                  'Failed to close window:',
                  error,
                )

                allowCloseRef.current =
                  false
              }
            },
          )

        /*
         * لو الـcomponent اختفى أثناء
         * انتظار التسجيل، ننظف فورًا.
         */
        if (
          disposed &&
          unlisten
        ) {
          unlisten()
        }
      }

      void attachListener()

      return () => {
        disposed =
          true

        unlisten?.()
      }
    },
    [],
  )
}