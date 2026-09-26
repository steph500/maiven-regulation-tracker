import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Both Python ingestion and TypeScript serving call this exact implementation.
export const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
export const EMBEDDING_MODEL = `${MODEL}@${REVISION}:q8:mean:normalized`;
let extractorPromise;

export function getEmbeddingProvider() {
  if ((process.env.EMBEDDING_PROVIDER ?? 'local') !== 'local') {
    throw new Error('Unsupported embedding provider');
  }
  return { name: 'local', model: EMBEDDING_MODEL, dimensions: 384, embed };
}

async function embed(texts) {
  if (!texts.length) return [];
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // Explicitly load the native backend so serverless tracing includes it.
      await import('onnxruntime-node');
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = process.env.EMBEDDING_CACHE_DIR ?? join(tmpdir(), 'maiven-models');
      env.allowLocalModels = false;
      return pipeline('feature-extraction', MODEL, {
        revision: REVISION, dtype: 'q8', device: 'cpu',
      });
    })().catch(error => {
      extractorPromise = undefined;
      console.error('Embedding model initialization failed', {
        name: error?.name,
        code: error?.code,
        message: String(error?.message ?? 'Unknown error').replace(/https?:\/\/\S+/g, '[remote model resource]'),
      });
      throw error;
    });
  }
  const extractor = await extractorPromise;
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  const vectors = output.tolist();
  if (vectors.length !== texts.length || vectors.some(v =>
    v.length !== 384 || v.some(n => !Number.isFinite(n)))) {
    throw new Error('Invalid embedding output');
  }
  return vectors;
}
