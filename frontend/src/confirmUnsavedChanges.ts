import {
  showConfirmation,
} from './confirmation'

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

  return showConfirmation({
    title:
      'Unsaved Changes',
    message:
      'لديك تغييرات غير محفوظة. إذا تابعت، ستفقد هذه التغييرات.',
    confirmLabel:
      'Discard Changes',
    cancelLabel:
      'Cancel',
    destructive: true,
  })
}