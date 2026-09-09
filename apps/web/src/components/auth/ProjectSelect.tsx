import type { Project } from '@daily-report/types'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useSession } from '../../api/auth-client'
import { api } from '../../api/client'
import { useProjects } from '../../contexts/ProjectContext'
import { useDateFormat } from '../../hooks/useDateFormat'
import { projectDotColor } from '../../lib/project-colors'
import { useConfirm } from '../ui/ConfirmDialog'
import styles from './ProjectSelect.module.css'

/**
 * Screen 10b — the `/projects` route. `App` redirects here when no recent
 * choice (`localStorage`) picks out one project among several; the user
 * menu (6a) also redirects here, on a simple click on "Change project".
 */
export function ProjectSelect() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const format = useDateFormat()
  const { data: session } = useSession()
  const { projects, refresh, archiveProject, removeProject } = useProjects()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)

  function chooseProject(id: string) {
    void navigate(`/projets/${id}`, { replace: true })
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setPending(true)
    const project = await api.projects.create({ name: trimmed })
    await refresh()
    setPending(false)
    setCreating(false)
    setName('')
    // A project we just created is one we want to start writing in right away.
    chooseProject(project.id)
  }

  async function handleArchiveToggle(project: Project) {
    await archiveProject(project.id, !project.archivedAt)
  }

  async function handleDelete(project: Project) {
    const confirmed = await confirm({
      title: t('projectSelect.confirmDelete.title', { name: project.name }),
      body:
        project.noteCount > 0
          ? t('projectSelect.confirmDelete.bodyWithNotes', {
              notes: t('projectSelect.noteCount', { count: project.noteCount }),
            })
          : t('projectSelect.confirmDelete.body'),
      confirmLabel: t('projectSelect.confirmDelete.confirm'),
      tone: 'danger',
    })
    if (confirmed) await removeProject(project.id)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>
              {t('projectSelect.greeting', { name: session?.user.name ?? '' })}
            </h1>
            <p className={styles.subtitle}>{t('projectSelect.subtitle')}</p>
          </div>
          <div className={styles.identity}>
            <span className={styles.identity_dot} aria-hidden="true">
              {(session?.user.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            {session?.user.name}
          </div>
        </div>

        <div className={styles.grid}>
          {projects.map((project, index) => (
            <div key={project.id} className={styles.tile}>
              <div className={styles.tile_actions}>
                <button
                  type="button"
                  className={styles.tile_action}
                  onClick={() => void handleArchiveToggle(project)}
                  title={project.archivedAt ? t('projectSelect.unarchive') : t('projectSelect.archive')}
                  aria-label={
                    project.archivedAt
                      ? t('projectSelect.unarchiveNamed', { name: project.name })
                      : t('projectSelect.archiveNamed', { name: project.name })
                  }
                >
                  {project.archivedAt ? '↩' : '🗄'}
                </button>
                <button
                  type="button"
                  className={styles.tile_action}
                  onClick={() => void handleDelete(project)}
                  title={t('projectSelect.delete')}
                  aria-label={t('projectSelect.deleteNamed', { name: project.name })}
                >
                  🗑
                </button>
              </div>

              {/* The selection button covers the whole tile (::after) — same
                  principle as `NoteResultCard`: a button inside a button
                  doesn't exist, so the actions above must be siblings, not
                  children, and go back above it in z-index. */}
              <button
                type="button"
                className={styles.tile_open}
                onClick={() => chooseProject(project.id)}
              >
                <div className={styles.tile_head}>
                  <span
                    className={styles.dot}
                    style={{ background: projectDotColor(index) }}
                    aria-hidden="true"
                  />
                  <span className={styles.tile_name}>{project.name}</span>
                  {project.archivedAt ? (
                    <span className="tag tag-neutral">{t('projectSelect.archived')}</span>
                  ) : null}
                </div>
                <div className={styles.tile_meta}>
                  {project.noteCount > 0
                    ? t('projectSelect.noteCount', { count: project.noteCount })
                    : t('projectSelect.noNotes')}
                  {project.lastNoteDate
                    ? ` · ${t('projectSelect.lastNote', { day: format.dayShort(project.lastNoteDate) })}`
                    : ''}
                </div>
              </button>
            </div>
          ))}

          {creating ? (
            <form className={styles.new_form} onSubmit={(event) => void handleCreate(event)}>
              <input
                className="input"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('projectSelect.newProjectPlaceholder')}
                aria-label={t('projectSelect.newProjectPlaceholder')}
                disabled={pending}
              />
              <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
                {t('projectSelect.create')}
              </button>
            </form>
          ) : (
            <button type="button" className={styles.new_tile} onClick={() => setCreating(true)}>
              <span className={styles.new_icon} aria-hidden="true">
                ＋
              </span>
              {t('projectSelect.newProject')}
            </button>
          )}
        </div>

        <div className={styles.footer}>
          <span className="tag tag-outline">
            {t('projectSelect.projectCount', { count: projects.length })}
          </span>
          <p className={styles.footer_hint}>{t('projectSelect.footerHint')}</p>
        </div>
      </div>

      {confirmDialog}
    </div>
  )
}
