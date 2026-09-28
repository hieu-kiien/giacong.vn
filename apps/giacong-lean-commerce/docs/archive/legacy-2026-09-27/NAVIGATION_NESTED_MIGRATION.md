# Nested navigation migration

Migration `0021_navigation_nested_items.sql` is additive and local-only until the staging gate is opened.

1. Export the targeted `site_navigation_items` rows plus navigation audit rows; record `version`, `last_request_id`, and current `published_*` values.
2. Apply migration 0021 before deploying code that selects or writes `draft_parent_id` / `published_parent_id`.
3. Verify both nullable columns exist, row count is unchanged, all existing parents are `NULL`, and the parent index exists.
4. Deploy the worker. New writes validate same-menu parent, missing parent, and cycle constraints; publish copies the draft parent pointer atomically.
5. Verify published rows, audit counts, and public desktop/mobile rendering. Rollback is code-first: deploy the previous reader/writer (it ignores extra nullable columns); do not drop columns during rollback.

No seed menu content is included. Existing rows and user-managed logo/media data are preserved.
