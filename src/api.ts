import cors from 'cors';
import express, { Request, Response } from 'express';

import { deepResearch, writeFinalAnswer, writeFinalReport } from './deep-research';

const app = express();
const port = process.env.PORT || 3051;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

app.get('/healthz', (_req: Request, res: Response) => {
  return res.status(200).json({ ok: true });
});

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { query, depth = 3, breadth = 3, mode = 'answer' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (mode !== 'answer' && mode !== 'report') {
      return res.status(400).json({ error: 'Mode must be "answer" or "report"' });
    }

    log('\nStarting research...\n');

    const { learnings, visitedUrls } = await deepResearch({
      query,
      breadth,
      depth,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    if (mode === 'report') {
      const { reportMarkdown, mdPath, docxPath } = await writeFinalReport({
        prompt: query,
        learnings,
        visitedUrls,
      });

      return res.json({
        success: true,
        mode,
        content: reportMarkdown,
        learnings,
        visitedUrls,
        mdPath,
        docxPath,
      });
    }

    const { exactAnswer, mdPath, docxPath } = await writeFinalAnswer({
      prompt: query,
      learnings,
    });

    return res.json({
      success: true,
      mode,
      content: exactAnswer,
      learnings,
      visitedUrls,
      mdPath,
      docxPath,
    });
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app;
