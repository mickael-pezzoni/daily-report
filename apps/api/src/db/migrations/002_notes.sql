-- Les notes du journal : une par utilisateur et par date.
--
-- La contrainte UNIQUE (user_id, note_date) EST la règle métier — elle vit ici,
-- pas dans du code applicatif qu'on pourrait contourner.

CREATE TABLE daily_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  note_date    DATE NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  -- Document TipTap, tel que l'éditeur le sérialise.
  content      JSONB NOT NULL,
  -- Texte aplati, recalculé au serveur à chaque écriture. Sert aux extraits des
  -- listes aujourd'hui, à la recherche plein texte française plus tard.
  content_text TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, note_date)
);

-- Couvre le listing « derniers jours » et l'agrégation du calendrier.
CREATE INDEX daily_notes_user_date_idx ON daily_notes (user_id, note_date DESC);
