import { Entity } from '../BaseEntity.js';
import { CombatEngineer } from '../units/Infantry.js'; // 순환 참조 주의, 필요시 동적 import 또는 구조 변경

export class Base extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'base';
        this.name = '총사령부';
        this.ownerId = 1; // 플레이어 1 소유 명시
        this.maxHp = 99999999;
        this.hp = 99999999;
        this.width = 360;  // 9 tiles * 40
        this.height = 240; // 6 tiles * 40
        this.size = 360;
        this.passable = false; // 통과 불가 명시
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 1000;
        this.popProvide = 40; // 사령부 기본 인구수 제공
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 130; // 9x6 건물 남쪽 출입구
                // CombatEngineer가 아직 로드되지 않았을 수 있음 (순환 참조)
                // engine.entityClasses.CombatEngineer 등을 사용하는 것이 안전함
                const CombatEngineerClass = engine.entityClasses?.CombatEngineer;

                if (CombatEngineerClass) {
                    let unit = new CombatEngineerClass(this.x, spawnY, engine);
                    unit.isInitialExit = true; // 건물 밖으로 나갈 때까지 충돌 무시
                    unit.destination = { x: this.x, y: this.y + 170 };
                    engine.entities.units.push(unit);
                } else {
                    console.error("CombatEngineer definition not found");
                }
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // 2.5D Projection Constants
        const depth = 35;
        const angle = -Math.PI / 4;
        const dx = Math.cos(angle) * depth;
        const dy = Math.sin(angle) * depth;

        // Building Dimensions
        const totalW = 320;
        const baseH = 110;
        const centerH = 150;
        const startX = -totalW / 2 - 15;
        const startY = -40;

        const yBase = startY;
        const yCenter = startY - (centerH - baseH);
        const yBottom = startY + baseH;

        const centerW = 100;
        const wingW = (totalW - centerW) / 2;
        const x1 = startX;
        const x2 = startX + wingW;
        const x3 = startX + wingW + centerW;
        const x4 = startX + totalW;

        const colors = {
            front: '#ecf0f1',
            roof: '#ffffff',
            side: '#bdc3c7',
            sideDark: '#95a5a6'
        };

        // 1. 측면
        ctx.fillStyle = colors.side;
        ctx.beginPath();
        ctx.moveTo(x4, yBase); ctx.lineTo(x4 + dx, yBase + dy);
        ctx.lineTo(x4 + dx, yBottom + dy); ctx.lineTo(x4, yBottom);
        ctx.fill();

        // 2. 지붕
        ctx.fillStyle = colors.roof;
        ctx.beginPath(); // 좌측 윙
        ctx.moveTo(x1, yBase); ctx.lineTo(x1 + dx, yBase + dy);
        ctx.lineTo(x2 + dx, yBase + dy); ctx.lineTo(x2, yBase); ctx.fill();
        ctx.beginPath(); // 중앙 타워
        ctx.moveTo(x2, yCenter); ctx.lineTo(x2 + dx, yCenter + dy);
        ctx.lineTo(x3 + dx, yCenter + dy); ctx.lineTo(x3, yCenter); ctx.fill();
        ctx.beginPath(); // 우측 윙
        ctx.moveTo(x3, yBase); ctx.lineTo(x3 + dx, yBase + dy);
        ctx.lineTo(x4 + dx, yBase + dy); ctx.lineTo(x4, yBase); ctx.fill();

        // 3. 전면
        ctx.fillStyle = colors.front;
        ctx.beginPath();
        ctx.moveTo(x1, yBase); ctx.lineTo(x2, yBase); ctx.lineTo(x2, yCenter);
        ctx.lineTo(x3, yCenter); ctx.lineTo(x3, yBase); ctx.lineTo(x4, yBase);
        ctx.lineTo(x4, yBottom); ctx.lineTo(x1, yBottom); ctx.closePath(); ctx.fill();

        // 4. 창문 디테일 (간소화)
        ctx.fillStyle = '#2c3e50';
        const winW = 12; const winH = 10;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 5; c++) {
                ctx.fillRect(x1 + 20 + c * 20, yBase + 20 + r * 20, winW, winH);
                ctx.fillRect(x3 + 15 + c * 20, yBase + 20 + r * 20, winW, winH);
            }
        }

        ctx.restore();
    }
}
