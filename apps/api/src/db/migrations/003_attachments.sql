-- Pièces jointes d'une note.
--
-- La ligne est la source de vérité : c'est elle qui porte le nom d'origine, le
-- type et le contrôle d'accès (via la note, donc via l'utilisateur). Le
-- stockage, lui, ne connaît qu'une clé opaque et ne sait rien de qui possède
-- quoi.

CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID NOT NULL REFERENCES daily_notes(id) ON DELETE CASCADE,
  -- Clé dans le stockage. Opaque : seul le driver l'interprète.
  storage_key TEXT NOT NULL UNIQUE,
  -- Nom tel que déposé par l'utilisateur, rendu au téléchargement.
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX attachments_note_idx ON attachments (note_id, created_at);
