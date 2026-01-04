import { Entity } from '../BaseEntity.js';

export class Refinery extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'refinery';
        this.size = 80;
        this.width = 80;
        this.height = 80;
        this.maxHp = 1200;
        this.hp = 1200;
        this.maxFuel = 800;
        this.fuel = 800;
        this.productionRate = 5;
        this.color = '#32cd32';
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.fuel > 0) {
            const amount = this.productionRate * deltaTime / 1000;
            const produced = engine.produceResource('oil', amount, this);

            if (produced) {
                this.fuel -= deltaTime / 1000;
                if (this.fuel < 0) this.fuel = 0;
            }
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 기반 및 플랫폼 (Steel Foundation)
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-35, -35, 70, 70);
        ctx.strokeStyle = '#34495e'; ctx.lineWidth = 2;
        ctx.strokeRect(-35, -35, 70, 70);

        // 2. 고층 증류탑 (Distillation Tower) - 좌측 후방
        const drawTower = (tx, ty) => {
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(tx, ty, 15, 50);
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(tx + 2, ty, 3, 50); // 하이라이트
            // 가로 링 (Ring details)
            ctx.strokeStyle = '#2c3e50';
            for (let i = 10; i < 50; i += 10) {
                ctx.beginPath(); ctx.moveTo(tx, ty + i); ctx.lineTo(tx + 15, ty + i); ctx.stroke();
            }
        };
        drawTower(-30, -45);

        // 3. 구형 저장 탱크 (Spherical Tank) - 우측 후방
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath(); ctx.arc(20, -15, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2c3e50'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(15, -20, 5, 0, Math.PI * 2); ctx.fill(); // 반사광

        // 4. 가스 굴뚝 (Gas Flare) - 중앙
        ctx.fillStyle = '#333';
        ctx.fillRect(-5, -30, 8, 40);
        if (this.fuel > 0) {
            // 화염 효과
            const flicker = Math.random() * 5;
            const grad = ctx.createRadialGradient(-1, -35, 2, -1, -40, 15);
            grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, '#f1c40f'); grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(-4, -30); ctx.lineTo(-1, -45 - flicker); ctx.lineTo(2, -30);
            ctx.fill();
        }

        // 5. 정면 복잡한 파이프라인
        ctx.strokeStyle = '#95a5a6'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-30, 5); ctx.lineTo(30, 5);
        ctx.moveTo(-15, 15); ctx.lineTo(15, 15);
        ctx.stroke();

        ctx.restore();

        // HP 바 (위치 조정)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 30, this.y - 55, 60, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 30, this.y - 55, (this.hp / this.maxHp) * 60, 4);
    }
}

export class GoldMine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'gold-mine';
        this.size = 80;
        this.width = 80;
        this.height = 80;
        this.maxHp = 1500;
        this.hp = 1500;
        this.maxFuel = 1000;
        this.fuel = 1000;
        this.productionRate = 8;
        this.color = '#FFD700';
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.fuel > 0) {
            const amount = this.productionRate * deltaTime / 1000;
            const produced = engine.produceResource('gold', amount, this);

            if (produced) {
                this.fuel -= deltaTime / 1000;
                if (this.fuel < 0) this.fuel = 0;
            }
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 기반 시설 (Concrete Pad)
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-38, -38, 76, 76);
        ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2;
        ctx.strokeRect(-38, -38, 76, 76);

        // 2. 메인 기계동 (Engine Room) - 중앙 후방
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-20, -35, 40, 30);
        // 유리창 (Control Room)
        ctx.fillStyle = '#3498db';
        ctx.fillRect(-15, -30, 10, 5);
        ctx.fillRect(5, -30, 10, 5);

        // 3. 대형 회전 굴착 드릴 (Excavation Drill) - 전방
        const drillAngle = (this.fuel > 0) ? (Date.now() / 100) : 0;
        ctx.save();
        ctx.translate(0, 15);
        // 지지 구조물
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-5, -15, 10, 15);
        // 드릴 헤드 (회전)
        ctx.rotate(drillAngle);
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            ctx.rotate(Math.PI * 2 / 3);
            ctx.moveTo(0, 0); ctx.lineTo(-8, 15); ctx.lineTo(8, 15);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // 4. 금색 입자 및 광석 컨베이어 (Conveyor details)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-30, 5, 60, 8);
        if (this.fuel > 0) {
            const shift = (Date.now() / 50) % 15;
            ctx.fillStyle = '#FFD700';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath(); ctx.arc(-25 + i * 15 + shift, 9, 2, 0, Math.PI * 2); ctx.fill();
            }
        }

        ctx.restore();

        // HP 바
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 30, this.y - 55, 60, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 30, this.y - 55, (this.hp / this.maxHp) * 60, 4);
    }
}

