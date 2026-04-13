export const maxDuration = 300

const researchApiUrl =
  process.env.SEEKER_BACKEND_URL ?? 'http://127.0.0.1:3051/api/research'

type ResearchMode = 'answer' | 'report'

type ChatRequestBody = {
  query?: string
  breadth?: number
  depth?: number
  mode?: ResearchMode
}

export async function POST(req: Request) {
  let body: ChatRequestBody

  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }

  const query = body.query?.trim()
  const breadth = Number.isFinite(body.breadth) ? Number(body.breadth) : 3
  const depth = Number.isFinite(body.depth) ? Number(body.depth) : 2
  const mode: ResearchMode = body.mode === 'report' ? 'report' : 'answer'

  if (!query) {
    return Response.json({ error: 'A research query is required.' }, { status: 400 })
  }

  try {
    const response = await fetch(researchApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        breadth,
        depth,
        mode,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()

      return Response.json(
        {
          error: errorText || 'The research backend returned an error.',
        },
        { status: response.status },
      )
    }

    const result = await response.json()
    return Response.json(result)
  } catch (error) {
    console.error('Research proxy error:', error)

    return Response.json(
      {
        error:
          'The research backend is unavailable. Make sure the backend API is running on http://127.0.0.1:3051 or set SEEKER_BACKEND_URL.',
      },
      { status: 503 },
    )
  }
}
