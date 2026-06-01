import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const SERVER_PORT = 3777;
const CLIENT_PORT = 8080;

const server = spawn('node', ['--watch', 'server/src/index.js'], {
  env: { ...process.env, PORT: String(SERVER_PORT) },
  stdio: 'inherit',
  shell: true,
});

const client = spawn('npx', ['serve', 'client', '-p', String(CLIENT_PORT), '--no-clipboard'], {
  stdio: 'inherit',
  shell: true,
});

server.on('error', err => console.error('Server error:', err));
client.on('error', err => console.error('Client server error:', err));

console.log(`Starting server on :${SERVER_PORT} and client on :${CLIENT_PORT}...`);
await sleep(2000);

spawn('cmd', ['/c', 'start', `http://localhost:${CLIENT_PORT}`], { shell: true });
spawn('cmd', ['/c', 'start', `http://localhost:${CLIENT_PORT}`], { shell: true });

console.log('Opened two browser windows. Ctrl+C to stop.');

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.kill();
    client.kill();
    process.exit(0);
  });
}
