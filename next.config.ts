import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  outputFileTracingIncludes: { '/api/*': ['./db/certs/supabase-ca.crt'] },
};
export default config;
