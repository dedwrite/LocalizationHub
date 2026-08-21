import {
  confirm,
} from '@tauri-apps/plugin-dialog'

/*
 * يرجع true إذا نقدر نكمل العملية.
 *
 * إذا ما فيه تغييرات:
 * نكمل مباشرة بدون أي dialog.
 *
 * إذا فيه تغييرات:
 * نسأل المستخدم قبل التخلص منها.
 */
export async function confirmUnsavedChanges(
  isDirty: boolean,
): Promise<boolean> {
  if (
    !isDirty
  ) {
    return true
  }

  return confirm(
    'لديك تغييرات غير محفوظة. إذا تابعت، ستفقد هذه التغييرات.',
    {
      title:
        'Unsaved Changes',

      kind:
        'warning',

      okLabel:
        'Discard Changes',

      cancelLabel:
        'Cancel',
    },
  )
}