export class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.width = 40;  // Default 1x1
        this.height = 40; // Default 1x1
        this.size = 40;   // Default for circles
        this.domain = 'ground'; // 'ground', 'air', 'sea' (기본값 지상)
        this.attackTargets = ['ground', 'sea']; // 공격 가능 대상 (기본값 지상/해상)
        
        // 건설 관련 속성
        this.isUnderConstruction = false;
        this.buildProgress = 0; // 0 to 1
        this.totalBuildTime = 0;
        this.targetResource = null; // 건설 중인 자원 객체 보관용
    }

    // 대상이 이 주체(Entity/Projectile)로부터 피해를 입을 수 있는지 확인
    canDamage(target) {
        if (!target || !target.active || target.hp === undefined) return false;
        // 공격 대상의 domain이 나의 attackTargets 목록에 포함되어 있는지 확인
        return this.attackTargets.includes(target.domain);
    }

    drawConstruction(ctx) {
        if (!this.isUnderConstruction) return;
        
        const w = this.width || this.size || 40;
        const h = this.height || this.size || 40;
        
        // 1. 건설 부지 가이드 (점선)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(this.x - w/2, this.y - h/2, w, h);
        
        // 2. 진행 바
        const barW = w * 0.8;
        const barH = 6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barW/2, this.y + h/2 + 5, barW, barH);
        ctx.fillStyle = '#f1c40f'; // 건설은 노란색
        ctx.fillRect(this.x - barW/2, this.y + h/2 + 5, barW * this.buildProgress, barH);
        ctx.restore();
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
        this.width = 200;  // 5x5 tiles
        this.height = 200; // 5x5 tiles
        this.size = 200;
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 1000;
        this.isGenerator = true; // 전력 생산 가능
        this.powerOutput = 500;  // 기본 제공 전력량
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
                const spawnY = this.y + 110; // 5x5 건물 남쪽 출입구
                let unit = new CombatEngineer(this.x, spawnY, engine);
                unit.destination = { x: this.x, y: this.y + 150 };
                engine.entities.units.push(unit);
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 거대 하부 요새 플랫폼 (강화 콘크리트 - 밝은 회색)
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        const b = 95; // 플랫폼 크기
        ctx.moveTo(-b, -b+20); ctx.lineTo(-b+20, -b); ctx.lineTo(b-20, -b); ctx.lineTo(b, -b+20);
        ctx.lineTo(b, b-20); ctx.lineTo(b-20, b); ctx.lineTo(-b+20, b); ctx.lineTo(-b, b-20);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 플랫폼 위 구획선 (군용 패널)
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for(let i=-80; i<=80; i+=40) {
            ctx.beginPath(); ctx.moveTo(i, -90); ctx.lineTo(i, 90); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-90, i); ctx.lineTo(90, i); ctx.stroke();
        }

        // 2. 외곽 방어선 - 모래주머니 및 방벽 (네 구석)
        const drawDefenses = (dx, dy) => {
            ctx.save();
            ctx.translate(dx, dy);
            // 방벽
            ctx.fillStyle = '#4b5320'; // Olive Drab
            ctx.fillRect(-25, -25, 50, 50);
            ctx.strokeStyle = '#2d3310';
            ctx.strokeRect(-25, -25, 50, 50);
            // 모래주머니 (베이지색 작은 곡선들)
            ctx.fillStyle = '#c2b280';
            for(let i=0; i<3; i++) {
                ctx.beginPath(); ctx.arc(-20 + i*15, 30, 8, 0, Math.PI, true); ctx.fill();
                ctx.beginPath(); ctx.arc(-20 + i*15, -30, 8, Math.PI, 0, true); ctx.fill();
            }
            ctx.restore();
        };
        drawDefenses(-70, -70); drawDefenses(70, -70);
        drawDefenses(-70, 70);  drawDefenses(70, 70);

        // 3. 메인 지휘소 건물 (십자형 강화 빌딩)
        ctx.fillStyle = '#bdc3c7'; // 주 건재색
        // 십자 형태 본체
        ctx.fillRect(-60, -30, 120, 60);
        ctx.fillRect(-30, -60, 60, 120);
        ctx.strokeStyle = '#7f8c8d';
        ctx.strokeRect(-60, -30, 120, 60);
        ctx.strokeRect(-30, -60, 60, 120);

        // 중앙 지휘탑 (3층 구조)
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(-35, -35, 70, 70);
        ctx.strokeRect(-35, -35, 70, 70);
        
        // 옥상 기계 설비 (환풍기, 실외기 등)
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(10, 10, 15, 15); // AC Unit 1
        ctx.fillRect(-25, 10, 15, 15); // AC Unit 2
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(17.5, 17.5, 4, 0, Math.PI*2); ctx.fill(); // 팬

        // 4. 현대식 통신 어레이 (진짜 안테나 숲)
        // 메인 통신 마스트 (중앙)
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-2, -55, 4, 40);
        // 안테나 가로대
        for(let i=0; i<3; i++) {
            ctx.beginPath(); ctx.moveTo(-15, -50 + i*10); ctx.lineTo(15, -50 + i*10);
            ctx.strokeStyle = '#34495e'; ctx.stroke();
        }

        // 위성 통신 접시 (SE)
        ctx.save();
        ctx.translate(45, 45);
        ctx.rotate(Math.sin(Date.now()/3000)*0.2);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0.5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#bdc3c7'; ctx.stroke();
        ctx.restore();

        // 5. 입구 광장 및 국기 게양대
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(-20, 80, 40, 20); // 진입 램프
        
        // 국기 게양대 (작은 디테일)
        ctx.fillStyle = '#333';
        ctx.fillRect(-30, 70, 2, 25); // 깃대
        ctx.fillStyle = '#c0392b'; // 펄럭이는 깃발 느낌
        ctx.fillRect(-30, 70, 10, 6);

        // 6. 야간 작전용 항공 장애등 (Red Safety Lights)
        const blink = Math.sin(Date.now() / 600) > 0;
        ctx.fillStyle = blink ? '#ff0000' : '#440000';
        const lightPos = [[-55, -25], [55, -25], [0, -55], [-30, 55], [30, 55]];
        lightPos.forEach(p => {
            ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI*2); ctx.fill();
        });

        ctx.restore();

        // UI (HP & 생산)
        const barWidth = 180;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(this.x - barWidth/2, this.y - 125, barWidth, 10);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barWidth/2, this.y - 125, (this.hp / this.maxHp) * barWidth, 10);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - barWidth/2, this.y - 125, barWidth, 10);

        if (this.spawnQueue.length > 0) {
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(this.x - 60, this.y - 140, 120, 8);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(this.x - 60, this.y - 140, 120 * progress, 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`공병 대기 중...`, this.x, this.y - 145);
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
        this.attackTargets = ['ground', 'sea']; // 기본 지상 공격
        switch (this.type) {
            case 'turret-fast':
                this.range = 150;
                this.damage = 5;
                this.fireRate = 400; // 빨름
                this.color = '#39ff14'; // 네온 그린
                this.attackTargets = ['ground', 'sea', 'air']; // 머신건 타입은 공중 공격 가능
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
                this.attackTargets = ['ground', 'sea', 'air']; // 전기는 공중 전이 가능
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
                this.attackTargets = ['ground', 'sea', 'air']; // 기본 포탑 공중 공격 허용
                break;
        }
    }

    update(deltaTime, enemies, projectiles) {
        if (!this.isPowered || this.isUnderConstruction) return; // 건설 중이거나 전기가 없으면 작동 중지
        const now = Date.now();

        // 타겟 찾기 (가장 가까운 적 중 나의 공격 가능 영역에 있는 대상)
        if (!this.target || !this.target.active || this.dist(this.target) > this.range || !this.canDamage(this.target)) {
            this.target = null;
            let minDist = this.range;
            for (const enemy of enemies) {
                if (!this.canDamage(enemy)) continue; // 공격 불가능한 영역(공중 등)이면 패스
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
                        // 화염방사기도 공격 가능 대상만 타격
                        if (!this.canDamage(enemy)) return;
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
        projectiles.push(new Projectile(this.x, this.y, this.target, this.damage, this.color, this));
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }

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

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 25, (this.hp / this.maxHp) * 30, 3);
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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
    }
}

