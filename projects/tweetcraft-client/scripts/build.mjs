import { context } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('manifest.json', 'dist/manifest.json');
const build = await context({
  entryPoints: { main: 'src/entrypoints/main.ts', content: 'src/entrypoints/content.ts' },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome111',
  sourcemap: true,
  logLevel: 'info',
});
if (process.argv.includes('--watch')) await build.watch();
else {
  await build.rebuild();
  await build.dispose();
}
