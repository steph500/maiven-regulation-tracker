import { getEmbeddingProvider } from '../lib/search/embedding-provider.mjs';

const provider = getEmbeddingProvider();
if (process.argv.includes('--metadata')) {
  console.log(JSON.stringify({ name: provider.name, model: provider.model, dimensions: provider.dimensions }));
} else {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const vectors = await provider.embed(JSON.parse(input));
  console.log(JSON.stringify(vectors));
}
