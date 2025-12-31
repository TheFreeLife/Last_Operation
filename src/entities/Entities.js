export class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.width = 40;  // Default 1x1
        this.height = 40; // Default 1x1
        this.size = 40;   // Default for circles
    }

    getSelectionBounds() {
        const w = this.width || this.size || 40;
        const h = this.height || this.size || 40;
        return {
            left: this.x - w / 2,
            right: this.x + w / 2,
            top: this.y - h / 2,
            bottom: this.y + h / 2
        };
    }
}

export class Base extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'base';
        this.name = '총사령부';
        this.maxHp = 99999999;
        this.hp = 99999999;
        this.width = 120;  // 3x3 tiles
        this.height = 120; // 3x3 tiles
        this.size = 120;
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 4000; // 공병 생산 시간 (4초)
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 70; // 건물 남쪽 출입구 앞
                let unit = new CombatEngineer(this.x, spawnY, engine);
                unit.destination = { x: this.x, y: this.y + 100 };
                engine.entities.units.push(unit);
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // ... (기존 그리기 로직 유지)

        // 1. 메인 대형 빌딩 본체 (석조 건물의 웅장함 - 밝은 회색/베이지)
        ctx.fillStyle = '#dcdde1';
        ctx.fillRect(-55, -55, 110, 110);
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 2;
        ctx.strokeRect(-55, -55, 110, 110);

        // 2. 대칭형 창문 디자인 (현대식 오피스 빌딩 느낌)
        ctx.fillStyle = 'rgba(44, 62, 80, 0.8)'; // 짙은 창문 색상
        const winCols = 5;
        const winRows = 4;
        const winW = 12;
        const winH = 15;
        const spacingX = 20;
        const spacingY = 22;

        for (let r = 0; r < winRows; r++) {
            for (let c = 0; c < winCols; c++) {
                const wx = -40 + c * spacingX;
                const wy = -40 + r * spacingY;
                // 창문 본체
                ctx.fillRect(wx - winW/2, wy - winH/2, winW, winH);
                // 창문 반사 효과 (디테일)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(wx - winW/2, wy - winH/2, winW, 3);
                ctx.fillStyle = 'rgba(44, 62, 80, 0.8)';
            }
        }

        // 3. 상단 옥상 구조물 및 난간
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(-58, -58, 116, 15); // 상단 테두리
        ctx.strokeRect(-58, -58, 116, 15);

        // 4. 옥상 통신 시설 (대형 위성 안테나 및 레이더)
        // 왼쪽 대형 위성 접시
        ctx.save();
        ctx.translate(-30, -45);
        ctx.fillStyle = '#f5f6fa';
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 10, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#999'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -12); ctx.stroke();
        ctx.restore();

        // 오른쪽 레이더 타워
        ctx.fillStyle = '#2f3640';
        ctx.fillRect(25, -55, 8, 25);
        const radarAngle = Date.now() / 800;
        ctx.save();
        ctx.translate(29, -55);
        ctx.rotate(radarAngle);
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-10, -2, 20, 4);
        ctx.restore();

        // 5. 중앙 입구 및 상징물 (국방부 느낌)
        // 거대한 중앙 기둥/현관
        ctx.fillStyle = '#b2bec3';
        ctx.fillRect(-25, 30, 50, 25);
        ctx.strokeRect(-25, 30, 50, 25);

        // 부대 마크/엠블럼 (중앙)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(0, 35); ctx.lineTo(8, 42); ctx.lineTo(0, 49); ctx.lineTo(-8, 42);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f1c40f'; // 금색 테두리
        ctx.lineWidth = 1;
        ctx.stroke();

        // 6. 전면 계단 및 보안 바리케이드
        ctx.fillStyle = '#95a5a6';
        for(let i=0; i<3; i++) {
            ctx.fillRect(-30, 50 + i*3, 60, 2);
        }

        // 7. 항공 장애등 (최상단 양쪽)
        const blink = Math.sin(Date.now() / 500) > 0;
        ctx.fillStyle = blink ? '#e74c3c' : '#440000';
        ctx.beginPath(); ctx.arc(-50, -50, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(50, -50, 3, 0, Math.PI * 2); ctx.fill();

        ctx.restore();

        // HP Bar
        const barWidth = 110;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barWidth/2, this.y - 80, barWidth, 8);
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(this.x - barWidth/2, this.y - 80, (this.hp / this.maxHp) * barWidth, 8);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barWidth/2, this.y - 80, barWidth, 8);

        // 생산 대기열 표시
        if (this.spawnQueue.length > 0) {
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 40, this.y - 95, 80, 8);
            ctx.fillStyle = '#f1c40f'; // 공병은 노란색 바
            ctx.fillRect(this.x - 40, this.y - 95, 80 * progress, 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`공병 생산 중 x${this.spawnQueue.length}`, this.x, this.y - 100);
        }
    }
}

export class Turret extends Entity {
    constructor(x, y, type = 'turret-basic') {
        super(x, y);
        this.type = type;
        this.target = null;
        this.angle = 0;
        this.lastFireTime = 0;

        // 타입별 초기 스탯 설정
        this.initStats();
        this.isPowered = false;
        this.maxHp = 100;
        this.hp = 100;
        this.size = 30;
        this.width = 40;
        this.height = 40;
    }

    initStats() {
        switch (this.type) {
            case 'turret-fast':
                this.range = 150;
                this.damage = 5;
                this.fireRate = 400; // 빨름
                this.color = '#39ff14'; // 네온 그린
                break;
            case 'turret-sniper':
                this.range = 450;
                this.damage = 60;
                this.fireRate = 3000; // 느림
                this.color = '#ff3131'; // 네온 레드
                break;
            case 'turret-tesla':
                this.range = 180;
                this.damage = 2; // 지속 딜 (틱당)
                this.fireRate = 100; // 매우 빠른 틱
                this.color = '#00ffff'; // 시안 (전기 색상)
                break;
            case 'turret-flamethrower':
                this.range = 140;
                this.damage = 3; // 지속 딜
                this.fireRate = 100; // 매우 빠른 틱
                this.color = '#ff6600'; // 주황색 (불꽃)
                break;
            default: // basic
                this.range = 200;
                this.damage = 15;
                this.fireRate = 1000;
                this.color = '#00d2ff'; // 네온 블루
                break;
        }
    }