export class Wall extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'wall';
        this.name = '철조망';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 200; // 벽보다 내구도 하향
        this.hp = 200;
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 바닥 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-18, 5, 36, 12);

        // 2. 수직 지지대 (Posts - 2.5D)
        const drawPost = (px, py) => {
            const pHeight = 25;
            // 벽면 (깊이)
            ctx.fillStyle = '#3a2a1a'; // 어두운 나무색
            ctx.fillRect(px, py - pHeight, 4, pHeight);
            // 앞면
            ctx.fillStyle = '#5d4037'; // 밝은 나무색
            ctx.fillRect(px - 2, py - pHeight - 2, 4, pHeight);
            // 윗면 (입체)
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(px - 2, py - pHeight - 2, 4, 2);
        };

        drawPost(-15, 10); // 좌측 기둥
        drawPost(15, 10);  // 우측 기둥

        // 3. 가시 철사 (Barbed Wires - X자 교차)
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 1]); // 가시 느낌을 위한 점선

        // 상단 가로선
        ctx.beginPath();
        ctx.moveTo(-15, -12); ctx.lineTo(15, -12);
        ctx.stroke();

        // 중앙 X자 교차선
        ctx.beginPath();
        ctx.moveTo(-15, -12); ctx.lineTo(15, 8);
        ctx.moveTo(15, -12); ctx.lineTo(-15, 8);
        ctx.stroke();

        // 하단 가로선
        ctx.beginPath();
        ctx.moveTo(-15, 8); ctx.lineTo(15, 8);
        ctx.stroke();

        ctx.setLineDash([]);

        // 4. 가시 디테일 (작은 점들)
        ctx.fillStyle = '#bdc3c7';
        for(let i=0; i<5; i++) {
            const tx = -15 + i*7.5;
            ctx.fillRect(tx, -13, 2, 2);
            ctx.fillRect(tx, 7, 2, 2);
        }

        ctx.restore();

        // HP 바
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 25, (this.hp / this.maxHp) * 30, 3);
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
        this.maxFuel = 500;
        this.fuel = 500;
    }

    update(deltaTime) {
        if (this.fuel > 0) {
            this.fuel -= deltaTime / 1000;
            if (this.fuel < 0) this.fuel = 0;
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

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
        this.maxFuel = 800;
        this.fuel = 800;
    }

    update(deltaTime) {
        if (this.fuel > 0) {
            this.fuel -= deltaTime / 1000;
            if (this.fuel < 0) this.fuel = 0;
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        ctx.restore();
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
        this.maxFuel = 800;
        this.fuel = 800;
        this.productionRate = 5;
        this.color = '#32cd32';
        this.isConnectedToBase = false; 
        this.connectedTarget = null;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

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
        this.maxFuel = 1000; // 자원 매장량
        this.fuel = 1000;
        this.productionRate = 8; // 초당 골드 생산량
        this.color = '#FFD700';
        this.isConnectedToBase = false;
        this.connectedTarget = null;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

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
        this.spawnTimeRequired = 1000; // 1초 (테스트용)
    }

    requestCargoPlane() {
        this.spawnQueue++;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
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
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        // 7. HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 30, this.y - 65, 60, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x -30, this.y - 65, (this.hp / this.maxHp) * 60, 5);

        // 8. 생산 대기열 표시 (HP 바 위로 위치 고정)
        if (this.spawnQueue > 0) {
            const barY = this.y - 75;
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
        this._destination = null; 
        this.path = []; // A* 경로 저장용
        this.pathRecalculateTimer = 0;
        this.command = 'stop'; // 'move', 'attack', 'patrol', 'stop', 'hold'
        this.patrolStart = null;
        this.patrolEnd = null;
        this.domain = 'ground'; // 'ground', 'air', 'sea'
        this.attackTargets = ['ground', 'sea']; // 공격 가능 대상
        this.canBypassObstacles = false; // 장애물(건물 등) 통과 가능 여부
    }

    get destination() { return this._destination; }
    set destination(value) {
        this._destination = value;
        if (value) {
            if (this.domain === 'air') {
                // 공중 유닛은 장애물을 무시하고 목적지까지 직선으로 비행
                this.path = [{ x: value.x, y: value.y }];
            } else {
                // 지상 유닛은 기존대로 A* 경로 탐색 수행
                this.path = this.engine.pathfinding.findPath(this.x, this.y, value.x, value.y, this.canBypassObstacles) || [];
                
                while (this.path.length > 0) {
                    const first = this.path[0];
                    if (Math.hypot(first.x - this.x, first.y - this.y) < 20) {
                        this.path.shift();
                    } else {
                        break;
                    }
                }
            }
            
            this.pathRecalculateTimer = 1000; 
        } else {
            this.path = [];
        }
    }

    update(deltaTime) {
        if (!this.alive) return;

        // 1. --- Command Logic & Targeting ---
        const enemies = this.engine.entities.enemies;
        let bestTarget = null;
        let minDistToMe = Infinity;

        let canActuallyAttack = (typeof this.attack === 'function' && this.damage > 0 && this.type !== 'engineer');
        if (this.type === 'missile-launcher') canActuallyAttack = false;

        if (canActuallyAttack && this.command !== 'move') {
            // 1. 수동 지정 타겟(manualTarget) 우선 확인 (중립 유닛 포함)
            if (this.manualTarget && (this.manualTarget.active !== false) && (this.manualTarget.hp > 0)) {
                const distToManual = Math.hypot(this.manualTarget.x - this.x, this.manualTarget.y - this.y);
                // 영역(domain) 체크
                const targetDomain = this.manualTarget.domain || 'ground';
                if (this.attackTargets.includes(targetDomain) && distToManual <= this.attackRange) {
                    bestTarget = this.manualTarget;
                }
            }

            // 2. 수동 타겟이 없거나 사거리 밖이면 자동 타겟팅 수행 (적군만)
            if (!bestTarget) {
                for (const e of enemies) {
                    const enemyDomain = e.domain || 'ground';
                    if (!this.attackTargets.includes(enemyDomain)) continue;

                    const distToMe = Math.hypot(e.x - this.x, e.y - this.y);
                    if (distToMe <= this.attackRange && distToMe < minDistToMe) {
                        minDistToMe = distToMe;
                        bestTarget = e;
                    }
                }
            }
        }
        this.target = bestTarget;

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.attack();
            if (this.command === 'attack') {
                this._destination = null; 
                this.path = [];
            }
        } else if (this._destination) {
            // 2. --- A* Path Following ---
            // 경로가 있고, 첫 번째 웨이포인트가 너무 가까우면(이미 도달했거나 겹침) 건너뜀
            while (this.path.length > 0) {
                const waypoint = this.path[0];
                const distToWaypoint = Math.hypot(waypoint.x - this.x, waypoint.y - this.y);
                
                // 웨이포인트 도달 판정 거리 (유동적)
                // 너무 가까우면 각도 계산이 튀므로 즉시 제거하고 다음 지점으로
                if (distToWaypoint < 15) { 
                    this.path.shift();
                } else {
                    break;
                }
            }

            if (this.path.length > 0) {
                const waypoint = this.path[0];
                // 부드러운 회전 대신 즉각적인 방향 전환 (RTS 스타일)
                // 필요하다면 보간(Lerp)을 넣을 수 있지만, 반응성을 위해 즉시 전환 유지
                this.angle = Math.atan2(waypoint.y - this.y, waypoint.x - this.x);
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
            } else {
                // 경로 끝에 도달했거나 경로가 없음
                const distToFinal = Math.hypot(this._destination.x - this.x, this._destination.y - this.y);
                if (distToFinal < 15) {
                    if (this.command === 'patrol') {
                        const temp = this.patrolStart;
                        this.patrolStart = this.patrolEnd;
                        this.patrolEnd = temp;
                        this.destination = this.patrolEnd;
                    } else {
                        this._destination = null;
                        if (this.command !== 'build') this.command = 'stop';
                    }
                } else {
                    // 경로가 없는데 아직 목적지 근처가 아니라면 재탐색 시도
                    this.pathRecalculateTimer -= deltaTime;
                    if (this.pathRecalculateTimer <= 0) {
                        this.destination = this._destination; // setter를 통해 경로 재계산
                    }
                }
            }
        }

        // --- Collision Avoidance (Local Avoidance) ---
        let pushX = 0;
        let pushY = 0;

        const allUnits = [...this.engine.entities.units, ...this.engine.entities.enemies, ...this.engine.entities.neutral];
        for (const other of allUnits) {
            if (other === this || (other.alive === false && other.hp <= 0)) continue;
            
            // 같은 영역(지상-지상, 공중-공중) 유닛끼리만 충돌 회피 수행
            if (this.domain !== other.domain) continue;

            const d = Math.hypot(this.x - other.x, this.y - other.y);
            const minDist = (this.size + other.size) * 0.4; 
            if (d < minDist) {
                const pushAngle = Math.atan2(this.y - other.y, this.x - other.x);
                const force = (minDist - d) / minDist;
                pushX += Math.cos(pushAngle) * force * 1.5;
                pushY += Math.sin(pushAngle) * force * 1.5;
            }
        }

        this.x += pushX;
        this.y += pushY;

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
        this.speed = 1.8; // 1.2 -> 1.8 (1.5배 상향)
        this.fireRate = 1800; 
        this.damage = 45;     
        this.color = '#39ff14';
        this.attackRange = 360; 
        this.visionRange = 6; // 전차 시야: 보병보다 넓음
        this.explosionRadius = 40; // 폭발 반경 추가
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            const { Projectile } = this.engine.entityClasses;
            const p = new Projectile(this.x, this.y, this.target, this.damage, this.color, this);
            p.type = 'shell'; // 포탄 타입 지정
            p.explosionRadius = this.explosionRadius; 
            this.engine.entities.projectiles.push(p);
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        // 아군 체력 바 (초록색) 상시 표시
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class NeutralTank extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'neutral-tank';
        this.name = '중립 전차';
        this.speed = 1.0;
        this.fireRate = 2000;
        this.damage = 30;
        this.color = '#bdc3c7'; 
        this.attackRange = 300;
        this.maxHp = 500;
        this.hp = 500;
        this.destination = null; // 초기 목적지 없음
    }

    update(deltaTime) {
        // 부모의 A* 이동 로직 사용
        super.update(deltaTime);
        if (!this.alive) return;

        // 중립 유닛은 공격 타겟팅만 수행 (반격 용도 등, enemies만 타겟으로)
        const enemies = this.engine.entities.enemies;
        let bestTarget = null;
        let minDistToMe = Infinity;

        for (const e of enemies) {
            const distToMe = Math.hypot(e.x - this.x, e.y - this.y);
            if (distToMe <= this.attackRange && distToMe < minDistToMe) {
                minDistToMe = distToMe;
                bestTarget = e;
            }
        }
        
        // 수동 타겟이 없는 경우에만 자동 타겟팅 적용
        if (!this.target || this.target.hp <= 0) {
            this.target = bestTarget;
        }

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.attack();
        }
    }

    attack() {
        // 중립 유닛은 기본적으로 공격 로직이 있으나 타겟팅 로직에 의해 선공하지 않음
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate && this.target) {
            const { Projectile } = this.engine.entityClasses;
            const p = new Projectile(this.x, this.y, this.target, this.damage, this.color, this);
            this.engine.entities.projectiles.push(p);
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);
        
        // 중립 도색 (회색 계열)
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-12, -10, 24, 20);
        ctx.strokeStyle = '#95a5a6';
        ctx.strokeRect(-12, -10, 24, 20);
        
        ctx.fillStyle = '#333';
        ctx.fillRect(-14, -12, 28, 4);
        ctx.fillRect(-14, 8, 28, 4);
        
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(0, -2, 15, 4);
        
        ctx.restore();

        // 중립 체력 바 (흰색/회색)
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class Missile extends Entity {
    constructor(startX, startY, targetX, targetY, damage, engine) {
        super(startX, startY);
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.engine = engine;
        this.speed = 7; // 비행 속도 상향 (4 -> 7)
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.totalDistance = Math.hypot(targetX - startX, targetY - startY);
        this.active = true;
        this.explosionRadius = 80; // 약 2칸 반경
        this.arrived = false;
        this.explosionTimer = 0;
        this.maxExplosionTime = 120; // 약 2초간 지속 (충분한 연기 감상 시간)
        // 거리에 따라 고도를 동적으로 조절 (최소 200, 최대 600)
        this.peakHeight = Math.max(200, Math.min(this.totalDistance * 0.4, 600));
        this.trail = [];
    }

    update(deltaTime) {
        if (!this.active && !this.arrived) return;

        if (this.active) {
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);

            if (progress >= 1) {
                this.explode();
            } else {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
                
                const altitude = Math.sin(progress * Math.PI) * this.peakHeight;
                this.trail.push({x: this.x, y: this.y - altitude, alpha: 1.0});
                if (this.trail.length > 25) this.trail.shift();
            }
        } else if (this.arrived) {
            this.explosionTimer++;
            if (this.explosionTimer >= this.maxExplosionTime) {
                this.arrived = false;
            }
        }
        
        this.trail.forEach(p => p.alpha -= 0.04);
        this.trail = this.trail.filter(p => p.alpha > 0);
    }

    explode() {
        this.active = false;
        this.arrived = true;
        this.explosionTimer = 0;
        
        this.smokeParticles = [];
        for(let i = 0; i < 15; i++) {
            this.smokeParticles.push({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * this.explosionRadius * 0.8,
                size: 30 + Math.random() * 30,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4 - 0.5,
                color: Math.random() > 0.5 ? '#7f8c8d' : '#95a5a6'
            });
        }

        const targets = [...this.engine.entities.enemies, ...this.engine.entities.neutral];
        targets.forEach(target => {
            const dist = Math.hypot(target.x - this.targetX, target.y - this.targetY);
            if (dist <= this.explosionRadius) {
                target.hp -= this.damage;
                if (target.hp <= 0) {
                    if (target.active !== undefined) target.active = false;
                    if (target.alive !== undefined) target.alive = false;
                }
            }
        });
    }

    draw(ctx) {
        if (!this.active && !this.arrived) return;

        // 1. 비행 연기 트레일
        this.trail.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha * 0.5;
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        if (this.active) {
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);
            const altitude = Math.sin(progress * Math.PI) * this.peakHeight;

            // 2. 그림자 (고도에 따라 크기 변화)
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#000';
            const shadowSize = Math.max(5, 10 * (1 - altitude/this.peakHeight));
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 3. 미사일 본체
            ctx.save();
            ctx.translate(this.x, this.y - altitude);
            
            // --- 정밀 탄도 각도 계산 (접선 벡터) ---
            // 수평 속도 벡터
            const vx = Math.cos(this.angle);
            const vy = Math.sin(this.angle);
            
            // 수직 고도 변화율 (sin 미분 -> cos)
            // altitude = peakHeight * sin(progress * PI)
            // d(altitude)/d(progress) = peakHeight * PI * cos(progress * PI)
            const dAlt = this.peakHeight * Math.PI * Math.cos(progress * Math.PI);
            
            // progress = dist / totalDist 이므로 d(progress)/dt 연쇄법칙 적용
            // 최종적으로 비행 기울기 산출
            const flightAngle = Math.atan2(vy * this.totalDistance - dAlt, vx * this.totalDistance);
            
            ctx.rotate(flightAngle);
            
            ctx.fillStyle = '#f5f6fa';
            ctx.beginPath();
            ctx.moveTo(16, 0); ctx.lineTo(6, -3); ctx.lineTo(-12, -3); ctx.lineTo(-12, 3); ctx.lineTo(6, 3);
            ctx.closePath(); ctx.fill();
            
            ctx.fillStyle = '#2d3436';
            ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-12, -7); ctx.lineTo(-12, -3); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-12, 7); ctx.lineTo(-12, 3); ctx.closePath(); ctx.fill();
            
            const flameSize = 4 + Math.random() * 3;
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(-13, 0, flameSize, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e67e22';
            ctx.beginPath(); ctx.arc(-13, 0, flameSize * 0.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.arrived) {
            ctx.save();
            const progress = this.explosionTimer / this.maxExplosionTime;
            const fireAlpha = Math.max(0, 1 - progress * 4); // 화염은 아주 짧게 (0.5초 이내)
            const smokeAlpha = Math.max(0, 1 - progress);   // 연기는 2초 동안 서서히
            
            // 1. 잔류 연기 효과 (Lingering Smoke)
            if (this.smokeParticles) {
                this.smokeParticles.forEach(p => {
                    const shiftX = p.vx * this.explosionTimer;
                    const shiftY = p.vy * this.explosionTimer;
                    const size = p.size * (1 + progress * 2); // 연기가 대폭 확산
                    
                    ctx.save();
                    ctx.globalAlpha = smokeAlpha * 0.95; // 연기 농도 대폭 강화
                    ctx.fillStyle = p.color; 
                    ctx.beginPath();
                    const px = this.targetX + Math.cos(p.angle) * p.dist + shiftX;
                    const py = this.targetY + Math.sin(p.angle) * p.dist + shiftY;
                    ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            // 2. 충격파 고리
            if (progress < 0.2) {
                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, this.explosionRadius * Math.pow(progress/0.2, 0.5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - progress/0.2) * 0.8})`;
                ctx.lineWidth = 5;
                ctx.stroke();
            }

            // 3. 메인 화염 (Fire)
            if (fireAlpha > 0) {
                const grad = ctx.createRadialGradient(this.targetX, this.targetY, 0, this.targetX, this.targetY, this.explosionRadius);
                grad.addColorStop(0, `rgba(255, 255, 255, ${fireAlpha})`);
                grad.addColorStop(0.3, `rgba(255, 215, 0, ${fireAlpha * 0.9})`);
                grad.addColorStop(1, `rgba(255, 69, 0, 0)`);
                
                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, this.explosionRadius * (1 + progress), 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            }
            
            ctx.restore();
        }
    }
}

export class MissileLauncher extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'missile-launcher';
        this.name = '이동식 미사일 발사대';
        this.speed = 1.4; // 0.8 -> 1.4 (기동성 강화)
        this.baseSpeed = 1.4;
        this.fireRate = 2500;
        this.damage = 350;
        this.color = '#ff3131';
        this.attackRange = 1800; // 600 -> 1800 (3배 사거리)
        this.visionRange = 8;
        this.recoil = 0;
        this.canBypassObstacles = false; // 장애물 통과 불가
        
        // 시즈 모드 관련 상태
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.maxTransitionTime = 60; 
        this.raiseAngle = 0; 

        // 발사 준비 시퀀스
        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.maxFireDelay = 45; // 발사 전 대기 시간 (약 0.75초)
        this.pendingFirePos = { x: 0, y: 0 };
    }

    toggleSiege() {
        if (this.isTransitioning || this.isFiring) return; 
        this.isTransitioning = true;
        this.transitionTimer = 0;
        this.destination = null; 
        this.speed = 0;         
        this.engine.addEffect?.('system', this.x, this.y, this.isSieged ? '시즈 해제 중...' : '시즈 모드 설정 중...');
    }

    update(deltaTime) {
        super.update(deltaTime);

        if (this.isTransitioning) {
            this.transitionTimer++;
            if (this.isSieged) {
                this.raiseAngle = 1 - (this.transitionTimer / this.maxTransitionTime);
            } else {
                this.raiseAngle = this.transitionTimer / this.maxTransitionTime;
            }

            if (this.transitionTimer >= this.maxTransitionTime) {
                this.isTransitioning = false;
                this.isSieged = !this.isSieged;
                this.raiseAngle = this.isSieged ? 1 : 0;
                this.speed = this.isSieged ? 0 : this.baseSpeed;
                if (this.isSieged) this.destination = null; 
            }
        }

        // 발사 시퀀스 업데이트
        if (this.isFiring) {
            this.fireDelayTimer++;
            
            // 타겟을 향해 더 빠르고 정교하게 각도 조절 (회전 속도 상향 0.05 -> 0.15)
            const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.angle += angleDiff * 0.15;

            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire();
                this.isFiring = false;
                this.fireDelayTimer = 0;
            }
        }
    }

    attack() {}

    fireAt(targetX, targetY) {
        if (!this.isSieged || this.isTransitioning || this.isFiring) return;

        // 사거리 체크
        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        if (dist > this.attackRange) return;

        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            this.isFiring = true;
            this.fireDelayTimer = 0;
            this.pendingFirePos = { x: targetX, y: targetY };
        }
    }

    executeFire() {
        const { x: targetX, y: targetY } = this.pendingFirePos;
        const launchDist = 35 * 2;
        const tiltDir = Math.cos(this.angle) >= 0 ? -1 : 1;
        const visualAngle = this.angle + (tiltDir * (Math.PI / 10) * this.raiseAngle);
        
        const spawnX = this.x + Math.cos(visualAngle) * launchDist;
        const spawnY = this.y + Math.sin(visualAngle) * launchDist;

        const missile = new Missile(spawnX, spawnY, targetX, targetY, this.damage, this.engine);
        missile.peakHeight = Math.max(missile.peakHeight, 150); 
        
        this.engine.entities.projectiles.push(missile);
        this.lastFireTime = Date.now();
        this.recoil = 15; 
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.recoil > 0) {
            ctx.translate(-this.recoil, 0);
            this.recoil *= 0.85;
            if (this.recoil < 0.1) this.recoil = 0;
        }

        ctx.scale(2, 2); 
        
        if (this.raiseAngle > 0) {
            ctx.fillStyle = '#636e72';
            const extend = 8 * this.raiseAngle;
            ctx.fillRect(-15, -12 - extend, 4, 4);
            ctx.fillRect(-15, 8 + extend, 4, 4);
            ctx.fillRect(11, -12 - extend, 4, 4);
            ctx.fillRect(11, 8 + extend, 4, 4);
        }

        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-22, -10, 44, 20);
        
        ctx.fillStyle = '#34495e';
        ctx.fillRect(12, -10, 10, 20);
        ctx.fillStyle = '#81ecec';
        ctx.fillRect(16, -8, 4, 16);
        
        ctx.fillStyle = '#1a1a1a';
        const wheelX = [-17, -7, 3, 13];
        wheelX.forEach(x => {
            ctx.fillRect(x, -12, 6, 3);
            ctx.fillRect(x, 9, 6, 3);
        });

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-20, -8, 30, 16);

        ctx.save();
        ctx.translate(-15, 0);
        const tiltDir = Math.cos(this.angle) >= 0 ? -1 : 1;
        ctx.rotate(tiltDir * (Math.PI / 10) * this.raiseAngle); 
        
        ctx.fillStyle = '#4b5320'; 
        const scaleS = 1 + (this.raiseAngle * 0.1);
        const canisterLen = 32 * scaleS;
        ctx.fillRect(0, -7, canisterLen, 14);
        
        ctx.strokeStyle = '#3a4118';
        for(let i = 4; i <= 28; i += 4) {
            ctx.beginPath(); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke();
        }
        
        // 해치 개방 애니메이션
        const hatchProgress = this.isFiring ? (this.fireDelayTimer / this.maxFireDelay) : 0;
        ctx.fillStyle = '#2d3436';
        if (hatchProgress < 0.1) {
            ctx.fillRect(canisterLen - 2, -7, 3, 14);
        } else {
            const openDist = 8 * Math.min(hatchProgress * 1.5, 1);
            ctx.fillRect(canisterLen - 2, -7 - openDist, 3, 7); // 상단
            ctx.fillRect(canisterLen - 2, 0 + openDist, 3, 7);  // 하단
            if (hatchProgress > 0.6) {
                ctx.fillStyle = `rgba(255, 165, 0, ${(hatchProgress - 0.6) * 2.5})`;
                ctx.fillRect(canisterLen - 4, -4, 4, 8);
            }
        }

        if (this.recoil > 5) {
            ctx.save();
            ctx.translate(canisterLen, 0);
            ctx.fillStyle = '#ff4500';
            ctx.beginPath(); ctx.arc(5, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath(); ctx.arc(8, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // 발사 준비 중 스파크 효과
        if (this.isFiring && this.fireDelayTimer > 15) {
            ctx.save();
            ctx.translate(15, 0);
            ctx.fillStyle = '#f1c40f';
            for(let i=0; i<3; i++) {
                ctx.fillRect(Math.random()*15, (Math.random()-0.5)*15, 2, 2);
            }
            ctx.restore();
        }

        ctx.strokeStyle = '#95a5a6';
        ctx.beginPath(); ctx.moveTo(-18, -7); ctx.lineTo(-24, -13); ctx.stroke();
        ctx.restore();

        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        if (this.isFiring) {
            ctx.fillStyle = '#e67e22'; // 발사 준비 게이지
            ctx.fillRect(this.x - barW/2, barY, (this.fireDelayTimer / this.maxFireDelay) * barW, 4);
        } else {
            ctx.fillStyle = this.isSieged ? '#f1c40f' : '#2ecc71'; 
            ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
        }
    }
}

export class Artillery extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'artillery';
        this.name = '자주포';
        this.speed = 0.9;
        this.fireRate = 4000; // 매우 느린 연사
        this.damage = 100;    // 강력한 한 방
        this.attackRange = 1000;
        this.visionRange = 7;
        this.explosionRadius = 60;
        this.attackTargets = ['ground', 'sea'];
        this.canBypassObstacles = false;
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate && this.target) {
            const shell = new Projectile(this.x, this.y, this.target, this.damage, '#f1c40f', this);
            shell.type = 'shell';
            shell.explosionRadius = this.explosionRadius;
            shell.speed = 6;
            this.engine.entities.projectiles.push(shell);
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) { this.drawConstruction(ctx); return; }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);
        
        // 1. 하부 궤도 및 차체 (Chassis)
        ctx.fillStyle = '#1a1a1a'; // 궤도 색상
        ctx.fillRect(-16, -11, 32, 22);
        
        ctx.fillStyle = '#4b5320'; // 올리브 드랩 (메인 차체)
        ctx.beginPath();
        ctx.moveTo(-15, -10); ctx.lineTo(15, -10);
        ctx.lineTo(18, -8); ctx.lineTo(18, 8); ctx.lineTo(15, 10);
        ctx.lineTo(-15, 10); ctx.lineTo(-18, 8); ctx.lineTo(-18, -8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3a4118';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 보기륜 (Wheels) 디테일
        ctx.fillStyle = '#2d3436';
        for(let i = -12; i <= 12; i += 6) {
            ctx.beginPath(); ctx.arc(i, -10, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(i, 10, 2, 0, Math.PI * 2); ctx.fill();
        }

        // 2. 거대 박스형 포탑 (Turret)
        ctx.save();
        // 포탑은 차체보다 약간 뒤쪽에 위치
        ctx.translate(-2, 0);
        
        ctx.fillStyle = '#556644';
        ctx.fillRect(-10, -9, 22, 18);
        ctx.strokeStyle = '#2d3436';
        ctx.strokeRect(-10, -9, 22, 18);
        
        // 포탑 상부 디테일 (해치 및 장비)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-2, -6, 6, 6); // 메인 해치
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(8, -8, 2, 16); // 포탑 후면 바스켓 느낌
        
        // 3. 초장거리 포신 (Main Gun)
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(12, -2, 28, 4); // 매우 긴 포신
        
        // 제퇴기 (Muzzle Brake)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(38, -3, 4, 6);
        ctx.strokeStyle = '#111';
        ctx.strokeRect(38, -3, 4, 6);
        
        // 포신 뿌리 부분 (Gun Mantlet)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(10, -4, 4, 8);

        // 4. 안테나 (Antenna)
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-8, -7); ctx.lineTo(-15, -15);
        ctx.stroke();
        
        ctx.restore();
        
        // 5. 전면 라이트
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(16, -7, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 7, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
        this.drawHealthBar(ctx);
    }

    drawHealthBar(ctx) {
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class AntiAirVehicle extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'anti-air';
        this.name = '대공 차량';
        this.speed = 1.3;
        this.fireRate = 800; // 빠른 연사
        this.damage = 30;
        this.attackRange = 500;
        this.visionRange = 8;
        this.attackTargets = ['air']; // 공중 유닛만 공격 가능
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate && this.target) {
            const missile = new Projectile(this.x, this.y, this.target, this.damage, '#00d2ff', this);
            missile.speed = 10;
            this.engine.entities.projectiles.push(missile);
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) { this.drawConstruction(ctx); return; }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);
        // 차체
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-10, -8, 20, 16);
        // 레이더/미사일 팩
        ctx.fillStyle = '#00d2ff';
        ctx.fillRect(-4, -6, 8, 12);
        ctx.fillRect(2, -5, 6, 2); ctx.fillRect(2, 3, 6, 2);
        ctx.restore();
        this.drawHealthBar(ctx);
    }

    drawHealthBar(ctx) {
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class Rifleman extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'rifleman';
        this.name = '소총병';
        this.speed = 0.9;
        this.fireRate = 100;
        this.damage = 10;
        this.color = '#e0e0e0';
        this.attackRange = 180;
        this.size = 24; // 12 -> 24
        this.visionRange = 4; // 보병 시야: 제일 좁음
        this.attackTargets = ['ground', 'sea', 'air']; // 소총병은 공중 공격 가능
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate && this.target) {
            const { Projectile } = this.engine.entityClasses;
            this.engine.entities.projectiles.push(new Projectile(this.x, this.y, this.target, this.damage, this.color, this));
            this.lastFireTime = now;
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
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

        // 아군 체력 바 (초록색) 상시 표시
        const barW = 20;
        const barY = this.y - 20;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 3);
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
        this.targetObject = null;
        this.currentSharedTask = null; // 현재 맡은 공유 작업
        this.buildingTarget = null; // 현재 짓고 있는 건물 객체
        this.myGroupQueue = null; // 이 유닛이 속한 건설 그룹의 큐 (배열 참조)
    }

    clearBuildQueue() {
        // 1. 현재 짓고 있는 실체화된 건물 취소
        if (this.buildingTarget && this.buildingTarget.isUnderConstruction) {
            const buildInfo = this.engine.buildingRegistry[this.buildingTarget.type];
            if (buildInfo) {
                this.engine.resources.gold += buildInfo.cost;
                this.engine.clearBuildingTiles(this.buildingTarget);
                
                // 엔티티 목록에서 제거
                const list = this.engine.entities[buildInfo.list];
                if (list) {
                    const idx = list.indexOf(this.buildingTarget);
                    if (idx !== -1) list.splice(idx, 1);
                }
            }
            this.buildingTarget = null;
        }

        // 2. 현재 맡고 있던 공유 작업(예약) 반납
        if (this.currentSharedTask) {
            this.currentSharedTask.assignedEngineer = null;
            this.currentSharedTask = null;
        }

        // 3. 그룹 큐 탈퇴 및 오크 큐(아무도 안 하는 큐) 정리
        const queueToAbandon = this.myGroupQueue;
        this.myGroupQueue = null;

        if (queueToAbandon) {
            // 이 큐를 여전히 참조하고 있는 다른 공병이 있는지 확인
            const othersUsingIt = this.engine.entities.units.some(u => 
                u !== this && u.alive && u.type === 'engineer' && u.myGroupQueue === queueToAbandon
            );

            if (!othersUsingIt) {
                // 더 이상 이 건설 큐를 수행할 공병이 없으면 모든 예약 작업 취소 및 자원 환불
                queueToAbandon.forEach(task => {
                    this.engine.clearBuildingTiles(task);
                    const cost = this.engine.buildingRegistry[task.type]?.cost || 0;
                    this.engine.resources.gold += cost;
                });
                queueToAbandon.length = 0; // 배열 비움
            }
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (!this.alive) {
            this.clearBuildQueue();
            return;
        }

        // 건설 중이 아닌데 그룹 큐에 있거나 빌딩 타겟이 있다면 (강제 이동 등)
        if (this.command !== 'build' && (this.myGroupQueue || this.buildingTarget)) {
            this.clearBuildQueue();
        }

        // 1단계: 건설 진행
        if (this.command === 'build' && this.buildingTarget) {
            if (this.buildingTarget.isUnderConstruction) {
                // 건설 중인 건물을 바라보게 함
                this.angle = Math.atan2(this.buildingTarget.y - this.y, this.buildingTarget.x - this.x);

                const progressPerFrame = deltaTime / (this.buildingTarget.totalBuildTime * 1000);
                this.buildingTarget.buildProgress += progressPerFrame;
                this.buildingTarget.hp = Math.max(1, this.buildingTarget.maxHp * this.buildingTarget.buildProgress);
                if (this.buildingTarget.buildProgress >= 1) {
                    this.buildingTarget.buildProgress = 1;
                    this.buildingTarget.isUnderConstruction = false;
                    this.buildingTarget.hp = this.buildingTarget.maxHp;
                    if (this.buildingTarget.targetResource) {
                        const resList = this.engine.entities.resources;
                        const resIdx = resList.indexOf(this.buildingTarget.targetResource);
                        if (resIdx !== -1) resList.splice(resIdx, 1);
                    }
                    this.buildingTarget = null;
                }
                return;
            } else {
                this.buildingTarget = null;
            }
        }

        // 2단계: 작업 분담 및 이동 (자신의 그룹 큐에서 일감 찾기)
        if (this.command === 'build' && this.myGroupQueue) {
            // 아직 맡은 일이 없다면 큐에서 첫 번째 비어있는 작업 할당
            if (!this.currentSharedTask) {
                const nextTask = this.myGroupQueue.find(task => task.assignedEngineer === null);
                if (nextTask) {
                    this.currentSharedTask = nextTask;
                    nextTask.assignedEngineer = this;
                }
            }

            if (this.currentSharedTask) {
                const task = this.currentSharedTask;
                const buildInfo = this.engine.buildingRegistry[task.type];
                const [tw, th] = buildInfo ? buildInfo.size : [1, 1];
                
                // 건물의 크기에 상관없이 넉넉하게 인식 범위를 잡음 (건물 절반 크기 + 유닛 크기 + 여유 30px)
                const targetDistX = (tw * 40) / 2 + this.size / 2 + 30;
                const targetDistY = (th * 40) / 2 + this.size / 2 + 30;
                const dx = Math.abs(this.x - task.x), dy = Math.abs(this.y - task.y);

                if (dx <= targetDistX && dy <= targetDistY) {
                    // 이미 해당 위치에 건설 중인 건물이 있는지 먼저 확인 (중복 생성 방지)
                    let existingBuilding = null;
                    const listName = buildInfo.list;
                    if (this.engine.entities[listName]) {
                        existingBuilding = this.engine.entities[listName].find(b => 
                            b.gridX === task.gridX && b.gridY === task.gridY && b.isUnderConstruction
                        );
                    }

                    if (existingBuilding) {
                        this.buildingTarget = existingBuilding;
                    } else {
                        const building = this.engine.executeBuildingPlacement(
                            task.type, task.x, task.y, task.gridX, task.gridY
                        );
                        if (building) {
                            this.buildingTarget = building;
                        }
                    }

                    if (this.buildingTarget) {
                        // 성공적으로 할당받거나 생성했으면 큐에서 제거
                        const taskIdx = this.myGroupQueue.indexOf(task);
                        if (taskIdx !== -1) this.myGroupQueue.splice(taskIdx, 1);
                        this.currentSharedTask = null;
                        this.destination = null;
                    } else {
                        // 실패 시 (드문 경우) 작업을 포기하고 다음으로
                        const taskIdx = this.myGroupQueue.indexOf(task);
                        if (taskIdx !== -1) this.myGroupQueue.splice(taskIdx, 1);
                        this.currentSharedTask = null;
                    }
                } else {
                    // 건물의 중심이 아닌 가장 가까운 외곽 지점으로 이동
                    const halfW = (tw * 40) / 2;
                    const halfH = (th * 40) / 2;
                    
                    const minX = task.x - halfW;
                    const maxX = task.x + halfW;
                    const minY = task.y - halfH;
                    const maxY = task.y + halfH;

                    // 현재 위치에서 건물의 AABB(Axis-Aligned Bounding Box) 상의 가장 가까운 점 계산
                    const closestX = Math.max(minX, Math.min(this.x, maxX));
                    const closestY = Math.max(minY, Math.min(this.y, maxY));

                    this.destination = { x: closestX, y: closestY };
                }
            } else if (!this.buildingTarget && this.myGroupQueue.length === 0) {
                // 더 이상 할 일이 없으면 정지
                this.command = 'stop';
                this.myGroupQueue = null;
            }
        }

        // 수리 로직 (이제 정상적으로 update 내부로 통합됨)
        if (this.command === 'repair' && this.targetObject) {
            // 수리 대상을 바라보게 함
            this.angle = Math.atan2(this.targetObject.y - this.y, this.targetObject.x - this.x);

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
                // 수리 대상의 가장 가까운 지점으로 이동
                const targetW = this.targetObject.width || this.targetObject.size || 40;
                const targetH = this.targetObject.height || this.targetObject.size || 40;
                const halfW = targetW / 2;
                const halfH = targetH / 2;

                const minX = this.targetObject.x - halfW;
                const maxX = this.targetObject.x + halfW;
                const minY = this.targetObject.y - halfH;
                const maxY = this.targetObject.y + halfH;

                const closestX = Math.max(minX, Math.min(this.x, maxX));
                const closestY = Math.max(minY, Math.min(this.y, maxY));

                this.destination = { x: closestX, y: closestY };
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

        // 아군 체력 바 (초록색) 상시 표시
        const barW = 20;
        const barY = this.y - 25;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 3);
    }
}

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
        this.isPowered = false;
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

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 65; 
                let unit = new Rifleman(this.x, spawnY, engine);
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
            ctx.fillStyle = this.isPowered ? '#3498db' : '#111';
            for(let i=0; i<3; i++) {
                ctx.fillRect(-30 + i*25, 5, 10, 6);
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
            for(let i=0; i<2; i++) {
                // 하단층
                ctx.fillStyle = '#a6936a'; // 어두운 면
                ctx.beginPath(); ctx.ellipse(-5 + i*12, 4, 7, 5, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#c2b280'; // 윗면
                ctx.beginPath(); ctx.ellipse(-5 + i*12, 0, 7, 5, 0, 0, Math.PI*2); ctx.fill();
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
        ctx.fillRect(this.x - barW/2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 6);

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
        this.width = 120; // 3 tiles
        this.height = 120; // 3 tiles
        this.size = 120;
        this.maxHp = 2000;
        this.hp = 2000;
        this.isPowered = false;
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

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 65; 
                let unit;
                if (current.type === 'tank') unit = new Tank(this.x, spawnY, engine);
                else if (current.type === 'missile-launcher') unit = new MissileLauncher(this.x, spawnY, engine);
                else if (current.type === 'artillery') unit = new Artillery(this.x, spawnY, engine);
                else if (current.type === 'anti-air') unit = new AntiAirVehicle(this.x, spawnY, engine);
                
                if (unit) {
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

                

                const h = 20; // 건물의 높이(두께)

        

                // 1. 건물의 그림자 (바닥)

                ctx.fillStyle = 'rgba(0,0,0,0.3)';

                ctx.fillRect(-55, -35, 115, 85);

        

                // 2. 건물의 벽면 (2.5D 깊이감 - 어두운 부분)

                ctx.fillStyle = '#2c3e50';

                // 정면 벽

                ctx.fillRect(-50, 40, 100, h);

                // 측면 벽

                ctx.beginPath();

                ctx.moveTo(50, -40); ctx.lineTo(50, 40);

                ctx.lineTo(50 + 5, 40 + h); ctx.lineTo(50 + 5, -40 + h);

                ctx.closePath(); ctx.fill();

        

                // 3. 메인 지붕 (톱니바퀴형 - 윗면)

                for(let i=0; i<3; i++) {

                    const rx = -50 + (i * 33.3);

                    

                    // 지붕의 측면(두께)

                    ctx.fillStyle = '#34495e';

                    ctx.beginPath();

                    ctx.moveTo(rx + 33.3, -40);

                    ctx.lineTo(rx + 33.3, -65);

                    ctx.lineTo(rx + 33.3 + 5, -65 + 5);

                    ctx.lineTo(rx + 33.3 + 5, -40 + 5);

                    ctx.closePath(); ctx.fill();

        

                    // 지붕의 경사면 (윗면)

                    ctx.fillStyle = '#95a5a6';

                    ctx.beginPath();

                    ctx.moveTo(rx, -40);

                    ctx.lineTo(rx + 33.3, -40);

                    ctx.lineTo(rx + 33.3, -65);

                    ctx.closePath();

                    ctx.fill();

                    

                    // 지붕 채광창 (유리)

                    ctx.fillStyle = this.isPowered ? '#3498db' : '#2c3e50';

                    ctx.beginPath();

                    ctx.moveTo(rx + 20, -40);

                    ctx.lineTo(rx + 33.3, -40);

                    ctx.lineTo(rx + 33.3, -55);

                    ctx.closePath();

                    ctx.fill();

                }

        

                // 4. 입체적인 굴뚝 (Smokestacks)

                const draw3DChimney = (cx, cy) => {

                    const cHeight = 45;

                    // 굴뚝 그림자

                    ctx.fillStyle = 'rgba(0,0,0,0.2)';

                    ctx.fillRect(cx + 2, cy - cHeight + 2, 12, cHeight);

                    

                    // 굴뚝 몸체 (그라데이션으로 원통 느낌)

                    const cGrad = ctx.createLinearGradient(cx, 0, cx + 12, 0);

                    cGrad.addColorStop(0, '#222');

                    cGrad.addColorStop(0.5, '#444');

                    cGrad.addColorStop(1, '#222');

                    ctx.fillStyle = cGrad;

                    ctx.fillRect(cx, cy - cHeight, 12, cHeight);

                    

                    // 굴뚝 상단 캡

                    ctx.fillStyle = '#c0392b';

                    ctx.fillRect(cx - 1, cy - cHeight, 14, 4);

        

                    if (this.isPowered) {

                        // 연기 파티클 (2.5D 위치에 맞춰 조정)

                        const time = Date.now() / 1000;

                        ctx.save();

                        ctx.globalAlpha = 0.5;

                        ctx.fillStyle = '#bdc3c7';

                        for(let j=0; j<3; j++) {

                            const s = 6 + (time + j*0.4) % 1 * 12;

                            const ox = Math.sin(time*2 + j) * 8;

                            const oy = (cy - cHeight - 10) - ((time + j*0.4) % 1) * 40;

                            ctx.beginPath(); ctx.arc(cx + 6 + ox, oy, s, 0, Math.PI * 2); ctx.fill();

                        }

                        ctx.restore();

                    }

                };

                draw3DChimney(-35, -10);

                draw3DChimney(-10, -15);

        

                // 5. 정면 셔터 도어 (입체감)

                ctx.fillStyle = '#1a1a1a';

                ctx.fillRect(-30, 10, 60, 30);

                ctx.strokeStyle = this.isPowered ? '#39ff14' : '#555';

                ctx.lineWidth = 2;

                ctx.strokeRect(-30, 10, 60, 30);

                

                // 셔터 날 (가로선)

                ctx.strokeStyle = '#333';

                ctx.lineWidth = 1;

                for(let i=14; i<40; i+=4) {

                    ctx.beginPath(); ctx.moveTo(-28, i); ctx.lineTo(28, i); ctx.stroke();

                }

        

                ctx.restore();

                this.drawUI(ctx);

            }

    

        drawUI(ctx) {

            const barW = 100;

            const barY = this.y - 85;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';

            ctx.fillRect(this.x - barW/2, barY, barW, 6);

            ctx.fillStyle = '#2ecc71';

            ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 6);

    

            if (this.spawnQueue.length > 0) {

                const qBarY = barY - 14;

                const progress = this.spawnQueue[0].timer / this.spawnTime;

                ctx.fillStyle = 'rgba(0,0,0,0.6)';

                ctx.fillRect(this.x - 50, qBarY, 100, 10);

                ctx.fillStyle = '#39ff14';

                ctx.fillRect(this.x - 50, qBarY, 100 * progress, 10);

                

                const counts = this.spawnQueue.reduce((acc, curr) => {

                    acc[curr.type] = (acc[curr.type] || 0) + 1;

                    return acc;

                }, {});

                

                const labels = [];

                if (counts.tank) labels.push(`전차 x${counts.tank}`);

                if (counts.missile) labels.push(`미사일 x${counts.missile}`);

                if (counts.artillery) labels.push(`자주포 x${counts.artillery}`);

                if (counts.antiAir) labels.push(`대공 x${counts.antiAir}`);

                

                ctx.fillStyle = '#fff';

                ctx.font = 'bold 12px Arial';

                ctx.textAlign = 'center';

                ctx.shadowBlur = 4; ctx.shadowColor = '#000';

                labels.reverse().forEach((label, i) => {

                    ctx.fillText(label, this.x, qBarY - 20 - (i * 15));

                });

                ctx.fillText('무기 제조 중...', this.x, qBarY - 5);

                ctx.shadowBlur = 0;

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
        this.isPowered = false;
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

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                // 활주로 중앙 부근에서 생성 (오른쪽으로 이동됨)
                let unit;
                if (current.type === 'bomber') {
                    unit = new Bomber(this.x + 55, this.y - 80, engine);
                } else {
                    unit = new ScoutPlane(this.x + 55, this.y - 80, engine);
                }
                
                unit.destination = { x: this.x + 55, y: this.y + 140 };
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

        // 1. 거대 베이스 플랫폼 (두께감 있는 콘크리트 슬래브)
        // 하부 그림자 및 측면 두께
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(-100, -140, 205, 285); // 그림자
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-100, -140, 200, 280); // 베이스

        // 콘크리트 타일 텍스처
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for(let i=-100; i<=100; i+=25) {
            ctx.beginPath(); ctx.moveTo(i, -140); ctx.lineTo(i, 140); ctx.stroke();
        }
        for(let j=-140; j<=140; j+=25) {
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
            for(let i=-30; i<=30; i+=10) {
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
            ctx.beginPath(); ctx.arc(2, 2, 12, 0, Math.PI*2); ctx.fill();
            // 몸체 (옆면)
            const sideGrd = ctx.createLinearGradient(-12, 0, 12, 0);
            sideGrd.addColorStop(0, '#7f8c8d');
            sideGrd.addColorStop(0.5, '#ecf0f1');
            sideGrd.addColorStop(1, '#95a5a6');
            ctx.fillStyle = sideGrd;
            ctx.fillRect(-12, -15, 24, 25);
            // 윗면 (Top)
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath(); ctx.ellipse(0, -15, 12, 6, 0, 0, Math.PI*2); ctx.fill();
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
        const towerBlink = Math.sin(Date.now()/400) > 0;
        const towerColor = this.isPowered ? (towerBlink ? '#4fc3f7' : '#0288d1') : '#1c313a';
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
        if (this.isPowered) {
            ctx.rotate(Date.now() / 600);
            const dishGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
            dishGrd.addColorStop(0, '#bdc3c7');
            dishGrd.addColorStop(1, '#7f8c8d');
            ctx.fillStyle = dishGrd;
            ctx.beginPath(); ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#333'; ctx.stroke();
            // 레이더 빔 효과
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 80, -0.2, 0.2); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // 8. 야간 항공 유도등 (입체적인 광원 효과) - 오른쪽 활주로에 맞춰 이동
        for(let i=0; i<6; i++) {
            const yPos = -120 + i*48;
            const blink = (Math.floor(Date.now()/300) + i) % 4 === 0;
            if (this.isPowered) {
                ctx.save();
                ctx.globalAlpha = blink ? 1.0 : 0.3;
                ctx.shadowBlur = 10; ctx.shadowColor = '#2ecc71';
                ctx.fillStyle = '#2ecc71';
                ctx.beginPath(); ctx.arc(15, yPos, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(95, yPos, 4, 0, Math.PI*2); ctx.fill();
                ctx.restore();
            }
        }

        ctx.restore();

        // HP 및 생산 바 (기존 유지하되 위치 최적화)
        const barW = 140;
        const barY = this.y - 170;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 10);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 10);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(this.x - barW/2, barY, barW, 10);

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

export class ScoutPlane extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'scout-plane';
        this.name = '고등 정찰 무인기';
        this.domain = 'air'; 
        this.speed = 4.5;    // 속도 살짝 상향
        this.visionRange = 18; // 정찰 능력 강화
        this.hp = 250;       // 체력 상향
        this.maxHp = 250;
        this.size = 70;      // 크기 대폭 확장
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 1. 그림자 (공중에 떠 있는 느낌)
        ctx.save();
        ctx.translate(-5, 5);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(35, 0); ctx.lineTo(-15, -45); ctx.lineTo(-25, 0); ctx.lineTo(-15, 45);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // 2. 주익 (Wings - 델타익 스타일의 세련된 날개)
        const wingGrd = ctx.createLinearGradient(-20, -45, -20, 45);
        wingGrd.addColorStop(0, '#7f8c8d');
        wingGrd.addColorStop(0.5, '#bdc3c7');
        wingGrd.addColorStop(1, '#7f8c8d');
        
        ctx.fillStyle = wingGrd;
        ctx.beginPath();
        ctx.moveTo(10, 0);       // 앞쪽 중앙
        ctx.lineTo(-18, -48);    // 왼쪽 날개 끝
        ctx.lineTo(-28, -48);    // 왼쪽 날개 뒷단
        ctx.lineTo(-15, 0);      // 뒤쪽 중앙
        ctx.lineTo(-28, 48);     // 오른쪽 날개 뒷단
        ctx.lineTo(-18, 48);     // 오른쪽 날개 끝
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 날개 디테일 (플랩 및 라인)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.moveTo(-10, -25); ctx.lineTo(-22, -25);
        ctx.moveTo(-10, 25); ctx.lineTo(-22, 25);
        ctx.stroke();

        // 3. 동체 (Main Body - 유선형 무인기 스타일)
        const bodyGrd = ctx.createLinearGradient(0, -10, 0, 10);
        bodyGrd.addColorStop(0, '#ecf0f1');
        bodyGrd.addColorStop(0.5, '#bdc3c7');
        bodyGrd.addColorStop(1, '#95a5a6');
        
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(40, 0);       // 기수
        ctx.bezierCurveTo(30, -12, 10, -10, -25, -6); // 상단 라인
        ctx.lineTo(-25, 6);      // 하단 끝
        ctx.bezierCurveTo(10, 10, 30, 12, 40, 0);   // 하단 라인
        ctx.fill();
        ctx.stroke();

        // 4. 엔진 배기구 및 제트 화염
        ctx.fillStyle = '#333';
        ctx.fillRect(-28, -5, 5, 10);
        
        if (this.destination || Math.random() > 0.3) {
            const flicker = Math.random() * 5;
            const engineGrd = ctx.createRadialGradient(-30, 0, 2, -35, 0, 15);
            engineGrd.addColorStop(0, '#fff');
            engineGrd.addColorStop(0.4, '#00d2ff');
            engineGrd.addColorStop(1, 'transparent');
            ctx.fillStyle = engineGrd;
            ctx.beginPath();
            ctx.moveTo(-28, -4);
            ctx.lineTo(-45 - flicker, 0);
            ctx.lineTo(-28, 4);
            ctx.fill();
        }

        // 5. 정찰용 센서 터렛 (기수 하단)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(25, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e74c3c'; // 렌즈 안광
        ctx.beginPath();
        ctx.arc(27, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        // 6. 콕핏/위성 안테나 페어링 (무인기 특유의 불룩한 기수)
        ctx.fillStyle = 'rgba(0, 210, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(15, 0, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();

        // 7. 항법등 (깜빡이는 라이트)
        const blink = Math.sin(Date.now() / 200) > 0;
        if (blink) {
            ctx.fillStyle = '#ff3131'; // 좌익단 적색등
            ctx.beginPath(); ctx.arc(-22, -48, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71'; // 우익단 녹색등
            ctx.beginPath(); ctx.arc(-22, 48, 3, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();

        // HP 바 (기체 크기에 맞춰 위치 조정)
        const barW = 50;
        const barY = this.y - 50;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barW/2, barY, barW, 5);
    }
}

export class FallingBomb {
    constructor(x, y, engine, damage = 300, source) {
        this.x = x;
        this.y = y;
        this.engine = engine;
        this.damage = damage;
        this.source = source;
        this.timer = 0;
        this.duration = 1000; // 1초 후 폭발
        this.active = true;
        this.arrived = false; // GameEngine 필터 조건 대응
        this.radius = 120; // 폭발 범위 살짝 확장
        this.scale = 2.0; 
        this.type = 'bomb';
        
        // 폭격기로부터 공격 가능 대상 목록 상속 (폭격기는 기본적으로 지상/해상 공격)
        this.attackTargets = source?.attackTargets || ['ground', 'sea'];
    }

    update(deltaTime) {
        if (!this.active) return;
        this.timer += deltaTime;
        
        // 원근감: 2.0(하늘) -> 1.0(지면)
        this.scale = 2.0 - (this.timer / this.duration);
        
        if (this.timer >= this.duration) {
            this.explode();
            this.active = false;
            this.arrived = true;
        }
    }

    explode() {
        const potentialTargets = [
            ...this.engine.entities.enemies,
            ...this.engine.entities.neutral,
            ...this.engine.entities.turrets,
            ...this.engine.entities.generators,
            ...this.engine.entities.airports,
            ...this.engine.entities.refineries,
            ...this.engine.entities.goldMines,
            ...this.engine.entities.storage,
            ...this.engine.entities.armories,
            ...this.engine.entities.barracks,
            this.engine.entities.base
        ];

        potentialTargets.forEach(target => {
            if (!target || target.hp === undefined) return;
            
            // 도메인 체크: 공격 가능한 대상 도메인인지 확인
            const targetDomain = target.domain || 'ground';
            if (!this.attackTargets.includes(targetDomain)) return;

            const dist = Math.hypot(this.x - target.x, this.y - target.y);
            const targetSize = target.size || 40;
            if (dist <= this.radius + targetSize / 2) {
                target.hp -= this.damage;
                if (target.hp <= 0 && target.active !== undefined) {
                    target.active = false;
                }
            }
        });

        // 폭발 이펙트 추가
        this.engine.entities.projectiles.push({
            x: this.x,
            y: this.y,
            active: true,
            arrived: false,
            timer: 0,
            duration: 600,
            update(dt) {
                this.timer += dt;
                if (this.timer >= this.duration) this.active = false;
            },
            draw(ctx) {
                const p = this.timer / this.duration;
                ctx.save();
                ctx.globalAlpha = 1 - p;
                
                // 중심 화염
                ctx.beginPath();
                ctx.arc(this.x, this.y, 60 * p, 0, Math.PI * 2);
                ctx.fillStyle = '#ff4500';
                ctx.fill();
                
                // 충격파
                ctx.beginPath();
                ctx.arc(this.x, this.y, 100 * p, 0, Math.PI * 2);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.restore();
            }
        });
    }

    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        // 1. 지면 낙하 예상 지점 가이드
        const progress = this.timer / this.duration;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + progress * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * (0.2 + progress * 0.8), 0, Math.PI * 2);
        ctx.stroke();

        // 2. 떨어지는 포탄 본체
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        
        // 포탄 본체 (더 크게 묘사)
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 꼬리 날개
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-6, -12, 12, 3);
        ctx.fillRect(-2, -15, 4, 6);
        
        ctx.restore();
    }
}

export class Bomber extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'bomber';
        this.name = '전략 폭격기';
        this.domain = 'air';
        this.speed = 2.2; 
        this.visionRange = 12;
        this.hp = 1200; 
        this.maxHp = 1200;
        this.size = 92;    // 유닛 충돌 범위 약간 확장
        this.width = 140;  // 날개 폭 (좌우 70씩)
        this.height = 115; // 기체 길이 (앞뒤 58씩)
        this.damage = 0; 
        this.domain = 'air';
        this.attackTargets = ['ground', 'sea']; // 폭격기는 지상/해상만 타격
        
        // 폭격 스킬 관련 변수
        this.bombTimer = 0;
        this.bombInterval = 500; // 0.5초 (기존 0.2초에서 상향)
    }

    startBombing(targetX, targetY) {
        this.command = 'bombing';
        this.destination = { x: targetX, y: targetY };
        this.bombTimer = 0;
    }

    update(deltaTime) {
        super.update(deltaTime);
        
        if (this.command === 'bombing') {
            if (this.destination) {
                this.bombTimer += deltaTime;
                if (this.bombTimer >= this.bombInterval) {
                    this.bombTimer = 0;
                    // 포탄 투하 (자신을 source로 전달)
                    const bomb = new FallingBomb(this.x, this.y, this.engine, 300, this);
                    this.engine.entities.projectiles.push(bomb);
                }

                // 목적지 도달 시 종료
                const dist = Math.hypot(this.x - this.destination.x, this.y - this.destination.y);
                if (dist < 30) {
                    this.destination = null;
                    this.command = 'stop';
                }
            } else {
                this.command = 'stop';
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // --- B-52 Stratofortress "BUFF" 스타일 디테일 ---

        // 1. 거대한 주익 (High-wing configuration)
        // 안쪽은 두껍고 바깥쪽으로 갈수록 가늘어지는 형태
        const wingColor = '#2c3e50'; 
        ctx.fillStyle = wingColor;
        ctx.beginPath();
        ctx.moveTo(15, 0);       
        ctx.lineTo(-20, -75);   // 왼쪽 날개 끝
        ctx.lineTo(-35, -75);   
        ctx.lineTo(-10, 0);      
        ctx.lineTo(-35, 75);    // 오른쪽 날개 끝
        ctx.lineTo(-20, 75);     
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 날개 보조 바퀴/플로트 (Outriggers - B-52의 특징)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-32, -72, 6, 3);
        ctx.fillRect(-32, 69, 6, 3);

        // 2. 4기 엔진 포드 및 소형 프로펠러 (Compact Propeller Engines)
        const engineOffsets = [-28, -52, 28, 52]; 
        const propAngle = (Date.now() / 60) % (Math.PI * 2); // 회전 속도를 대폭 늦춰 무게감 부여

        engineOffsets.forEach(offset => {
            ctx.save();
            ctx.translate(-8, offset); 
            
            // 엔진 나셀 (소형화)
            const engGrd = ctx.createLinearGradient(0, -6, 0, 6);
            engGrd.addColorStop(0, '#34495e');
            engGrd.addColorStop(0.5, '#2c3e50');
            engGrd.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = engGrd;
            ctx.fillRect(-10, -6, 26, 12); 
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(-10, -6, 26, 12);

            // 프로펠러 스피너 (작게)
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.arc(16, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 4엽 프로펠러 회전 애니메이션 (훨씬 작고 얇게, 속도는 묵직하게)
            ctx.save();
            ctx.translate(16, 0);
            ctx.rotate(propAngle);
            ctx.fillStyle = '#0a0a0a'; // 더 어두운 색상으로 무게감 강조
            for(let i=0; i<4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.beginPath();
                // 끝부분을 살짝 더 뭉툭하게 하여 무게감 있는 디자인 적용
                ctx.ellipse(0, 9, 2.5, 11, 0, 0, Math.PI * 2); 
                ctx.fill();
            }
            ctx.restore();
            
            ctx.restore();
        });

        // 3. 메인 동체 (Fuselage - 뭉툭한 기수와 긴 몸체)
        const bodyGrd = ctx.createLinearGradient(0, -15, 0, 15);
        bodyGrd.addColorStop(0, '#34495e');
        bodyGrd.addColorStop(0.5, '#2c3e50');
        bodyGrd.addColorStop(1, '#1c2833');
        
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        // 기수 (사진처럼 뭉툭하고 둥근 코)
        ctx.moveTo(60, 0);
        ctx.bezierCurveTo(60, -14, 50, -16, 40, -16); 
        // 몸체 라인
        ctx.lineTo(-55, -12);
        // 꼬리 부분
        ctx.lineTo(-65, 0);
        ctx.lineTo(-55, 12);
        ctx.lineTo(40, 16);
        ctx.bezierCurveTo(50, 16, 60, 14, 60, 0);
        ctx.fill();
        ctx.stroke();

        // 4. 조종석 (Cockpit - 상단에 위치한 창)
        ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(48, -6);
        ctx.bezierCurveTo(52, -5, 52, 5, 48, 6);
        ctx.lineTo(42, 5);
        ctx.lineTo(42, -6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();

        // 5. 수직 미익 및 수평 미익 (Tail assembly)
        ctx.fillStyle = '#2c3e50';
        // 수평 미익
        ctx.beginPath();
        ctx.moveTo(-45, 0);
        ctx.lineTo(-65, -30);
        ctx.lineTo(-75, -30);
        ctx.lineTo(-60, 0);
        ctx.lineTo(-75, 30);
        ctx.lineTo(-65, 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 6. 패널 라인 및 디테일 (거대함 강조)
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, -15); ctx.lineTo(20, 15);
        ctx.moveTo(-10, -13); ctx.lineTo(-10, 13);
        ctx.moveTo(-40, -12); ctx.lineTo(-40, 12);
        ctx.stroke();

        // 폭격 중 효과
        if (this.command === 'bombing') {
            const blink = Math.sin(Date.now() / 150) > 0;
            if (blink) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
                // 동체 하부 폭탄창 열림 묘사
                ctx.fillStyle = '#000';
                ctx.fillRect(-20, -6, 40, 12);
            }
        }

        ctx.restore();

        // HP 바
        const barW = 100;
        const barY = this.y - 70;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 6);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x - barW/2, barY, barW, 6);
    }
}

export class CargoPlane extends PlayerUnit {
    constructor(storage, engine) {
        super(storage.x, storage.y, engine);
        this.type = 'cargo-plane';
        this.domain = 'air';
        this.storage = storage;
        this.speed = 3;
        this.capacity = 500;
        this.payload = { gold: 0, oil: 0 };
        this.state = 'loading'; // idle, loading, flying_to_base, unloading, flying_to_storage
        this.size = 50;
    }

    update(deltaTime) {
        super.update(deltaTime);
        const base = this.engine.entities.base;
        if (!this.storage.active || this.storage.hp <= 0) {
            this.state = 'flying_to_base';
        }

        switch (this.state) {
            case 'loading':
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
                this.engine.resources.gold += this.payload.gold;
                this.engine.resources.oil += this.payload.oil;
                this.payload = { gold: 0, oil: 0 };
                if (!this.storage.active || this.storage.hp <= 0) {
                    this.alive = false;
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

        ctx.fillStyle = '#7f8c8d';
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 1;
        ctx.fillRect(-2, -30, 8, 60);
        ctx.strokeRect(-2, -30, 8, 60);

        const time = Date.now();
        const propAngle = (time / 50) % (Math.PI * 2);
        const drawEngine = (ey) => {
            ctx.fillStyle = '#555';
            ctx.fillRect(2, ey - 4, 10, 8);
            ctx.strokeRect(2, ey - 4, 10, 8);
            ctx.save();
            ctx.translate(12, ey);
            ctx.rotate(propAngle);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
            ctx.moveTo(0, -6); ctx.lineTo(0, 6);
            ctx.stroke();
            ctx.restore();
        };
        drawEngine(-18);
        drawEngine(18);

        const bodyGrd = ctx.createLinearGradient(0, -12, 0, 12);
        bodyGrd.addColorStop(0, '#bdc3c7');
        bodyGrd.addColorStop(0.5, '#95a5a6');
        bodyGrd.addColorStop(1, '#7f8c8d');
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.quadraticCurveTo(22, -10, 15, -10);
        ctx.lineTo(-15, -10);
        ctx.lineTo(-15, 10);
        ctx.lineTo(15, 10);
        ctx.quadraticCurveTo(22, 10, 22, 0);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-15, 0); ctx.lineTo(-25, -15); ctx.lineTo(-25, 15); ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

export class DamageText {
    constructor(x, y, text, color = '#ff3131') {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.timer = 0;
        this.duration = 1000;
        this.active = true;
        this.arrived = false; // Filter 대응
        this.offsetY = 0;
    }

    update(deltaTime) {
        this.timer += deltaTime;
        this.offsetY -= 0.5; // 위로 떠오름
        if (this.timer >= this.duration) this.active = false;
    }

    draw(ctx) {
        const p = this.timer / this.duration;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y + this.offsetY);
        ctx.restore();
    }
}

export class Sandbag extends Entity {

    constructor(x, y) {
        super(x, y);
        this.name = '샌드백';
        this.type = 'sandbag';
        this.maxHp = 1000000;
        this.hp = this.maxHp;
        this.lastHp = this.hp; // 데미지 감지용
        this.speed = 0;
        this.damage = 0;
        this.size = 60;
        this.active = true;
    }

    update(deltaTime, target, buildings, engine) {
        // 데미지 감지
        if (this.hp < this.lastHp) {
            const damageDealt = Math.floor(this.lastHp - this.hp);
            if (damageDealt > 0 && engine) {
                // 데미지 텍스트 생성
                engine.entities.projectiles.push(new DamageText(this.x, this.y - 30, damageDealt));
            }
            // 체력 리셋 (무한 측정 가능)
            this.hp = this.maxHp;
            this.lastHp = this.hp;
        }
    }



    draw(ctx) {

        ctx.save();

        ctx.translate(this.x, this.y);

        

        // 모래주머니 뭉치 표현

        const drawBag = (dx, dy, rot) => {

            ctx.save();

            ctx.translate(dx, dy);

            ctx.rotate(rot);

            ctx.fillStyle = '#c2b280'; // 모래색

            ctx.strokeStyle = '#a6936a';

            ctx.lineWidth = 1;

            

            // 둥근 자루 형태

            ctx.beginPath();

            ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);

            ctx.fill();

            ctx.stroke();

            

            // 묶음 매듭

            ctx.fillStyle = '#a6936a';

            ctx.beginPath();

            ctx.arc(-10, 0, 2, 0, Math.PI * 2);

            ctx.fill();

            ctx.restore();

        };



                // 3단 쌓기



                drawBag(-10, 5, -0.2);



                drawBag(10, 5, 0.2);



                drawBag(0, -2, 0);



                



                ctx.restore();



            }



        }



        



        export class AirSandbag extends Entity {



            constructor(x, y) {
                super(x, y);
                this.name = '공중 샌드백';
                this.type = 'air-sandbag';
                this.domain = 'air'; // 공중 유닛 판정
                this.maxHp = 1000000;
                this.hp = this.maxHp;
                this.lastHp = this.hp;
                this.speed = 0;
                this.damage = 0;
                this.size = 60;
                this.active = true;
                this.floatOffset = 0;
            }
        
            update(deltaTime, target, buildings, engine) {
                // 공중에서 둥실둥실 떠있는 효과
                this.floatOffset = Math.sin(Date.now() / 500) * 10;

                if (this.hp < this.lastHp) {
                    const damageDealt = Math.floor(this.lastHp - this.hp);
                    if (damageDealt > 0 && engine) {
                        engine.entities.projectiles.push(new DamageText(this.x, this.y - 40, damageDealt, '#00d2ff'));
                    }
                    this.hp = this.maxHp;
                    this.lastHp = this.hp;
                }
            }



        



            draw(ctx) {



                ctx.save();



                ctx.translate(this.x, this.y + this.floatOffset);



                



                // 1. 메인 풍선 (타겟 느낌)



                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);



                grad.addColorStop(0, '#ff7675');



                grad.addColorStop(1, '#d63031');



                ctx.fillStyle = grad;



                ctx.beginPath();



                ctx.arc(0, 0, 25, 0, Math.PI * 2);



                ctx.fill();



                



                // 2. 조준 과녁 (Crosshair pattern)



                ctx.strokeStyle = '#fff';



                ctx.lineWidth = 2;



                ctx.beginPath();



                ctx.arc(0, 0, 15, 0, Math.PI * 2);



                ctx.moveTo(-20, 0); ctx.lineTo(20, 0);



                ctx.moveTo(0, -20); ctx.lineTo(0, 20);



                ctx.stroke();



        



                // 3. 고정 줄 (아래로 뻗어가는 느낌)



                ctx.setLineDash([5, 5]);



                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';



                ctx.beginPath();



                ctx.moveTo(0, 25);



                ctx.lineTo(0, 100);



                ctx.stroke();



                



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
        this.path = [];
        this.pathTimer = Math.random() * 2000; // 초기 경로 계산 분산
    }

    update(deltaTime, base, buildings, engine) {
        if (!base) return;
        const now = Date.now();
        
        // 2초마다 경로 재계산 (엔진 참조 필요)
        this.pathTimer += deltaTime;
        if (this.pathTimer >= 2000 || (this.path.length === 0 && this.hp > 0)) {
            const pf = engine.pathfinding;
            this.path = pf.findPath(this.x, this.y, base.x, base.y, false) || [];
            this.pathTimer = 0;
        }

        let moveTarget = base;
        
        // 경로 추종 로직 개선 (가까운 웨이포인트 스킵)
        while (this.path.length > 0) {
            const waypoint = this.path[0];
            const distToWaypoint = Math.hypot(waypoint.x - this.x, waypoint.y - this.y);
            if (distToWaypoint < 15) {
                this.path.shift();
            } else {
                moveTarget = waypoint;
                break;
            }
        }

        const angleToTarget = Math.atan2(moveTarget.y - this.y, moveTarget.x - this.x);
        let nextX = this.x + Math.cos(angleToTarget) * this.speed;
        let nextY = this.y + Math.sin(angleToTarget) * this.speed;
        
        let blockedBy = null;
        const distToBase = Math.hypot(this.x - base.x, this.y - base.y);
        
        if (distToBase <= this.attackRange) {
            blockedBy = base;
        } else {
            // 로컬 회피 및 충돌 체크 (건물)
            for (const obs of buildings) {
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

        // 공격 로직 (기존 유지)
        if (this.currentTarget && (this.currentTarget.active !== false) && this.currentTarget.hp > 0) {
            const attackDist = Math.hypot(this.x - this.currentTarget.x, this.y - this.currentTarget.y);
            const rangeThreshold = (this.currentTarget === base) ? this.attackRange + 5 : (this.size/2 + (this.currentTarget.width || this.currentTarget.size || 40)/2 + 5);
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
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 적군 외형: 육각형 모양의 위협적인 기계 유닛
        ctx.fillStyle = '#441111';
        ctx.strokeStyle = '#ff3131';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * (this.size / 2.5);
            const py = Math.sin(angle) * (this.size / 2.5);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 중앙 '코어' (빛남)
        ctx.fillStyle = '#ff3131';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3131';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

        // HP 바 (적군은 빨간색)
        const barY = this.y + this.size / 2 + 5;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, barY, 30, 4);
        ctx.fillStyle = '#ff3131';
        ctx.fillRect(this.x - 15, barY, (this.hp / this.maxHp) * 30, 4);
    }
}

export class Projectile extends Entity {
    constructor(x, y, target, damage, color = '#ffff00', source) {
        super(x, y);
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.source = source;
        this.speed = 8;
        this.size = 6;
        this.type = 'normal'; // 'shell', 'normal', etc.
        this.angle = 0;
        this.explosionRadius = 0; // 0이면 단일 타겟, >0 이면 범위 공격
        this.exploding = false; // 폭발 연출 중인지 여부
        this.explosionTimer = 0;
    }

    explode(engine) {
        if (this.explosionRadius > 0) {
            // 범위 내 모든 대상(적군 및 중립)에게 데미지
            const targets = [...engine.entities.enemies, ...engine.entities.neutral];
            
            // 공격 주체(source)의 공격 가능 대상 목록 가져오기
            const attackTargets = this.source?.attackTargets || ['ground', 'sea'];

            targets.forEach(target => {
                // 공격 가능 도메인인지 확인 (예: 지상 전용 무기는 공중 유닛을 공격하지 못함)
                const targetDomain = target.domain || 'ground';
                if (!attackTargets.includes(targetDomain)) return;

                const dist = Math.hypot(target.x - this.x, target.y - this.y);
                if (dist <= this.explosionRadius) {
                    target.hp -= this.damage;
                    if (target.hp <= 0) {
                        if (target.active !== undefined) target.active = false;
                        if (target.alive !== undefined) target.alive = false;
                    }
                }
            });
            this.exploding = true;
            this.explosionTimer = 150; // 150ms 동안 폭발 연출
        } else {
            // 단일 타겟 처리 (이미 hit 체크에서 처리됨)
            this.active = false;
        }
    }

    update(deltaTime, engine) {
        if (this.exploding) {
            this.explosionTimer -= deltaTime;
            if (this.explosionTimer <= 0) this.active = false;
            return;
        }

        if (!this.active) return;
        
        // 타겟 유효성 체크 (active와 alive 모두 고려)
        const isTargetDead = (this.target.active === false) || (this.target.alive === false) || (this.target.hp <= 0);
        if (!this.target || isTargetDead) {
            this.active = false;
            return;
        }

        this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        if (!engine) return;

        // 충돌 체크 함수 (공격 대상 도메인 필터링 및 장애물 통과 여부 포함)
        const checkCollision = (other) => {
            if (other === this.source || other.passable) return false;
            
            // 대상이 이미 죽었는지 확인
            const isDead = (other.active === false) || (other.alive === false) || (other.hp <= 0);
            if (isDead) return false;
            
            // [수정] 이동 방해 속성(canBypassObstacles)과 별개로, 
            // 곡사 포탄(shell)이나 미사일 발사대(missile-launcher)의 공격은 장애물을 넘어감
            const isIndirectFire = (this.type === 'shell') || (this.source && this.source.type === 'missile-launcher');
            if (isIndirectFire) return false;

            // 소스 유닛이 장애물 통과 능력이 있으면 비행 중 충돌 무시 (스카웃 등)
            if (this.source && this.source.canBypassObstacles) return false;

            // 소스 유닛의 공격 대상 도메인 확인
            const attackTargets = this.source?.attackTargets || ['ground', 'sea'];
            const targetDomain = other.domain || 'ground';
            
            // 공격 대상 도메인이 아니면 통과 (높이 차이 구현)
            if (!attackTargets.includes(targetDomain)) return false;

            const bounds = other.getSelectionBounds ? other.getSelectionBounds() : null;
            if (bounds) {
                return this.x >= bounds.left && this.x <= bounds.right && 
                       this.y >= bounds.top && this.y <= bounds.bottom;
            }
            const dist = Math.hypot(this.x - other.x, this.y - other.y);
            const otherSize = other.size || 40;
            return dist < (this.size / 2 + otherSize / 2);
        };

        // 1. 적 유닛/건물 또는 중립 유닛 체크
        const hostileTargets = [...engine.entities.enemies, ...engine.entities.neutral];
        for (const target of hostileTargets) {
            if (checkCollision(target)) {
                if (this.explosionRadius > 0) {
                    this.explode(engine);
                } else {
                    target.hp -= this.damage;
                    if (target.hp <= 0) {
                        if (target.active !== undefined) target.active = false;
                        if (target.alive !== undefined) target.alive = false;
                    }
                    this.active = false;
                }
                return;
            }
        }

        // 2. 아군 유닛/건물/자원 체크 (사라짐)
        const friendlyObstacles = [
            engine.entities.base,
            ...engine.entities.units,
            ...engine.entities.turrets, ...engine.entities.generators, ...engine.entities.walls, 
            ...engine.entities.airports, ...engine.entities.refineries, ...engine.entities.goldMines, 
            ...engine.entities.storage, ...engine.entities.armories, ...engine.entities.barracks,
            ...engine.entities.resources.filter(r => !r.covered)
        ];

        for (const b of friendlyObstacles) {
            if (checkCollision(b)) {
                if (this.explosionRadius > 0) {
                    this.explode(engine);
                } else {
                    this.active = false;
                }
                return;
            }
        }

        // 목표 도달 체크
        if (Math.hypot(this.x - this.target.x, this.y - this.target.y) < 15) {
            if (this.explosionRadius > 0) {
                this.explode(engine);
            } else {
                if (this.target.hp !== undefined) {
                    this.target.hp -= this.damage;
                    if (this.target.hp <= 0) this.target.active = false;
                }
                this.active = false;
            }
        }
    }

    draw(ctx) {
        if (this.exploding) {
            // 폭발 이펙트
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 165, 0, ${this.explosionTimer / 150})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 69, 0, ${this.explosionTimer / 150})`;
            ctx.stroke();
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.type === 'shell') {
            // 전차 포탄 외형
            ctx.fillStyle = '#7f8c8d'; // 금속 회색
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1;
            
            // 포탄 몸체 (길쭉한 타원/사각형 조합)
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-4, -3);
            ctx.lineTo(-8, -3);
            ctx.lineTo(-8, 3);
            ctx.lineTo(-4, 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 추진체 불꽃/빛 (뒤쪽)
            ctx.fillStyle = '#e67e22';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#f39c12';
            ctx.beginPath();
            ctx.arc(-8, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 일반 발사체 (빛나는 구체)
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

export class Resource extends Entity {
    constructor(x, y, type = 'ore') {
        super(x, y);
        this.type = type;
        this.size = 25;
        this.covered = false; // 건설 중일 때 숨김 처리
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
        if (this.covered) return; // 건물에 의해 가려졌으면 그리지 않음
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