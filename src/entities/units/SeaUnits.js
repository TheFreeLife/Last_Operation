import { PlayerUnit, TurretUnit } from './BaseUnit.js';

export class SmallBoat extends TurretUnit {
    static editorConfig = { category: 'sea', icon: 'boat', name: '고속정' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'small-boat';
        this.name = '고속정';
        this.speed = 2.5; 
        this.baseSpeed = 2.5;
        this.fireRate = 600; 
        this.damage = 25;
        this.color = '#3498db';
        this.attackRange = 450;
        this.visionRange = 10;
        this.size = 70; 
        this.population = 4; 
        this.hp = 500;
        this.maxHp = 500;
        this.cargoSize = 99; // 수송 불가
        this.muzzleOffset = 45;
        this.projectileSpeed = 38; 
        this.hitEffectType = 'bullet';

        this.domain = 'sea'; 
        this.attackTargets = ['ground', 'sea', 'air']; 

        this.armorType = 'light';
        this.weaponType = 'bullet';

        this.ammoType = 'bullet';
        this.maxAmmo = 300;
        this.ammo = 300;

        this.turretOffset = { x: 12, y: 0 }; 
        this.recoil = 0;
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.turretAngle = this.angle;
        this.turretOffset = { x: 12, y: 0 };
        this.recoil = 0;
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.recoil > 0) this.recoil *= 0.85;

        // 이동 중일 때 물보라 파티클 생성
        if (this.active && this._destination && Math.hypot(this.x - this._destination.x, this.y - this._destination.y) > 10) {
            if (Math.random() < 0.25) {
                const fx = this.x + Math.cos(this.angle) * 25;
                const fy = this.y + Math.sin(this.angle) * 25;
                this.engine.addEffect?.('water_wake', fx, fy, this.angle);
            }
            if (Math.random() < 0.15) {
                const bx = this.x + Math.cos(this.angle + Math.PI) * 25;
                const by = this.y + Math.sin(this.angle + Math.PI) * 25;
                this.engine.addEffect?.('water_wake', bx, by, this.angle);
            }
        }
    }

    drawBody(ctx) {
        const bodyImg = this.getPartBitmap(this.type, 'body', (offCtx) => {
            offCtx.scale(1.8, 1.8);
            const hullColor = '#2c3e50'; 
            const deckColor = '#34495e';
            const detailColor = '#1e272e';

            // 1. 스텔스 선체 (Hull)
            offCtx.fillStyle = hullColor;
            offCtx.beginPath();
            offCtx.moveTo(28, 0);    
            offCtx.lineTo(10, -12);  
            offCtx.lineTo(-25, -12); 
            offCtx.lineTo(-28, -8);  
            offCtx.lineTo(-28, 8);   
            offCtx.lineTo(-25, 12);  
            offCtx.lineTo(10, 12);   
            offCtx.closePath();
            offCtx.fill();

            // 2. 갑판 구조물 (Deck)
            offCtx.fillStyle = deckColor;
            offCtx.beginPath();
            offCtx.moveTo(15, 0);
            offCtx.lineTo(5, -8);
            offCtx.lineTo(-22, -8);
            offCtx.lineTo(-22, 8);
            offCtx.lineTo(5, 8);
            offCtx.closePath();
            offCtx.fill();

            // 3. 브릿지 / 상부 구조 (Bridge)
            offCtx.fillStyle = detailColor;
            offCtx.fillRect(-8, -6, 12, 12);
            offCtx.fillStyle = '#2c3e50';
            offCtx.beginPath();
            offCtx.moveTo(4, -6); offCtx.lineTo(8, -4); offCtx.lineTo(8, 4); offCtx.lineTo(4, 6); offCtx.fill();
            offCtx.fillStyle = '#2980b9';
            offCtx.globalAlpha = 0.6;
            offCtx.fillRect(5, -4, 2, 8);
            offCtx.globalAlpha = 1.0;

            // 4. 후방 미사일 발사관 (Missile Launchers)
            offCtx.fillStyle = '#111';
            offCtx.fillRect(-20, -7, 8, 4); 
            offCtx.fillRect(-20, 3, 8, 4);  
            offCtx.fillStyle = '#000';
            offCtx.fillRect(-5, -13, 10, 1); 
            offCtx.fillRect(-5, 12, 10, 1);
        });

        const s = bodyImg.width;
        ctx.drawImage(bodyImg, -s/2, -s/2);
    }

    drawBodyAnimations(ctx) {
        ctx.save();
        ctx.scale(1.8, 1.8);
        ctx.translate(-5, 0);
        const radarRot = (Date.now() / 500) % (Math.PI * 2);
        ctx.rotate(radarRot);
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
        ctx.stroke();
        ctx.fillStyle = '#00d2ff';
        ctx.fillRect(2, -0.5, 3, 1);
        ctx.restore();
    }

    drawTurret(ctx) {
        const turretImg = this.getPartBitmap(this.type, 'turret', (offCtx) => {
            offCtx.scale(1.8, 1.8);
            const gunColor = '#2c3e50';
            offCtx.fillStyle = gunColor;
            offCtx.beginPath();
            offCtx.moveTo(-6, -5);
            offCtx.lineTo(4, -5);
            offCtx.lineTo(8, -2);
            offCtx.lineTo(8, 2);
            offCtx.lineTo(4, 5);
            offCtx.lineTo(-6, 5);
            offCtx.closePath();
            offCtx.fill();
            offCtx.fillStyle = '#111';
            offCtx.fillRect(-2, -2, 4, 4);
        });

        const s = turretImg.width;
        ctx.drawImage(turretImg, -s/2, -s/2);

        ctx.save();
        ctx.scale(1.8, 1.8);
        const recoilX = this.recoil || 0;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(8 - recoilX, -1, 15, 2); 
        ctx.fillStyle = '#333';
        ctx.fillRect(20 - recoilX, -1.5, 4, 3); 
        ctx.restore();
    }
}