    update(deltaTime, enemies, projectiles) {
        if (!this.isPowered) return; // 전기가 없으면 작동 중지
        const now = Date.now();

        // 타겟 찾기 (가장 가까운 적)
        if (!this.target || !this.target.active || this.dist(this.target) > this.range) {
            this.target = null;
            let minDist = this.range;
            for (const enemy of enemies) {
                const d = this.dist(enemy);
                if (d < minDist) {
                    minDist = d;
                    this.target = enemy;
                }
            }
        }

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            
            if (this.type === 'turret-tesla') {
                if (now - this.lastFireTime > this.fireRate) {
                    this.target.hp -= this.damage;
                    if (this.target.hp <= 0) this.target.active = false;
                    this.lastFireTime = now;
                }
            } else if (this.type === 'turret-flamethrower') {
                if (now - this.lastFireTime > this.fireRate) {
                    enemies.forEach(enemy => {
                        const d = this.dist(enemy);
                        if (d <= this.range) {
                            enemy.hp -= this.damage;
                            if (enemy.hp <= 0) enemy.active = false;
                        }
                    });
                    this.lastFireTime = now;
                }
            } else {
                if (now - this.lastFireTime > this.fireRate) {
                    this.fire(projectiles);
                    this.lastFireTime = now;
                }
            }
        }
    }

    fire(projectiles) {
        projectiles.push(new Projectile(this.x, this.y, this.target, this.damage, this.color));
    }

    drawLightning(ctx, startX, startY, length) {
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        let curX = startX;
        let curY = startY;
        ctx.moveTo(curX, curY);
        const segments = 5;
        const segLen = length / segments;
        for (let i = 0; i < segments; i++) {
            curX += segLen;
            curY += (Math.random() - 0.5) * 20;
            ctx.lineTo(curX, curY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawFlames(ctx, startX, startY, length) {
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
            const dist = Math.random() * length;
            const spread = (dist / length) * 20;
            const size = (1 - dist / length) * 10 + 2;
            const px = startX + dist;
            const py = startY + (Math.random() - 0.5) * spread;
            const colors = ['#ff4500', '#ff8c00', '#ffd700'];
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            ctx.globalAlpha = (1 - dist / length) * 0.8;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }

    dist(other) {
        return Math.hypot(this.x - other.x, this.y - other.y);
    }

    draw(ctx, showRange = false) {
        if (showRange) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.strokeStyle = `${this.color}33`;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.fillStyle = `${this.color}0D`;
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);

        ctx.fillStyle = this.isPowered ? '#666' : '#222';
        if (this.type === 'turret-fast') {
            ctx.fillRect(0, -8, 15, 6);
            ctx.fillRect(0, 2, 15, 6);
        } else if (this.type === 'turret-sniper') {
            ctx.fillRect(0, -4, 30, 8);
            ctx.fillStyle = this.isPowered ? this.color : '#444';
            ctx.fillRect(25, -5, 5, 10);
        } else if (this.type === 'turret-tesla') {
            ctx.fillStyle = this.isPowered ? '#888' : '#333';
            ctx.fillRect(0, -10, 10, 20);
            for(let i=0; i<3; i++) {
                ctx.fillStyle = this.isPowered ? this.color : '#444';
                ctx.fillRect(10 + i*4, -12 + i*2, 2, 24 - i*4);
            }
            if (this.target && this.isPowered) {
                this.drawLightning(ctx, 15, 0, this.dist(this.target));
            }
        } else if (this.type === 'turret-flamethrower') {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, -8, 20, 16);
            ctx.fillStyle = '#333';
            ctx.fillRect(18, -10, 4, 20);
            if (this.target && this.isPowered) {
                this.drawFlames(ctx, 22, 0, this.range);
            }
        } else {
            ctx.fillRect(0, -6, 20, 12);
        }

        if (!this.isPowered) {
            ctx.rotate(-this.angle);
            ctx.fillStyle = '#ff0';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚡!', 0, 5);
        }

        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 15, this.y - 25, 30, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 15, this.y - 25, (this.hp / this.maxHp) * 30, 3);
        }
    }
}

export class Generator extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'generator';
        this.size = 30;
        this.color = '#ffff00';
        this.maxHp = 80;
        this.hp = 80;
    }
}

export class PipeLine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'pipe-line';
        this.passable = true;
        this.maxHp = 80;
        this.hp = 80;
        this.size = 30;
        this.isConnected = false; // Whether connected to Base
    }

    update() {}

    draw(ctx, allEntities, engine) {
        const neighbors = { n: null, s: null, e: null, w: null };
        if (allEntities && engine) {
            allEntities.forEach(other => {
                if (other === this) return;
                
                // 건물의 절반 크기 계산 (기본값 20)
                const otherHW = (other.width || 40) / 2;
                const otherHH = (other.height || 40) / 2;
                const myHW = 20;
                const myHH = 20;

                // 중심점 간의 거리
                const dx = Math.abs(other.x - this.x);
                const dy = Math.abs(other.y - this.y);

                // 범용 인접 체크 (상하좌우로 딱 붙어 있는지 확인)
                const margin = 2;
                const isAdjacentX = dx <= (otherHW + myHW) + margin && dy < Math.max(otherHH, myHH);
                const isAdjacentY = dy <= (otherHH + myHH) + margin && dx < Math.max(otherHW, myHW);

                if (isAdjacentX || isAdjacentY) {
                    const pipeTransmitters = ['pipe-line', 'refinery', 'gold-mine', 'storage', 'base'];
                    const isTransmitter = pipeTransmitters.includes(other.type) || (other.maxHp === 99999999);
                    
                    if (isTransmitter) {
                        if (isAdjacentX) {
                            if (other.x > this.x) neighbors.e = other;
                            else neighbors.w = other;
                        } else {
                            if (other.y > this.y) neighbors.s = other;
                            else neighbors.n = other;
                        }
                    }
                }
            });
        }

        const finalNeighbors = {
            n: !!neighbors.n,
            s: !!neighbors.s,
            e: !!neighbors.e,
            w: !!neighbors.w
        };

        ctx.save();
        // Pipe Style: Thicker and industrial look
        ctx.lineWidth = 8;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = this.isConnected ? '#9370DB' : '#555'; // 공급 중일 때 전체가 보라색
        const halfSize = 20;
        
        const drawSegment = (dirX, dirY) => {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + dirX * halfSize, this.y + dirY * halfSize);
            ctx.stroke();
            
            // Inner liquid flow line
            if (this.isConnected) {
                ctx.save();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#DDA0DD'; // 더 밝은 보라색으로 흐름 강조
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + dirX * halfSize, this.y + dirY * halfSize);
                ctx.stroke();
                ctx.restore();
            }
        };

        if (finalNeighbors.n) drawSegment(0, -1);
        if (finalNeighbors.s) drawSegment(0, 1);
        if (finalNeighbors.w) drawSegment(-1, 0);
        if (finalNeighbors.e) drawSegment(1, 0);

        if (!finalNeighbors.n && !finalNeighbors.s && !finalNeighbors.w && !finalNeighbors.e) {
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, Math.PI * 2); ctx.fill();
        }

        // Joint/Valve
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
        
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 10, this.y - 15, 20, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 10, this.y - 15, (this.hp / this.maxHp) * 20, 3);
        }
    }
}

export class Wall extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'wall';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 500;
        this.hp = 500;
        this.color = '#888';
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-15, -5); ctx.lineTo(15, -5);
        ctx.moveTo(-15, 5); ctx.lineTo(15, 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5, -15); ctx.lineTo(-5, -5);
        ctx.moveTo(10, -15); ctx.lineTo(10, -5);
        ctx.moveTo(-10, -5); ctx.lineTo(-10, 5);
        ctx.moveTo(5, -5); ctx.lineTo(5, 5);
        ctx.moveTo(-5, 5); ctx.lineTo(-5, 15);
        ctx.moveTo(10, 5); ctx.lineTo(10, 15);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-14, -14); ctx.lineTo(14, -14);
        ctx.moveTo(-14, -14); ctx.lineTo(-14, 14);
        ctx.stroke();
        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 15, this.y - 25, 30, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 15, this.y - 25, (this.hp / this.maxHp) * 30, 3);
        }
    }
}

export class CoalGenerator extends Generator {
    constructor(x, y) {
        super(x, y);
        this.type = 'coal-generator';
        this.color = '#ff6600';
        this.width = 40;
        this.height = 40;
        this.maxHp = 150;
        this.hp = 150;
        this.maxFuel = 50;
        this.fuel = 50;
    }

