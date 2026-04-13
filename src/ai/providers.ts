import { createFireworks } from '@ai-sdk/fireworks';
import { createOpenAI } from '@ai-sdk/openai';
import {
  extractReasoningMiddleware,
  LanguageModelV1,
  wrapLanguageModel,
} from 'ai';
import { getEncoding } from 'js-tiktoken';

import { RecursiveCharacterTextSplitter } from './text-splitter';

const openAiApiKey = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY;
const openAiBaseUrl =
  process.env.OPENAI_ENDPOINT ??
  process.env.OPENAI_BASE_URL ??
  'https://api.openai.com/v1';

// Providers
const openai = openAiApiKey
  ? createOpenAI({
      apiKey: openAiApiKey,
      baseURL: openAiBaseUrl,
    })
  : undefined;

const fireworks = process.env.FIREWORKS_API_KEY
  ? createFireworks({
      apiKey: process.env.FIREWORKS_API_KEY,
    })
  : undefined;

const customModel = process.env.CUSTOM_MODEL
  ? openai?.(process.env.CUSTOM_MODEL, {
      structuredOutputs: true,
    })
  : undefined;

// Models

const o3MiniModel = openai?.('o3-mini', {
  reasoningEffort: 'medium',
  structuredOutputs: true,
});

// Only instantiate a Fireworks model if an explicit model id is provided via
// `FIREWORKS_MODEL`. This prevents attempting to use a model that is not
// deployed or accessible with the current API key (which would cause runtime
// errors). If `FIREWORKS_MODEL` is not set, the code will fall back to the
// OpenAI model (`o3-mini`).
const FIREWORKS_MODEL = process.env.FIREWORKS_MODEL;

const deepSeekR1Model =
  fireworks && FIREWORKS_MODEL
    ? wrapLanguageModel({
        model: fireworks(FIREWORKS_MODEL) as LanguageModelV1,
        middleware: extractReasoningMiddleware({ tagName: 'think' }),
      })
    : undefined;

export function getModel(): LanguageModelV1 {
  if (customModel) {
    return customModel;
  }

  const model = deepSeekR1Model ?? o3MiniModel;
  if (!model) {
    throw new Error('No model found');
  }

  return model as LanguageModelV1;
}

const MinChunkSize = 140;
const encoder = getEncoding('o200k_base');

// trim prompt to maximum context size
export function trimPrompt(
  prompt: string,
  contextSize = Number(process.env.CONTEXT_SIZE) || 128_000,
) {
  if (!prompt) {
    return '';
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? '';

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}