export class Corvette extends TurretUnit {
    static editorConfig = { category: 'sea', icon: 'boat', name: '초계함' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'corvette';
        this.name = '초계함';
        this.speed = 1.8; 
        this.baseSpeed = 1.8;
        this.fireRate = 100; // 초고속 연사 (30mm 기관포)
        this.damage = 12;
        this.attackRange = 550;
        this.visionRange = 12;
        this.size = 100; 
        this.population = 12; 
        this.hp = 1500;
        this.maxHp = 1500;
        this.cargoSize = 99; // 수송 불가
        this.muzzleOffset = 60;
        this.projectileSpeed = 42; 
        this.hitEffectType = 'bullet';

        this.domain = 'sea'; 
        this.attackTargets = ['ground', 'sea', 'air']; 

        this.armorType = 'heavy';
        this.weaponType = 'bullet'; // 기관총 판정

        this.ammoType = 'bullet';
        this.maxAmmo = 600;
        this.ammo = 600;

        this.turretOffset = { x: 25, y: 0 }; 
        this.recoil = 0;

        // 미사일 시스템
        this.missileFireRate = 8000;
        this.lastMissileTime = 0;
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.turretAngle = this.angle;
        this.turretOffset = { x: 25, y: 0 };
        this.recoil = 0;
        this.lastMissileTime = 0;
        this.ammo = 600;
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.recoil > 0) this.recoil *= 0.8; // 빠른 복구

        // 이동 중 물보라 연출
        if (this.active && this._destination && Math.hypot(this.x - this._destination.x, this.y - this._destination.y) > 10) {
            if (Math.random() < 0.3) {
                const fx = this.x + Math.cos(this.angle) * 45;
                const fy = this.y + Math.sin(this.angle) * 45;
                this.engine.addEffect?.('water_wake', fx, fy, this.angle);
            }
            if (Math.random() < 0.2) {
                const bx = this.x + Math.cos(this.angle + Math.PI) * 45;
                const by = this.y + Math.sin(this.angle + Math.PI) * 45;
                this.engine.addEffect?.('water_wake', bx, by, this.angle);
            }
        }