    update(deltaTime) {
        if (this.fuel > 0) {
            this.fuel -= deltaTime / 1000;
            if (this.fuel < 0) this.fuel = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#444';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(0, -5, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.stroke();
        const flicker = (this.fuel > 0) ? ((Math.random() * 0.2) + 0.8) : 0;
        ctx.fillStyle = `rgba(255, 100, 0, ${flicker})`;
        ctx.beginPath(); ctx.arc(0, -5, 6, 0, Math.PI * 2); ctx.fill();
        if (this.fuel > 0) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
            const time = Date.now() / 1000;
            const smokeY = -20 - (time % 1) * 15;
            const smokeSize = 5 + (time % 1) * 5;
            ctx.beginPath(); ctx.arc(Math.sin(time * 2) * 3, smokeY, smokeSize, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class OilGenerator extends Generator {
    constructor(x, y) {
        super(x, y);
        this.type = 'oil-generator';
        this.color = '#9370DB';
        this.width = 40;
        this.height = 40;
        this.maxHp = 150;
        this.hp = 150;
        this.maxFuel = 80;
        this.fuel = 80;
    }

    update(deltaTime) {
        if (this.fuel > 0) {
            this.fuel -= deltaTime / 1000;
            if (this.fuel < 0) this.fuel = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        const gradient = ctx.createLinearGradient(-10, 0, 10, 0);
        gradient.addColorStop(0, '#555');
        gradient.addColorStop(0.5, '#777');
        gradient.addColorStop(1, '#555');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.roundRect(-12, -12, 24, 24, 5); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.stroke();
        ctx.fillStyle = (this.fuel > 0) ? this.color : '#444';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = this.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-18, 0); ctx.stroke();
        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#9370DB';
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class PowerLine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'power-line';
        this.passable = true;
        this.maxHp = 50;
        this.hp = 50;
        this.size = 30;
        this.isPowered = false;
    }

    update() {}

    draw(ctx, allEntities, engine) {
        const neighbors = { n: null, s: null, e: null, w: null };
        if (allEntities && engine) {
            allEntities.forEach(other => {
                if (other === this) return;
                
                const otherHW = (other.width || 40) / 2;
                const otherHH = (other.height || 40) / 2;
                const myHW = 20;
                const myHH = 20;

                const dx = Math.abs(other.x - this.x);
                const dy = Math.abs(other.y - this.y);

                const margin = 2;
                const isAdjacentX = dx <= (otherHW + myHW) + margin && dy < Math.max(otherHH, myHH);
                const isAdjacentY = dy <= (otherHH + myHH) + margin && dx < Math.max(otherHW, myHW);

                if (isAdjacentX || isAdjacentY) {
                    const transmitterTypes = ['power-line', 'generator', 'coal-generator', 'oil-generator', 'base', 'airport', 'refinery', 'gold-mine', 'storage', 'armory', 'barracks'];
                    // 포탑 타입들도 전선 연결 대상으로 추가
                    const isTransmitter = transmitterTypes.includes(other.type) || 
                                        (other.type && other.type.startsWith('turret')) ||
                                        (other.maxHp === 99999999);
                    
                    if (isTransmitter) {
                        if (isAdjacentX) {
                            if (other.x > this.x) neighbors.e = other;
                            else neighbors.w = other;
                        } else {
                            if (other.y > this.y) neighbors.s = other;
                            else neighbors.n = other;
                        }
                    }
                }
            });
        }

        const finalNeighbors = {
            n: !!neighbors.n,
            s: !!neighbors.s,
            e: !!neighbors.e,
            w: !!neighbors.w
        };

        ctx.save();
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.isPowered ? '#ffff00' : '#444';
        const halfSize = 20;
        if (finalNeighbors.n) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, this.y - halfSize); ctx.stroke(); }
        if (finalNeighbors.s) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, this.y + halfSize); ctx.stroke(); }
        if (finalNeighbors.w) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - halfSize, this.y); ctx.stroke(); }
        if (finalNeighbors.e) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + halfSize, this.y); ctx.stroke(); }

        if (!finalNeighbors.n && !finalNeighbors.s && !finalNeighbors.w && !finalNeighbors.e) {
            ctx.fillStyle = this.isPowered ? '#ffff00' : '#444';
            ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill();
        }

        if (this.isPowered) {
            ctx.fillStyle = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffff00';
            ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 10, this.y - 15, 20, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 10, this.y - 15, (this.hp / this.maxHp) * 20, 3);
        }
    }
}

