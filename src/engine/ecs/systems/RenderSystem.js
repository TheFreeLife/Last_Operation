/**
 * ECS RenderSystem - 수천 개의 엔티티를 Batching하여 렌더링
 */
export function renderECS(world, ctx, engine) {
    const { active, x, y, startX, startY, targetX, targetY, isIndirect, typeId, maxEntities, ownerId } = world;
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
            
            const progress = Math.min(1, curDist / totalDist);
            const maxHeight = totalDist * 0.45; // 조금 더 가파른 곡선
            const height = Math.sin(progress * Math.PI) * maxHeight;

            const drawX = x[i];
            const drawY = y[i] - height;

            // 1. 역동적 그림자 (고도에 따라 크기와 불투명도 조절)
            const shadowOpacity = 0.4 - (height / maxHeight) * 0.2;
            const shadowSize = 4 - (height / maxHeight) * 2;
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
            ctx.beginPath();
            ctx.ellipse(x[i], y[i], shadowSize * 1.5, shadowSize, 0, 0, Math.PI * 2);
            ctx.fill();

            // 2. 고퀄리티 연기 궤적 (열기 왜곡 느낌 추가)
            if (engine.renderSystem && Math.random() > 0.3) {
                const smokeColor = progress < 0.2 ? '#ffcc00' : (progress > 0.8 ? '#555' : '#ccc');
                engine.renderSystem.addParticle(
                    drawX + (Math.random() - 0.5) * 2, 
                    drawY + (Math.random() - 0.5) * 2, 
                    -Math.cos(world.angle[i]) * 2, 
                    -Math.sin(world.angle[i]) * 2, 
                    3 + Math.random() * 3, 
                    smokeColor, 
                    400, 
                    'smoke'
                );
            }

            // 3. 포탄 본체 (날렵한 Ogive 형상 & 회전)
            ctx.save();
            ctx.translate(drawX, drawY);
            
            // [수정] 포물선의 수학적 접선(Tangent) 각도 계산
            // h = H * sin(pi * p) -> dh/dp = H * pi * cos(pi * p)
            // 실제 기울기는 -dh/dp (캔버스 Y축 반전)
            const deriv = (maxHeight * Math.PI / totalDist) * Math.cos(progress * Math.PI);
            const pitch = Math.atan(-deriv); // 기울기를 각도로 변환
            
            ctx.rotate(world.angle[i] + pitch);

            // 포탄 바디 (금속 질감)
            const grad = ctx.createLinearGradient(0, -3, 0, 3);
            grad.addColorStop(0, '#4b5320'); // 국방색
            grad.addColorStop(0.5, '#7f8c8d'); // 금속 광택
            grad.addColorStop(1, '#2d3436'); 
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            // 탄두 부분 (뾰족하게)
            ctx.moveTo(8, 0);
            ctx.bezierCurveTo(6, -3, 2, -3.5, -4, -3.5);
            // 탄저 부분
            ctx.lineTo(-6, -3.5);
            ctx.lineTo(-6, 3.5);
            ctx.lineTo(-4, 3.5);
            ctx.bezierCurveTo(2, 3.5, 6, 3, 8, 0);
            ctx.fill();

            // 구리 라이너 (포신과의 마찰 흔적 - 황금색 띠)
            ctx.fillStyle = '#d4af37';
            ctx.fillRect(-3, -3.5, 2, 7);

            // 비행 열기 (탄두 끝 작은 발광)
            ctx.fillStyle = 'rgba(255, 140, 0, 0.6)';
            ctx.beginPath();
            ctx.arc(8, 0, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

        } else {
            // --- 직사 탄환 연출 (보병, 전차 등) ---
            const isHeavyShell = world.explosionRadius[i] > 20;

            if (isHeavyShell) {
                // 1. 대구경 직사 포탄 (전차, 자주포 직사 등)
                ctx.save();
                ctx.translate(x[i], y[i]);
                ctx.rotate(world.angle[i]);

                // 포탄 바디 (강철 질감)
                const shellGrad = ctx.createLinearGradient(0, -2, 0, 2);
                shellGrad.addColorStop(0, '#7f8c8d');
                shellGrad.addColorStop(0.5, '#bdc3c7');
                shellGrad.addColorStop(1, '#2d3436');
                
                ctx.fillStyle = shellGrad;
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(-2, -2.5);
                ctx.lineTo(-6, -2.5);
                ctx.lineTo(-6, 2.5);
                ctx.lineTo(-2, 2.5);
                ctx.closePath();
                ctx.fill();

                // 탄미 예광 효과 (Tracer)
                ctx.fillStyle = '#ff3131'; // 빨간색 예광탄 느낌
                ctx.fillRect(-7, -1.5, 2, 3);
                
                // 비행 잔상 (Motion Blur)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-8, 0);
                ctx.lineTo(-20, 0);
                ctx.stroke();

                ctx.restore();

                // 주기적인 연기/열기 파티클
                if (engine.renderSystem && Math.random() > 0.6) {
                    engine.renderSystem.addParticle(x[i], y[i], 0, 0, 1 + Math.random() * 2, '#fff', 200, 'smoke');
                }
            } else {
                // 2. 소구경 탄환 (보병 등)
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(x[i], y[i], 2, 0, Math.PI * 2);
                ctx.fill();
                
                // 아주 짧은 궤적
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x[i], y[i]);
                ctx.lineTo(x[i] - Math.cos(world.angle[i]) * 10, y[i] - Math.sin(world.angle[i]) * 10);
                ctx.stroke();
            }
        }
    }
}
