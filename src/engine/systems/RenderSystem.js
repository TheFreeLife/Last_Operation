import { ICONS } from '../../assets/Icons.js';

/**
 * RenderSystem (Canvas 2D Optimized)
 * SVG를 매 프레임 그리는 대신, 게임 시작 시 비트맵 이미지로 캐싱하여 그립니다.
 * WebGL 없이도 높은 성능을 보장합니다.
 */
export class RenderSystem {
    constructor(engine) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.canvas = engine.canvas;

        // 레이어 정의 (렌더링 순서용)
        this.layers = {
            TERRAIN: 0,
            RESOURCES: 1,
            BUILDINGS: 2,
            UNITS: 3,
            PROJECTILES: 4,
            EFFECTS: 5,
            UI: 6
        };

        // SVG -> Image 캐싱 저장소
        this.iconCache = {};
        this.isCacheLoaded = false;
        
        // 아이콘 초기화 시작
        this.initIconCache().then(() => {
            console.log('[RenderSystem] SVG Icons cached successfully.');
            this.isCacheLoaded = true;
        });

        // 메모리 재사용을 위한 레이어 버킷 (GC 최적화)
        this.layerBuckets = {
            [this.layers.RESOURCES]: [],
            [this.layers.BUILDINGS]: [],
            [this.layers.UNITS]: [],
            [this.layers.PROJECTILES]: []
        };

