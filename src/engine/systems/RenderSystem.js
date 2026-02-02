import { ICONS } from '../../assets/Icons.js';

/**
 * RenderSystem (Canvas 2D Optimized with Bitmap Caching)
 * SVG 및 복잡한 벡터 드로잉을 최초 1회 비트맵으로 캐싱하여 성능을 극대화합니다.
 */
export class RenderSystem {
    constructor(engine) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.canvas = engine.canvas;

        // 레이어 정의
        this.layers = {
            TERRAIN: 0,
            UNITS: 1,
            PROJECTILES: 2,
            AIR_UNITS: 3,
            EFFECTS: 4,
            UI: 5
        };

        // 비트맵 캐싱 저장소
        this.iconCache = {}; // Icons.js SVG 기반 캐시
        this.entityCache = {}; // 실시간 draw() 결과 기반 캐시
        this.isCacheLoaded = false;
        
        // 아이콘 초기화
        this.initIconCache().then(() => {
            console.log('[RenderSystem] SVG Icons cached successfully.');
            this.isCacheLoaded = true;
        });

        // 메모리 재사용용 버킷
        this.layerBuckets = {
            [this.layers.UNITS]: [],
            [this.layers.PROJECTILES]: [],
            [this.layers.AIR_UNITS]: []
        };

