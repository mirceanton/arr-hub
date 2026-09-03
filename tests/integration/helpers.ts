/** Direct-fetch helpers used only by tests, to set up/verify/tear down state independently of the app's own client code. */

export async function servarrRequest<T>(
  baseUrl: string,
  apiKey: string,
  version: "v3" | "v1",
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}/api/${version}${path}`, {
    ...init,
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
