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
        ctx.save();

        // 1. 기반 및 플랫폼
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-35, -35, 70, 70);

        // 2. 고층 증류탑
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-30, -45, 15, 50);

        // 3. 구형 저장 탱크
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath(); ctx.arc(20, -15, 18, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
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
        ctx.save();

        // 1. 기반 시설
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-38, -38, 76, 76);

        // 2. 메인 기계동
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-20, -35, 40, 30);

        // 3. 굴착 드릴
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-5, 0, 10, 15);

        ctx.restore();
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
        ctx.save();

        // 1. 기반 플랫폼
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-38, -38, 76, 76);

        // 2. 메인 용광로
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.moveTo(-20, 30); ctx.lineTo(-15, -20);
        ctx.lineTo(15, -20); ctx.lineTo(20, 30);
        ctx.closePath(); ctx.fill();

        ctx.restore();
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
        ctx.save();

        // 1. 기반
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-80, -60, 160, 120);

        // 2. 대형 물류 행거
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-70, -50, 70, 90);

        // 3. 컨테이너들
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(10, -40, 25, 10);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(40, -40, 25, 10);

        ctx.restore();
    }
}