export class Refinery extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'refinery';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 200;
        this.hp = 200;
        this.maxFuel = 80;
        this.fuel = 80;
        this.productionRate = 5;
        this.color = '#32cd32';
        this.isConnectedToBase = false; 
        this.connectedTarget = null;
    }

    update(deltaTime, engine) {
        if (this.fuel > 0 && (this.isConnectedToBase || this.connectedTarget)) {
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
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = (this.fuel > 0) ? this.color : '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.fillStyle = '#555';
        ctx.fillRect(-10, -10, 8, 20);
        ctx.fillRect(2, -10, 8, 20);
        ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke();
        if (this.fuel > 0) {
            const liquidHeight = (this.fuel / this.maxFuel) * 18;
            ctx.fillStyle = '#9370DB'; ctx.fillRect(-9, 9 - liquidHeight, 6, liquidHeight);
            ctx.fillStyle = '#ffd700'; ctx.fillRect(3, 9 - liquidHeight, 6, liquidHeight);
        }
        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#32cd32';
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class GoldMine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'gold-mine';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 250;
        this.hp = 250;
        this.maxFuel = 100; // 자원 매장량
        this.fuel = 100;
        this.productionRate = 8; // 초당 골드 생산량
        this.color = '#FFD700';
        this.isConnectedToBase = false;
        this.connectedTarget = null;
    }

    update(deltaTime, engine) {
        if (this.fuel > 0 && (this.isConnectedToBase || this.connectedTarget)) {
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
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = (this.fuel > 0) ? this.color : '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        
        // 채굴 기계 표현
        ctx.fillStyle = '#666';
        ctx.fillRect(-12, -8, 24, 16);
        const drillAngle = (this.fuel > 0 && this.isConnected) ? (Date.now() / 100) : 0;
        ctx.save();
        ctx.rotate(drillAngle);
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class Storage extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'storage';
        this.name = '창고';
        this.width = 80;
        this.height = 80;
        this.size = 80;
        this.maxHp = 1000;
        this.hp = 1000;
        this.storedResources = { gold: 0, oil: 0 };
        this.maxCapacity = 1000;
        this.isConnectedToBase = false; // 기지로 자원을 보낼 수 있는지 여부
        this.cargoPlanes = []; // 이 창고 소속의 수송기들
        this.spawnQueue = 0; // 대기 중인 수송기 수
        this.spawnTimer = 0;
        this.spawnTimeRequired = 5000; // 5초 (ms)
    }

    requestCargoPlane() {
        this.spawnQueue++;
    }

    update(deltaTime, engine) {
        // ... 기존 로직 동일 (수송기 생산 및 자원 전송)
        if (this.spawnQueue > 0) {
            this.spawnTimer += deltaTime;
            if (this.spawnTimer >= this.spawnTimeRequired) {
                const newPlane = new CargoPlane(this, engine);
                this.cargoPlanes.push(newPlane);
                engine.entities.cargoPlanes.push(newPlane);
                this.spawnQueue--;
                this.spawnTimer = 0;
            }
        }

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
        ctx.translate(this.x, this.y);
        
        // 1. 하부 베이스 프레임
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-40, -40, 80, 80);
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 4;
        ctx.strokeRect(-40, -40, 80, 80);

        // 2. 금속 보강 지지대 (네 모서리)
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-42, -42, 12, 12);
        ctx.fillRect(30, -42, 12, 12);
        ctx.fillRect(-42, 30, 12, 12);
        ctx.fillRect(30, 30, 12, 12);

        // 3. 메인 저장고 해치/도어
        const grd = ctx.createLinearGradient(-30, -30, 30, 30);
        grd.addColorStop(0, '#333');
        grd.addColorStop(1, '#444');
        ctx.fillStyle = grd;
        ctx.fillRect(-30, -30, 60, 60);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(-30, -30, 60, 60);

        // 4. 상태 표시등 (기지 연결 시 시안색으로 빛남)
        ctx.fillStyle = this.isConnectedToBase ? '#00d2ff' : '#555';
        if (this.isConnectedToBase) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00d2ff';
        }
        ctx.beginPath(); ctx.arc(-22, -22, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // 5. 자원 저장 게이지 (디자인 개선)
        ctx.fillStyle = '#111';
        ctx.fillRect(-25, 20, 50, 12);
        ctx.strokeStyle = '#2c3e50';
        ctx.strokeRect(-25, 20, 50, 12);

        const totalStored = this.storedResources.gold + this.storedResources.oil;
        if (totalStored > 0) {
            const goldWidth = (this.storedResources.gold / this.maxCapacity) * 50;
            const oilWidth = (this.storedResources.oil / this.maxCapacity) * 50;
            
            // 금 게이지
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-25, 21, goldWidth, 10);
            
            // 석유 게이지
            ctx.fillStyle = '#9370DB';
            ctx.fillRect(-25 + goldWidth, 21, oilWidth, 10);

            // 게이지 광택 효과
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(-25, 21, 50, 5);
        }

        // 6. 환풍구 또는 기계 디테일
        ctx.fillStyle = '#222';
        for(let i = 0; i < 3; i++) {
            ctx.fillRect(-15, -15 + (i * 8), 30, 4);
        }

        ctx.restore();

        // 7. HP 바 (기존)
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 30, this.y - 65, 60, 5);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 30, this.y - 65, (this.hp / this.maxHp) * 60, 5);
        }

        // 8. 생산 대기열 표시
        if (this.spawnQueue > 0) {
            const barY = this.hp < this.maxHp ? this.y - 75 : this.y - 65;
            const progress = this.spawnTimer / this.spawnTimeRequired;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 30, barY, 60, 8);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(this.x - 30, barY, 60 * progress, 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 4; ctx.shadowColor = '#000';
            ctx.fillText(`수송기 생산 중 x${this.spawnQueue}`, this.x, barY - 5);
            ctx.shadowBlur = 0;
        }
    }
}

export class PlayerUnit extends Entity {
    constructor(x, y, engine) {
        super(x, y);
        this.engine = engine;
        this.attackRange = 250; 
        this.visionRange = 5; // Default vision range in tiles
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 1;
        this.target = null;
        this.lastFireTime = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.alive = true;
        this.size = 40; // 20 -> 40
        this.damage = 0; // 하위 클래스에서 정의
        this.destination = null; // {x, y}
        this.command = 'stop'; // 'move', 'attack', 'patrol', 'stop', 'hold'
        this.patrolStart = null;
        this.patrolEnd = null;
    }

    update(deltaTime) {
        if (!this.alive) return;

        // 1. --- Command Logic & Movement (먼저 이동 수행) ---
        const enemies = this.engine.entities.enemies;
        let bestTarget = null;
        let minDistToMe = Infinity;

        if (this.command !== 'move') {
            for (const e of enemies) {
                const distToMe = Math.hypot(e.x - this.x, e.y - this.y);
                if (distToMe <= this.attackRange && distToMe < minDistToMe) {
                    minDistToMe = distToMe;
                    bestTarget = e;
                }
            }
        }
        this.target = bestTarget;

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.attack();
            if (this.command === 'attack') this.destination = null; 
        } else if (this.destination) {
            const dist = Math.hypot(this.destination.x - this.x, this.destination.y - this.y);
            if (dist < 5) {
                if (this.command === 'patrol') {
                    const temp = this.patrolStart;
                    this.patrolStart = this.patrolEnd;
                    this.patrolEnd = temp;
                    this.destination = this.patrolEnd;
                } else {
                    this.destination = null;
                    this.command = 'stop';
                }
            } else {
                this.angle = Math.atan2(this.destination.y - this.y, this.destination.x - this.x);
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
            }
        }

        // --- Collision Avoidance (이동 후 겹침 해결) ---
        let pushX = 0;
        let pushY = 0;

        // --- 유닛 간 충돌 ---
        const allUnits = this.engine.entities.units;
        for (const other of allUnits) {
            if (other === this || !other.alive) continue;
            const d = Math.hypot(this.x - other.x, this.y - other.y);
            const minDist = (this.size + other.size) * 0.45; 
            if (d < minDist) {
                const pushAngle = Math.atan2(this.y - other.y, this.x - other.x);
                const force = (minDist - d) / minDist;
                pushX += Math.cos(pushAngle) * force * 2;
                pushY += Math.sin(pushAngle) * force * 2;
            }
        }

        // --- 건물 및 자원 충돌 (동적 수집 방식) ---
        const obstacles = [];
        const excludedCategories = ['units', 'enemies', 'projectiles', 'scoutPlanes', 'cargoPlanes'];
        
        for (const key in this.engine.entities) {
            if (excludedCategories.includes(key)) continue;
            const entry = this.engine.entities[key];
            if (Array.isArray(entry)) {
                obstacles.push(...entry);
            } else if (entry && entry !== null) {
                obstacles.push(entry);
            }
        }

        for (const b of obstacles) {
            if (!b || (b.active === false && b.hp !== 99999999) || b.passable) continue;

            const bWidth = b.width || b.size || 40;
            const bHeight = b.height || b.size || 40;
            
            // 충돌 박스 계산 (여유 공간 포함)
            const halfW = bWidth / 2 + this.size / 2 - 2;
            const halfH = bHeight / 2 + this.size / 2 - 2;
            const dx = this.x - b.x;
            const dy = this.y - b.y;

            if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
                const overlapX = halfW - Math.abs(dx);
                const overlapY = halfH - Math.abs(dy);
                
                // 더 적게 겹친 방향으로 강력하게 밀어냄
                if (overlapX < overlapY) {
                    this.x += (dx > 0 ? 1 : -1) * overlapX;
                } else {
                    this.y += (dy > 0 ? 1 : -1) * overlapY;
                }
            }
        }

        this.x += pushX;
        this.y += pushY;

        // 맵 경계 제한
        const mapW = this.engine.tileMap.cols * this.engine.tileMap.tileSize;
        const mapH = this.engine.tileMap.rows * this.engine.tileMap.tileSize;
        this.x = Math.max(this.size/2, Math.min(mapW - this.size/2, this.x));
        this.y = Math.max(this.size/2, Math.min(mapH - this.size/2, this.y));

        if (this.hp <= 0) this.alive = false;
    }

    attack() {}
}

