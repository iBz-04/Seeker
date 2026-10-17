import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';

import {
  PARALLEL_MCP_URL,
  resolveSearchProvider,
  SEARCH_USER_AGENT,
  searchWeb,
} from './search';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const requests: { url: string; init?: RequestInit; body: any }[] = [];
let prompts: string[] = [];
let content: unknown;
let textOnly = false;
let toolError = false;
let httpStatus = 200;
let stallMethod = '';
let deepResearch: typeof import('./deep-research').deepResearch;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

before(async () => {
  // No real inference or provider credentials are used by these fixtures.
  process.env.OPENAI_KEY = 'scripted-model';
  process.env.OPENAI_ENDPOINT = 'https://model.test/v1';
  delete process.env.FIREWORKS_API_KEY;
  delete process.env.CUSTOM_MODEL;
  ({ deepResearch } = await import('./deep-research'));
});

beforeEach(() => {
  for (const name of [
    'SEARCH_PROVIDER',
    'FIRECRAWL_KEY',
    'FIRECRAWL_API_KEY',
    'FIRECRAWL_BASE_URL',
  ]) {
    delete process.env[name];
  }
  // These must never be attached to anonymous MCP requests.
  process.env.PARALLEL_API_KEY = 'must-not-be-used';
  content = {
    results: [
      {
        url: 'https://example.org/source',
        title: 'Source',
        excerpts: ['Evidence from the source.'],
      },
    ],
  };
  textOnly = false;
  toolError = false;
  httpStatus = 200;
  stallMethod = '';
  prompts = [];
  requests.length = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === 'https://model.test/v1/chat/completions') {
      const prompt = body.messages.map((m: any) => m.content).join('\n');
      prompts.push(prompt);
      const answer = prompt.includes('generate a list of SERP queries')
        ? {
            queries: [
              {
                query: 'test research query',
                researchGoal: 'Find reliable evidence',
              },
            ],
          }
        : {
            learnings: ['A sourced learning.'],
            followUpQuestions: ['Follow the evidence'],
          };
      return json({
        id: 'scripted',
        model: 'o3-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: JSON.stringify(answer) },
            finish_reason: 'stop',
          },
        ],
      });
    }
    assert.equal(url, PARALLEL_MCP_URL);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('user-agent'), SEARCH_USER_AGENT);
    assert.equal(headers.get('authorization'), null);
    requests.push({ url, init, body });
    if (stallMethod === body.method) {
      return new Promise((_resolve, reject) => {
        const fail = () => reject(init?.signal?.reason);
        if (init?.signal?.aborted) fail();
        else init?.signal?.addEventListener('abort', fail, { once: true });
      });
    }
    if (!body.id && body.id !== 0) return new Response(null, { status: 202 });
    if (httpStatus !== 200 && body.method === 'tools/call')
      return json({ error: 'Service unavailable' }, httpStatus);
    let result;
    if (body.method === 'initialize') {
      result = {
        protocolVersion: body.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1' },
      };
    } else if (body.method === 'tools/list') {
      result = {
        tools: [{ name: 'web_search', inputSchema: { type: 'object' } }],
      };
    } else {
      assert.equal(body.method, 'tools/call');
      assert.equal(body.params.name, 'web_search');
      result = {
        content: [{ type: 'text', text: JSON.stringify(content) }],
        ...(textOnly ? {} : { structuredContent: content }),
        isError: toolError,
      };
    }
    return json({ jsonrpc: '2.0', id: body.id, result });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
});

test('provider resolution preserves keys, aliases, endpoints and explicit choices', () => {
  assert.equal(resolveSearchProvider({}), 'parallel');
  for (const key of [
    'FIRECRAWL_KEY',
    'FIRECRAWL_API_KEY',
    'FIRECRAWL_BASE_URL',
  ]) {
    assert.equal(resolveSearchProvider({ [key]: 'configured' }), 'firecrawl');
    assert.equal(
      resolveSearchProvider({
        [key]: 'configured',
        SEARCH_PROVIDER: 'parallel',
      }),
      'parallel',
    );
    assert.equal(
      resolveSearchProvider({ [key]: 'configured', SEARCH_PROVIDER: 'none' }),
      'none',
    );
  }
  assert.equal(
    resolveSearchProvider({ SEARCH_PROVIDER: 'firecrawl' }),
    'firecrawl',
  );
  assert.throws(
    () => resolveSearchProvider({ SEARCH_PROVIDER: 'typo' }),
    /SEARCH_PROVIDER/,
  );
});

test('fresh no-key research consumes MCP excerpts and source URLs through synthesis', async () => {
  const result = await deepResearch({
    query: 'Research a topic',
    breadth: 1,
    depth: 1,
  });
  assert.deepEqual(result, {
    learnings: ['A sourced learning.'],
    visitedUrls: ['https://example.org/source'],
  });
  assert.ok(prompts.some(p => p.includes('Evidence from the source.')));
  assert.deepEqual(requests.map(r => r.body.method).filter(Boolean), [
    'initialize',
    'notifications/initialized',
    'tools/list',
    'tools/call',
  ]);
  const args = requests.at(-1)!.body.params.arguments;
  assert.equal(args.objective, 'test research query');
  assert.deepEqual(args.search_queries, ['test research query']);
  assert.match(args.session_id, /^[a-f0-9-]{36}$/);
});

