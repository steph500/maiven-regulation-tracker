import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  outputFileTracingIncludes: {
    '/api/**': ['./db/certs/supabase-ca.crt'],
    '/api/search': [
      './node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so*',
    ],
  },
};
export default config;
