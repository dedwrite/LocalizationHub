export type ConfirmationOptions = {
  title:
    string

  message:
    string

  confirmLabel?:
    string

  cancelLabel?:
    string

  destructive?:
    boolean
}

export type ConfirmationRequest =
  ConfirmationOptions & {
    id:
      number

    confirmLabel:
      string

    cancelLabel:
      string

    destructive:
      boolean

    resolve:
      (
        value:
          boolean,
      ) => void
  }

type ConfirmationListener =
  (
    request:
      ConfirmationRequest,
  ) => void

let listener:
  ConfirmationListener | null =
    null

const backlog:
  ConfirmationRequest[] =
    []

let nextId =
  0

export function subscribeConfirmation(
  nextListener:
    ConfirmationListener,
) {
  if (listener) {
    throw new Error(
      'A confirmation listener is already registered.',
    )
  }

  listener =
    nextListener

  const queued =
    backlog.splice(
      0,
      backlog.length,
    )

  for (
    const request of
      queued
  ) {
    nextListener(
      request,
    )
  }

  return () => {
    if (
      listener ===
        nextListener
    ) {
      listener =
        null
    }
  }
}

export function showConfirmation(
  options:
    ConfirmationOptions,
): Promise<boolean> {
  return new Promise(
    (
      resolve,
    ) => {
      const request:
        ConfirmationRequest = {
        id:
          nextId++,

        ...options,

        confirmLabel:
          options.confirmLabel ??
          'Confirm',

        cancelLabel:
          options.cancelLabel ??
          'Cancel',

        destructive:
          options.destructive ??
          false,

        resolve,
      }

      if (listener) {
        listener(
          request,
        )
      } else {
        backlog.push(
          request,
        )
      }
    },
  )
}
