import { Entity } from '../BaseEntity.js';
import { Rifleman, Sniper } from '../units/Infantry.js';
import { Tank, MissileLauncher, Artillery, AntiAirVehicle } from '../units/Vehicles.js';
import { MilitaryTruck } from '../units/Logistics.js';
import { ScoutPlane, Bomber, CargoPlane } from '../units/AirUnits.js';
import { AmmoBox } from '../items/AmmoBox.js';

export class Barracks extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'barracks';
        this.name = '병영';
        this.width = 120; // 3 tiles
        this.height = 120; // 3 tiles
        this.size = 120;
        this.maxHp = 1500;
        this.hp = 1500;
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 1000;
        this.units = [];
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        this.units = this.units.filter(u => u.alive);

        if (this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 65;
                let unit;
                if (current.type === 'sniper') {
                    unit = new Sniper(this.x, spawnY, engine);
                } else {
                    unit = new Rifleman(this.x, spawnY, engine);
                }

                unit.isInitialExit = true;
                unit.destination = { x: this.x, y: this.y + 100 };
                this.units.push(unit);
                engine.entities.units.push(unit);
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // 1. 부지 기반
        ctx.fillStyle = '#3b4d3c';
        ctx.fillRect(-60, -60, 120, 120);

        // 2. 군 막사 건물 2동
        const draw3DHut = (hx, hy) => {
            ctx.save();
            ctx.translate(hx, hy);
            ctx.fillStyle = '#4b5320';
            ctx.fillRect(-45, -15, 90, 30);
            ctx.fillStyle = '#556644';
            ctx.beginPath();
            ctx.moveTo(-45, 15); ctx.lineTo(0, 25); ctx.lineTo(45, 15); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
            ctx.restore();
        };

        draw3DHut(0, -30);
        draw3DHut(0, 30);

        ctx.restore();
    }

    drawUI(ctx) {
        const barW = 80;
        const barY = this.y - 85;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 6);

        if (this.spawnQueue.length > 0) {
            const qBarY = barY - 14;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 40, qBarY, 80, 8);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 40, qBarY, 80 * progress, 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`훈련 중 (${this.spawnQueue.length})`, this.x, qBarY - 5);
        }
    }
}

export class Armory extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'armory';
        this.name = '병기창';
        this.width = 160; // 4 tiles
        this.height = 120; // 3 tiles
        this.size = 160;
        this.maxHp = 2500;
        this.hp = 2500;
        this.spawnQueue = [];
        this.spawnTime = 1000;
        this.units = [];
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        this.units = this.units.filter(u => u.alive);

        if (this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 65;
                let unit;
                if (current.type === 'tank') unit = new Tank(this.x, spawnY, engine);
                else if (current.type === 'missile-launcher') unit = new MissileLauncher(this.x, spawnY, engine);
                else if (current.type === 'artillery') unit = new Artillery(this.x, spawnY, engine);
                else if (current.type === 'anti-air') unit = new AntiAirVehicle(this.x, spawnY, engine);
                else if (current.type === 'military-truck') unit = new MilitaryTruck(this.x, spawnY, engine);

                if (unit) {
                    unit.isInitialExit = true;
                    unit.destination = { x: this.x, y: this.y + 100 };
                    this.units.push(unit);
                    engine.entities.units.push(unit);
                }
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();

        const bw = 130;
        const bh = 60;
        const wallH = 40;
        const bx = -bw / 2;
        const by = -bh / 2 - 5;

        // 1. 외벽
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(bx, by, bw, bh + wallH);

        // 2. 지붕
        ctx.fillStyle = '#556644';
        ctx.fillRect(bx, by - 10, bw, 10);

        // 3. 셔터
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-40, by + bh + wallH - 45, 80, 45);

        ctx.restore();
    }

    drawUI(ctx) {
        const barW = 120;
        const barY = this.y - 100;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 6);

        if (this.spawnQueue.length > 0) {
            const qBarY = barY - 14;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 60, qBarY, 120, 10);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 60, qBarY, 120 * progress, 10);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`무기 생산 중 (${this.spawnQueue.length})`, this.x, qBarY - 5);
        }
    }
}

export class Airport extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'airport';
        this.name = '대형 군용 비행장';
        this.width = 200;  // 5 tiles
        this.height = 280; // 7 tiles
        this.size = 280;
        this.maxHp = 2500; // 크기에 맞춰 체력 상향
        this.hp = 2500;
        this.spawnQueue = [];
        this.spawnTime = 1000;
        this.units = [];
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        this.units = this.units.filter(u => u.alive);

        if (this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                // 활주로 중앙 부근에서 생성 (오른쪽으로 이동됨)
                let unit;
                if (current.type === 'bomber') {
                    unit = new Bomber(this.x + 55, this.y - 80, engine);
                } else if (current.type === 'cargo-plane') {
                    unit = new CargoPlane(this.x + 55, this.y - 80, engine);
                } else {
                    unit = new ScoutPlane(this.x + 55, this.y - 80, engine);
                }

                unit.isInitialExit = true; // 출격 모드 설정 (활주로 이탈 전까지 충돌 무시)
                unit.destination = { x: this.x + 55, y: this.y + 140 };
                this.units.push(unit);
                engine.entities.units.push(unit);

                // 수송기의 경우 전용 리스트에도 추가 (렌더링 레이어 대응)
                if (current.type === 'cargo-plane' && engine.entities.cargoPlanes) {
                    engine.entities.cargoPlanes.push(unit);
                }

                this.spawnQueue.shift();

                // 유닛 생산 후 인구수 갱신
                if (engine.updatePopulation) engine.updatePopulation();
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // 1. 베이스 플랫폼
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-100, -140, 200, 280);

        // 2. 메인 활주로
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(20, -135, 70, 270);

        // 3. 격납고 2동
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-90, 30, 70, 45);
        ctx.fillRect(-90, 90, 70, 45);

        // 4. 관제탑
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-85, -110, 30, 40);

        ctx.restore();
    }
}

export class AmmoFactory extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'ammo-factory';
        this.name = '탄약 공장';
        this.width = 160;  // 4 tiles
        this.height = 120; // 3 tiles
        this.size = 160;
        this.maxHp = 2500;
        this.hp = 2500;
        this.spawnQueue = [];
        this.spawnTime = 1000;
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
                const spawnY = this.y + 65;
                let unit = new AmmoBox(this.x, spawnY, engine, current.type);
                unit.isInitialExit = true;
                unit.destination = { x: this.x, y: this.y + 100 };
                engine.entities.units.push(unit);
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // 1. 기반
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-80, -60, 160, 120);

        // 2. 메인 공장동
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-10, -40, 80, 80);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-70, -20, 50, 60);

        // 3. 하역장 셔터
        ctx.fillStyle = '#111';
        ctx.fillRect(-65, 15, 20, 15);
        ctx.fillRect(-40, 15, 20, 15);

        ctx.restore();
    }

    drawUI(ctx) {
        const barW = 120;
        const barY = this.y - 100;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 6);

        if (this.spawnQueue.length > 0) {
            const qBarY = barY - 14;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 60, qBarY, 120, 10);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(this.x - 60, qBarY, 120 * progress, 10);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`탄약 제조 중 (${this.spawnQueue.length})`, this.x, qBarY - 5);
        }
    }
}
