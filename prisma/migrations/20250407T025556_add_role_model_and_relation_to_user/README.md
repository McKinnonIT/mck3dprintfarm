# Migration: Add Role model and relation to User

This migration was created on 2025-04-07T02:55:56.327Z.

## How to use

1. Add your SQL statements to the migration.sql file
2. Test the migration locally
3. When ready, commit the migration to the repository

## Running manually

To run this migration manually, you can use:

```bash
sqlite3 prisma/dev.db < prisma/migrations/20250407T025556_add_role_model_and_relation_to_user/migration.sql
```

## Automatic version updating

The system will automatically update the schema version to match the package.json version (0.0.4a)
after applying migrations. You don't need to manually add version records anymore.
