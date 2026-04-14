import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express, { Request, Response } from 'express';

import {
  deepResearch,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import { generateFeedback } from './feedback';

export const app = express();

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

// Generic download endpoint for reports
app.get('/api/download/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  if (!filename || filename.includes('/') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
    }
  });
});

// API endpoint to generate feedback questions
app.post('/api/feedback', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const questions = await generateFeedback({
      query,
    });

    return res.json({ success: true, questions });
  } catch (error: unknown) {
    console.error('Error in feedback API:', error);
    return res.status(500).json({
      error: 'An error occurred generating feedback',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { query, depth = 3, breadth = 3, mode = 'answer' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (mode !== 'answer' && mode !== 'report') {
      return res
        .status(400)
        .json({ error: 'Mode must be "answer" or "report"' });
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
      visitedUrls,
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

export function startServer() {
  const port = process.env.PORT || 3051;

  return app.listen(port, () => {
    console.log(`Deep Research API running on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}

export default app;
