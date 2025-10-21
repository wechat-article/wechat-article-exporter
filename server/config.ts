import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('__dirname:', __dirname);
console.log('process.env.NUXT_PRESET:', process.env.NUXT_PRESET);

const dirPath = process.env.NUXT_PRESET === 'docker' ? 'app' : '../../';
export const root = path.resolve(__dirname, dirPath);
