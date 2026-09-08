#!/bin/sh
set -e

node apps/api/dist/db/migrate.js
exec node apps/api/dist/index.js