        // 통계 및 디버그용
        this.stats = {
            renderedEntities: 0,
            totalEntities: 0,
            lastFrameTime: 0
        };
    }

    /**
     * SVG 문자열을 Blob -> Image -> Offscreen Canvas(Bitmap)로 변환하여 캐싱
     * 벡터 연산을 로딩 시점에 끝내고, 런타임에는 순수 비트맵만 사용합니다.
     */
    async initIconCache() {
        const promises = [];

        for (const [key, html] of Object.entries(ICONS)) {
            // SVG 태그 추출
            const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/i);
            if (svgMatch) {
                let svgContent = svgMatch[0];

                // 네임스페이스 및 사이즈 보정
                if (!svgContent.includes('xmlns')) {
                    svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                
                // width/height가 없으면 강제 주입 (기본 해상도 64x64로 약간 여유있게 래스터화)
                const rasterSize = 64; 
                if (!svgContent.includes('width=')) {
                    svgContent = svgContent.replace('<svg', `<svg width="${rasterSize}" height="${rasterSize}"`);
                }

                // Blob 생성
                const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                // 이미지 로딩 및 비트맵 변환 Promise
                const p = new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        // 1. 오프스크린 캔버스 생성 (메모리상에만 존재)
                        const offCanvas = document.createElement('canvas');
                        offCanvas.width = rasterSize;
                        offCanvas.height = rasterSize;
                        const offCtx = offCanvas.getContext('2d');

                        // 2. SVG 이미지를 캔버스에 그림 (이 시점에 벡터 -> 비트맵 변환 발생)
                        offCtx.drawImage(img, 0, 0, rasterSize, rasterSize);

                        // 3. 변환된 비트맵(캔버스 자체)을 캐시에 저장
                        this.iconCache[key] = offCanvas;
                        
                        // 메모리 해제
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`[RenderSystem] Failed to load icon: ${key}`);
                        resolve();
                    };
                    img.src = url;
                });
                promises.push(p);
            }
        }

        await Promise.all(promises);
    }

    /**
     * 메인 렌더링 함수
     */
    render() {
        const startTime = performance.now();

        // [성능] 이미지 보간(부드럽게 처리) 끄기 -> 픽셀 그대로 표현 (빠르고 선명함)
        this.ctx.imageSmoothingEnabled = false;

        // 1. 화면 초기화
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. 카메라 변환 적용
        this.ctx.save();
        const camera = this.engine.camera;
        this.ctx.translate(camera.x, camera.y);
        this.ctx.scale(camera.zoom, camera.zoom);

        // 3. 뷰포트 컬링 범위 계산
        const viewport = this.getViewportBounds();

        // 4. 지형 (TileMap) 렌더링
        if (this.engine.tileMap) {
            this.engine.tileMap.drawGrid(camera); // TileMap 내부 최적화(청크) 사용
        }

        // 5. 엔티티 분류 및 렌더링
        // (캐시가 로드되지 않았어도 기본 도형으로라도 그릴 수 있도록 함)
        const visibleEntities = this.getVisibleEntities(viewport);
        
        // 레이어별 정렬 (재사용 버킷 활용)
        this.sortEntitiesByLayer(visibleEntities);

        // 순서대로 렌더링
        this.renderEntities(this.layerBuckets[this.layers.RESOURCES]);
        this.renderEntities(this.layerBuckets[this.layers.BUILDINGS]);
        this.renderEntities(this.layerBuckets[this.layers.UNITS]);
        this.renderEntities(this.layerBuckets[this.layers.PROJECTILES]); // 투사체는 별도 처리
        
        // 6. 이펙트
        this.renderEffects();

        // 7. 안개 (Fog) - 유닛 위에 덮어씀
        if (this.engine.tileMap) {
            this.engine.tileMap.drawFog(camera);
        }

        // 8. 선택 박스 및 오버레이
        this.renderSelectionBox();
        this.renderOverlays(visibleEntities);

        this.ctx.restore();

        // 9. UI (독립 좌표계) - 미니맵 등은 별도 Canvas 사용 중

        this.stats.lastFrameTime = performance.now() - startTime;
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
            return this.engine.entityManager.getInRect(
                viewport.left, viewport.top, viewport.right, viewport.bottom
            );
        }
        // Fallback
        return [
            ...this.engine.entities.resources,
            ...this.engine.getAllBuildings(),
            ...this.engine.entities.units,
            ...this.engine.entities.enemies,
            ...this.engine.entities.neutral,
            ...this.engine.entities.projectiles
        ];
    }

    sortEntitiesByLayer(entities) {
        // 기존 버킷 비우기 (새 배열 할당 없이 길이만 0으로)
        this.layerBuckets[this.layers.RESOURCES].length = 0;
        this.layerBuckets[this.layers.BUILDINGS].length = 0;
        this.layerBuckets[this.layers.UNITS].length = 0;
        this.layerBuckets[this.layers.PROJECTILES].length = 0;

        for (const ent of entities) {
            if (!ent.active && !ent.arrived) continue; // 비활성 제외
            if (ent.visible === false || ent.isBoarded) continue; // 숨겨진 것 제외

            if (ent.type === 'projectile' || ent.type === 'bullet' || ent.type === 'shell' || ent.type === 'missile') {
                this.layerBuckets[this.layers.PROJECTILES].push(ent);
            } else if (ent.type === 'resource' || ent.isResource) {
                this.layerBuckets[this.layers.RESOURCES].push(ent);
            } else if (ent.speed === undefined || ent.type === 'wall') { 
                // speed가 없으면 건물로 간주 (단순 분류)
                this.layerBuckets[this.layers.BUILDINGS].push(ent);
            } else {
                this.layerBuckets[this.layers.UNITS].push(ent);
            }
        }
        // 반환할 필요 없이 멤버 변수 직접 접근
    }

    renderEntities(entities) {
        if (!entities) return;

        for (const entity of entities) {
            // 건설 중인 경우 투명도 적용
            if (entity.isUnderConstruction) {
                this.ctx.globalAlpha = 0.6;
            }

            // 1. 캐시된 이미지 그리기 (우선)
            const img = this.iconCache[entity.type];
            if (this.isCacheLoaded && img) {
                const w = entity.width || entity.size || 40;
                const h = entity.height || entity.size || 40;
                
                this.ctx.save();
                this.ctx.translate(entity.x, entity.y);
                if (entity.angle) this.ctx.rotate(entity.angle);
                
                // 선택 시 틴트 효과 (Canvas filter는 성능이 무거우므로 외곽선으로 대체하거나 globalCompositeOperation 사용)
                // 여기서는 간단히 선택 시 밝기 조절 (성능 고려)
                // 하지만 filter는 무거우니 생략하고, 선택 박스로 구분합니다.

                this.ctx.drawImage(img, -w/2, -h/2, w, h);
                this.ctx.restore();
            } 
            // 2. 이미지가 없으면 기존 draw 메서드 호출 (Fallback)
            else if (entity.draw) {
                entity.draw(this.ctx);
            } 
            // 3. 그것도 없으면 기본 사각형 (최후의 수단)
            else {
                this.ctx.fillStyle = '#ff00ff';
                this.ctx.fillRect(entity.x - 20, entity.y - 20, 40, 40);
            }

            // 건설 진행바 (별도 메서드)
            if (entity.isUnderConstruction) {
                this.ctx.globalAlpha = 1.0;
                if (entity.drawConstruction) entity.drawConstruction(this.ctx);
            } else {
                this.ctx.globalAlpha = 1.0;
            }
        }
    }

    renderEffects() {
        const effects = this.engine.effects;
        if (!effects) return;

        const now = Date.now();
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
            } else if (effect.type === 'bullet') {
                // 트레일
                this.ctx.fillStyle = effect.color || '#ffff00';
                this.ctx.fillRect(effect.x - 1, effect.y - 1, 3, 3);
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
        this.ctx.setLineDash([5, 5]); // 점선
        this.ctx.strokeRect(box.startX, box.startY, box.currentX - box.startX, box.currentY - box.startY);
        this.ctx.restore();
    }

    renderOverlays(visibleEntities) {
        // 선택된 유닛 체력바 표시
        const selected = this.engine.selectedEntities;
        
        for (const entity of selected) {
            if (!entity.active || entity.hp === undefined) continue;
            // 화면 밖이면 패스 (visibleEntities에 포함되어 있는지 확인하거나, 좌표 계산)
            // 여기서는 단순 좌표 계산
            
            const w = entity.width || entity.size || 40;
            const h = 4;
            const x = entity.x - w / 2;
            const y = entity.y - (entity.height || entity.size || 40) / 2 - 10;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(x, y, w, h);
            
            const hpRatio = Math.max(0, entity.hp / entity.maxHp);
            this.ctx.fillStyle = hpRatio > 0.5 ? '#00ff00' : (hpRatio > 0.2 ? '#ffff00' : '#ff0000');
            this.ctx.fillRect(x, y, w * hpRatio, h);
            
            // 선택 테두리
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(entity.x - w/2, entity.y - (entity.height||40)/2, w, entity.height||40);
        }
    }
}
