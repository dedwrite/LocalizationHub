import {
  useEffect,
  useState,
} from 'react'

import ConfirmDialog from './ConfirmDialog'

import {
  subscribeConfirmation,
  type ConfirmationRequest,
} from './confirmation'

function ConfirmationModal() {
  const [
    queue,
    setQueue,
  ] =
    useState<
      ConfirmationRequest[]
    >(
      [],
    )

  useEffect(
    () =>
      subscribeConfirmation(
        (
          request,
        ) => {
          setQueue(
            (
              current,
            ) => [
              ...current,
              request,
            ],
          )
        },
      ),

    [],
  )

  const pending =
    queue[0] ??
    null

  if (!pending) {
    return null
  }

  function finish(
    value:
      boolean,
  ) {
    pending?.resolve(
      value,
    )

    setQueue(
      (
        current,
      ) => {
        if (
          current[0]
            ?.id ===
              pending?.id
        ) {
          return current.slice(
            1,
          )
        }

        return current.filter(
          (
            request,
          ) =>
            request.id !==
              pending?.id,
        )
      },
    )
  }

  return (
    <ConfirmDialog
      open
      title={
        pending.title
      }
      message={
        pending.message
      }
      confirmLabel={
        pending.confirmLabel
      }
      cancelLabel={
        pending.cancelLabel
      }
      destructive={
        pending.destructive
      }
      onConfirm={() => {
        finish(
          true,
        )
      }}
      onCancel={() => {
        finish(
          false,
        )
      }}
    />
  )
}

export default ConfirmationModal
