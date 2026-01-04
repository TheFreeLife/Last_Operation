/**
 * RenderSystem - 렌더링 최적화 시스템
 * 
 * 주요 기능:
 * 1. 뷰포트 컬링 (Viewport Culling) - 화면 밖 엔티티 렌더링 생략
 * 2. 레이어별 렌더링 - 지형 → 건물 → 유닛 → 이펙트 → UI
 * 3. EntityManager 활용 - 공간 분할 기반 효율적 검색
 */
export class RenderSystem {
    constructor(engine) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.canvas = engine.canvas;

        // 렌더링 레이어 정의
        this.layers = {
            TERRAIN: 0,
            RESOURCES: 1,
            BUILDINGS: 2,
            UNITS: 3,
            PROJECTILES: 4,
            EFFECTS: 5,
            UI: 6
        };

        // 디버그 모드
        this.debugMode = false;
        this.stats = {
            totalEntities: 0,
            renderedEntities: 0,
            culledEntities: 0,
            lastFrameTime: 0
        };
    }

    /**
     * 뷰포트 경계 계산
     * 카메라 위치와 줌을 고려한 화면 영역
     */
    getViewportBounds() {
        const camera = this.engine.camera;
        const margin = 100; // 여유 공간 (화면 밖에서 진입하는 엔티티 고려)

        return {
            left: -camera.x / camera.zoom - margin,
            right: (-camera.x + this.canvas.width) / camera.zoom + margin,
            top: -camera.y / camera.zoom - margin,
            bottom: (-camera.y + this.canvas.height) / camera.zoom + margin
        };
    }

    /**
     * 엔티티가 뷰포트 내에 있는지 확인
     */
    isInViewport(entity, bounds) {
        if (!entity || (!entity.active && !entity.arrived)) return false;

        const w = entity.width || entity.size || 40;
        const h = entity.height || entity.size || 40;
        const hw = w / 2;
        const hh = h / 2;

        return !(entity.x + hw < bounds.left ||
            entity.x - hw > bounds.right ||
            entity.y + hh < bounds.top ||
            entity.y - hh > bounds.bottom);
    }

    /**
     * 레이어별로 엔티티 분류
     */
    sortEntitiesByLayer() {
        const sorted = {
            [this.layers.TERRAIN]: [],
            [this.layers.RESOURCES]: [],
            [this.layers.BUILDINGS]: [],
            [this.layers.UNITS]: [],
            [this.layers.PROJECTILES]: [],
            [this.layers.EFFECTS]: []
        };

        const entities = this.engine.entities;

        // 자원
        if (entities.resources) {
            sorted[this.layers.RESOURCES] = entities.resources.filter(e => e.active);
        }

        // 건물
        const buildings = [
            ...(entities.walls || []),
            ...(entities.airports || []),
            ...(entities.apartments || []),
            ...(entities.refineries || []),
            ...(entities.goldMines || []),
            ...(entities.ironMines || []),
            ...(entities.storage || []),
            ...(entities.ammoFactories || []),
            ...(entities.armories || []),
            ...(entities.barracks || [])
        ];
        if (entities.base) buildings.push(entities.base);
        sorted[this.layers.BUILDINGS] = buildings.filter(e => e && e.active);

        // 유닛
        sorted[this.layers.UNITS] = [
            ...(entities.units || []),
            ...(entities.enemies || []),
            ...(entities.neutral || [])
        ].filter(e => e && e.active);

        // 발사체 (폭발 중인 객체 포함)
        sorted[this.layers.PROJECTILES] = (entities.projectiles || []).filter(e => e && (e.active || e.arrived));

        // 이펙트
        sorted[this.layers.EFFECTS] = (this.engine.effects || []).filter(e => e && e.active);

        return sorted;
    }

    /**
     * 메인 렌더링 함수
     */
    render() {
        const startTime = performance.now();

        // 화면 초기화
        this.ctx.save();
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 카메라 변환 적용
        const camera = this.engine.camera;
        this.ctx.translate(camera.x, camera.y);
        this.ctx.scale(camera.zoom, camera.zoom);

        // 뷰포트 경계 계산
        const viewportBounds = this.getViewportBounds();

        // EntityManager 사용: 뷰포트 내 엔티티만 가져오기
        const visibleEntities = this.engine.entityManager?.getInRect(
            viewportBounds.left,
            viewportBounds.top,
            viewportBounds.right,
            viewportBounds.bottom
        ) || [];

        // 통계 초기화
        this.stats.totalEntities = this.engine.entityManager?.allEntities.length || 0;
        this.stats.renderedEntities = 0;
        this.stats.culledEntities = this.stats.totalEntities - visibleEntities.length;

        // 레이어별로 정렬
        const sorted = this.sortEntitiesByLayer();

        // 레이어 순서대로 렌더링
        this.renderLayer(sorted[this.layers.TERRAIN], viewportBounds);
        this.renderTileMap(); // 타일맵 바닥(Grid) 렌더링
        this.renderLayer(sorted[this.layers.RESOURCES], viewportBounds);
        this.renderLayer(sorted[this.layers.BUILDINGS], viewportBounds);
        this.renderLayer(sorted[this.layers.UNITS], viewportBounds);
        this.renderLayer(sorted[this.layers.PROJECTILES], viewportBounds);
        this.renderEffects(sorted[this.layers.EFFECTS]);

        // [수정] 안개(Fog of War)는 모든 유닛/건물 위에 덮어씌워야 함
        this.renderFog();

        // 선택 박스 렌더링
        this.renderSelectionBox();

        // 카메라 변환 해제
        this.ctx.restore();

        // UI 레이어 (카메라 독립적)
        this.renderUI();

        // 디버그 정보
        if (this.debugMode) {
            this.renderDebugInfo();
        }

        this.stats.lastFrameTime = performance.now() - startTime;
    }

    /**
     * 레이어 렌더링
     */
    renderLayer(entities, viewportBounds) {
        if (!entities) return;

        for (const entity of entities) {
            // [수정] Fog of War에 의해 가려진 유닛 또는 탑승 중인 유닛은 렌더링하지 않음
            // 발사체는 arrived 상태일 때도 렌더링을 허용해야 함
            if (!entity || (!entity.active && !entity.arrived)) continue;
            if (entity.visible === false || entity.isBoarded) continue;

            // 뷰포트 컬링
            if (!this.isInViewport(entity, viewportBounds)) continue;

            // 엔티티 렌더링
            if (entity.draw) {
                entity.draw(this.ctx);
                this.stats.renderedEntities++;
            }

            // 선택 표시 (GameEngine의 renderOverlays에서 처리하므로 여기서는 생략)
            // if (this.engine.selectedEntities?.includes(entity)) {
            //     this.drawSelectionIndicator(entity);
            // }
        }
    }

    /**
     * 타일맵 렌더링 (기존 로직 유지)
     */
    renderTileMap() {
        // 바닥 타일만 렌더링 (안개 제외)
        if (this.engine.tileMap && this.engine.tileMap.drawGrid) {
            this.engine.tileMap.drawGrid(this.engine.camera);
        }
    }

    renderFog() {
        // 안개는 모든 객체 위에 렌더링됨
        if (this.engine.tileMap && this.engine.tileMap.drawFog) {
            this.engine.tileMap.drawFog(this.engine.camera);
        }
    }

    /**
     * 이펙트 렌더링
     */
    renderEffects(effects) {
        if (!effects) return;

        const now = Date.now();
        for (const effect of effects) {
            if (!effect.active) continue;

            const progress = effect.timer / effect.duration;
            const alpha = 1 - progress;

            this.ctx.save();
            this.ctx.globalAlpha = alpha;

            if (effect.type === 'bullet') {
                this.ctx.fillStyle = effect.color;
                for (const p of effect.particles || []) {
                    const x = effect.x + p.vx * effect.timer * 0.1;
                    const y = effect.y + p.vy * effect.timer * 0.1;
                    this.ctx.fillRect(x, y, p.size, p.size);
                }
            } else if (effect.type === 'explosion') {
                const radius = effect.radius * (1 + progress);
                this.ctx.strokeStyle = effect.color;
                this.ctx.lineWidth = 3 * (1 - progress);
                this.ctx.beginPath();
                this.ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (effect.type === 'hit') {
                // 피격 스파크 효과
                const size = (1 - progress) * 8;
                this.ctx.fillStyle = effect.color || '#fff';
                this.ctx.beginPath();
                this.ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
                this.ctx.fill();

                // 사방으로 튀는 짧은 선 (스파크)
                this.ctx.strokeStyle = effect.color || '#fff';
                this.ctx.lineWidth = 2 * (1 - progress);
                for (let i = 0; i < 4; i++) {
                    const angle = (i * Math.PI / 2) + (progress * 2);
                    const len = 12 * progress;
                    this.ctx.beginPath();
                    this.ctx.moveTo(effect.x + Math.cos(angle) * 3, effect.y + Math.sin(angle) * 3);
                    this.ctx.lineTo(effect.x + Math.cos(angle) * (3 + len), effect.y + Math.sin(angle) * (3 + len));
                    this.ctx.stroke();
                }
            } else if (effect.type === 'flak') {
                // 대공포 피격 효과 (공중 폭발 느낌)
                const radius = 5 + progress * 15;
                const alpha = 1 - progress;
                
                this.ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.5})`;
                this.ctx.beginPath();
                this.ctx.arc(effect.x, effect.y, radius * 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (effect.type === 'system') {
                this.ctx.fillStyle = effect.color;
                this.ctx.font = '14px Arial';
                this.ctx.textAlign = 'center';
                const yOffset = progress * 30;
                this.ctx.fillText(effect.text, effect.x, effect.y - yOffset);
            }

            this.ctx.restore();
        }
    }

    /**
     * 선택 표시 렌더링
     */
    drawSelectionIndicator(entity) {
        const bounds = entity.getSelectionBounds();
        const w = bounds.right - bounds.left;
        const h = bounds.bottom - bounds.top;

        this.ctx.save();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(bounds.left, bounds.top, w, h);

        // HP 바
        if (entity.hp !== undefined && entity.maxHp !== undefined && entity.hp < entity.maxHp) {
            const barW = Math.min(w, 60);
            const barH = 4;
            const barX = entity.x - barW / 2;
            const barY = bounds.top - 8;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(barX, barY, barW, barH);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(barX, barY, barW * (entity.hp / entity.maxHp), barH);
        }

        this.ctx.restore();
    }

    /**
     * 선택 박스 렌더링
     */
    renderSelectionBox() {
        const box = this.engine.camera.selectionBox;
        if (!box) return;

        this.ctx.save();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(box.startX, box.startY, box.endX - box.startX, box.endY - box.startY);
        this.ctx.restore();
    }

    /**
     * UI 렌더링 (카메라 독립적)
     */
    renderUI() {
        // 기존 UI는 HTML/CSS로 처리되므로 필요시만 캔버스 UI 추가
    }

    /**
     * 디버그 정보 렌더링
     */
    renderDebugInfo() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 250, 120);

        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';

        let y = 30;
        const lineHeight = 18;

        this.ctx.fillText(`FPS: ${(1000 / this.stats.lastFrameTime).toFixed(1)}`, 20, y);
        y += lineHeight;
        this.ctx.fillText(`Frame Time: ${this.stats.lastFrameTime.toFixed(2)}ms`, 20, y);
        y += lineHeight;
        this.ctx.fillText(`Total Entities: ${this.stats.totalEntities}`, 20, y);
        y += lineHeight;
        this.ctx.fillText(`Rendered: ${this.stats.renderedEntities}`, 20, y);
        y += lineHeight;
        this.ctx.fillText(`Culled: ${this.stats.culledEntities}`, 20, y);
        y += lineHeight;
        this.ctx.fillText(`Cull Rate: ${(this.stats.culledEntities / this.stats.totalEntities * 100).toFixed(1)}%`, 20, y);

        this.ctx.restore();
    }

    /**
     * 디버그 모드 토글
     */
    toggleDebug() {
        this.debugMode = !this.debugMode;
        console.log(`[RenderSystem] Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
    }
}
