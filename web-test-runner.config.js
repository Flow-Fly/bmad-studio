import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: 'tests/frontend/**/*.test.ts',
  nodeResolve: true,
  plugins: [
    esbuildPlugin({
      ts: true,
      tsconfig: './tsconfig.json',
      target: 'auto',
    }),
  ],
};