test('recursive research reuses its session and consumes text-only MCP results', async () => {
  textOnly = true;
  const result = await deepResearch({
    query: 'Research deeper',
    breadth: 1,
    depth: 2,
  });
  assert.deepEqual(result.visitedUrls, ['https://example.org/source']);
  const calls = requests.filter(r => r.body.method === 'tools/call');
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0]!.body.params.arguments.session_id,
    calls[1]!.body.params.arguments.session_id,
  );
});

test('disabled search sends neither model nor search requests and retains prior context', async () => {
  process.env.SEARCH_PROVIDER = 'none';
  const prior = { learnings: ['prior'], visitedUrls: ['https://prior.test'] };
  assert.deepEqual(
    await deepResearch({ query: 'offline', breadth: 1, depth: 1, ...prior }),
    prior,
  );
  assert.equal(requests.length, 0);
  assert.equal(prompts.length, 0);
});

test('invalid explicit provider fails before requests', async () => {
  process.env.SEARCH_PROVIDER = 'typo';
  await assert.rejects(
    deepResearch({ query: 'topic', breadth: 1, depth: 1 }),
    /SEARCH_PROVIDER/,
  );
  assert.equal(requests.length + prompts.length, 0);
});

test('empty results do not synthesize unsupported learnings', async () => {
  content = { results: [] };
  assert.deepEqual(
    await deepResearch({ query: 'topic', breadth: 1, depth: 1 }),
    { learnings: [], visitedUrls: [] },
  );
  assert.equal(prompts.length, 1);
});

test('only valid HTTP(S) source URLs enter research output', async () => {
  content = {
    results: [
      'javascript:alert(1)',
      'https://',
      'ftp://files.test',
      'http://valid.test/page',
    ].map(url => ({ url, excerpts: ['evidence'] })),
  };
  const result = await deepResearch({ query: 'topic', breadth: 1, depth: 1 });
  assert.deepEqual(result.visitedUrls, ['http://valid.test/page']);
});

test('MCP errors, malformed results and HTTP failures reject without changing providers', async () => {
  process.env.SEARCH_PROVIDER = 'parallel';
  process.env.FIRECRAWL_KEY = 'preserved-but-not-selected';
  toolError = true;
  await assert.rejects(
    searchWeb('query', { sessionId: 'session' }),
    /Parallel search failed/,
  );
  toolError = false;
  content = { results: [{ url: 'https://example.org', excerpts: 42 }] };
  await assert.rejects(searchWeb('query', { sessionId: 'session' }));
  httpStatus = 403;
  await assert.rejects(
    searchWeb('query', { sessionId: 'session' }),
    /Service unavailable/,
  );
  assert.ok(requests.every(r => r.url === PARALLEL_MCP_URL));
});

test('research keeps prior context after a search failure without synthesizing it', async () => {
  toolError = true;
  const prior = { learnings: ['prior'], visitedUrls: ['https://prior.test'] };
  assert.deepEqual(
    await deepResearch({ query: 'topic', breadth: 1, depth: 1, ...prior }),
    prior,
  );
  assert.equal(prompts.length, 1);
});

test('one deadline covers MCP initialization and tool execution', async () => {
  for (const method of ['initialize', 'tools/call']) {
    stallMethod = method;
    // Keep the event loop alive while AbortSignal.timeout uses its unref timer.
    const keepAlive = setInterval(() => {}, 1000);
    try {
      await assert.rejects(
        searchWeb('query', { sessionId: 'session', timeoutMs: 30 }),
      );
      assert.ok(requests.at(-1)!.init?.signal?.aborted);
    } finally {
      clearInterval(keepAlive);
    }
  }
});

test('cancellation stops active research and pre-cancelled calls make no requests', async () => {
  const cancelled = AbortSignal.abort(new Error('cancelled'));
  await assert.rejects(
    deepResearch({ query: 'topic', breadth: 1, depth: 1, signal: cancelled }),
    /cancelled/,
  );
  assert.equal(requests.length + prompts.length, 0);
  stallMethod = 'tools/call';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('cancelled')), 30);
  try {
    await assert.rejects(
      deepResearch({
        query: 'topic',
        breadth: 1,
        depth: 1,
        signal: controller.signal,
      }),
      /cancelled/,
    );
    assert.ok(requests.at(-1)!.init?.signal?.aborted);
  } finally {
    clearTimeout(timer);
  }
});

test('configured Firecrawl uses its existing endpoint, key and full-markdown options', async () => {
  const server = createServer(async (req, res) => {
    assert.equal(req.url, '/v1/search');
    assert.equal(req.headers.authorization, 'Bearer existing-key');
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    assert.deepEqual(body.scrapeOptions, { formats: ['markdown'] });
    assert.equal(body.timeout, 15000);
    assert.equal(body.limit, 5);
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: [
          {
            markdown: 'Firecrawl full page',
            metadata: { sourceURL: 'https://firecrawl-source.test' },
          },
        ],
      }),
    );
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address() as { port: number };
    process.env.FIRECRAWL_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.FIRECRAWL_API_KEY = 'existing-key';
    const result = await deepResearch({ query: 'topic', breadth: 1, depth: 1 });
    assert.deepEqual(result.visitedUrls, ['https://firecrawl-source.test']);
    assert.ok(prompts.some(p => p.includes('Firecrawl full page')));
    assert.equal(requests.length, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  }
});
