import { GameEngine } from './engine/GameEngine.js';

document.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();

    // 브라우저 콘솔에서 접근 가능하도록 전역으로 노출
    window.engine = engine;

    engine.start();

    // 개발 도구용: EntityManager 통계 출력
    console.log('[Game] EntityManager initialized:');
    console.log('  - SpatialGrid active:', !!engine.entityManager.spatialGrid);
    console.log('  - Initial entities:', engine.entityManager.allEntities.length);
});
