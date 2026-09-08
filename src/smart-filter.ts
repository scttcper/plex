/** Return the ordered Plex query parameters, preserving repeated filters and push/pop groups. */
export function smartFilterParams(content: string): URLSearchParams {
  const uri = content.includes('?') ? content : decodeURIComponent(content);
  const queryStart = uri.indexOf('?');
  return new URLSearchParams(queryStart === -1 ? '' : uri.slice(queryStart + 1));
}
