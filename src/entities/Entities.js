export class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
    }
}

export class Base extends Entity {
    constructor(x, y) {
        super(x, y);
        this.maxHp = 99999999;
        this.hp = 99999999;
        this.size = 30;
    }

    draw(ctx) {
        ctx.fillStyle = '#00d2ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00d2ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // HP Bar (Top)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(this.x - 20, this.y - 25, 40, 5);
        ctx.fillStyle = '#00d2ff';
        ctx.fillRect(this.x - 20, this.y - 25, (this.hp / this.maxHp) * 40, 5);
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

export class Substation extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'substation';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 100;
        this.hp = 100;
        this.isPowered = false;
        this.color = '#00ffcc';
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#333';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = this.isPowered ? this.color : '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);
        const coreHeight = 16;
        const chargeLevel = this.isPowered ? (Math.sin(Date.now() / 200) * 0.2 + 0.8) : 0.2;
        ctx.fillStyle = '#222';
        ctx.fillRect(-6, -8, 12, coreHeight);
        if (this.isPowered) {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            const h = coreHeight * chargeLevel;
            ctx.fillRect(-6, 8 - h, 12, h);
        }
        ctx.fillStyle = '#666';
        ctx.fillRect(-3, -10, 6, 2);
        ctx.restore();

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 12, this.y - 20, 24, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - 12, this.y - 20, (this.hp / this.maxHp) * 24, 3);
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
                    const transmitterTypes = ['power-line', 'generator', 'coal-generator', 'oil-generator', 'substation', 'base', 'airport', 'refinery', 'gold-mine', 'storage', 'armory'];
                    const isTransmitter = transmitterTypes.includes(other.type) || (other.maxHp === 99999999);
                    
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

export class PatrolUnit extends Entity {
    constructor(x, y, armory, engine) {
        super(x, y);
        this.armory = armory;
        this.engine = engine;
        this.patrolRadius = 450; 
        this.attackRange = 250; 
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 1;
        this.target = null;
        this.lastFireTime = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.alive = true;
        this.size = 20;
        this.damage = 0; // 하위 클래스에서 정의
    }

    update(deltaTime) {
        if (!this.alive) return;

        const enemies = this.engine.entities.enemies;
        let bestTarget = null;
        let minDistToMe = Infinity;
        
        // 1. 타겟 탐색 (병기창 보호 반경 내에 있는 모든 적 인식)
        const radius = this.patrolRadius; 
        for (const e of enemies) {
            const distToArmory = Math.hypot(e.x - this.armory.x, e.y - this.armory.y);
            // 보호 구역 안에만 있으면 일단 '인식' 가능
            if (distToArmory <= radius) {
                const distToMe = Math.hypot(e.x - this.x, e.y - this.y);
                if (distToMe < minDistToMe) {
                    minDistToMe = distToMe;
                    bestTarget = e;
                }
            }
        }
        this.target = bestTarget;

        // 2. 이동 및 공격 로직
        if (this.target) {
            const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.angle = angleToTarget;
            const distToMe = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            
            // 내 공격 사거리보다 멀리 있으면 추격
            if (distToMe > this.attackRange * 0.9) {
                const nextX = this.x + Math.cos(this.angle) * this.speed;
                const nextY = this.y + Math.sin(this.angle) * this.speed;
                const nextDistToArmory = Math.hypot(nextX - this.armory.x, nextY - this.armory.y);

                // 추격하되 병기창 보호 구역을 넘지는 않음
                if (nextDistToArmory <= radius) {
                    this.x = nextX;
                    this.y = nextY;
                }
            }
            
            // 사거리 안에 있으면 공격
            if (distToMe <= this.attackRange) {
                this.attack();
            }
        } else {
            // 적이 없을 때: 순찰 로직 (기존과 동일)
            const distToHome = Math.hypot(this.x - this.armory.x, this.y - this.armory.y);
            if (distToHome > radius - 30) {
                const angleToHome = Math.atan2(this.armory.y - this.y, this.armory.x - this.x);
                this.angle = angleToHome + (Math.random() - 0.5);
            } else if (Math.random() < 0.02) {
                this.angle += (Math.random() - 0.5) * 2;
            }
            
            const nextX = this.x + Math.cos(this.angle) * (this.speed * 0.6);
            const nextY = this.y + Math.sin(this.angle) * (this.speed * 0.6);
            if (Math.hypot(nextX - this.armory.x, nextY - this.armory.y) <= radius) {
                this.x = nextX;
                this.y = nextY;
            }
        }

        if (this.hp <= 0) this.alive = false;
    }

    attack() {}
}

export class Tank extends PatrolUnit {
    constructor(x, y, armory, engine) {
        super(x, y, armory, engine);
        this.type = 'tank';
        this.name = '전차';
        this.speed = 1.2;
        this.fireRate = 1000;
        this.damage = 25;
        this.color = '#39ff14';
        this.attackRange = 80; 
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

export class MissileLauncher extends PatrolUnit {
    constructor(x, y, armory, engine) {
        super(x, y, armory, engine);
        this.type = 'missile-launcher';
        this.name = '이동식 미사일 발사대';
        this.speed = 0.8;
        this.fireRate = 2500;
        this.damage = 70;
        this.color = '#ff3131';
        this.patrolRadius = 660; 
        this.attackRange = 400; 
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

export class Armory extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'armory';
        this.size = 80;
        this.width = 80;
        this.height = 80;
        this.maxHp = 1500;
        this.hp = 1500;
        this.isPowered = false;
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 5000; // 유닛당 5초
        this.units = []; // 생산한 유닛들
        this.maxUnits = 4;
        this.patrolRadius = 450; // 150 -> 450 (3배 확대)
    }

    requestUnit(unitType) {
        if (this.units.length + this.spawnQueue.length < this.maxUnits) {
            this.spawnQueue.push({ type: unitType, timer: 0 });
            return true;
        }
        return false;
    }

    update(deltaTime, engine) {
        this.units = this.units.filter(u => u.alive);

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                let unit;
                if (current.type === 'tank') unit = new Tank(this.x, this.y, this, engine);
                else unit = new MissileLauncher(this.x, this.y, this, engine);
                
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
    constructor(x, y, wave) {
        super(x, y);
        this.speed = 1.5 + (wave * 0.15);
        this.maxHp = 20 + (wave * 10);
        this.hp = this.maxHp;
        this.size = 20;
        this.damage = 5 + (wave * 2);
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
                if (['ore', 'coal', 'oil', 'gold', 'power-line', 'pipe-line'].includes(obs.type)) continue;
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