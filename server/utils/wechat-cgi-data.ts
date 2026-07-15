import { extractCgiDataNewScript, parseCgiDataNewFromScript } from '#shared/utils/html';

/**
 * Server-only cgiDataNew parser. It uses the shared static parser and never executes upstream scripts.
 */
export async function parseCgiDataNewOnServer(html: string): Promise<any> {
  const code = extractCgiDataNewScript(html);
  return code ? parseCgiDataNewFromScript(code) : null;
}
