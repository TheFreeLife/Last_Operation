import { Entity } from '../BaseEntity.js';

export class Apartment extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'apartment';
        this.name = '아파트';
        this.width = 160;  // 4 tiles
        this.height = 200; // 5 tiles
        this.size = 200;
        this.maxHp = 3000;
        this.hp = 3000;
        this.popProvide = 10;

        // 벙커(수송) 기능 추가
        this.cargo = [];
        this.cargoCapacity = 12; // 8 -> 12 (보병 분대 4개 수용 가능)
        this.isBunker = true;
        this.targetTimer = 0;
        this.targetInterval = 200; // 0.2초마다 타겟 갱신 (최적화)
        this.nearbyTargets = [];

        // 하차(출동) 관련 속성
        this.isUnloading = false;
        this.unloadTimer = 0;
        this.unloadInterval = 200; // 0.2초마다 한 명씩 신속 출동
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction || this.hp <= 0) return;

        // 순차 하차 처리
        if (this.isUnloading && this.cargo.length > 0) {
            this.unloadTimer += deltaTime;
            if (this.unloadTimer >= this.unloadInterval) {
                const unit = this.cargo.shift();
                
                // 유닛 상태 복구 (이제 리스트에 항상 존재하므로 플래그만 변경)
                unit.isBoarded = false;
                unit.active = true;
                
                // 입구 위치로 좌표 설정
                unit.x = this.x;
                unit.y = this.y + (this.height / 2) + 60; // 좀 더 아래로
                unit.angle = Math.PI / 2;
                
                // 명령 상태 초기화 및 전진
                unit.command = 'move';
                unit.destination = { x: unit.x, y: unit.y + 100 };
                
                // [중요] 물리 엔진 위치 동기화
                if (engine.entityManager && engine.entityManager.spatialGrid) {
                    engine.entityManager.spatialGrid.update(unit);
                }
                
                this.unloadTimer = 0;
                if (this.cargo.length === 0) {
                    this.isUnloading = false;
                    engine.addEffect?.('system', this.x, this.y - 100, '#00d2ff', '전원 출동 완료');
                }
            }
        }

        // 내부 유닛 공격 로직 (최적화 적용)
        if (this.cargo.length > 0) {
            this.targetTimer += deltaTime;
            if (this.targetTimer >= this.targetInterval) {
                // 1. 공유 타겟팅: 주변 적 검색 (최대 사거리 500 가정)
                this.nearbyTargets = engine.entities.enemies.filter(enemy => 
                    enemy.active && enemy.hp > 0 && Math.hypot(enemy.x - this.x, enemy.y - this.y) < 550
                );
                this.targetTimer = 0;
            }

            // 2. 내부 유닛들에게 사격 명령 (타겟 리스트 공유)
            if (this.nearbyTargets.length > 0) {
                this.cargo.forEach(unit => {
                    if (unit.updateBunkerFire) {
                        unit.updateBunkerFire(deltaTime, engine, this.nearbyTargets, this);
                    }
                });
            }
        }
    }

    loadUnit(unit) {
        const occupied = this.getOccupiedSize();
        const unitSize = unit.cargoSize || 1;
        
        if (occupied + unitSize <= this.cargoCapacity) {
            this.cargo.push(unit);
            unit.isBoarded = true;
            // [수정] active = false를 하지 않음. 그래야 엔진 리스트에서 유지됨.
            // RenderSystem에서 isBoarded 유닛은 그리지 않음.
            return true;
        }
        return false;
    }

    getOccupiedSize() {
        return this.cargo.reduce((sum, u) => sum + (u.cargoSize || 1), 0);
    }

    getSelectionBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }

    unloadAll() {
        if (this.cargo.length > 0) {
            this.isUnloading = true;
        }
    }

    // 건물이 파괴되거나 판매될 때 호출되어 내부 유닛을 내보냄
    onDestruction(engine) {
        if (this.cargo.length > 0) {
            this.cargo.forEach(unit => {
                unit.isBoarded = false;
                unit.active = true;
                // 건물 위치 주변에 무작위로 배치
                unit.x = this.x + (Math.random() - 0.5) * 80;
                unit.y = this.y + (this.height / 2) + 20; // 입구 근처로 방출
                unit.hp = Math.max(1, unit.hp * 0.9); // 충격 최소화

                // 공간 분할 그리드 업데이트
                if (engine.entityManager && engine.entityManager.spatialGrid) {
                    engine.entityManager.spatialGrid.update(unit);
                }
            });
            this.cargo = [];
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 기반 (Concrete Foundation)
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-80, -100, 160, 200);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.strokeRect(-80, -100, 160, 200);

        // 2. 메인 건물 구조 (2.5D)
        const drawBuilding = (bx, by, bw, bh, elevation, floors) => {
            // 건물 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(bx + 10, by + 10, bw, bh);

            // 뒷면/측면 두께 (Depth)
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(bx, by - elevation, bw + elevation, bh + elevation);

            // 정면 벽 (Main Facade)
            const facadeGrd = ctx.createLinearGradient(bx, by, bx, by + bh);
            facadeGrd.addColorStop(0, '#ecf0f1');
            facadeGrd.addColorStop(1, '#bdc3c7');
            ctx.fillStyle = facadeGrd;
            ctx.fillRect(bx, by, bw, bh);

            // 층별 창문 및 베란다
            const floorHeight = bh / floors;
            const winW = 12;
            const winH = 15;
            const winSpacing = bw / 5;

            for (let f = 0; f < floors; f++) {
                const fy = by + f * floorHeight + 10;

                // 층 구분선
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath(); ctx.moveTo(bx, fy - 5); ctx.lineTo(bx + bw, fy - 5); ctx.stroke();

                for (let w = 0; w < 4; w++) {
                    const wx = bx + (w + 0.5) * winSpacing - winW / 2;

                    // 베란다 복구 (직각형 돌출)
                    ctx.fillStyle = '#95a5a6';
                    ctx.fillRect(wx - 4, fy + winH - 2, winW + 8, 4);
                    ctx.fillStyle = '#bdc3c7';
                    ctx.fillRect(wx - 4, fy + winH - 5, winW + 8, 3);

                    // 창문 (단순 직각형)
                    // 전기가 들어올 때만 위치 기반으로 창문을 더 넓게 펼쳐서 켬 (밀집도 하향)
                    const lightSeed = Math.sin(f * 2.1 + w * 3.7 + this.x * 0.5 + this.y * 0.5);
                    let isLit = (lightSeed > 0.5); // 임계값을 0.5로 높여 더 듬성듬성하게 배치

                    ctx.fillStyle = isLit ? '#f1c40f' : '#2c3e50';
                    ctx.fillRect(wx, fy, winW, winH);
                }
            }

            // 옥상 설비 (심플하게 난간만 남김)
            ctx.save();
            ctx.translate(bx, by);
            // 옥상 난간
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 3;
            ctx.strokeRect(2, 2, bw - 4, 4);

            ctx.restore();
        };

        // 두 개의 동 배치
        drawBuilding(-70, -80, 60, 160, 10, 8); // A동
        drawBuilding(10, -90, 60, 170, 12, 9);  // B동

        // 3. 1층 입구 조경
        const drawTree = (tx, ty) => {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(tx + 2, ty + 2, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#27ae60';
            ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath(); ctx.arc(tx - 2, ty - 2, 5, 0, Math.PI * 2); ctx.fill();
        };
        drawTree(-50, 80);
        drawTree(-30, 85);
        drawTree(40, 75);
        drawTree(60, 80);

        // 중앙 현관 캐노피
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-20, 60, 40, 15);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-15, 75, 5, 10);
        ctx.fillRect(10, 75, 5, 10);
        ctx.fillStyle = '#f1c40f'; // 현관 조명
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-15, 70, 30, 5);
        ctx.globalAlpha = 1.0;

        ctx.restore();

        // HP 바
        const barW = 120;
        const barY = this.y - 120;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 8);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 8);
    }
}
