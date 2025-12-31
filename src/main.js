import { GameEngine } from './engine/GameEngine.js';

document.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    engine.start();

    // 초기 상태 업데이트
    document.getElementById('wave-count').textContent = '1';
    document.getElementById('base-hp').textContent = '1000';
    document.getElementById('resource-gold').textContent = '100';
});
