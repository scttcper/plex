# Changelog

## 4.0.0 (2025-12-23)

* feat: make query accept single options object (#39) ([a482f2e](https://github.com/scttcper/plex/commit/a482f2e)), closes [#39](https://github.com/scttcper/plex/issues/39)


### BREAKING CHANGE

* PlexServer.query now takes a single {path, ...} argument; MyPlexAccount.query now takes a single {url, ...} argument; updated all callsites.

## v4 Migration Guide

### Breaking Change: `query()` Method Signature Refactor

#### Summary

Both `PlexServer.query()` and `MyPlexAccount.query()` now accept a **single options object** instead of separate positional parameters. This provides a more consistent, extensible API that aligns with modern TypeScript best practices.

#### What Changed

##### PlexServer.query()

**Before:**
```typescript
async query<T>(
  path: string,
  options?: {
    method?: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
    headers?: Record<string, string>;
    body?: Uint8Array;
    username?: string;
    password?: string;
  }
): Promise<T>
```

**After:**
```typescript
async query<T>({
  path,
  method = 'get',
  headers,
  body,
  username,
  password,
}: {
  path: string;
  method?: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
  headers?: Record<string, string>;
  body?: Uint8Array;
  username?: string;
  password?: string;
}): Promise<T>
```

##### MyPlexAccount.query()

**Before:**
```typescript
async query<T>(
  url: string,
  options?: {
    method?: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
    headers?: any;
    username?: string;
    password?: string;
  }
): Promise<T>
```

**After:**
```typescript
async query<T>({
  url,
  method = 'get',
  headers,
  username,
  password,
}: {
  url: string;
  method?: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
  headers?: any;
  username?: string;
  password?: string;
}): Promise<T>
```

#### Migration Examples

##### Simple GET requests

**Before:**
```typescript
const data = await server.query('/library/sections');
const userData = await account.query('https://plex.tv/api/v2/user');
```

**After:**
```typescript
const data = await server.query({ path: '/library/sections' });
const userData = await account.query({ url: 'https://plex.tv/api/v2/user' });
```

##### POST/PUT/DELETE requests

**Before:**
```typescript
await server.query('/playlists', { method: 'post' });
await server.query('/library/sections/1', { method: 'delete' });
```

**After:**
```typescript
await server.query({ path: '/playlists', method: 'post' });
await server.query({ path: '/library/sections/1', method: 'delete' });
```

##### Requests with custom headers

**Before:**
```typescript
await server.query('/some/endpoint', {
  method: 'put',
  headers: { 'X-Custom': 'value' }
});
```

**After:**
```typescript
await server.query({
  path: '/some/endpoint',
  method: 'put',
  headers: { 'X-Custom': 'value' }
});
```

##### Requests with authentication

**Before:**
```typescript
await server.query('/protected/resource', {
  username: 'user',
  password: 'pass'
});
```

**After:**
```typescript
await server.query({
  path: '/protected/resource',
  username: 'user',
  password: 'pass'
});
```

##### Requests with body data

**Before:**
```typescript
await server.query('/upload', {
  method: 'post',
  body: fileData
});
```

**After:**
```typescript
await server.query({
  path: '/upload',
  method: 'post',
  body: fileData
});
```

## <small>3.12.1 (2025-12-23)</small>

* fix: Use URL to build more urls, fix undefined (#41) ([bad5d33](https://github.com/scttcper/plex/commit/bad5d33)), closes [#41](https://github.com/scttcper/plex/issues/41)

## 3.12.0 (2025-12-23)

* feat: Upgrade dependencies, fix lint (#40) ([3b2ef99](https://github.com/scttcper/plex/commit/3b2ef99)), closes [#40](https://github.com/scttcper/plex/issues/40)

## 3.11.0 (2025-11-13)

* feat: upgrade dependencies, enable useDefineForClassFields (#38) ([60b35d9](https://github.com/scttcper/plex/commit/60b35d9)), closes [#38](https://github.com/scttcper/plex/issues/38)

## 3.10.0 (2025-10-12)

* test: add 2nd artist ([bc48e04](https://github.com/scttcper/plex/commit/bc48e04))
* test: add three test tracks ([1dbb741](https://github.com/scttcper/plex/commit/1dbb741))
* test: adjust test for all env ([9772c14](https://github.com/scttcper/plex/commit/9772c14))
* test: disable voice gen, switch albums? ([7006a75](https://github.com/scttcper/plex/commit/7006a75))
* feat: add audio playlist support (Track, Album, Artist) (#36) ([7a72712](https://github.com/scttcper/plex/commit/7a72712)), closes [#36](https://github.com/scttcper/plex/issues/36)
* feat: Add more generics, make Audio a playable ([31ca565](https://github.com/scttcper/plex/commit/31ca565))
* feat: add Playlist.update() static method for efficient metadata updates (#37) ([da953b3](https://github.com/scttcper/plex/commit/da953b3)), closes [#37](https://github.com/scttcper/plex/issues/37) [#35](https://github.com/scttcper/plex/issues/35)
* feat: support history test, remove null/undefined history items ([0fbe282](https://github.com/scttcper/plex/commit/0fbe282))
* add another album ([4db3295](https://github.com/scttcper/plex/commit/4db3295))
* fix lint ([eba1481](https://github.com/scttcper/plex/commit/eba1481))
* flatten music dir ([0ea6112](https://github.com/scttcper/plex/commit/0ea6112))
* fix: convert mindate to Unix timestamp (seconds) in history() method (#34) ([65c839d](https://github.com/scttcper/plex/commit/65c839d)), closes [#34](https://github.com/scttcper/plex/issues/34)
* fix: Metadatum is a silly word, rename to HistoryResult ([7af6ef6](https://github.com/scttcper/plex/commit/7af6ef6))
* chore: remove biome mentions ([c1ff0a1](https://github.com/scttcper/plex/commit/c1ff0a1))
* chore: upgrade dependencies ([1b04380](https://github.com/scttcper/plex/commit/1b04380))

## <small>3.9.2 (2025-09-28)</small>

* ignore changelog ([ba7837f](https://github.com/scttcper/plex/commit/ba7837f))
* fix: do not commit package.json ([e70a605](https://github.com/scttcper/plex/commit/e70a605))

## <small>3.9.1 (2025-09-28)</small>

* fix: release using npm trusted publish ([649e374](https://github.com/scttcper/plex/commit/649e374))
