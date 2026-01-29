/**
 * ECS RenderSystem - 수천 개의 엔티티를 Batching하여 렌더링
 */
export function renderECS(world, ctx, engine) {
    const { active, x, y, typeId, maxEntities, ownerId } = world;
    const tileMap = engine?.tileMap;
    const isFullVision = engine?.debugSystem?.isFullVision;

    // 1. 투사체 렌더링 (Batching)
    ctx.save();
    ctx.fillStyle = '#ffff00'; // 기본 투사체 색상
    ctx.beginPath();
    
    for (let i = 0; i < maxEntities; i++) {
        if (active[i] === 0 || typeId[i] !== 1) continue;

        // [시야 체크] 아군 외 투사체는 시야 내에 있을 때만 렌더링
        const isAlly = (ownerId[i] === 1 || ownerId[i] === 3);
        if (!isAlly && tileMap && !isFullVision) {
            if (!tileMap.isInSight(x[i], y[i])) continue;
        }

        // 단순 원형으로 그리기 (매우 빠름)
        ctx.moveTo(x[i], y[i]);
        ctx.arc(x[i], y[i], 2, 0, Math.PI * 2);
    }
    
    ctx.fill();
    ctx.restore();
}
