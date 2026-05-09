# Agent Rules

## Environment

- Use `pnpm` (not npm/yarn) for package management.

## Implementation

- When comparing against the Python implementation, use `~/gh/python-plexapi` as the reference for Plex behavior and feature coverage. Match the useful behavior, but do not copy Python-shaped APIs when a TypeScript-native shape is clearer.
- Prefer TypeScript options objects, explicit return types, and narrow/conditional return types over positional arguments or kwargs-style objects.
- Use real Plex response payloads to decide which fields are required vs optional. Temporarily log payloads in focused tests or scripts when needed, then remove all debug logging before finishing.
- Avoid fake type safety. If Plex accepts server/plugin-specific string values, document common examples but keep the type honest instead of inventing a closed union.
- Breaking public API changes should be explicit in commit messages with a `BREAKING CHANGE:` footer so semantic release can pick them up.

## Testing

- Tests use a real Plex server via `test/test-client.ts` (`createClient()`). Credentials are in `.env`.
- Tests that create resources must clean up after themselves. Use `beforeAll`/`afterAll` to remove leftovers from prior failed runs (e.g. delete any collection matching the test name before and after).
- When a test fails, inspect the actual error message/value before changing source code — the bug may be in the test assertion, not the implementation.
- Tests should try not to destroy data since the same test server is used across all tests. Running the test again should not require re-creating the server or re-adding media. If a test needs to create a resource, it should clean up after itself (e.g. delete the collection it created). If a test needs to modify an existing resource, it should restore the original state before finishing.
- No branching logic (`if`/`else`, ternaries, `||` expressions) inside test bodies. A test that silently returns early or hides assertions behind conditions proves nothing. If a test can only run under certain conditions, ensure those conditions exist in the test setup. Use direct assertions (`toBe`, `toEqual`, `typeof` checks) — not `toSatisfy` or `expect(a || b).toBe(true)`.
- Use mocked tests for exact query-shape and type-instantiation coverage. Use real-server tests for Plex compatibility, especially for response shapes and safe read-only helpers.
- Prefer safe real-server coverage when feasible. For mutations, create temporary resources with unique test names and clean them up before and after the test.

## Plex API

- Not all endpoints return `{ MediaContainer: { ... } }`. Some (e.g. `/butler`) use a different root key (`{ ButlerTasks: { ButlerTask: [] } }`). Check the actual response shape with curl before assuming `fetchItems()` will work or console.log the response in a test.
- Collection creation (`POST /library/collections`) requires a `sectionId` parameter in addition to `type`, `title`, and `uri`.
- Some API responses have fields that can be empty strings or missing (e.g. device `name`). Don't assert `toBeTruthy()` on fields that may legitimately be empty — use `typeof` checks instead.
- Some Plex endpoints omit fields that Python exposes as optional attributes. Keep those fields optional unless a real payload proves they are always present for the endpoint being modeled.