        // 보조 무장: 대함/대공 미사일 (자동 발사)
        const now = Date.now();
        if (this.target && now - this.lastMissileTime > this.missileFireRate) {
            this.fireMissile();
            this.lastMissileTime = now;
        }
    }

    fireMissile() {
        if (!this.target) return;
        this.engine.audioSystem.play('missile_flight', { volume: 0.3 });
        const vx = this.x + Math.cos(this.angle + Math.PI) * 20;
        const vy = this.y + Math.sin(this.angle + Math.PI) * 20;
        
        this.engine.entityManager.create('guided-missile', vx, vy, {
            target: this.target,
            damage: 150,
            ownerId: this.ownerId,
            flightAngle: this.angle - Math.PI/2 
        }, 'neutral');
    }

    drawBody(ctx) {
        const bodyImg = this.getPartBitmap(this.type, 'body', (offCtx) => {
            offCtx.scale(2.2, 2.2);
            const hullColor = '#2c3e50'; 
            const deckColor = '#34495e';
            const detailColor = '#1e272e';

            // 1. 거대 스텔스 함체
            offCtx.fillStyle = hullColor;
            offCtx.beginPath();
            offCtx.moveTo(40, 0); offCtx.lineTo(15, -14); offCtx.lineTo(-35, -14); offCtx.lineTo(-42, -8); 
            offCtx.lineTo(-42, 8); offCtx.lineTo(-35, 14); offCtx.lineTo(15, 14); offCtx.closePath(); offCtx.fill();

            // 2. 주 갑판
            offCtx.fillStyle = deckColor;
            offCtx.beginPath();
            offCtx.moveTo(25, 0); offCtx.lineTo(10, -10); offCtx.lineTo(-32, -10); offCtx.lineTo(-32, 10); offCtx.lineTo(10, 10); offCtx.closePath(); offCtx.fill();

            // 3. 거대 상부 구조물
            offCtx.fillStyle = detailColor;
            offCtx.fillRect(-15, -8, 25, 16);
            offCtx.fillStyle = hullColor;
            offCtx.beginPath(); offCtx.moveTo(10, -8); offCtx.lineTo(16, -5); offCtx.lineTo(16, 5); offCtx.lineTo(10, 8); offCtx.fill();
            offCtx.fillStyle = '#2980b9'; offCtx.globalAlpha = 0.7; offCtx.fillRect(12, -6, 3, 12); offCtx.globalAlpha = 1.0;

            // 4. 후방 VLS 및 헬기장
            offCtx.fillStyle = '#111';
            for(let i=0; i<2; i++) for(let j=0; j<4; j++) offCtx.fillRect(-28 + j*4, -6 + i*8, 3, 3);
            offCtx.strokeStyle = 'rgba(255,255,255,0.3)'; offCtx.lineWidth = 1; offCtx.beginPath(); offCtx.arc(-20, 0, 8, 0, Math.PI * 2); offCtx.stroke();
        });
        const s = bodyImg.width;
        ctx.drawImage(bodyImg, -s/2, -s/2);
    }

    drawBodyAnimations(ctx) {
        ctx.save();
        ctx.scale(2.2, 2.2);
        const time = Date.now();
        ctx.save(); ctx.translate(-5, 0); ctx.rotate((time / 800) % (Math.PI * 2)); ctx.strokeStyle = '#00d2ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke(); ctx.strokeRect(3, -0.5, 2, 1); ctx.restore();
        ctx.save(); ctx.translate(5, 0); ctx.rotate((time / 300) % (Math.PI * 2)); ctx.fillStyle = '#f1c40f'; ctx.fillRect(-2, -0.5, 4, 1); ctx.restore();
        ctx.restore();
    }

    drawTurret(ctx) {
        const turretImg = this.getPartBitmap(this.type, 'turret', (offCtx) => {
            offCtx.scale(2.2, 2.2);
            const gunColor = '#2c3e50';
            // 30mm CIWS 스타일 포탑 (둥글고 복잡한 형상)
            offCtx.fillStyle = gunColor;
            offCtx.beginPath(); offCtx.arc(0, 0, 8, 0, Math.PI * 2); offCtx.fill();
            offCtx.fillStyle = '#1e272e';
            offCtx.fillRect(-4, -8, 8, 4); // 탄매 회수 장치 느낌
            offCtx.fillStyle = '#111';
            offCtx.fillRect(4, -3, 4, 6); // 센서 유닛
        });
        const s = turretImg.width;
        ctx.drawImage(turretImg, -s/2, -s/2);

        ctx.save();
        ctx.scale(2.2, 2.2);
        const recoilX = this.recoil || 0;
        // 3연장 기관포신 (CIWS 느낌)
        ctx.fillStyle = '#111';
        const offsets = [-2, 0, 2];
        offsets.forEach(oy => {
            ctx.fillRect(6 - recoilX, oy - 0.6, 18, 1.2);
        });
        ctx.restore();
    }
}
