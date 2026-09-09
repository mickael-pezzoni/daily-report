import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ConfirmDialog.module.css'

/** What's needed to ask a question — mockup screen 8. */
export interface ConfirmRequest {
  title: string
  body: string
  /** The confirm button **names the action** — "Delete", never "OK". */
  confirmLabel: string
  /** `danger` paints this button as destructive: the 8b variant. */
  tone?: 'neutral' | 'danger'
}

interface ConfirmDialogProps {
  request: ConfirmRequest
  onSettle: (confirmed: boolean) => void
}

function ConfirmDialog({ request, onSettle }: ConfirmDialogProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const bodyId = useId()

  // `showModal()` rather than the `open` attribute: only it promotes the
  // modal to the top layer — above the user menu and the drawer without any
  // z-index having to line up —, draws the backdrop, traps focus, and makes
  // the rest of the page inert.
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={`dialog ${styles.dialog}`}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape closes natively. We intercept it to answer "no" to the
      // caller, instead of leaving it waiting on a promise that never settles.
      onCancel={(event) => {
        event.preventDefault()
        onSettle(false)
      }}
      // A click on the backdrop targets the modal itself: that's what tells
      // outside from inside apart, without a listener on the document.
      onClick={(event) => {
        if (event.target === ref.current) onSettle(false)
      }}
    >
      <h2 className="dialog-title" id={titleId}>
        {request.title}
      </h2>
      <p className="dialog-body" id={bodyId}>
        {request.body}
      </p>
      <div className="dialog-actions">
        {/* "Cancel" comes first in the DOM, and therefore gets focus on
            open: a reflexive Enter press deletes nothing. */}
        <button type="button" className="btn btn-secondary" onClick={() => onSettle(false)}>
          {t('dialog.cancel')}
        </button>
        <button
          type="button"
          className={`btn btn-primary ${request.tone === 'danger' ? styles.danger : ''}`}
          onClick={() => onSettle(true)}
        >
          {request.confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

/**
 * The confirmation modal, standing in for `window.confirm`.
 *
 * The call keeps the native shape — `if (await confirm({…}))` — but the
 * question is rendered by the application: it follows the theme, the
 * language, and can name its action instead of a generic "OK".
 *
 * ```tsx
 * const { confirm, dialog } = useConfirm()
 * …
 * if (await confirm({ title, body, confirmLabel, tone: 'danger' })) remove()
 * …
 * return <>{…}{dialog}</>
 * ```
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmRequest) => {
    setRequest(next)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = useCallback((confirmed: boolean) => {
    setRequest(null)
    resolveRef.current?.(confirmed)
    resolveRef.current = null
  }, [])

  // Unmounted while a question is still pending — the card disappears from
  // the list, we switch days: we answer "no". Without this the caller would
  // stay stuck on a promise nobody can resolve anymore.
  useEffect(() => () => resolveRef.current?.(false), [])

  return {
    confirm,
    dialog: request ? <ConfirmDialog request={request} onSettle={settle} /> : null,
  }
}
