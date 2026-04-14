export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');

  if (!file) {
    return new Response('File is required', { status: 400 });
  }

  const backendUrl = process.env.SEEKER_BACKEND_URL ?? 'http://127.0.0.1:3051/api/research';
  // Note: SEEKER_BACKEND_URL might point to /api/research - strip that off to get the host
  const baseUrl = backendUrl.replace('/api/research', '');
  
  try {
    const response = await fetch(`${baseUrl}/api/download/${file}`, {
      method: 'GET',
    });

    if (!response.ok) {
      return new Response('File not found', { status: response.status });
    }

    const blob = await response.blob();
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${file}"`);
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');

    return new Response(blob, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Download proxy error:', error);
    return new Response('Error downloading file', { status: 500 });
  }
}
