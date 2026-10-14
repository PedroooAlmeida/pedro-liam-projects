import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['tests/fixtures/harness.ts'], bundle: true, write: false, format: 'iife', target: 'chrome111' });
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tweetcraft Client · Local integration harness</title><style>
body{margin:0;background:#122130;color:#d2e4f1;font:14px system-ui}#gl{position:fixed;inset:0;width:100%;height:100%}
aside{position:fixed;bottom:24px;left:24px;max-width:580px;background:#152332e8;padding:18px;border:1px solid #3a5265;border-radius:9px}h1{font-size:17px;margin:0 0 8px}p{line-height:1.5;color:#a8bfce}button{padding:7px 12px;background:#263f51;border:1px solid #4c6a80;color:white;border-radius:5px;cursor:pointer}
</style></head><body><canvas id="gl" tabindex="0"></canvas><input id="chatbox" hidden><canvas id="inv" class="off" hidden></canvas>
<aside><h1>Local integration harness</h1><p>Authored fixtures exercise the actual extension bundles against WebAssembly, WebGL, and protocol 5 messages. This is not a live Tweetcraft server test.</p>
<button id="move-target">Toggle target movement</button> <button id="move-player">Move player +1 X</button> <button id="disconnect">Disconnect fixture</button><p>Click the scene to lock the mouse. Right Shift opens the client.</p><p id="failure"></p></aside><script src="/harness.js"></script></body></html>`;
const files = { '/': [html, 'text/html'], '/harness.js': [result.outputFiles[0].contents, 'text/javascript'] };
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  try {
    if (files[path]) { response.setHeader('Content-Type', files[path][1]); response.end(files[path][0]); return; }
    if (!['/main.js', '/content.js'].includes(path)) { response.writeHead(404); response.end('Not found'); return; }
    response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(`dist${path}`));
  } catch (error) { response.writeHead(500); response.end(`Build the extension first: ${String(error)}`); }
});
server.listen(2819, '127.0.0.1', () => process.stdout.write('Local integration harness: http://127.0.0.1:2819\n'));