export class Tank extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'tank';
        this.name = '전차';
        this.speed = 1.2;
        this.fireRate = 1000;
        this.damage = 25;
        this.color = '#39ff14';
        this.attackRange = 180; 
        this.visionRange = 6; // 전차 시야: 보병보다 넓음
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            const { Projectile } = this.engine.entityClasses;
            this.engine.entities.projectiles.push(new Projectile(this.x, this.y, this.target, this.damage, this.color));
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2); // 2배 확대
        
        // 전차 몸체
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-12, -10, 24, 20);
        ctx.strokeStyle = '#34495e';
        ctx.strokeRect(-12, -10, 24, 20);
        
        // 무한궤도
        ctx.fillStyle = '#111';
        ctx.fillRect(-14, -12, 28, 4);
        ctx.fillRect(-14, 8, 28, 4);
        
        // 포탑
        ctx.fillStyle = '#34495e';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(0, -2, 15, 4);
        
        ctx.restore();
    }
}

export class Missile extends Entity {
    constructor(startX, startY, targetX, targetY, damage, engine) {
        super(startX, startY);
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.engine = engine;
        this.speed = 5;
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.active = true;
        this.explosionRadius = 40; // 반경 1칸 (40px)
        this.arrived = false;
    }

    update(deltaTime) {
        if (!this.active) return;

        const d = Math.hypot(this.targetX - this.x, this.targetY - this.y);
        if (d < 10) {
            this.explode();
        } else {
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
        }
    }

    explode() {
        this.active = false;
        this.arrived = true;
        
        // 범위 내 모든 적에게 데미지
        const enemies = this.engine.entities.enemies;
        enemies.forEach(enemy => {
            const dist = Math.hypot(enemy.x - this.targetX, enemy.y - this.targetY);
            if (dist <= this.explosionRadius) {
                enemy.hp -= this.damage;
                if (enemy.hp <= 0) enemy.active = false;
            }
        });
    }

    draw(ctx) {
        if (!this.active && !this.arrived) return;

        if (this.active) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = '#ff3131';
            ctx.beginPath();
            ctx.moveTo(10, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5);
            ctx.fill();
            // 미사일 연기 효과
            ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
            ctx.beginPath(); ctx.arc(-15, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.arrived) {
            // 폭발 이펙트 (잠깐 표시)
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.targetX, this.targetY, this.explosionRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 69, 0, 0.4)';
            ctx.fill();
            ctx.strokeStyle = '#ff4500';
            ctx.stroke();
            ctx.restore();
            // 다음 프레임에 소멸되도록 arrived 해제
            this.arrived = false;
        }
    }
}

export class MissileLauncher extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'missile-launcher';
        this.name = '이동식 미사일 발사대';
        this.speed = 0.8;
        this.fireRate = 2500;
        this.damage = 70;
        this.color = '#ff3131';
        this.attackRange = 400; 
        this.visionRange = 8; // 미사일 시야: 제일 넓음
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate && this.target) {
            // 타겟의 현재 위치를 향해 논타겟팅 미사일 발사
            this.engine.entities.projectiles.push(new Missile(this.x, this.y, this.target.x, this.target.y, this.damage, this.engine));
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2); // 2배 확대
        
        // 차량 몸체
        ctx.fillStyle = '#444';
        ctx.fillRect(-15, -10, 30, 20);
        
        // 미사일 랙
        ctx.fillStyle = '#222';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#ff3131';
        ctx.fillRect(0, -6, 12, 3);
        ctx.fillRect(0, 3, 12, 3);
        
        ctx.restore();
    }
}

export class Rifleman extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'rifleman';
        this.name = '소총병';
        this.speed = 0.9;
        this.fireRate = 800;
        this.damage = 10;
        this.color = '#e0e0e0';
        this.attackRange = 180;
        this.size = 24; // 12 -> 24
        this.visionRange = 4; // 보병 시야: 제일 좁음
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate && this.target) {
            const { Projectile } = this.engine.entityClasses;
            this.engine.entities.projectiles.push(new Projectile(this.x, this.y, this.target, this.damage, this.color));
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2); // 2배 확대
        
        // 몸통
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // 총기
        ctx.fillStyle = '#636e72';
        ctx.fillRect(2, -1, 10, 2);
        
        // 헬멧
        ctx.fillStyle = '#556644';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

