import './styles/main.css';
import { Game } from './game';
import { GAME_TITLE } from './config/constants';

document.title = GAME_TITLE;

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui-root') as HTMLElement | null;

if (!canvas || !uiRoot) {
  throw new Error('Missing #game-canvas or #ui-root');
}

// Boot the game
new Game(canvas, uiRoot);

// Helpful console banner for developers
console.info(
  `%c${GAME_TITLE}%c ready — modular Canvas TD · local saves · no backend`,
  'color:#c4e09a;font-weight:bold;font-size:14px',
  'color:#8aa090',
);
