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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 부지 기반
        ctx.fillStyle = '#3b4d3c';
        ctx.fillRect(-60, -60, 120, 120);
        ctx.strokeStyle = '#2d3e2d';
        ctx.strokeRect(-60, -60, 120, 120);

        // 2. 군 막사 건물 2동 (2.5D 입체화)
        const draw3DHut = (hx, hy) => {
            const depth = 12;
            ctx.save();
            ctx.translate(hx, hy);

            // 건물 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(-48, -10, 96, 35);

            // 2.5D 벽면 (어두운 부분)
            ctx.fillStyle = '#2d3310';
            ctx.fillRect(-45, 15, 90, depth); // 정면 벽
            // 우측 벽
            ctx.beginPath();
            ctx.moveTo(45, -15); ctx.lineTo(45, 15);
            ctx.lineTo(45 + 3, 15 + depth); ctx.lineTo(45 + 3, -15 + depth);
            ctx.closePath(); ctx.fill();

            // 건물 본체 (윗면/옆면)
            ctx.fillStyle = '#4b5320';
            ctx.fillRect(-45, -15, 90, 30);

            // 박공 지붕 (Gabled Roof - 입체감 추가)
            // 지붕의 어두운 쪽 (서쪽/북쪽)
            ctx.fillStyle = '#3a4118';
            ctx.beginPath();
            ctx.moveTo(-45, -15); ctx.lineTo(0, -25); ctx.lineTo(45, -15);
            ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
            // 지붕의 밝은 쪽 (동쪽/남쪽)
            ctx.fillStyle = '#556644';
            ctx.beginPath();
            ctx.moveTo(-45, 15); ctx.lineTo(0, 25); ctx.lineTo(45, 15);
            ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();

            // 창문 (입체감 있는 배치)
            ctx.fillStyle = '#3498db';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(-30 + i * 25, 5, 10, 6);
            }

            ctx.restore();
        };

        draw3DHut(0, -30); // 북쪽 막사
        draw3DHut(0, 30);  // 남쪽 막사

        // 3. 중앙 요소 (게양대 등)
        // 국기 게양대 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-43, 2, 15, 4);

        // 게양대 (입체)
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(-46, -25, 3, 25);
        // 깃발
        const flagWave = Math.sin(Date.now() / 300) * 3;
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(-43, -25);
        ctx.lineTo(-25 + flagWave, -25);
        ctx.lineTo(-30 + flagWave, -18);
        ctx.lineTo(-43, -18);
        ctx.closePath(); ctx.fill();

        // 4. 모래주머니 (입체)
        const draw3DSandbags = (sx, sy) => {
            ctx.save();
            ctx.translate(sx, sy);
            for (let i = 0; i < 2; i++) {
                // 하단층
                ctx.fillStyle = '#a6936a'; // 어두운 면
                ctx.beginPath(); ctx.ellipse(-5 + i * 12, 4, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#c2b280'; // 윗면
                ctx.beginPath(); ctx.ellipse(-5 + i * 12, 0, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#8e7a55'; ctx.lineWidth = 0.5; ctx.stroke();
            }
            ctx.restore();
        };
        draw3DSandbags(35, -5);
        draw3DSandbags(35, 10);

        ctx.restore();

        // HP 바 & 생산 UI (기존 로직 유지)
        this.drawUI(ctx);
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 2.5D Projection
        const depth = 15;
        const angle = -Math.PI / 4;
        const dx = Math.cos(angle) * depth;
        const dy = Math.sin(angle) * depth;

        // Hitbox: [-80, 80] x [-60, 60]
        const bw = 130;
        const bh = 60;
        const wallH = 40;
        const bx = -bw / 2;
        const by = -bh / 2 - 5;

        // 1. 기초 바닥 (Tactical Concrete Foundation)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(bx - 10, by + bh + wallH + 5);
        ctx.lineTo(bx + bw + 10, by + bh + wallH + 5);
        ctx.lineTo(bx + bw + 10 + dx, by + bh + wallH + 5 + dy);
        ctx.lineTo(bx - 10 + dx, by + bh + wallH + 5 + dy);
        ctx.closePath(); ctx.fill();

        // 2. 외벽 및 장갑판 (Reinforced Tactical Walls)
        // 측면
        ctx.fillStyle = '#3d441e'; // 올리브 드랍 (측면 어둡게)
        ctx.beginPath();
        ctx.moveTo(bx + bw, by); ctx.lineTo(bx + bw + dx, by + dy);
        ctx.lineTo(bx + bw + dx, by + bh + wallH + dy); ctx.lineTo(bx + bw, by + bh + wallH);
        ctx.closePath(); ctx.fill();

        // 전면 벽 (국방색)
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(bx, by, bw, bh + wallH);

        // 장갑판 리벳 디테일
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
        for (let i = 0; i < bw; i += 30) {
            ctx.strokeRect(bx + i, by, 30, bh + wallH);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(bx + i + 2, by + 2, 2, 2);
            ctx.fillRect(bx + i + 26, by + 2, 2, 2);
        }

        // 3. 지붕 (Heavy Armored Roof)
        const sw = bw / 4;
        for (let i = 0; i < 4; i++) {
            const rx = bx + i * sw;
            ctx.fillStyle = '#556644'; // 지붕 상단
            ctx.beginPath();
            ctx.moveTo(rx, by); ctx.lineTo(rx + sw, by);
            ctx.lineTo(rx + sw + dx, by + dy); ctx.lineTo(rx + dx, by + dy);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#3d441e'; // 지붕 수직면
            ctx.beginPath();
            ctx.moveTo(rx + sw, by); ctx.lineTo(rx + sw + dx, by + dy);
            ctx.lineTo(rx + sw + dx, by + dy - 10); ctx.lineTo(rx + sw, by - 10);
            ctx.closePath(); ctx.fill();

            // 전술 조명
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(rx + sw + 2, by - 8, sw - 4, 4);
        }

        // 4. 대형 전술 셔터 (Blast Door)
        const dw = 80; const dh = 45;
        const doorX = -dw / 2; const doorY = by + bh + wallH - dh;

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(doorX, doorY, dw, dh);

        // 셔터 보강재
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        for (let i = 0; i < dh; i += 8) {
            ctx.strokeRect(doorX + 5, doorY + i, dw - 10, 4);
        }

        // 가동 시 경고등 (Red Blink)
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(doorX - 8, doorY + 5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(doorX + dw + 8, doorY + 5, 3, 0, Math.PI * 2); ctx.fill();
        }

        // 5. 기계 장치 및 소품
        // 회전 레이더 (전력 있을 때만 회전)
        const radarX = bx + 20; const radarY = by;
        ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(radarX, radarY); ctx.lineTo(radarX, radarY - 15); ctx.stroke();

        const radarRot = (Date.now() / 400);
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.ellipse(radarX, radarY - 15, Math.abs(12 * Math.cos(radarRot)), 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 냉각 팬
        const fanRotation = (Date.now() / 150);
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.arc(bx + 15, by + 15, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx + 15 + Math.cos(fanRotation) * 6, by + 15 + Math.sin(fanRotation) * 6);
        ctx.lineTo(bx + 15 - Math.cos(fanRotation) * 6, by + 15 - Math.sin(fanRotation) * 6);
        ctx.stroke();

        // 탄약 박스 및 드럼통
        const drawProp = (px, py, color, type) => {
            ctx.fillStyle = color;
            if (type === 'box') ctx.fillRect(px, py, 12, 8);
            else { ctx.beginPath(); ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(px - 6, py - 10, 12, 10); }
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
        };
        drawProp(bx + bw - 20, by + bh + wallH - 10, '#7f8c8d', 'drum');
        drawProp(bx + bw - 35, by + bh + wallH - 8, '#d35400', 'box');

        ctx.restore();

        this.drawUI(ctx);
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 거대 베이스 플랫폼 (두께감 있는 콘크리트 슬래브)
        // 하부 그림자 및 측면 두께
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(-100, -140, 205, 285); // 그림자
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-100, -140, 200, 280); // 베이스

        // 콘크리트 타일 텍스처
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = -100; i <= 100; i += 25) {
            ctx.beginPath(); ctx.moveTo(i, -140); ctx.lineTo(i, 140); ctx.stroke();
        }
        for (let j = -140; j <= 140; j += 25) {
            ctx.beginPath(); ctx.moveTo(-100, j); ctx.lineTo(100, j); ctx.stroke();
        }

        // 2. 메인 활주로 (입체적인 느낌의 아스팔트) - 오른쪽으로 이동
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(20, -135, 70, 270);
        // 활주로 가장자리 유도 경계선
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, -135, 70, 270);

        // 활주로 마킹
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px "Courier New"';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.8;
        ctx.fillText('0 7 R', 55, -110);
        ctx.fillText('2 5 L', 55, 125);
        ctx.globalAlpha = 1.0;

        // 중앙 점선 (입체적인 두께 표현을 위해 두 번 그림)
        ctx.setLineDash([20, 15]);
        ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(55, -130); ctx.lineTo(55, 130); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(55, -130); ctx.lineTo(55, 130); ctx.stroke();
        ctx.setLineDash([]);

        // 3. 유도로 및 대기 구역 (노란색 라인 디테일) - 왼쪽으로 방향 수정
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 0); ctx.lineTo(-20, 0); ctx.lineTo(-20, 130);
        ctx.stroke();

        // 4. 2.5D 입체 격납고 (Hangar complex) - 왼쪽으로 이동
        const drawHangar25D = (dx, dy) => {
            ctx.save();
            ctx.translate(dx, dy);

            // 1. 벽면 (그림자쪽)
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-35, -20, 70, 45); // 전체 높이감

            // 2. 정면 도어 (Sliding Doors)
            ctx.fillStyle = '#34495e';
            ctx.fillRect(-30, -5, 60, 20);
            ctx.strokeStyle = '#1a252f';
            for (let i = -30; i <= 30; i += 10) {
                ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i, 15); ctx.stroke();
            }

            // 3. 둥근 지붕 (Roof - 입체감)
            const grd = ctx.createLinearGradient(0, -25, 0, 0);
            grd.addColorStop(0, '#95a5a6');
            grd.addColorStop(0.5, '#bdc3c7');
            grd.addColorStop(1, '#7f8c8d');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.ellipse(0, -15, 35, 15, 0, 0, Math.PI, true);
            ctx.lineTo(35, -15); ctx.lineTo(-35, -15);
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        };
        drawHangar25D(-55, 50);
        drawHangar25D(-55, 110);

        // 5. 2.5D 원통형 연료 탱크 (Fuel Tanks) - 왼쪽으로 이동
        const drawTank25D = (dx, dy) => {
            ctx.save();
            ctx.translate(dx, dy);
            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(2, 2, 12, 0, Math.PI * 2); ctx.fill();
            // 몸체 (옆면)
            const sideGrd = ctx.createLinearGradient(-12, 0, 12, 0);
            sideGrd.addColorStop(0, '#7f8c8d');
            sideGrd.addColorStop(0.5, '#ecf0f1');
            sideGrd.addColorStop(1, '#95a5a6');
            ctx.fillStyle = sideGrd;
            ctx.fillRect(-12, -15, 24, 25);
            // 윗면 (Top)
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath(); ctx.ellipse(0, -15, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#7f8c8d'; ctx.stroke();
            // 파이프 연결부
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(-4, -20, 8, 3);
            ctx.restore();
        };
        drawTank25D(-30, -50);
        drawTank25D(-60, -50);
        drawTank25D(-90, -50);

        // 6. 3층 구조 2.5D 관제탑 (Advanced Control Tower) - 왼쪽으로 이동
        ctx.save();
        ctx.translate(-70, -110);
        // 1층 하부 구조
        ctx.fillStyle = '#34495e'; ctx.fillRect(-15, 0, 30, 40);
        ctx.fillStyle = '#7f8c8d'; ctx.fillRect(-12, 0, 24, 38);
        // 2층 중간 데크
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(-18, -5, 36, 6);
        // 3층 관제실 (유리 및 조명)
        const towerBlink = Math.sin(Date.now() / 400) > 0;
        const towerColor = towerBlink ? '#4fc3f7' : '#0288d1';
        ctx.fillStyle = '#263238'; // 프레임
        ctx.beginPath();
        ctx.moveTo(-22, -25); ctx.lineTo(22, -25); ctx.lineTo(18, -5); ctx.lineTo(-18, -5);
        ctx.closePath(); ctx.fill();
        // 유리창
        ctx.fillStyle = towerColor;
        ctx.beginPath();
        ctx.moveTo(-18, -22); ctx.lineTo(18, -22); ctx.lineTo(15, -8); ctx.lineTo(-15, -8);
        ctx.closePath(); ctx.fill();
        // 옥상 장비 및 레이더
        ctx.fillStyle = '#444'; ctx.fillRect(-10, -30, 20, 5);
        ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -55); ctx.stroke();
        ctx.restore();

        // 7. 입체 회전 레이더 디쉬 - 왼쪽으로 이동
        ctx.save();
        ctx.translate(-40, -110);
        ctx.fillStyle = '#555'; ctx.fillRect(-3, 0, 6, 15); // 지지대

        ctx.rotate(Date.now() / 600);
        const dishGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
        dishGrd.addColorStop(0, '#bdc3c7');
        dishGrd.addColorStop(1, '#7f8c8d');
        ctx.fillStyle = dishGrd;
        ctx.beginPath(); ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.stroke();
        // 레이더 빔 효과
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 80, -0.2, 0.2); ctx.closePath(); ctx.fill();

        ctx.restore();

        // 8. 야간 항공 유도등 (입체적인 광원 효과) - 오른쪽 활주로에 맞춰 이동
        for (let i = 0; i < 6; i++) {
            const yPos = -120 + i * 48;
            const blink = (Math.floor(Date.now() / 300) + i) % 4 === 0;

            ctx.save();
            ctx.globalAlpha = blink ? 1.0 : 0.3;
            ctx.shadowBlur = 10; ctx.shadowColor = '#2ecc71';
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath(); ctx.arc(15, yPos, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(95, yPos, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        ctx.restore();

        // HP 및 생산 바 (기존 유지하되 위치 최적화)
        const barW = 140;
        const barY = this.y - 170;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 10);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 10);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(this.x - barW / 2, barY, barW, 10);

        if (this.spawnQueue.length > 0) {
            const qBarY = barY - 18;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 70, qBarY, 140, 10);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 70, qBarY, 140 * progress, 10);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`비행대 출격 대기 중 (${this.spawnQueue.length})`, this.x, qBarY - 5);
        }
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 기반 (Heavy Foundation)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-80, -60, 160, 120);
        ctx.strokeStyle = '#3d441e'; ctx.lineWidth = 2;
        ctx.strokeRect(-80, -60, 160, 120);

        // 2. 메인 공장동 (Main Production Hall - 2.5D)
        const drawBlock = (bx, by, bw, bh, elevation, color) => {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(bx + 5, by + 5, bw, bh); // 그림자

            // 벽면 (측면 입체)
            ctx.fillStyle = '#1e272e';
            ctx.beginPath();
            ctx.moveTo(bx + bw, by); ctx.lineTo(bx + bw + elevation, by - elevation);
            ctx.lineTo(bx + bw + elevation, by + bh - elevation); ctx.lineTo(bx + bw, by + bh);
            ctx.closePath(); ctx.fill();

            // 정면 벽
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, bw, bh);

            // 옥상
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(bx + elevation, by - elevation);
            ctx.lineTo(bx + bw + elevation, by - elevation); ctx.lineTo(bx + bw, by);
            ctx.closePath(); ctx.fill();
        };

        // 생산동 A (우측 대형)
        drawBlock(-10, -40, 80, 80, 10, '#34495e');
        // 생산동 B (좌측 소형)
        drawBlock(-70, -20, 50, 60, 8, '#2c3e50');

        // 3. 세부 디테일
        // 산업용 대형 팬
        const fanRot = Date.now() / 150;
        const drawFan = (fx, fy) => {
            ctx.save(); ctx.translate(fx, fy);
            ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#00d2ff'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(fanRot) * 10, Math.sin(fanRot) * 10); ctx.lineTo(-Math.cos(fanRot) * 10, -Math.sin(fanRot) * 10);
            ctx.stroke();
            ctx.restore();
        };
        drawFan(30, 0);

        // 하역장 셔터 (Loading Docks)
        ctx.fillStyle = '#111';
        ctx.fillRect(-65, 15, 20, 15);
        ctx.fillRect(-40, 15, 20, 15);
        ctx.strokeStyle = '#f1c40f';
        ctx.strokeRect(-65, 15, 20, 15);
        ctx.strokeRect(-40, 15, 20, 15);

        // 탄약 상자 더미 (Stacks of Ammo Crates)
        const drawCrate = (cx, cy, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(cx, cy, 10, 6);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeRect(cx, cy, 10, 6);
        };
        drawCrate(10, 45, '#556644'); drawCrate(22, 45, '#556644');
        drawCrate(15, 38, '#3a4118');

        // 상태 표시 라이트
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        ctx.fillStyle = blink ? '#ff3131' : '#330000';
        ctx.beginPath(); ctx.arc(-70, -50, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#39ff14';
        ctx.beginPath(); ctx.arc(-60, -50, 3, 0, Math.PI * 2); ctx.fill();

        ctx.restore();

        // HP 바 & 생산 UI
        this.drawUI(ctx);
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
