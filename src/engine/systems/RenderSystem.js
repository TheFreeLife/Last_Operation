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
            EFFECTS: 3,
            UI: 4
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
            [this.layers.PROJECTILES]: []
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
        if (this.engine.tileMap) this.engine.tileMap.drawGrid(camera);

        // 4. 엔티티 분류 및 렌더링
        const visibleEntities = this.getVisibleEntities(viewport);
        this.sortEntitiesByLayer(visibleEntities);

        this.renderEntities(this.layerBuckets[this.layers.UNITS]);
        this.renderEntities(this.layerBuckets[this.layers.PROJECTILES]);
        
        // 5. 파티클 및 이펙트 (최상단)
        this.updateParticles(16);
        this.renderParticles();
        this.renderEffects();

        if (this.engine.tileMap) this.engine.tileMap.drawFog(camera);

        // 6. 선택 도구
        this.renderSelectionBox();
        this.renderOverlays(visibleEntities);

        this.ctx.restore();
        this.stats.lastFrameTime = performance.now() - startTime;
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

            let img = this.entityCache[entity.type];
            // 탄약 상자(ammo-) 계열은 동적 이펙트(빔)가 있으므로 캐싱 제외
            const isDynamic = entity.type?.startsWith('ammo-');
            
            if (!img && entity.draw && entity.type && !isDynamic) {
                img = this.generateEntityBitmap(entity);
            }

            if (img) {
                const w = img.width, h = img.height;
                this.ctx.drawImage(img, -w/2, -h/2, w, h);
            } else if (entity.draw) {
                entity.draw(this.ctx);
            }

            this.ctx.restore();

            if (entity.hp !== undefined && entity.hp < entity.maxHp) {
                this.drawMiniHealthBar(entity);
            }
        }
    }

    generateEntityBitmap(entity) {
        const type = entity.type;
        if (this.entityCache[type]) return this.entityCache[type];

        const size = (entity.size || 60) * 2; 
        const offCanvas = document.createElement('canvas');
        offCanvas.width = size;
        offCanvas.height = size;
        const offCtx = offCanvas.getContext('2d');

        offCtx.translate(size / 2, size / 2);
        
        const oldX = entity.x, oldY = entity.y, oldAngle = entity.angle;
        entity.x = 0; entity.y = 0; entity.angle = 0;
        
        try {
            entity.draw(offCtx);
        } catch (e) {
            console.warn(`Failed to cache entity ${type}:`, e);
        }

        entity.x = oldX; entity.y = oldY; entity.angle = oldAngle;
        this.entityCache[type] = offCanvas;
        return offCanvas;
    }

    drawMiniHealthBar(entity) {
        const w = (entity.width || entity.size || 40) * 0.8;
        const h = 3;
        const x = entity.x - w / 2, y = entity.y - (entity.height || entity.size || 40) / 2 - 5;
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

        for (const ent of entities) {
            if (!ent.active && !ent.arrived) continue;
            if (ent.visible === false || ent.isBoarded) continue;

            if (['projectile', 'bullet', 'shell', 'missile'].includes(ent.type)) {
                this.layerBuckets[this.layers.PROJECTILES].push(ent);
            } else {
                this.layerBuckets[this.layers.UNITS].push(ent);
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

    renderSelectionBox() {
        const box = this.engine.camera.selectionBox;
        if (!box) return;
        this.ctx.save();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(box.startX, box.startY, box.currentX - box.startX, box.currentY - box.startY);
        this.ctx.restore();
    }

    renderOverlays(visibleEntities) {
        const selected = this.engine.selectedEntities;
        if (!selected) return;
        for (const entity of selected) {
            if (!entity.active || entity.hp === undefined) continue;
            const w = entity.width || entity.size || 40;
            const h = 4;
            const x = entity.x - w / 2, y = entity.y - (entity.height || entity.size || 40) / 2 - 10;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(x, y, w, h);
            const hpRatio = Math.max(0, entity.hp / entity.maxHp);
            this.ctx.fillStyle = hpRatio > 0.5 ? '#00ff00' : (hpRatio > 0.2 ? '#ffff00' : '#ff0000');
            this.ctx.fillRect(x, y, w * hpRatio, h);
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(entity.x - w/2, entity.y - (entity.height||40)/2, w, entity.height||40);
        }
    }
}
