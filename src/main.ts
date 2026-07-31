import './styles/main.css';
import { Game } from './game';
import { GAME_TITLE } from './config/constants';

document.title = GAME_TITLE;

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui-root') as HTMLElement | null;

if (!canvas || !uiRoot) {
  throw new Error('Missing #game-canvas or #ui-root');
}

new Game(canvas, uiRoot);
