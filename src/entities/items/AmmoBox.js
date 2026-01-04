import { PlayerUnit } from '../units/BaseUnit.js';

export class AmmoBox extends PlayerUnit {
    constructor(x, y, engine, ammoType = 'bullet') {
        super(x, y, engine);
        this.type = `ammo-${ammoType}`;
        this.ammoType = ammoType;
        this.name = ammoType === 'bullet' ? '총알 상자' : (ammoType === 'shell' ? '포탄 상자' : '미사일 상자');
        this.speed = 0.6;
        this.hp = 150;
        this.maxHp = 150;
        this.size = 30;
        this.attackRange = 150; // 사거리 150으로 축소
        this.popCost = 1;
        this.damage = 0; // 공격 능력 없음

        // 탄약 총계 수치 추가
        const amountMap = { bullet: 200, shell: 6, missile: 2 };
        this.maxAmount = amountMap[ammoType] || 0;
        this.amount = this.maxAmount;
        this.chargingUnits = []; // 현재 충전 중인 유닛 목록 (시각 효과용)
    }

    attack() { /* 탄약 상자는 공격하지 않음 */ }

    update(deltaTime) {
        super.update(deltaTime);
        if (!this.active || this.hp <= 0) return;

        this.chargingUnits = [];
        if (this.amount <= 0.0001) {
            this.amount = 0;
            this.hp = 0; // 소진 시 파괴 처리 (제거 트리거)
            this.active = false;
            return;
        }

        // 초당 충전 속도 설정
        const refillRates = { bullet: 50, shell: 1.5, missile: 0.5 };
        const rate = refillRates[this.ammoType] || 0;
        const frameRefill = rate * deltaTime / 1000;

        // 사거리 내 탄약 보충이 필요한 아군 유닛 검색
        const units = this.engine.entities.units;
        for (const unit of units) {
            // 조건: 살아있음, 아군, 탄종 일치, 탄약 부족
            if (unit === this || unit.ownerId !== 1 || !unit.active || unit.hp <= 0) continue;
            if (unit.ammoType !== this.ammoType || unit.ammo >= unit.maxAmmo) continue;

            const dist = Math.hypot(this.x - unit.x, this.y - unit.y);
            if (dist <= this.attackRange && this.amount > 0) {
                // 충전량 계산 (상자 잔량, 유닛 필요량, 프레임당 속도 중 최소값)
                let toRefill = Math.min(frameRefill, unit.maxAmmo - unit.ammo, this.amount);

                // 실제로 충전할 양이 있는 경우에만 유닛 등록 및 차감
                if (toRefill > 0.0001) {
                    this.chargingUnits.push(unit);
                    unit.ammo += toRefill;
                    this.amount -= toRefill;
                }

                if (this.amount <= 0.0001) {
                    this.amount = 0;
                    break;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 1. 바퀴 (4개)
        ctx.fillStyle = '#111';
        ctx.fillRect(-12, -14, 6, 4); // 전좌
        ctx.fillRect(6, -14, 6, 4);  // 전우
        ctx.fillRect(-12, 10, 6, 4); // 후좌
        ctx.fillRect(6, 10, 6, 4);  // 후우

        // 2. 나무 상자 (2.5D 느낌)
        const woodColor = this.ammoType === 'bullet' ? '#8d6e63' : (this.ammoType === 'shell' ? '#795548' : '#5d4037');
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-13, -11, 28, 22);
        ctx.fillStyle = woodColor;
        ctx.fillRect(-15, -12, 30, 24);

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-15, -4); ctx.lineTo(15, -4);
        ctx.moveTo(-15, 4); ctx.lineTo(15, 4);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 10px Arial';
        if (this.ammoType === 'bullet') {
            ctx.fillStyle = '#333'; ctx.fillText('BUL', 0, 4);
        } else if (this.ammoType === 'shell') {
            ctx.fillStyle = '#f1c40f'; ctx.fillText('SHL', 0, 4);
        } else if (this.ammoType === 'missile') {
            ctx.fillStyle = '#e74c3c'; ctx.fillText('MSL', 0, 4);
        }

        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -12, 30, 24);

        ctx.restore();

        // 3. 충전 빔 효과 (Shield Battery Style)
        if (this.chargingUnits.length > 0) {
            ctx.save();
            this.chargingUnits.forEach(unit => {
                const grad = ctx.createLinearGradient(this.x, this.y, unit.x, unit.y);
                const beamColor = this.ammoType === 'bullet' ? '#f1c40f' : (this.ammoType === 'shell' ? '#e67e22' : '#ff3131');
                grad.addColorStop(0, beamColor);
                grad.addColorStop(1, 'white');

                ctx.shadowBlur = 10;
                ctx.shadowColor = beamColor;
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2 + Math.sin(Date.now() / 50) * 1;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(unit.x, unit.y);
                ctx.stroke();

                // 대상 유닛 주변 입자 효과
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(unit.x + (Math.random() - 0.5) * 20, unit.y + (Math.random() - 0.5) * 20, 2, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        }

        // 체력 및 탄약 바
        const barW = 30;
        const barY = this.y - 25;
        // HP Bar
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 3);

        // Amount Bar (상자 잔량)
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY + 4, barW, 3);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(this.x - barW / 2, barY + 4, (this.amount / this.maxAmount) * barW, 3);
    }
}
