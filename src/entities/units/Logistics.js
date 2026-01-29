import { PlayerUnit } from './BaseUnit.js';

export class MilitaryTruck extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'military-truck';
        this.name = '군용 트럭';
        this.speed = 2.0;
        this.hp = 600;
        this.maxHp = 600;
        this.size = 80;
        this.cargoSize = 15; // 다른 수송기에 탈 수는 있지만 큰 부피 차지

        this.cargo = [];
        this.cargoCapacity = 5; // 수송량 5
        this.isUnloading = false;
        this.unloadTimer = 0;
        this.unloadInterval = 400;
    }

    getOccupiedSize() {
        return this.cargo.reduce((sum, unit) => sum + (unit.cargoSize || 1), 0);
    }

    getSkillConfig(cmd) {
        if (cmd === 'unload_all') return { type: 'instant', handler: this.startUnloading };
        return null;
    }

    loadUnit(unit) {
        const uSize = unit.cargoSize || 1;
        if (this.isUnloading || (this.getOccupiedSize() + uSize) > this.cargoCapacity) return false;

        unit.isBoarded = true;
        unit.command = 'stop';
        unit.destination = null;
        unit.path = [];
        this.cargo.push(unit);

        if (this.engine.selectedEntities) {
            this.engine.selectedEntities = this.engine.selectedEntities.filter(e => e !== unit);
        }
        this.engine.addEffect?.('system', this.x, this.y - 20, '#ffff00', '유닛 탑승');

        if (this.engine.updateBuildMenu) this.engine.updateBuildMenu();
        return true;
    }

    startUnloading() {
        if (this.cargo.length === 0) return;
        this.isUnloading = true;
        this.unloadTimer = 0;
    }

    update(deltaTime) {
        if (this.isUnloading) {
            this.unloadTimer += deltaTime;
            if (this.unloadTimer >= this.unloadInterval) {
                this.unloadTimer = 0;
                const unit = this.cargo.shift();

                const rearDist = 45;
                unit.x = this.x + Math.cos(this.angle + Math.PI) * rearDist;
                unit.y = this.y + Math.sin(this.angle + Math.PI) * rearDist;
                unit.isBoarded = false;
                unit.active = true;
                unit.angle = this.angle + Math.PI;
                unit.destination = {
                    x: unit.x + Math.cos(this.angle + Math.PI) * 50,
                    y: unit.y + Math.sin(this.angle + Math.PI) * 50
                };

                if (this.cargo.length === 0) this.isUnloading = false;
            }
        }
        super.update(deltaTime);
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();

        // 1. 바퀴 (6개 - 대형 트럭)
        ctx.fillStyle = '#111';
        const wheelPositions = [
            { x: 20, y: -22 }, { x: 20, y: 18 },   // 전륜
            { x: -10, y: -22 }, { x: -10, y: 18 }, // 중륜
            { x: -25, y: -22 }, { x: -25, y: 18 }  // 후륜
        ];
        wheelPositions.forEach(p => ctx.fillRect(p.x, p.y, 12, 6));

        // 2. 섀시 및 몸체 (Chassis)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-35, -18, 70, 36);

        // 3. 운전석 (Cab - 2.5D)
        ctx.fillStyle = '#3a4118'; // 국방색
        ctx.fillRect(15, -18, 25, 36);
        // 유리창
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(32, -15, 6, 30);
        // 헤드라이트
        ctx.fillStyle = '#fff';
        ctx.fillRect(38, -16, 2, 6);
        ctx.fillRect(38, 10, 2, 6);

        // 4. 적재함 (Cargo Bed - 캔버스 덮개 느낌)
        const cargoGrd = ctx.createLinearGradient(-35, 0, 15, 0);
        cargoGrd.addColorStop(0, '#4b5320');
        cargoGrd.addColorStop(1, '#556644');
        ctx.fillStyle = cargoGrd;
        ctx.beginPath();
        ctx.roundRect(-35, -20, 50, 40, 5);
        ctx.fill();

        // 덮개 주름 디테일
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let i = -30; i < 10; i += 10) {
            ctx.beginPath(); ctx.moveTo(i, -20); ctx.lineTo(i, 20); ctx.stroke();
        }

        // 5. 후방 적재함 문
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-37, -15, 4, 30);

        ctx.restore();

        // [수정] 수송기 스타일의 상세 적재 정보 UI
        if (this.cargo.length > 0) {
            const occupiedSize = this.getOccupiedSize();
            const barWidth = 50;
            const barHeight = 6;
            const bx = this.x - barWidth / 2;
            const by = this.y + 30;

            // 배경
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(bx, by, barWidth, barHeight);

            // 적재 게이지 (부피 기준)
            const fillWidth = (occupiedSize / this.cargoCapacity) * barWidth;
            ctx.fillStyle = '#00d2ff';
            ctx.fillRect(bx, by, fillWidth, barHeight);

            // 테두리
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barWidth, barHeight);

            // 텍스트 정보 (부피 기준)
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${occupiedSize} / ${this.cargoCapacity}`, this.x, by + 16);

            // [추가] 적재 유닛 타입별 점(Dot) 표시
            this.cargo.forEach((u, idx) => {
                const dotX = bx + 5 + idx * 8;
                const dotY = by + 10;
                let dotColor = '#fff';
                if (u.type === 'tank') dotColor = '#39ff14';
                else if (u.type === 'rifleman') dotColor = '#556644';
                else if (u.type === 'missile-launcher') dotColor = '#ff3131';

                ctx.fillStyle = dotColor;
                ctx.beginPath(); ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2); ctx.fill();
            });
        }
    }
}
