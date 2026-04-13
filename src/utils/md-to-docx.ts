import fs from 'fs/promises';
import { marked } from 'marked';
import htmlToDocx from 'html-to-docx';

export async function mdToDocx(mdFilePath: string, outFilePath: string) {
  const md = await fs.readFile(mdFilePath, 'utf-8');

  const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body>${marked.parse(
    md,
  )}</body></html>`;

  const buffer = await htmlToDocx(html, null, {
    table: { row: { cantSplit: true } },
  });

  await fs.writeFile(outFilePath, buffer);
  return outFilePath;
}

export async function saveMdAndConvert(
  mdContent: string,
  mdFilePath?: string,
  docxFilePath?: string,
): Promise<{ mdPath: string; docxPath: string }> {
  const mdPath = mdFilePath ?? `output-${Date.now()}.md`;
  const docxPath = docxFilePath ?? mdPath.replace(/\.md$/i, '.docx');

  await fs.writeFile(mdPath, mdContent, 'utf-8');
  await mdToDocx(mdPath, docxPath);

  return { mdPath, docxPath };
}

export default mdToDocx;
