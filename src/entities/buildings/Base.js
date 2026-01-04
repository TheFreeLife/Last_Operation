import { Entity } from '../BaseEntity.js';

/**
 * Base - 총사령부
 * 기존 Entities.js에서 Base 클래스만 추출
 */
export class Base extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'base';
        this.name = '총사령부';
        this.ownerId = 1;
        this.maxHp = 99999999;
        this.hp = 99999999;
        this.width = 360;  // 9 tiles * 40
        this.height = 240; // 6 tiles * 40
        this.size = 360;
        this.passable = false;
        this.spawnQueue = [];
        this.spawnTime = 1000;
        this.popProvide = 40;
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
                // CombatEngineer는 원본 Entities.js에서 import 필요
                // 임시로 기본 유닛 생성 (추후 수정)
                const spawnY = this.y + 130;
                // Note: 실제 유닛 생성 로직은 GameEngine에서 처리하도록 수정 필요
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        // 기존 Entities.js의 복잡한 Base draw 로직을 그대로 가져와야 함
        // 임시로 간단한 박스만 렌더링
        ctx.save();
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

        // 체력 바
        if (this.hp < this.maxHp) {
            const barW = this.width * 0.8;
            const barH = 8;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.x - barW / 2, this.y - this.height / 2 - 15, barW, barH);
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(this.x - barW / 2, this.y - this.height / 2 - 15, barW * (this.hp / this.maxHp), barH);
        }

        // 텍스트
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y);

        ctx.restore();

        // 건설 중이면 진행 바 표시
        this.drawConstruction(ctx);
    }
}

// TODO: 기존 Entities.js의 완전한 Base.draw() 구현을 여기로 마이그레이션
