const chunkSize = 32_768;

export function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

export function encodeBase64Url(value: Uint8Array): string {
  return encodeBase64Bytes(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[\w-]*$/.test(value) || value.length % 4 === 1) {
    throw new TypeError('Invalid base64url string.');
  }
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = globalThis.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
