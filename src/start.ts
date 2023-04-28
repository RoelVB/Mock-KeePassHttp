import { Server } from './server';

new Server(Number(process.env.MOCKKPH_PORT) || 19455).start();
