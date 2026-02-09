/**
 * ECS RenderSystem - 수천 개의 엔티티를 Batching하여 렌더링
 */
export function renderECS(world, ctx, engine) {
    const { active, x, y, startX, startY, targetX, targetY, peakHeight, startHeight, isIndirect, typeId, maxEntities, ownerId } = world;
    const tileMap = engine?.tileMap;
    const isFullVision = engine?.debugSystem?.isFullVision;

    for (let i = 0; i < maxEntities; i++) {
        if (active[i] === 0 || typeId[i] !== 1) continue;

        // [시야 체크]
        const isAlly = (ownerId[i] === 1 || ownerId[i] === 3);
        if (!isAlly && tileMap && !isFullVision) {
            if (!tileMap.isInSight(x[i], y[i])) continue;
        }

        if (isIndirect[i] === 1) {
            // --- 자주포 포탄 연출 (포물선 & 현실적 형상) ---
            const dx = targetX[i] - startX[i];
            const dy = targetY[i] - startY[i];
            const totalDist = Math.sqrt(dx * dx + dy * dy);
            
            const curDx = x[i] - startX[i];
            const curDy = y[i] - startY[i];
            const curDist = Math.sqrt(curDx * curDx + curDy * curDy);
            
            // [수정] 진행률 계산 정밀도 향상
            let progress = Math.min(1, curDist / totalDist);
            if (progress > 0.98) progress = 1.0; 

            // [수정] 명시적인 peakHeight 및 startHeight 사용
            const maxHeight = peakHeight[i] > 0 ? peakHeight[i] : totalDist * 0.45; 
            const height = (1 - progress) * startHeight[i] + Math.sin(progress * Math.PI) * maxHeight;

            const drawX = x[i];
            const drawY = y[i] - height;

            // 1. 역동적 그림자 (고도에 따라 크기와 불투명도 조절)
            const ratio = height / maxHeight;
            const shadowOpacity = Math.max(0, 0.4 - ratio * 0.2);
            const shadowSize = Math.max(0, 4 - ratio * 2);
            
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
            ctx.beginPath();
            ctx.ellipse(x[i], y[i], shadowSize * 1.5, shadowSize, 0, 0, Math.PI * 2);
            ctx.fill();

            // 2. 고퀄리티 연기 궤적
            if (engine.renderSystem && Math.random() > 0.3) {
                const smokeColor = progress < 0.2 ? '#ffcc00' : (progress > 0.8 ? '#555' : '#ccc');
                engine.renderSystem.addParticle(
                    drawX, drawY, 
                    -Math.cos(world.angle[i]) * 2, -Math.sin(world.angle[i]) * 2, 
                    3 + Math.random() * 3, smokeColor, 400, 'smoke'
                );
            }

            // 3. 포탄 본체
            ctx.save();
            ctx.translate(drawX, drawY);
            
            // [추가] 자탄 여부에 따른 크기 조절
            const isSubMunition = startHeight[i] > 0;
            if (isSubMunition) ctx.scale(0.6, 0.6);
            
            const deriv = (maxHeight * Math.PI / totalDist) * Math.cos(progress * Math.PI);
            const pitch = Math.atan(-deriv); 
            ctx.rotate(world.angle[i] + pitch);

            const grad = ctx.createLinearGradient(0, -3, 0, 3);
            grad.addColorStop(0, '#4b5320');
            grad.addColorStop(0.5, '#7f8c8d');
            grad.addColorStop(1, '#2d3436'); 
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.bezierCurveTo(6, -3, 2, -3.5, -4, -3.5);
            ctx.lineTo(-6, -3.5); ctx.lineTo(-6, 3.5); ctx.lineTo(-4, 3.5);
            ctx.bezierCurveTo(2, 3.5, 6, 3, 8, 0);
            ctx.fill();
            ctx.fillStyle = '#d4af37'; ctx.fillRect(-3, -3.5, 2, 7);
            ctx.fillStyle = 'rgba(255, 140, 0, 0.6)'; ctx.beginPath(); ctx.arc(8, 0, 2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

        } else {
            // --- 직사 탄환 연출 ---
            const isHeavyShell = world.explosionRadius[i] > 20;
            if (isHeavyShell) {
                ctx.save();
                ctx.translate(x[i], y[i]);
                ctx.rotate(world.angle[i]);
                const shellGrad = ctx.createLinearGradient(0, -2, 0, 2);
                shellGrad.addColorStop(0, '#7f8c8d'); shellGrad.addColorStop(0.5, '#bdc3c7'); shellGrad.addColorStop(1, '#2d3436');
                ctx.fillStyle = shellGrad;
                ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-2, -2.5); ctx.lineTo(-6, -2.5); ctx.lineTo(-6, 2.5); ctx.lineTo(-2, 2.5); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ff3131'; ctx.fillRect(-7, -1.5, 2, 3);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-20, 0); ctx.stroke();
                ctx.restore();
                if (engine.renderSystem && Math.random() > 0.6) engine.renderSystem.addParticle(x[i], y[i], 0, 0, 1 + Math.random() * 2, '#fff', 200, 'smoke');
            } else {
                ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(x[i], y[i], 2, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x[i], y[i]); ctx.lineTo(x[i] - Math.cos(world.angle[i]) * 10, y[i] - Math.sin(world.angle[i]) * 10); ctx.stroke();
            }
        }
    }
}