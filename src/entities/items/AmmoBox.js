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
        // RenderSystem이 이미 (this.x, this.y)로 translate하고 rotate(this.angle)한 상태임

        // --- 1. 충전 중일 때 상자 주변 글로우 효과 ---
        if (this.chargingUnits.length > 0) {
            ctx.save();
            // 상자의 회전과 상관없이 항상 정방향으로 글로우를 그리기 위해 역회전
            if (this.angle) ctx.rotate(-this.angle);
            
            const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
            const glowColor = this.ammoType === 'bullet' ? 'rgba(241, 196, 15, 0.3)' : (this.ammoType === 'shell' ? 'rgba(230, 126, 34, 0.3)' : 'rgba(231, 76, 60, 0.3)');
            
            ctx.shadowBlur = 15 + pulse * 10;
            ctx.shadowColor = glowColor;
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 2. 상자 본체 (회전된 상태로 그림)
        ctx.save();
        // 2.1 바퀴 (4개)
        ctx.fillStyle = '#111';
        ctx.fillRect(-12, -14, 6, 4); // 전좌
        ctx.fillRect(6, -14, 6, 4);  // 전우
        ctx.fillRect(-12, 10, 6, 4); // 후좌
        ctx.fillRect(6, 10, 6, 4);  // 후우

        // 2.2 나무 상자
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

        // 3. 강화된 충전 빔 효과 (역회전하여 월드 좌표계 정렬 후 계산)
        if (this.chargingUnits.length > 0) {
            ctx.save();
            if (this.angle) ctx.rotate(-this.angle); // 상자의 회전 무시

            this.chargingUnits.forEach(unit => {
                const beamColor = this.ammoType === 'bullet' ? '#f1c40f' : (this.ammoType === 'shell' ? '#e67e22' : '#ff3131');
                
                // 유닛의 상대 위치 계산
                const relX = unit.x - this.x;
                const relY = unit.y - this.y;

                // 메인 코어 빔
                ctx.shadowBlur = 15;
                ctx.shadowColor = beamColor;
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1 + Math.random() * 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(relX, relY);
                ctx.stroke();

                // 외곽 에너지 흐름 (애니메이션)
                ctx.strokeStyle = beamColor;
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.4;
                ctx.setLineDash([10, 5]);
                ctx.lineDashOffset = -Date.now() / 20; 
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(relX, relY);
                ctx.stroke();
                ctx.setLineDash([]);

                // 전송 중인 에너지 입자들
                for(let i=0; i<2; i++) {
                    const progress = (Math.random() + (Date.now() / 1000)) % 1.0;
                    const px = relX * progress;
                    const py = relY * progress;
                    const jitter = Math.sin(Date.now() / 50 + progress * 10) * 5;
                    
                    ctx.fillStyle = 'white';
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(px + jitter, py + jitter, 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 대상 유닛 주변 충전 불꽃
                ctx.fillStyle = beamColor;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(relX + (Math.random() - 0.5) * 30, relY + (Math.random() - 0.5) * 30, 3, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        }

        // 4. 탄약 바 (상자 잔량)
        ctx.save();
        if (this.angle) ctx.rotate(-this.angle); // 바데는 회전시키지 않음
        
        const barW = 30;
        const barY = -25;

        // 배경
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-barW / 2, barY, barW, 4);
        
        const amountRatio = this.amount / this.maxAmount;
        ctx.fillStyle = amountRatio > 0.5 ? '#2ecc71' : (amountRatio > 0.2 ? '#f1c40f' : '#e74c3c');
        ctx.fillRect(-barW / 2, barY, barW * amountRatio, 4);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, barY, barW, 4);
        ctx.restore();
    }
}