export class IronMine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'iron-mine';
        this.name = '제철소';
        this.size = 80;
        this.width = 80;
        this.height = 80;
        this.maxHp = 1800;
        this.hp = 1800;
        this.maxFuel = 1200;
        this.fuel = 1200;
        this.productionRate = 10;
        this.color = '#a5a5a5';
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.fuel > 0) {
            const amount = this.productionRate * deltaTime / 1000;
            const produced = engine.produceResource('iron', amount, this);

            if (produced) {
                this.fuel -= deltaTime / 1000;
                if (this.fuel < 0) this.fuel = 0;
            }
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 기반 플랫폼 (Heavy Reinforced Base)
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-38, -38, 76, 76);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 3;
        ctx.strokeRect(-38, -38, 76, 76);

        // 2. 메인 용광로 (Blast Furnace) - 중앙
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.moveTo(-20, 30); ctx.lineTo(-15, -20);
        ctx.lineTo(15, -20); ctx.lineTo(20, 30);
        ctx.closePath(); ctx.fill();

        // 용광로 열기 (Heat Glow)
        if (this.fuel > 0) {
            const flicker = Math.random() * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 69, 0, ${flicker * 0.6})`;
            ctx.fillRect(-10, 10, 20, 15);
            // 흐르는 쇳물 효과
            ctx.fillStyle = `rgba(255, 165, 0, ${flicker})`;
            ctx.fillRect(-2, 15, 4, 15);
        }

        // 3. 배기 굴뚝 (Exhaust Pipes) - 후방 좌우
        const drawExhaust = (ex, ey) => {
            ctx.fillStyle = '#333';
            ctx.fillRect(ex, ey, 8, 25);
            if (this.fuel > 0) {
                // 연기 (Smoke)
                const time = Date.now() / 800;
                ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
                ctx.beginPath(); ctx.arc(ex + 4 + Math.sin(time) * 5, ey - 10, 8, 0, Math.PI * 2); ctx.fill();
            }
        };
        drawExhaust(-30, -35);
        drawExhaust(22, -35);

        // 4. 상단 연결 통로
        ctx.fillStyle = '#444';
        ctx.fillRect(-30, -25, 60, 5);

        ctx.restore();

        // HP 바
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 30, this.y - 55, 60, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 30, this.y - 55, (this.hp / this.maxHp) * 60, 4);
    }
}

export class Storage extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'storage';
        this.name = '보급고';
        this.width = 160;  // 4 tiles * 40px
        this.height = 120; // 3 tiles * 40px
        this.size = 160;   // Use max dimension for radius-based checks
        this.maxHp = 2000; // 크기 증가에 따른 체력 상향
        this.hp = 2000;
        this.storedResources = { gold: 0, oil: 0 };
        this.maxCapacity = 2000; // 용량 2배 증가
        this.isConnectedToBase = false;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;

        if (this.isConnectedToBase) {
            const transferRate = 50;
            const amount = transferRate * deltaTime / 1000;
            if (this.storedResources.gold > 0) {
                const transferGold = Math.min(this.storedResources.gold, amount);
                engine.resources.gold += transferGold;
                this.storedResources.gold -= transferGold;
            }
            if (this.storedResources.oil > 0) {
                const transferOil = Math.min(this.storedResources.oil, amount);
                engine.resources.oil += transferOil;
                this.storedResources.oil -= transferOil;
            }
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
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-80, -60, 160, 120);
        ctx.strokeStyle = '#3a4118'; // 경계선
        ctx.lineWidth = 2;
        ctx.strokeRect(-80, -60, 160, 120);

        // 구역 표시선 (노란색 안전 라인)
        ctx.strokeStyle = 'rgba(241, 196, 15, 0.5)';
        ctx.setLineDash([10, 10]);
        ctx.strokeRect(-70, -50, 140, 100);
        ctx.setLineDash([]);

        // 2. 대형 물류 행거 (Main Hangar - 좌측)
        const drawHangar = (hx, hy) => {
            ctx.save();
            ctx.translate(hx, hy);

            // 건물 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(5, 5, 70, 90);

            // 벽면 (2.5D)
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, 70, 90); // 바닥면적
            ctx.fillStyle = '#34495e'; // 앞벽
            ctx.fillRect(0, 80, 70, 15);

            // 지붕 (둥근 퀀셋 스타일)
            const grd = ctx.createLinearGradient(0, 0, 70, 0);
            grd.addColorStop(0, '#34495e');
            grd.addColorStop(0.5, '#7f8c8d'); // 하이라이트
            grd.addColorStop(1, '#2c3e50');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, 70, 80);

            // 지붕 골조 라인
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1;
            for (let i = 10; i < 80; i += 10) {
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(70, i); ctx.stroke();
            }

            // 대형 슬라이딩 도어
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(10, 82, 50, 10);
            ctx.strokeStyle = '#f1c40f'; // 안전선
            ctx.beginPath();
            ctx.moveTo(10, 92); ctx.lineTo(60, 92);
            ctx.stroke();

            // 환기구 팬 (지붕 위)
            ctx.fillStyle = '#2d3436';
            ctx.beginPath(); ctx.arc(35, 20, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(35, 60, 5, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        };
        drawHangar(-70, -50);

        // 3. 야외 야적장 (Outdoor Storage - 우측 상단)
        const drawContainer = (cx, cy, color) => {
            ctx.save();
            ctx.translate(cx, cy);
            // 컨테이너 본체
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 25, 10);
            // 음영 및 디테일
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0, 0, 25, 2); // 윗면
            ctx.fillRect(23, 0, 2, 10); // 측면
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.strokeRect(0, 0, 25, 10);
            // 문
            ctx.fillStyle = '#333';
            ctx.fillRect(12, 2, 1, 6);
            ctx.restore();
        };

        // 컨테이너 적재 (랜덤한 느낌으로 배치)
        drawContainer(10, -40, '#2980b9'); // 파란색
        drawContainer(40, -40, '#c0392b'); // 빨간색
        drawContainer(10, -25, '#27ae60'); // 초록색
        drawContainer(15, -50, '#e67e22'); // 주황색 (위에 쌓임)

        // 4. 자원 저장 탱크 (Fuel/Resource Tanks - 우측 하단)
        const drawTank = (tx, ty) => {
            ctx.save();
            ctx.translate(tx, ty);
            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(5, 5, 12, 0, Math.PI * 2); ctx.fill();
            // 탱크 본체 (원통형 입체)
            const tGrad = ctx.createLinearGradient(-10, 0, 10, 0);
            tGrad.addColorStop(0, '#7f8c8d');
            tGrad.addColorStop(0.5, '#ecf0f1');
            tGrad.addColorStop(1, '#95a5a6');
            ctx.fillStyle = tGrad;
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
            // 파이프 연결부
            ctx.fillStyle = '#34495e';
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        };
        drawTank(20, 20);
        drawTank(50, 20);
        drawTank(20, 45);
        drawTank(50, 45);

        // 5. 자원 게이지 UI (현대적인 디지털 패널 스타일)
        const totalStored = this.storedResources.gold + this.storedResources.oil;
        if (totalStored > 0) {
            ctx.save();
            ctx.translate(5, -10); // 중앙 부근

            // 패널 배경
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(-30, 0, 60, 6);

            const goldW = (this.storedResources.gold / this.maxCapacity) * 60;
            const oilW = (this.storedResources.oil / this.maxCapacity) * 60;

            // 자원 바
            ctx.fillStyle = '#f1c40f'; // Gold
            ctx.fillRect(-30, 1, goldW, 4);
            ctx.fillStyle = '#8e44ad'; // Oil
            ctx.fillRect(-30 + goldW, 1, oilW, 4);

            ctx.restore();
        }

        // 상태 표시등 (연결됨)
        if (this.isConnectedToBase) {
            ctx.fillStyle = '#00d2ff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00d2ff';
            ctx.beginPath(); ctx.arc(-60, -50, 3, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 40, this.y - 70, 80, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 40, this.y - 70, (this.hp / this.maxHp) * 80, 5);
    }
}
