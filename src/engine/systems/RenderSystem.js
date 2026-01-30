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
        this.renderEntities(this.layerBuckets[this.layers.PROJECTILES]);
        this.renderEntities(this.layerBuckets[this.layers.AIR_UNITS]);
        
        // 5. 파티클 및 이펙트 (최상단)
        this.updateParticles(16);
        this.renderParticles();
        this.renderEffects();

        if (this.engine.tileMap) this.engine.tileMap.drawFog(camera);

        // 6. 선택 도구 및 오버레이 (GameEngine에서 중복 처리되는 부분 제외하고 필요한 것만 유지)
        this.renderOverlays(visibleEntities);

        this.ctx.restore();
        
        // 7. UI 오버레이 (카메라 영향 받지 않음)
        this.renderGold();
        
        this.stats.lastFrameTime = performance.now() - startTime;
    }

    renderGold() {
        if (this.engine.gameState !== 'PLAYING') return;

        const gold = this.engine.gold;
        const income = this.engine.goldIncome;
        const x = 20, y = 20;
        const w = 160, h = 40;

        // 배경 박스
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.strokeStyle = '#fbc02d';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 5);
        this.ctx.fill();
        this.ctx.stroke();

        // 골드 아이콘 (코인 모양)
        this.ctx.fillStyle = '#fbc02d';
        this.ctx.beginPath();
        this.ctx.arc(x + 20, y + 20, 10, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('$', x + 20, y + 25);

        // 골드 수치
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px "Courier New", monospace';
        this.ctx.fillText(Math.floor(gold).toLocaleString(), x + 40, y + 27);

        // 초당 수익 표시
        this.ctx.fillStyle = '#39ff14';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText(`+${income}/s`, x + w - 45, y + 25);
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
                cacheKey = (['missile', 'projectile'].includes(entity.type)) ? null : entity.type;
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
            if (entity.hp !== undefined && entity.hp < entity.maxHp) {
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
                if (!this.engine.tileMap.isInSight(ent.x, ent.y) && !(this.engine.debugSystem?.isFullVision)) {
                    continue;
                }
            }

            if (['projectile', 'bullet', 'shell', 'missile'].includes(ent.type)) {
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
