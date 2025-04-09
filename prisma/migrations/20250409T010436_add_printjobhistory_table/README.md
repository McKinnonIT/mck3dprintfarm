# Migration: Add PrintJobHistory table

This migration was created on 2025-04-09T01:04:36.562Z.

## How to use

1. Add your SQL statements to the migration.sql file
2. Test the migration locally
3. When ready, commit the migration to the repository

## Running manually

To run this migration manually, you can use:

```bash
sqlite3 prisma/dev.db < prisma/migrations/20250409T010436_add_printjobhistory_table/migration.sql
```

## Automatic version updating

The system will automatically update the schema version to match the package.json version (0.0.5a)
after applying migrations. You don't need to manually add version records anymore.
