# Migration: Add allowedActions to Role

This migration was created on 2025-04-09T07:57:59.553Z.

## How to use

1. Add your SQL statements to the migration.sql file
2. Test the migration locally
3. When ready, commit the migration to the repository

## Running manually

To run this migration manually, you can use:

```bash
sqlite3 prisma/dev.db < prisma/migrations/20250409T075759_add_allowedactions_to_role/migration.sql
```

## Automatic version updating

The system will automatically update the schema version to match the package.json version (0.0.6a)
after applying migrations. You don't need to manually add version records anymore.