        this.stats = { renderedEntities: 0, totalEntities: 0, lastFrameTime: 0 };
        this.particles = [];
    }

    /**
     * SVG 문자열을 비트맵으로 변환하여 캐싱
     */
    async initIconCache() {
        const promises = [];
        for (const [key, html] of Object.entries(ICONS)) {
            const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/i);
            if (svgMatch) {
                let svgContent = svgMatch[0];
                if (!svgContent.includes('xmlns')) {
                    svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                const rasterSize = 64; 
                const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const p = new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const offCanvas = document.createElement('canvas');
                        offCanvas.width = rasterSize;
                        offCanvas.height = rasterSize;
                        const offCtx = offCanvas.getContext('2d');
                        offCtx.drawImage(img, 0, 0, rasterSize, rasterSize);
                        this.iconCache[key] = offCanvas;
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    img.onerror = () => resolve();
                    img.src = url;
                });
                promises.push(p);
            }
        }
        await Promise.all(promises);
    }

    addParticle(x, y, vx, vy, size, color, life, type = 'spark') {
        this.particles.push({ x, y, vx, vy, size, color, life, maxLife: life, type });
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= deltaTime;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    render() {
        const startTime = performance.now();
        this.ctx.imageSmoothingEnabled = false;

        // 1. 화면 초기화
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. 카메라 변환
        this.ctx.save();
        const camera = this.engine.camera;
        this.ctx.translate(camera.x, camera.y);
        this.ctx.scale(camera.zoom, camera.zoom);

        const viewport = this.getViewportBounds();

        // 3. 지형
        if (this.engine.tileMap) {
            this.engine.tileMap.drawGrid(camera);
            this.engine.tileMap.drawWalls(this.ctx);
        }

        // 4. 엔티티 분류 및 렌더링
        const visibleEntities = this.getVisibleEntities(viewport);
        this.sortEntitiesByLayer(visibleEntities);

        this.renderEntities(this.layerBuckets[this.layers.UNITS]);
        
        // 4-A. 직사 투사체 (천장 아래)
        const directProjectiles = this.layerBuckets[this.layers.PROJECTILES].filter(p => !p.isIndirect && p.type !== 'missile' && p.type !== 'nuclear-missile');
        this.renderEntities(directProjectiles);

        // 4.5 천장 레이어
        if (this.engine.tileMap) {
            this.engine.tileMap.drawCeiling(this.ctx);
        }

        this.renderEntities(this.layerBuckets[this.layers.AIR_UNITS]);
        
        // 4.6 곡사 투사체 (천장 위)
        const indirectProjectiles = this.layerBuckets[this.layers.PROJECTILES].filter(p => p.isIndirect || p.type === 'missile' || p.type === 'nuclear-missile');
        this.renderEntities(indirectProjectiles);
        
        // 5. 파티클 및 이펙트
        this.updateParticles(16);
        this.renderParticles();
        this.renderEffects();

        if (this.engine.tileMap) this.engine.tileMap.drawFog(camera);

        // 6. 선택 도구 및 오버레이 (GameEngine에서 중복 처리되는 부분 제외하고 필요한 것만 유지)
        this.renderOverlays(visibleEntities);

        this.ctx.restore();

        // 7. UI 오버레이 (카메라 영향 받지 않음)
        this.renderStatusUI();
        
        this.stats.lastFrameTime = performance.now() - startTime;
    }

    renderStatusUI() {
        if (this.engine.gameState !== 'PLAYING') return;

        const sentiment = Math.floor(this.engine.publicSentiment);
        
        const x = 20, y = 20;
        const w = 350, h = 60; // 너비를 220에서 350으로 확장
        const isCritical = sentiment < 30;

        // 1. 웅장한 배경 및 테두리
        this.ctx.save();
        
        // 배경 그림자 (Outer Glow)
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = isCritical ? 'rgba(255, 49, 49, 0.4)' : 'rgba(0, 0, 0, 0.5)';
        
        // 메인 배경
        const bgGrad = this.ctx.createLinearGradient(x, y, x, y + h);
        bgGrad.addColorStop(0, 'rgba(20, 20, 25, 0.95)');
        bgGrad.addColorStop(1, 'rgba(10, 10, 15, 0.98)');
        this.ctx.fillStyle = bgGrad;
        
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 10);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // 금속 느낌의 테두리 그라데이션
        const borderGrad = this.ctx.createLinearGradient(x, y, x + w, y + h);
        if (isCritical) {
            borderGrad.addColorStop(0, '#ff1744');
            borderGrad.addColorStop(0.5, '#b71c1c');
            borderGrad.addColorStop(1, '#ff1744');
        } else {
            borderGrad.addColorStop(0, '#9e9e9e');
            borderGrad.addColorStop(0.5, '#ffffff');
            borderGrad.addColorStop(1, '#757575');
        }
        
        this.ctx.strokeStyle = borderGrad;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // 2. 민심 섹션 (중앙 배치)
        const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
        const hx = x + 25, hy = y + 35; // 위치 조정
        this.ctx.fillStyle = isCritical ? `rgba(255, 49, 49, ${0.7 + pulse * 0.3})` : '#69f0ae';
        this.ctx.shadowBlur = isCritical ? 15 + pulse * 10 : 5;
        this.ctx.shadowColor = this.ctx.fillStyle;

        // 중앙 메인 시민
        this.ctx.beginPath();
        this.ctx.arc(hx, hy - 10, 4, 0, Math.PI * 2); // 머리
        this.ctx.moveTo(hx - 6, hy);
        this.ctx.lineTo(hx + 6, hy);
        this.ctx.lineTo(hx + 4, hy - 6);
        this.ctx.lineTo(hx - 4, hy - 6);
        this.ctx.closePath(); // 몸통
        this.ctx.fill();

        // 좌측 시민 (약간 뒤)
        this.ctx.globalAlpha = 0.6;
        this.ctx.beginPath();
        this.ctx.arc(hx - 8, hy - 7, 3, 0, Math.PI * 2);
        this.ctx.moveTo(hx - 13, hy);
        this.ctx.lineTo(hx - 5, hy);
        this.ctx.lineTo(hx - 6, hy - 4);
        this.ctx.lineTo(hx - 12, hy - 4);
        this.ctx.closePath();
        this.ctx.fill();

        // 우측 시민 (약간 뒤)
        this.ctx.beginPath();
        this.ctx.arc(hx + 8, hy - 7, 3, 0, Math.PI * 2);
        this.ctx.moveTo(hx + 5, hy);
        this.ctx.lineTo(hx + 13, hy);
        this.ctx.lineTo(hx + 12, hy - 4);
        this.ctx.lineTo(hx + 6, hy - 4);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;

        // 민심 게이지 바
        const barX = x + 45, barY = y + 25, barW = w - 60, barH = 12;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.fillRect(barX, barY, barW, barH);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barW, barH);

        const currentBarW = barW * (sentiment / 100);
        let barColor1, barColor2;
        if (sentiment < 30) {
            barColor1 = '#ff1744';
            barColor2 = '#ff5252';
        } else if (sentiment < 60) {
            barColor1 = '#fbc02d';
            barColor2 = '#fff176';
        } else {
            barColor1 = '#00c853';
            barColor2 = '#69f0ae';
        }

        if (currentBarW > 0) {
            const grad = this.ctx.createLinearGradient(barX, 0, barX + currentBarW, 0);
            grad.addColorStop(0, barColor1);
            grad.addColorStop(1, barColor2);
            
            this.ctx.save();
            this.ctx.shadowBlur = isCritical ? 15 : 8;
            this.ctx.shadowColor = barColor1;
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(barX, barY, currentBarW, barH);
            this.ctx.restore();
        }

        // 구분선 추가 (10% 단위로 9개 표시)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;
        for (let i = 1; i <= 9; i++) {
            const lx = barX + (barW * i / 10);
            this.ctx.beginPath();
            this.ctx.moveTo(lx, barY);
            this.ctx.lineTo(lx, barY + barH);
            this.ctx.stroke();
        }

        // 민심 퍼센트 및 상태
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '900 16px "Segoe UI", Arial';
        this.ctx.fillText(`${sentiment}%`, barX, y + 52);

        this.ctx.textAlign = 'right';
        this.ctx.font = 'bold 11px "Segoe UI", Arial';
        this.ctx.fillStyle = barColor2;
        const status = isCritical ? "CRITICAL" : (sentiment < 60 ? "UNSTABLE" : "STABLE");
        this.ctx.fillText(status, x + w - 15, y + 49);

        this.ctx.restore();
    }

    renderParticles() {
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            this.ctx.globalAlpha = alpha;
            
            if (p.type === 'fire') {
                // 화염: 밝은 노랑 -> 주황 -> 짙은 회색으로 변함
                const r = 255;
                const g = Math.floor(200 * alpha);
                const b = Math.floor(100 * alpha * alpha);
                this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                
                this.ctx.beginPath();
                // 화염은 팽창하다가 사라짐
                const size = p.size * (1 + (1 - alpha) * 2);
                this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.type === 'smoke') {
                // 연기: 뭉게뭉게 피어오름
                this.ctx.fillStyle = p.color || '#555';
                this.ctx.beginPath();
                const size = p.size * (1 + (1 - alpha) * 3);
                this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.type === 'spark') {
                // 파편/스파크
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            }
        }
        this.ctx.globalAlpha = 1.0;
    }

    renderEntities(entities) {
        if (!entities) return;
        for (const entity of entities) {
            this.ctx.save();
            this.ctx.translate(entity.x, entity.y);
            if (entity.angle) this.ctx.rotate(entity.angle);

            // 1. 캐시 키 확인 (인터페이스 우선)
            let cacheKey = null;
            if (entity.getCacheKey) {
                cacheKey = entity.getCacheKey();
            } else {
                // 발사체 등 인터페이스가 없는 경우 기본 타입 캐싱 (null이면 실시간)
                cacheKey = (['missile', 'nuclear-missile', 'projectile'].includes(entity.type)) ? null : entity.type;
            }

            let img = cacheKey ? this.entityCache[cacheKey] : null;
            
            // 2. 비트맵 렌더링 혹은 실시간 벡터 렌더링
            if (cacheKey) {
                if (!img && entity.draw) {
                    img = this.generateEntityBitmap(entity, cacheKey);
                }
                if (img) {
                    const w = img.width, h = img.height;
                    this.ctx.drawImage(img, -w/2, -h/2, w, h);
                } else if (entity.draw) {
                    entity.draw(this.ctx);
                }
            } else if (entity.draw) {
                // cacheKey가 null인 경우 (애니메이션 진행 중 등) 실시간 렌더링
                entity.draw(this.ctx);
            }

            this.ctx.restore();

            // 3. 부가 정보 (체력바 등)
            // [수정] 탄약 상자 계열은 체력바를 숨기고, 일반 유닛도 체력이 98% 이상이면 숨김
            const isAmmoBox = entity.type && entity.type.startsWith('ammo-');
            if (entity.hp !== undefined && entity.hp < entity.maxHp * 0.98 && !isAmmoBox) {
                const isSelected = this.engine.selectedEntities.includes(entity);
                if (!isSelected) this.drawMiniHealthBar(entity);
            }
        }
    }

    generateEntityBitmap(entity, customKey) {
        const key = customKey || entity.type;
        if (this.entityCache[key]) return this.entityCache[key];

        // 상태값 임시 저장 (캐시용 이미지를 위해 각도를 0으로 설정)
        const oldX = entity.x, oldY = entity.y, oldAngle = entity.angle;
        
        // [수정] 대형 기체(수송기 등)와 공중 부상 오프셋을 완벽히 수용하기 위해 캐시 크기 대폭 확장 (4.0 -> 6.0)
        const size = (entity.size || 60) * 6.0; 
        const offCanvas = document.createElement('canvas');
        offCanvas.width = size;
        offCanvas.height = size;
        const offCtx = offCanvas.getContext('2d');

        offCtx.translate(size / 2, size / 2);
        
        entity.x = 0; entity.y = 0; entity.angle = 0;
        
        try {
            entity.draw(offCtx);
        } catch (e) {
            console.warn(`Failed to cache entity ${key}:`, e);
        }

        entity.x = oldX; entity.y = oldY; entity.angle = oldAngle;
        this.entityCache[key] = offCanvas;
        return offCanvas;
    }

    drawMiniHealthBar(entity) {
        const bounds = entity.getSelectionBounds ? entity.getSelectionBounds() : {
            left: entity.x - 20, right: entity.x + 20, top: entity.y - 20, bottom: entity.y + 20
        };
        const w = (bounds.right - bounds.left) * 0.8;
        const h = 3;
        const x = bounds.left + (bounds.right - bounds.left - w) / 2;
        const y = bounds.top - 5;
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(x, y, w, h);
        const hpRatio = Math.max(0, entity.hp / entity.maxHp);
        this.ctx.fillStyle = hpRatio > 0.4 ? '#2ecc71' : '#e74c3c';
        this.ctx.fillRect(x, y, w * hpRatio, h);
    }

    getViewportBounds() {
        const camera = this.engine.camera;
        const margin = 100;
        return {
            left: -camera.x / camera.zoom - margin,
            right: (-camera.x + this.canvas.width) / camera.zoom + margin,
            top: -camera.y / camera.zoom - margin,
            bottom: (-camera.y + this.canvas.height) / camera.zoom + margin
        };
    }

    getVisibleEntities(viewport) {
        if (this.engine.entityManager) {
            return this.engine.entityManager.getInRect(viewport.left, viewport.top, viewport.right, viewport.bottom);
        }
        return [];
    }

    sortEntitiesByLayer(entities) {
        this.layerBuckets[this.layers.UNITS].length = 0;
        this.layerBuckets[this.layers.PROJECTILES].length = 0;
        this.layerBuckets[this.layers.AIR_UNITS].length = 0;

        for (const ent of entities) {
            if (!ent.active && !ent.arrived) continue;
            if (ent.visible === false || ent.isBoarded) continue;

            // [안개 시스템] 아군 외 유닛은 시야 내에 있을 때만 렌더링
            const isAlly = (ent.ownerId === 1 || ent.ownerId === 3); // 1: Player, 3: Ally
            if (!isAlly && this.engine.tileMap) {
                const gx = Math.floor(ent.x / this.engine.tileMap.tileSize);
                const gy = Math.floor(ent.y / this.engine.tileMap.tileSize);
                const hasCeiling = this.engine.tileMap.layers.ceiling[gy]?.[gx]?.id;

                // 1. 기본 시야(안개) 체크
                const inSight = this.engine.tileMap.isInSight(ent.x, ent.y) || (this.engine.debugSystem?.isFullVision);
                
                if (!inSight) continue;

                // 2. [천장 은폐 체크] 적 유닛이 천장 아래에 있는 경우
                if (hasCeiling) {
                    const roomId = this.engine.tileMap.grid[gy][gx].roomId;
                    
                    // 주변에 아군 유닛이 이 천장 구역(Room) 안에 있는지 확인 (공중 유닛은 제외)
                    const alliedUnitsInRoom = this.engine.entities.units.some(u => {
                        const isFlying = (u.domain === 'air' || (u.altitude !== undefined && u.altitude > 0.01));
                        if (u.ownerId !== 1 || !u.active || u.hp <= 0 || isFlying) return false;
                        
                        const ugx = Math.floor(u.x / this.engine.tileMap.tileSize);
                        const ugy = Math.floor(u.y / this.engine.tileMap.tileSize);
                        const uRoomId = this.engine.tileMap.grid[ugy]?.[ugx]?.roomId;
                        
                        // 아군 지상 유닛이 적과 같은 구역(Room)에 있거나, 바로 그 타일에 있으면 보임
                        return (uRoomId === roomId && roomId !== null) || (ugx === gx && ugy === gy);
                    });

                    if (!alliedUnitsInRoom) continue;
                }
            }

            if (['projectile', 'bullet', 'shell', 'missile', 'nuclear-missile', 'bomb'].includes(ent.type)) {
                this.layerBuckets[this.layers.PROJECTILES].push(ent);
            } else {
                // 공중 유닛 판별: 도메인이 air이거나, 현재 떠 있는 상태(altitude > 0.1)인 경우
                const isFlying = (ent.domain === 'air' || (ent.altitude !== undefined && ent.altitude > 0.1));
                
                if (isFlying) {
                    this.layerBuckets[this.layers.AIR_UNITS].push(ent);
                } else {
                    this.layerBuckets[this.layers.UNITS].push(ent);
                }
            }
        }
    }

    renderEffects() {
        const effects = this.engine.effects;
        if (!effects) return;
        for (const effect of effects) {
            if (!effect.active) continue;
            const progress = effect.timer / effect.duration;
            const alpha = 1 - progress;
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            if (effect.type === 'explosion') {
                const radius = (effect.radius || 20) * (1 + progress);
                this.ctx.strokeStyle = effect.color || '#fff';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (effect.type === 'hit') {
                this.ctx.fillStyle = effect.color || '#fff';
                this.ctx.beginPath();
                this.ctx.arc(effect.x, effect.y, 5 * alpha, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (effect.type === 'system') {
                this.ctx.fillStyle = effect.color;
                this.ctx.font = '14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(effect.text, effect.x, effect.y - (progress * 20));
            }
            this.ctx.restore();
        }
    }

    renderOverlays(visibleEntities) {
        const selected = this.engine.selectedEntities;
        if (!selected) return;
        for (const entity of selected) {
            if (!entity.active || entity.hp === undefined) continue;
            
            // [수정] getSelectionBounds를 사용하여 공중 유닛의 고도 오프셋을 반영
            const bounds = entity.getSelectionBounds ? entity.getSelectionBounds() : {
                left: entity.x - 20, right: entity.x + 20, top: entity.y - 20, bottom: entity.y + 20
            };
            
            const w = bounds.right - bounds.left;
            const h = 4;
            const x = bounds.left;
            const y = bounds.top - 10; // 박스 상단에서 10px 위
            
            // 1. 체력바 렌더링
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(x, y, w, h);
            const hpRatio = Math.max(0, entity.hp / entity.maxHp);
            this.ctx.fillStyle = hpRatio > 0.5 ? '#00ff00' : (hpRatio > 0.2 ? '#ffff00' : '#ff0000');
            this.ctx.fillRect(x, y, w * hpRatio, h);
            
            // [제거] 선택 박스 strokeRect는 GameEngine.renderOverlays에서 색상/관계별로 더 정확하게 그리므로 여기서 제거
        }
    }
}
