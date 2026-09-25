export interface EmbeddingProvider {
  name: string;
  model: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
export const MODEL: string;
export const REVISION: string;
export const EMBEDDING_MODEL: string;
export function getEmbeddingProvider(): EmbeddingProvider;
