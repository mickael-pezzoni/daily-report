import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ConfirmDialog.module.css'

/** Ce qu'il faut savoir pour poser une question — l'écran 8 de la maquette. */
export interface ConfirmRequest {
  title: string
  body: string
  /** Le bouton qui confirme **nomme l'action** — « Supprimer », jamais « OK ». */
  confirmLabel: string
  /** `danger` peint ce bouton en destructif : la variante 8b. */
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

  // `showModal()` plutôt que l'attribut `open` : lui seul monte la modale dans
  // la couche supérieure — au-dessus du menu utilisateur et du tiroir sans
  // qu'aucun z-index n'ait à s'aligner —, dessine le fond, piège le focus et
  // rend le reste de la page inerte.
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={`dialog ${styles.dialog}`}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Échap ferme nativement. On intercepte pour répondre « non » à
      // l'appelant, au lieu de le laisser attendre une promesse en suspens.
      onCancel={(event) => {
        event.preventDefault()
        onSettle(false)
      }}
      // Un clic sur le fond a pour cible la modale elle-même : c'est ce qui
      // distingue le dehors du dedans, sans écouteur posé sur le document.
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
        {/* « Annuler » vient en premier dans le DOM, et reçoit donc le focus à
            l'ouverture : une frappe sur Entrée par réflexe ne supprime rien. */}
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
 * La modale de confirmation, à la place de `window.confirm`.
 *
 * L'appel garde la forme du natif — `if (await confirm({…}))` — mais la
 * question est rendue par l'application : elle suit le thème, la langue, et
 * peut nommer son action au lieu d'un « OK » générique.
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

  // Démontage alors qu'une question est encore posée — la carte disparaît de la
  // liste, on change de jour : on répond « non ». Sans ça l'appelant resterait
  // suspendu à une promesse que plus personne ne peut résoudre.
  useEffect(() => () => resolveRef.current?.(false), [])

  return {
    confirm,
    dialog: request ? <ConfirmDialog request={request} onSettle={settle} /> : null,
  }
}
