#!/usr/bin/env node
import { spawn } from 'child_process';
import { platform } from 'os';

const procs = [
  spawn('node', ['serve.js'],           { stdio: 'inherit' }),
  spawn('node', ['server/src/index.js'], { stdio: 'inherit' }),
];

const opener = platform() === 'win32' ? 'cmd' :
               platform() === 'darwin' ? 'open' : 'xdg-open';
const args   = platform() === 'win32'
  ? ['/c', 'start', 'http://localhost:48123']
  : ['http://localhost:48123'];

setTimeout(() => spawn(opener, args, { stdio: 'ignore', detached: true }).unref(), 800);

process.on('SIGINT', () => { procs.forEach(p => p.kill()); process.exit(); });