export class CombatEngineer extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'engineer';
        this.name = '공병';
        this.speed = 1.5;
        this.hp = 60;
        this.maxHp = 60;
        this.size = 30; // 15 -> 30
        this.visionRange = 5;
        this.repairRate = 20; // 초당 수리량
        this.harvestRate = 5; // 초당 자원 채취량
        this.state = 'idle'; // idle, repairing, harvesting
        this.targetObject = null;
        this.buildQueue = []; // [{ type, x, y }]
    }

    clearBuildQueue() {
        if (this.buildQueue.length > 0) {
            this.buildQueue.forEach(task => {
                const buildInfo = this.engine.buildingRegistry[task.type];
                if (buildInfo) {
                    // 1. 자원 환불 (100%)
                    this.engine.resources.gold += buildInfo.cost;

                    // 2. 점유했던 타일 해제
                    const [tw, th] = buildInfo.size;
                    const tileInfo = this.engine.tileMap.getTileAt(task.x, task.y);
                    if (tileInfo) {
                        for (let dy = 0; dy > -th; dy--) {
                            for (let dx = 0; dx < tw; dx++) {
                                const nx = tileInfo.x + dx;
                                const ny = tileInfo.y + dy;
                                if (this.engine.tileMap.grid[ny] && this.engine.tileMap.grid[ny][nx]) {
                                    this.engine.tileMap.grid[ny][nx].occupied = false;
                                }
                            }
                        }
                    }
                }
            });
            this.buildQueue = [];
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (!this.alive) {
            // 죽었을 때도 예약된 건물을 취소하고 자원 반환
            this.clearBuildQueue();
            return;
        }

        // 건설 중이 아닌데 큐에 작업이 있다면 (다른 명령을 받았을 때)
        if (this.command !== 'build' && this.buildQueue.length > 0) {
            this.clearBuildQueue();
        }

        // 건설 로직 (작업 예약 방식)
        if (this.command === 'build' && this.buildQueue.length > 0) {
            const currentTask = this.buildQueue[0];
            const buildInfo = this.engine.buildingRegistry[currentTask.type];
            const [tw, th] = buildInfo ? buildInfo.size : [1, 1];
            
            // 건물 크기에 따른 판정 거리 계산 (타일 크기 기반)
            const targetDistX = (tw * 40) / 2 + this.size / 2 + 5;
            const targetDistY = (th * 40) / 2 + this.size / 2 + 5;
            
            const dx = Math.abs(this.x - currentTask.x);
            const dy = Math.abs(this.y - currentTask.y);
            
            // 타겟 위치에 인접했는지 확인 (박스 범위 기반)
            if (dx <= targetDistX && dy <= targetDistY) {
                // 인접 완료! 건설 실행
                this.engine.executeBuildingPlacement(currentTask.type, currentTask.x, currentTask.y);
                this.buildQueue.shift(); // 완료된 작업 제거
                
                if (this.buildQueue.length === 0) {
                    this.command = 'stop';
                }
            } else {
                this.destination = { x: currentTask.x, y: currentTask.y };
            }
        }

        // 수리 로직
        if (this.command === 'repair' && this.targetObject) {
            const dist = Math.hypot(this.x - this.targetObject.x, this.y - this.targetObject.y);
            const range = (this.size + (this.targetObject.width || this.targetObject.size || 40)) / 2 + 10;
            
            if (dist <= range) {
                if (this.targetObject.hp < this.targetObject.maxHp) {
                    this.targetObject.hp = Math.min(this.targetObject.maxHp, this.targetObject.hp + (this.repairRate * deltaTime / 1000));
                } else {
                    this.command = 'stop';
                    this.targetObject = null;
                }
            } else {
                this.destination = { x: this.targetObject.x, y: this.targetObject.y };
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2); // 2배 확대

        // 1. 몸체 (어두운 군용 작업복)
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // 2. 공병 포인트 - 형광 조끼 (High-Visibility Vest)
        ctx.fillStyle = '#f1c40f'; // 밝은 노란색
        ctx.fillRect(-3, -4, 6, 8);
        ctx.fillStyle = '#fff'; // 반사 띠
        ctx.fillRect(-3, -1, 6, 1);

        // 3. 도구 배낭 (Tool Backpack)
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-7, -5, 4, 10);

        // 4. 수리용 멀티툴 (총 대신 들고 있는 대형 렌치/집게)
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(2, -2, 10, 4); // 툴 본체
        // 툴 끝부분 (집게 모양)
        ctx.beginPath();
        ctx.moveTo(12, -3); ctx.lineTo(15, -3); ctx.lineTo(15, -1); ctx.lineTo(12, -1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(12, 1); ctx.lineTo(15, 1); ctx.lineTo(15, 3); ctx.lineTo(12, 3);
        ctx.fill();
        
        // 5. 공병 포인트 - 노란색 안전 헬멧
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        // 헬멧 챙
        ctx.fillRect(0, -4, 5, 1);

        ctx.restore();

        // 수리 이펙트 (불꽃)
        if (this.command === 'repair' && this.targetObject) {
            const dist = Math.hypot(this.x - this.targetObject.x, this.y - this.targetObject.y);
            const range = (this.size + (this.targetObject.width || this.targetObject.size || 40)) / 2 + 15;
            if (dist <= range) {
                for(let i=0; i<3; i++) {
                    ctx.fillStyle = Math.random() > 0.5 ? '#f1c40f' : '#e67e22';
                    ctx.beginPath();
                    ctx.arc(this.x + Math.cos(this.angle)*15 + (Math.random()-0.5)*10, 
                            this.y + Math.sin(this.angle)*15 + (Math.random()-0.5)*10, 2, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
    }
}

export class Barracks extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'barracks';
        this.name = '병영';
        this.width = 80;
        this.height = 80;
        this.size = 80;
        this.maxHp = 1000;
        this.hp = 1000;
        this.isPowered = false;
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 3000; // 보병은 생산 속도가 빠름 (3초)
        this.units = [];
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        this.units = this.units.filter(u => u.alive);

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 45; 
                let unit = new Rifleman(this.x, spawnY, engine);
                
                unit.destination = { x: this.x, y: this.y + 80 };
                
                this.units.push(unit);
                engine.entities.units.push(unit);
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 1. 건물 메인 바디 (어두운 군색)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-40, -40, 80, 80);
        ctx.strokeStyle = '#1e272e';
        ctx.lineWidth = 2;
        ctx.strokeRect(-40, -40, 80, 80);

        // 2. 카모플라쥬 패턴 (데코레이션)
        ctx.fillStyle = '#3b4d3c';
        ctx.fillRect(-35, -35, 20, 15);
        ctx.fillRect(10, -25, 25, 20);
        ctx.fillRect(-30, 10, 15, 25);
        ctx.fillRect(5, 5, 20, 15);

        // 3. 지붕 디자인 (경사진 막사 지붕)
        ctx.fillStyle = '#4a5d4b';
        ctx.beginPath();
        ctx.moveTo(-45, -30);
        ctx.lineTo(0, -50);
        ctx.lineTo(45, -30);
        ctx.lineTo(40, -25);
        ctx.lineTo(-40, -25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 4. 창고형 문 및 입구
        ctx.fillStyle = '#111';
        ctx.fillRect(-20, 10, 40, 30);
        ctx.strokeStyle = this.isPowered ? '#39ff14' : '#ff3131';
        ctx.lineWidth = 2;
        ctx.strokeRect(-20, 10, 40, 30);
        
        // 문 장식 (셔터 느낌)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for(let i = 15; i < 40; i += 5) {
            ctx.beginPath();
            ctx.moveTo(-18, i);
            ctx.lineTo(18, i);
            ctx.stroke();
        }

        // 5. 창문 (작고 빛나는 느낌)
        const drawWindow = (wx, wy) => {
            ctx.fillStyle = this.isPowered ? 'rgba(0, 210, 255, 0.3)' : '#111';
            ctx.fillRect(wx, wy, 12, 8);
            ctx.strokeStyle = '#555';
            ctx.strokeRect(wx, wy, 12, 8);
            if (this.isPowered) {
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#00d2ff';
                ctx.fillStyle = '#00d2ff';
                ctx.fillRect(wx + 2, wy + 2, 8, 4);
                ctx.shadowBlur = 0;
            }
        };
        drawWindow(-32, -15);
        drawWindow(20, -15);

        // 6. 환풍기 또는 안테나
        ctx.fillStyle = '#555';
        ctx.fillRect(25, -45, 4, 15);
        ctx.beginPath();
        ctx.arc(27, -45, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // HP 바
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 30, this.y - 65, 60, 5);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 30, this.y - 65, (this.hp / this.maxHp) * 60, 5);
        }

        // 생산 대기열 표시
        if (this.spawnQueue.length > 0) {
            const barY = this.y - 75;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 40, barY, 80, 8);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 40, barY, 80 * progress, 8);
            ctx.shadowBlur = 0;
        }
    }
}

export class Armory extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'armory';
        this.name = '병기창';
        this.size = 80;
        this.width = 80;
        this.height = 80;
        this.maxHp = 1500;
        this.hp = 1500;
        this.isPowered = false;
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 5000; // 유닛당 5초
        this.units = []; // 생산한 유닛들
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        this.units = this.units.filter(u => u.alive);

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 45; // 병기창 아래쪽 문 앞
                let unit;
                if (current.type === 'tank') unit = new Tank(this.x, spawnY, engine);
                else unit = new MissileLauncher(this.x, spawnY, engine);
                
                // 생성되자마자 문 밖으로 조금 더 나가도록 목적지 설정 (건물 겹침 방지)
                unit.destination = { x: this.x, y: this.y + 80 };
                
                this.units.push(unit);
                engine.entities.units.push(unit);
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 건물 베이스
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-40, -40, 80, 80);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.strokeRect(-40, -40, 80, 80);
        
        // 지붕 장식
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-30, -30, 60, 20);
        ctx.strokeStyle = '#555';
        for(let i=0; i<4; i++) {
            ctx.strokeRect(-30 + i*15, -30, 15, 20);
        }

        // 출입구
        ctx.fillStyle = '#111';
        ctx.fillRect(-20, 10, 40, 30);
        ctx.strokeStyle = this.isPowered ? '#00ffcc' : '#444';
        ctx.strokeRect(-20, 10, 40, 30);

        // 상태 표시등
        ctx.fillStyle = this.isPowered ? '#39ff14' : '#ff3131';
        ctx.beginPath(); ctx.arc(-30, 30, 4, 0, Math.PI * 2); ctx.fill();

        ctx.restore();

        // HP 바
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 30, this.y - 65, 60, 5);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 30, this.y - 65, (this.hp / this.maxHp) * 60, 5);
        }

        // 상세 생산 대기열 표시
        if (this.spawnQueue.length > 0) {
            const barY = this.y - 75;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 40, barY, 80, 8);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 40, barY, 80 * progress, 8);
            
            // 종류별 합산
            const counts = this.spawnQueue.reduce((acc, curr) => {
                acc[curr.type] = (acc[curr.type] || 0) + 1;
                return acc;
            }, {});
            
            const labels = [];
            if (counts.tank) labels.push(`전차 x${counts.tank}`);
            if (counts.missile) labels.push(`미사일 x${counts.missile}`);
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 4; ctx.shadowColor = '#000';
            
            // 레이블을 위아래로 쌓아서 표시
            labels.reverse().forEach((label, i) => {
                ctx.fillText(label, this.x, barY - 20 - (i * 14));
            });
            ctx.fillText('생산 중', this.x, barY - 5);
            
            ctx.shadowBlur = 0;
        }
    }
}

