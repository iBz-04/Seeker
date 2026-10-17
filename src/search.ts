import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const PARALLEL_MCP_URL = 'https://search.parallel.ai/mcp';
export const SEARCH_USER_AGENT =
  'Seeker/0.0.1 (+https://github.com/iBz-04/Seeker)';

type SearchProvider = 'parallel' | 'firecrawl' | 'none';
export type ResearchSearchResponse = {
  success: boolean;
  data: Pick<SearchResponse['data'][number], 'url' | 'markdown' | 'metadata'>[];
};

export function resolveSearchProvider(
  env: NodeJS.ProcessEnv = process.env,
): SearchProvider {
  const selected = env.SEARCH_PROVIDER?.trim().toLowerCase();
  if (selected) {
    if (
      selected === 'parallel' ||
      selected === 'firecrawl' ||
      selected === 'none'
    ) {
      return selected;
    }
    throw new Error('SEARCH_PROVIDER must be parallel, firecrawl, or none');
  }

  // A custom Firecrawl endpoint may be self-hosted and need no key.
  return env.FIRECRAWL_KEY || env.FIRECRAWL_API_KEY || env.FIRECRAWL_BASE_URL
    ? 'firecrawl'
    : 'parallel';
}

const parallelResults = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string().nullish(),
      excerpts: z.array(z.string()),
    }),
  ),
});

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function searchWeb(
  query: string,
  {
    sessionId,
    signal,
    timeoutMs = 15_000,
  }: {
    sessionId: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<ResearchSearchResponse> {
  signal?.throwIfAborted();
  const provider = resolveSearchProvider();
  if (provider === 'none') return { success: true, data: [] };
  if (provider === 'firecrawl') {
    const firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_KEY ?? process.env.FIRECRAWL_API_KEY ?? '',
      apiUrl: process.env.FIRECRAWL_BASE_URL,
    });
    return firecrawl.search(query, {
      timeout: timeoutMs,
      limit: 5,
      scrapeOptions: { formats: ['markdown'] },
    });
  }

  // Bound initialization, discovery and search by one deadline. Do not use
  // ambient Parallel credentials: this provider intentionally connects anonymously.
  const deadline = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const client = new Client({ name: 'Seeker', version: '0.0.1' });
  const transport = new StreamableHTTPClientTransport(
    new URL(PARALLEL_MCP_URL),
    {
      requestInit: { headers: { 'User-Agent': SEARCH_USER_AGENT } },
      fetch: (url, init) =>
        globalThis.fetch(url, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, requestSignal])
            : requestSignal,
        }),
      reconnectionOptions: {
        maxRetries: 0,
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1,
      },
    },
  );
  const options = { signal: requestSignal, timeout: timeoutMs };
  try {
    await client.connect(transport, options);
    const { tools } = await client.listTools({}, options);
    if (!tools.some(tool => tool.name === 'web_search')) {
      throw new Error('Parallel MCP does not offer web_search');
    }
    const result = CallToolResultSchema.parse(
      await client.callTool(
        {
          name: 'web_search',
          arguments: {
            objective: query,
            search_queries: [query],
            session_id: sessionId,
          },
        },
        undefined,
        options,
      ),
    );
    const text = result.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    if (result.isError) throw new Error(`Parallel search failed: ${text}`);
    const parsed = parallelResults.parse(
      result.structuredContent ?? JSON.parse(text),
    );
    return {
      success: true,
      data: parsed.results
        .filter(item => isHttpUrl(item.url))
        .slice(0, 5)
        .map(item => ({
          url: item.url,
          title: item.title ?? undefined,
          markdown: item.excerpts.join('\n\n'),
        })),
    };
  } finally {
    await client.close();
  }
}
