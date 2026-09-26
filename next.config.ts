import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  outputFileTracingIncludes: {
    '/api/**': ['./db/certs/supabase-ca.crt'],
    '/api/search': [
      // Use pnpm's real package path; tracing through its symlinks duplicates files.
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so*',
    ],
  },
};
export default config;
