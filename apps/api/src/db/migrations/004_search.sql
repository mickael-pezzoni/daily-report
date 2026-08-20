-- Recherche plein texte : titre + contenu des notes, noms des pièces jointes.
--
-- Chaque note est indexée dans la langue du compte qui l'a écrite plutôt qu'en
-- français fixe : le dictionnaire linguistique change la racinisation
-- (stemming), pas seulement les mots vides. La langue est figée à la création
-- (déclencheur ci-dessous) plutôt que relue à chaque écriture : changer la
-- langue de l'interface après coup ne doit pas faire dériver l'indexation
-- d'une note déjà écrite.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() n'est pas déclarée IMMUTABLE par Postgres (elle dépend du
-- search_path pour trouver son dictionnaire), ce qui l'interdit dans une
-- colonne générée ou un index fonctionnel. Ce wrapper au search_path fixe est
-- le contournement standard.
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
   SET search_path = public, pg_catalog;

ALTER TABLE daily_notes ADD COLUMN search_language regconfig NOT NULL DEFAULT 'french';

-- Snapshote la langue du compte au moment de la création de la note. Les
-- tables better-auth ("user") ne passent pas par Kysely : c'est le seul
-- endroit simple pour faire cette jointure sans toucher aux routes.
CREATE OR REPLACE FUNCTION daily_notes_set_search_language()
RETURNS trigger AS $$
BEGIN
  SELECT CASE "user".language
           WHEN 'en' THEN 'english'::regconfig
           ELSE 'french'::regconfig
         END
  INTO NEW.search_language
  FROM "user"
  WHERE "user".id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = pg_catalog, public;

CREATE TRIGGER daily_notes_search_language_trigger
  BEFORE INSERT ON daily_notes
  FOR EACH ROW EXECUTE FUNCTION daily_notes_set_search_language();

-- Titre pondéré 'A', contenu pondéré 'B' : prépare un futur tri par
-- pertinence (ts_rank) sans migration supplémentaire. STORED : Postgres la
-- maintient tout seul à chaque écriture de title/content_text.
ALTER TABLE daily_notes ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector(search_language, f_unaccent(title)), 'A') ||
    setweight(to_tsvector(search_language, f_unaccent(content_text)), 'B')
  ) STORED;

CREATE INDEX daily_notes_search_idx ON daily_notes USING GIN (search_vector);

-- Un nom de fichier n'est pas de la prose : un trigramme retrouve un fragment
-- au milieu d'un mot composé (« latence » dans « graphe-latence.png »), ce
-- qu'un dictionnaire linguistique découperait mal.
CREATE INDEX attachments_filename_trgm_idx ON attachments
  USING GIN (f_unaccent(filename) gin_trgm_ops);
