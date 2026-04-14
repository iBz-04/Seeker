import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type VercelKvGetClient = {
  get<T = unknown>(key: string): Promise<T | null>
}

const kvClient = kv as unknown as VercelKvGetClient

export async function middleware(req: NextRequest) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const id = req.nextUrl.pathname.split('/').pop()
    const url = id ? await kvClient.get<string>(`fragment:${id}`) : null

    if (url) {
      return NextResponse.redirect(url)
    } else {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.redirect(new URL('/', req.url))
}

export const config = {
  matcher: '/s/:path*',
}