export class Airport extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'airport';
        this.name = '공항';
        this.width = 80;
        this.height = 120;
        this.size = 80;
        this.maxHp = 2000;
        this.hp = 2000;
        this.color = '#aaaaaa';
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-40, -60, 80, 120);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.strokeRect(-40, -60, 80, 120);
        ctx.fillStyle = '#1a1c23';
        ctx.fillRect(-10, -55, 20, 110);
        ctx.strokeStyle = '#ffff00';
        ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(0, 50); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#444';
        ctx.fillRect(-35, -20, 25, 50);
        ctx.strokeStyle = '#888'; ctx.strokeRect(-35, -20, 25, 50);
        ctx.fillStyle = '#666';
        ctx.fillRect(15, -40, 15, 15);
        ctx.fillStyle = '#00d2ff';
        ctx.shadowBlur = 5; ctx.shadowColor = '#00d2ff';
        ctx.fillRect(17, -38, 11, 5);
        ctx.shadowBlur = 0;
        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 30, this.y - 75, 60, 5);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 30, this.y - 75, (this.hp / this.maxHp) * 60, 5);
        }
    }
}

export class ScoutPlane extends Entity {

    constructor(startX, startY, targetX, targetY, engine) {

        super(startX, startY);

        this.engine = engine;

        this.targetX = targetX;

        this.targetY = targetY;

        this.speed = 5;

        this.angle = Math.atan2(targetY - startY, targetX - startX);

        this.arrived = false;

        this.revealRadius = 20;

        this.alive = true;

        this.returning = false;

        this.homeX = startX;

        this.homeY = startY;

    }



    update(deltaTime) {

        if (!this.alive) return;

        const tx = this.returning ? this.homeX : this.targetX;

        const ty = this.returning ? this.homeY : this.targetY;

        const d = Math.hypot(tx - this.x, ty - this.y);

        if (d < 10) {

            if (!this.returning) {

                this.revealFog();

                this.returning = true;

                this.angle = Math.atan2(this.homeY - this.y, this.homeX - this.x);

            } else {

                this.alive = false;

            }

        }

        else {

            this.x += Math.cos(this.angle) * this.speed;

            this.y += Math.sin(this.angle) * this.speed;

        }

    }



    revealFog() {

        const radius = this.revealRadius;

        const grid = this.engine.tileMap.worldToGrid(this.x, this.y);

        for (let dy = -radius; dy <= radius; dy++) {

            for (let dx = -radius; dx <= radius; dx++) {

                const nx = grid.x + dx;

                const ny = grid.y + dy;

                if (nx >= 0 && nx < this.engine.tileMap.cols && ny >= 0 && ny < this.engine.tileMap.rows) {

                    if (dx * dx + dy * dy <= radius * radius) {

                        this.engine.tileMap.grid[ny][nx].visible = true;

                    }

                }

            }

        }

    }



    draw(ctx) {

        if (!this.alive) return;

        ctx.save();

        ctx.translate(this.x, this.y);

        ctx.rotate(this.angle);

        ctx.fillStyle = '#fff';

        ctx.beginPath();

        ctx.moveTo(10, 0);

        ctx.lineTo(-10, -6);

        ctx.lineTo(-6, 0);

        ctx.lineTo(-10, 6);

        ctx.closePath();

        ctx.fill();

        ctx.fillRect(-2, -12, 4, 24);

        ctx.restore();

    }

}



export class CargoPlane extends Entity {

    constructor(storage, engine) {

        super(storage.x, storage.y);

        this.storage = storage;

        this.engine = engine;

        this.speed = 3;

        this.state = 'loading'; // loading, flying_to_base, unloading, flying_to_storage

        this.capacity = 100;

        this.payload = { gold: 0, oil: 0 };

        this.targetX = storage.x;

        this.targetY = storage.y;

        this.angle = 0;

        this.alive = true;

        this.size = 20;

    }



    update(deltaTime) {

        const base = this.engine.entities.base;

        if (!this.storage.active || this.storage.hp <= 0) {

            this.state = 'flying_to_base'; // 창고 파괴 시 일단 기지로 복귀 후 소멸

        }



        switch (this.state) {

            case 'loading':

                // 창고에서 자원 적재 (즉시 처리)

                const totalStored = this.storage.storedResources.gold + this.storage.storedResources.oil;

                if (totalStored > 0) {

                    const ratio = Math.min(1, this.capacity / totalStored);

                    this.payload.gold = this.storage.storedResources.gold * ratio;

                    this.payload.oil = this.storage.storedResources.oil * ratio;

                    this.storage.storedResources.gold -= this.payload.gold;

                    this.storage.storedResources.oil -= this.payload.oil;

                    this.state = 'flying_to_base';

                }

                break;



            case 'flying_to_base':

                this.moveTo(base.x, base.y, () => {

                    this.state = 'unloading';

                });

                break;



            case 'unloading':

                // 기지에 자원 하역

                this.engine.resources.gold += this.payload.gold;

                this.engine.resources.oil += this.payload.oil;

                this.payload = { gold: 0, oil: 0 };

                if (!this.storage.active || this.storage.hp <= 0) {

                    this.alive = false; // 창고 없으면 기지에서 소멸

                } else {

                    this.state = 'flying_to_storage';

                }

                break;



            case 'flying_to_storage':

                this.moveTo(this.storage.x, this.storage.y, () => {

                    this.state = 'loading';

                });

                break;

        }

    }



    moveTo(tx, ty, onArrive) {

        const d = Math.hypot(tx - this.x, ty - this.y);

        if (d < 5) {

            onArrive();

        } else {

            this.angle = Math.atan2(ty - this.y, tx - this.x);

            this.x += Math.cos(this.angle) * this.speed;

            this.y += Math.sin(this.angle) * this.speed;

        }

    }



