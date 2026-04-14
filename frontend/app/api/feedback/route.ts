export const maxDuration = 300;

const feedbackApiUrl = process.env.SEEKER_BACKEND_URL
  ? process.env.SEEKER_BACKEND_URL.replace('/api/research', '/api/feedback')
  : 'http://127.0.0.1:3051/api/feedback';

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const query = body.query?.trim();

  if (!query) {
    return Response.json({ error: 'A query is required.' }, { status: 400 });
  }

  try {
    const response = await fetch(feedbackApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { error: errorText || 'The feedback backend returned an error.' },
        { status: response.status },
      );
    }

    const result = await response.json();
    return Response.json(result);
  } catch (error) {
    console.error('Feedback proxy error:', error);
    return Response.json(
      { error: 'The feedback backend is unavailable.' },
      { status: 503 },
    );
  }
}
