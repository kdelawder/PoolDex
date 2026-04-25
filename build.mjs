import { rmSync, mkdirSync, copyFileSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
copyFileSync('index.html', 'www/index.html');
console.log('Rebuilt www/ from index.html');