            draw(ctx) {



                ctx.save();



                ctx.translate(this.x, this.y);



                ctx.rotate(this.angle);



                



                // 1. 주날개 (직선적이고 튼튼한 형태)



                ctx.fillStyle = '#7f8c8d';



                ctx.strokeStyle = '#34495e';



                ctx.lineWidth = 1;



                ctx.fillRect(-2, -30, 8, 60); // 긴 직사각형 날개



                ctx.strokeRect(-2, -30, 8, 60);



        



                // 2. 엔진 및 프로펠러 (비행기 느낌의 핵심)



                const time = Date.now();



                const propAngle = (time / 50) % (Math.PI * 2); // 프로펠러 회전 각도



                



                const drawEngine = (ey) => {



                    ctx.fillStyle = '#555';



                    ctx.fillRect(2, ey - 4, 10, 8); // 엔진 몸체



                    ctx.strokeRect(2, ey - 4, 10, 8);



                    



                    // 프로펠러 회전 효과



                    ctx.save();



                    ctx.translate(12, ey);



                    ctx.rotate(propAngle);



                    ctx.strokeStyle = '#333';



                    ctx.lineWidth = 2;



                    ctx.beginPath();



                    ctx.moveTo(-6, 0); ctx.lineTo(6, 0); // 날개 1



                    ctx.moveTo(0, -6); ctx.lineTo(0, 6); // 날개 2



                    ctx.stroke();



                    ctx.restore();



                };



                drawEngine(-18); // 왼쪽 날개 엔진



                drawEngine(18);  // 오른쪽 날개 엔진



        



                // 3. 동체 (Fuselage - 더 길고 원통형에 가까운 형태)



                const bodyGrd = ctx.createLinearGradient(0, -12, 0, 12);



                bodyGrd.addColorStop(0, '#bdc3c7');



                bodyGrd.addColorStop(0.5, '#95a5a6');



                bodyGrd.addColorStop(1, '#7f8c8d');



                ctx.fillStyle = bodyGrd;



                



                // 앞코는 약간 둥글게, 몸통은 직사각형



                ctx.beginPath();



                ctx.moveTo(22, 0);



                ctx.quadraticCurveTo(22, -10, 15, -10); // 둥근 코



                ctx.lineTo(-18, -10); // 왼쪽 면



                ctx.lineTo(-18, 10);  // 뒷면



                ctx.lineTo(15, 10);   // 오른쪽 면



                ctx.quadraticCurveTo(22, 10, 22, 0);  // 둥근 코



                ctx.fill();



                ctx.stroke();



        



                // 4. 수평 꼬리날개 (Horizontal Stabilizers)



                ctx.fillStyle = '#7f8c8d';



                ctx.fillRect(-22, -12, 6, 24);



                ctx.strokeRect(-22, -12, 6, 24);



        



                // 5. 수직 꼬리날개 (Vertical Fin - 위에서 본 모습)



                ctx.strokeStyle = '#34495e';



                ctx.lineWidth = 2;



                ctx.beginPath();



                ctx.moveTo(-18, 0);



                ctx.lineTo(-25, 0);



                ctx.stroke();



        



                // 6. 조종석 창 (앞부분에 위치)



                ctx.fillStyle = '#2c3e50';



                ctx.fillRect(12, -6, 4, 12);



        



                // 7. 항행등 (Blinking)



                if (Math.floor(time / 500) % 2 === 0) {



                    ctx.fillStyle = '#ff3131';



                    ctx.beginPath(); ctx.arc(-2, -30, 2, 0, Math.PI * 2); ctx.fill();



                    ctx.fillStyle = '#39ff14';



                    ctx.beginPath(); ctx.arc(-2, 30, 2, 0, Math.PI * 2); ctx.fill();



                }



        



                // 8. 화물 표시 (동체 내부가 비치는 느낌)



                if (this.payload.gold > 0 || this.payload.oil > 0) {



                    const resColor = this.payload.gold > this.payload.oil ? '#FFD700' : '#9370DB';



                    ctx.fillStyle = resColor;



                    ctx.globalAlpha = 0.6;



                    ctx.fillRect(-10, -6, 15, 12);



                    ctx.globalAlpha = 1.0;



                }



                



                ctx.restore();



            }

}

export class Enemy extends Entity {
    constructor(x, y) {
        super(x, y);
        this.speed = 1.8;
        this.maxHp = 50;
        this.hp = this.maxHp;
        this.size = 40; // 20 -> 40
        this.damage = 10;
        this.attackRange = 35;
        this.attackInterval = 1000;
        this.lastAttackTime = 0;
        this.currentTarget = null;
    }

    update(deltaTime, base, buildings) {
        if (!base) return;
        const now = Date.now();
        const angleToBase = Math.atan2(base.y - this.y, base.x - this.x);
        let nextX = this.x + Math.cos(angleToBase) * this.speed;
        let nextY = this.y + Math.sin(angleToBase) * this.speed;
        let blockedBy = null;
        const distToBase = Math.hypot(this.x - base.x, this.y - base.y);
        if (distToBase <= this.attackRange) {
            blockedBy = base;
        } else {
            for (const obs of buildings) {
                // 전선과 파이프라인은 여전히 통과 가능하게 두되, 자원은 통과 대상에서 제외(충돌 발생)
                if (['power-line', 'pipe-line'].includes(obs.type)) continue;
                if (obs === base) continue;
                const dNext = Math.hypot(nextX - obs.x, nextY - obs.y);
                const minDist = (this.size / 2) + (obs.size / 2) + 2;
                if (dNext < minDist) {
                    blockedBy = obs;
                    break;
                }
            }
        }
        if (!blockedBy) {
            this.x = nextX;
            this.y = nextY;
            this.currentTarget = base;
        } else {
            this.currentTarget = blockedBy;
        }
        if (this.currentTarget && this.currentTarget.active && this.currentTarget.hp > 0) {
            const attackDist = Math.hypot(this.x - this.currentTarget.x, this.y - this.currentTarget.y);
            const rangeThreshold = (this.currentTarget === base) ? this.attackRange + 5 : (this.size/2 + this.currentTarget.size/2 + 5);
            if (attackDist <= rangeThreshold) {
                if (now - this.lastAttackTime > this.attackInterval) {
                    this.currentTarget.hp -= this.damage;
                    this.lastAttackTime = now;
                    if (this.currentTarget === base && this.currentTarget.hp <= 0) {
                        this.currentTarget.active = false;
                    }
                }
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#ff3131';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2); ctx.fill();
        const barY = this.y + this.size / 2 + 5;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 10, barY, 20, 3);
        ctx.fillStyle = '#ff3131';
        ctx.fillRect(this.x - 10, barY, (this.hp / this.maxHp) * 20, 3);
    }
}

export class Projectile extends Entity {
    constructor(x, y, target, damage, color = '#ffff00') {
        super(x, y);
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.speed = 8;
        this.size = 6;
    }

    update(deltaTime) {
        if (!this.target || !this.target.active) {
            this.active = false;
            return;
        }
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
        if (Math.hypot(this.x - this.target.x, this.y - this.target.y) < 15) {
            this.target.hp -= this.damage;
            if (this.target.hp <= 0) this.target.active = false;
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
}

export class Resource extends Entity {
    constructor(x, y, type = 'ore') {
        super(x, y);
        this.type = type;
        this.size = 25;
        this.initType();
    }

    initType() {
        switch (this.type) {
            case 'coal': this.color = '#333333'; this.name = '석탄'; break;
            case 'oil': this.color = '#2F4F4F'; this.name = '석유'; break;
            case 'gold': this.color = '#FFD700'; this.name = '금'; break;
            default: this.color = '#778899'; this.name = '자원'; break;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * (this.size / 2);
            const py = Math.sin(angle) * (this.size / 2);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }
}