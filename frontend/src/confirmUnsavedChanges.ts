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
      'You have unsaved changes. If you continue, those changes will be lost.',
    confirmLabel:
      'Discard Changes',
    cancelLabel:
      'Cancel',
    destructive: true,
  })
}
