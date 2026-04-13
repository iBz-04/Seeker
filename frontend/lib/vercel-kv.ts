import { kv } from '@vercel/kv'

type VercelKvClient = {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: string, options?: { px?: number }): Promise<unknown>
}

const kvClient = kv as unknown as VercelKvClient

export async function getFragmentUrl(id: string): Promise<string | null> {
  return kvClient.get<string>(`fragment:${id}`)
}

export async function setFragmentUrl(
  id: string,
  url: string,
  expirationMs: number,
): Promise<void> {
  await kvClient.set(`fragment:${id}`, url, { px: expirationMs })
}
