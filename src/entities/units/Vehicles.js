import { PlayerUnit, TurretUnit } from './BaseUnit.js';
import { Missile } from '../projectiles/Missile.js';
import { NuclearMissile } from '../projectiles/NuclearMissile.js';

export class Tank extends TurretUnit {
    static editorConfig = { category: 'vehicle', icon: 'tank', name: '전차' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'tank';
        this.name = '전차';
        this.speed = 1.8;
        this.fireRate = 1800;
        this.damage = 180; 
        this.color = '#39ff14';
        this.attackRange = 360;
        this.visionRange = 6;
        this.explosionRadius = 70; 
        this.size = 80;
        this.cargoSize = 10;
        this.population = 4; 
        this.hp = 1000;
        this.maxHp = 1000;
        this.muzzleOffset = 60;
        this.projectileSpeed = 18; 
        this.hitEffectType = 'explosion';

        this.armorType = 'heavy';
        this.weaponType = 'shell';

        this.ammoType = 'shell';
        this.maxAmmo = 20;
        this.ammo = 20;

        this.turretRotationSpeed = 0.08;
    }

    drawBody(ctx) {
        ctx.scale(2.2, 2.2);
        const hullColor = '#4b5320'; 
        const darkHull = '#3a4118';  
        const camoColor = '#3d2b1f'; 

        // --- 1. 하부 (차체 및 무한궤도) ---
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-16, -13, 32, 26);

        ctx.fillStyle = '#2d3436';
        for(let i=-14; i<=10; i+=6) {
            ctx.fillRect(i, -13, 4, 3);
            ctx.fillRect(i, 10, 4, 3);
        }

        ctx.fillStyle = hullColor;
        ctx.beginPath();
        ctx.moveTo(-16, -10); ctx.lineTo(12, -10);
        ctx.lineTo(18, -6); ctx.lineTo(18, 6);
        ctx.lineTo(12, 10); ctx.lineTo(-16, 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = camoColor;
        ctx.fillRect(-10, -10, 6, 20);
        ctx.fillRect(4, -6, 4, 12);

        ctx.fillStyle = darkHull;
        ctx.fillRect(-16, -11, 28, 3);
        ctx.fillRect(-16, 8, 28, 3);

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-12, -6, 6, 12);
    }

    drawTurret(ctx) {
        const turretImg = this.getPartBitmap(this.type, 'turret', (offCtx) => {
            offCtx.scale(2.2, 2.2);
            const hullColor = '#4b5320'; 
            const darkHull = '#3a4118';  
            const lightHull = '#556644'; 

            const turretGrd = offCtx.createLinearGradient(-10, -10, 10, 10);
            turretGrd.addColorStop(0, lightHull);
            turretGrd.addColorStop(1, hullColor);
            offCtx.fillStyle = turretGrd;
            
            offCtx.beginPath();
            offCtx.moveTo(-10, -9); offCtx.lineTo(4, -9);
            offCtx.lineTo(12, -4); offCtx.lineTo(12, 4);
            offCtx.lineTo(4, 9); offCtx.lineTo(-10, 9);
            offCtx.closePath();
            offCtx.fill();

            offCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            offCtx.lineWidth = 2;
            offCtx.beginPath();
            offCtx.moveTo(-2, -4); offCtx.lineTo(2, 0); offCtx.lineTo(-2, 4);
            offCtx.stroke();

            offCtx.fillStyle = darkHull;
            offCtx.fillRect(0, -7, 4, 3);
            offCtx.fillRect(0, 4, 4, 3);

            offCtx.fillStyle = '#1a1a1a';
            offCtx.beginPath(); offCtx.arc(-3, -4, 3, 0, Math.PI * 2); offCtx.fill();
            offCtx.fillStyle = '#2980b9'; 
            offCtx.fillRect(6, 2, 3, 4);

            offCtx.fillStyle = hullColor;
            offCtx.fillRect(12, -1.5, 34, 3);
            offCtx.fillStyle = darkHull;
            offCtx.fillRect(22, -2, 8, 4);
            
            offCtx.fillStyle = '#2d3436';
            offCtx.fillRect(44, -2.5, 4, 5);
            offCtx.fillStyle = '#1a1a1a';
            offCtx.fillRect(45, -3, 2, 6);
        });

        const s = turretImg.width;
        ctx.drawImage(turretImg, -s/2, -s/2);
    }
}

export class MissileLauncher extends TurretUnit {
    static editorConfig = { category: 'vehicle', icon: 'missile-launcher', name: '미사일 발사대' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'missile-launcher';
        this.name = '이동식 미사일 발사대';
        this.speed = 1.4;
        this.baseSpeed = 1.4;
        this.fireRate = 2500;
        this.damage = 800;
        this.attackRange = 1800;
        this.visionRange = 8;
        this.recoil = 0;
        this.size = 80;
        this.cargoSize = 10;
        this.population = 3; // 운전수, 사격통제수 2명
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.maxTransitionTime = 60;
        this.raiseAngle = 0;
        this.turretAngle = 0; // 차체 기준 상부 회전 각도

        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.maxFireDelay = 90; // 정렬 후 대기 시간 (약 1.5초)
        this.pendingFirePos = { x: 0, y: 0 };
        this.attackTargets = ['ground', 'sea'];

        this.armorType = 'light';
        this.weaponType = 'missile';

        this.ammoType = 'missile';
        this.maxAmmo = 6;
        this.ammo = 6;
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.raiseAngle = 0;
        this.turretAngle = 0;
        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.speed = this.baseSpeed || 1.4;
        this.pendingFirePos = { x: 0, y: 0 };
        this.recoil = 0;
    }

    getSkillConfig(cmd) {
        const skills = {
            'siege': { type: 'state', handler: this.toggleSiege },
            'manual_fire': { type: 'targeted', handler: this.fireAt }
        };
        return skills[cmd];
    }

    toggleSiege() {
        if (this.isTransitioning || this.isFiring) return;

        // 시즈 모드 사운드 즉시 시작
        this.siegeSoundInstance = this.engine.audioSystem.play('siege_mode', { volume: 0.2, loop: true, cooldown: 0 });

        this.isTransitioning = true;
        this.transitionTimer = 0;
        this.destination = null;
        this.speed = 0;
        this.engine.addEffect?.('system', this.x, this.y, '#fff', this.isSieged ? '시즈 해제 중...' : '시즈 모드 설정 중...');
    }

    update(deltaTime) {
        const prevAngle = this.angle;
        // TurretUnit의 update를 호출하지 않고 BaseUnit 수준의 이동/공격 로직만 호출 (시즈 모드 특수성 때문)
        Object.getPrototypeOf(TurretUnit.prototype).update.call(this, deltaTime);

        if (this.isSieged) {
            this.angle = prevAngle;
        }

        if (this.isSieged && !this.isTransitioning) {
            if (this.isFiring) {
                const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
                let diff = targetAngle - this.turretAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                this.turretAngle += diff * 0.0125;
                if (Math.abs(diff) < 0.05) {
                    this.fireDelayTimer++;
                }
            }
        } else if (!this.isSieged) {
            // [수정] 이동 중에는 포탑을 차체 정면에 즉시 고정 (Travel Lock)
            this.turretAngle = this.angle;
        }

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
                
                // 시즈 모드 사운드 중단
                if (this.siegeSoundInstance) {
                    this.siegeSoundInstance.pause();
                    this.siegeSoundInstance = null;
                }
            }
        }

        if (this.isFiring) {
            // 발사 15프레임(약 0.25초) 전에 사운드를 미리 재생하여 씽크를 맞춤
            if (this.fireDelayTimer === this.maxFireDelay - 15) {
                this.engine.audioSystem.play('missile_flight', { volume: 0.2 });
            }

            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire({ skipSound: true });
                this.isFiring = false;
                this.fireDelayTimer = 0;
            }
        }
    }

    attack() {
        if (this.isSieged && !this.isTransitioning && !this.isFiring) {
            const now = Date.now();
            if (now - this.lastFireTime > this.fireRate && this.target) {
                this.pendingFirePos = { x: this.target.x, y: this.target.y };
                this.executeFire();
            }
        }
    }

    fireAt(targetX, targetY) {
        if (!this.isSieged || this.isTransitioning || this.isFiring) return;
        if (this.ammo <= 0) {
            this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '미사일 고갈!');
            return;
        }
        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        if (dist > this.attackRange) return;

        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            this.isFiring = true;
            this.fireDelayTimer = 0;
            this.pendingFirePos = { x: targetX, y: targetY };
            this.engine.addEffect?.('system', this.x, this.y - 50, '#ff3131', '미사일 포탑 정렬 중...');
        }
    }

    executeFire(options = {}) {
        if (this.ammo <= 0) return;
        const { x: targetX, y: targetY } = this.pendingFirePos;
        const totalAngle = this.turretAngle; // [수정] 절대 각도 사용
        const launchDist = 30;
        const spawnX = this.x + Math.cos(totalAngle) * launchDist;
        const spawnY = this.y + Math.sin(totalAngle) * launchDist;

        if (!options.skipSound) {
            this.engine.audioSystem.play('missile_flight', { volume: 0.2 });
        }

        const totalDistance = Math.hypot(targetX - spawnX, targetY - spawnY);
        const peakHeight = Math.max(250, totalDistance * 0.5);

        this.engine.entityManager.create('missile', spawnX, spawnY, {
            startX: spawnX,
            startY: spawnY,
            targetX: targetX,
            targetY: targetY,
            damage: this.damage,
            ownerId: this.ownerId,
            totalDistance: totalDistance,
            peakHeight: peakHeight,
            moveAngle: Math.atan2(targetY - spawnY, targetX - spawnX)
        }, 'neutral');

        this.ammo--;
        this.lastFireTime = Date.now();
        this.recoil = 15;
    }

    drawBody(ctx) {
        ctx.scale(2, 2);
        // 시즈 모드일 때 지지대(Outriggers) 그리기
        if (this.raiseAngle > 0) {
            const outDist = this.raiseAngle * 8;
            ctx.fillStyle = '#2d3436';
            const outriggers = [
                { x: -15, y: -9, dx: -1, dy: -1 }, { x: 15, y: -9, dx: 1, dy: -1 },  
                { x: -15, y: 9, dx: -1, dy: 1 }, { x: 15, y: 9, dx: 1, dy: 1 }    
            ];
            outriggers.forEach(o => {
                ctx.save();
                ctx.translate(o.x + o.dx * outDist, o.y + o.dy * outDist);
                ctx.fillRect(-2, -2, 4, 4);
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(-o.dx * outDist, -o.dy * outDist); ctx.lineTo(0, 0); ctx.stroke();
                ctx.restore();
            });
        }
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-22, -10, 44, 20);
        ctx.fillStyle = '#34495e';
        ctx.fillRect(12, -10, 10, 20);
    }

    drawTurret(ctx) {
        ctx.scale(2, 2);
        ctx.translate(-8, 0);
        ctx.fillStyle = '#1e272e';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        const canisterLen = 32 - (this.raiseAngle * 12);
        if (this.raiseAngle > 0.1) {
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(2, -2, 8 * this.raiseAngle, 4);
        }
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-4, -7, canisterLen, 14);
        if (this.raiseAngle > 0.8) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(canisterLen - 8, 0, 5, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(canisterLen - 6, -5, 2, 10);
        }

        // 시즈 모드 표시등
        if (this.isSieged && !this.isTransitioning) {
            const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(255, 49, 49, ${0.4 + pulse * 0.6})`;
            ctx.beginPath(); ctx.arc(-10, 0, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
}

export class Artillery extends TurretUnit {
    static editorConfig = { category: 'vehicle', icon: 'artillery', name: '자주포' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'artillery';
        this.name = '자주포';
        this.speed = 0.9;
        this.fireRate = 4000;
        this.damage = 100;
        this.attackRange = 600;
        this.visionRange = 8;
        this.explosionRadius = 60;
        this.size = 80;
        this.cargoSize = 5;
        this.population = 5; 
        this.isIndirect = true; 

        this.armorType = 'heavy';
        this.weaponType = 'shell';

        this.ammoType = 'shell';
        this.maxAmmo = 20;
        this.ammo = 20;
        this.muzzleOffset = 96;
        this.projectileSpeed = 10; 

        this.turretRotationSpeed = 0.05;
    }

    drawBody(ctx) {
        ctx.scale(2.2, 2.2);
        const hullColor = '#5a6344'; 
        const darkHull = '#454d30';  

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-18, -13, 36, 26);
        
        ctx.fillStyle = '#2d3436';
        for(let i=-16; i<=14; i+=5) {
            ctx.fillRect(i, -13, 3, 3);
            ctx.fillRect(i, 10, 3, 3);
        }

        ctx.fillStyle = hullColor;
        ctx.beginPath();
        ctx.moveTo(-18, -11); ctx.lineTo(12, -11);
        ctx.lineTo(18, -7); ctx.lineTo(18, 7);
        ctx.lineTo(12, 11); ctx.lineTo(-18, 11);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(14, -8, 2, 16); 
        ctx.fillStyle = '#fbc02d'; 
        ctx.fillRect(16, -9, 1.5, 1.5);
        ctx.fillRect(16, 7.5, 1.5, 1.5);
    }

    drawTurret(ctx) {
        const turretImg = this.getPartBitmap(this.type, 'turret', (offCtx) => {
            offCtx.scale(2.2, 2.2);
            const hullColor = '#5a6344'; 
            const darkHull = '#454d30';  
            const lightHull = '#6b7552'; 

            offCtx.translate(-6, 0); 
            
            const turretGrd = offCtx.createLinearGradient(-12, -10, 14, 10);
            turretGrd.addColorStop(0, lightHull);
            turretGrd.addColorStop(1, darkHull);
            offCtx.fillStyle = turretGrd;
            
            offCtx.beginPath();
            offCtx.moveTo(-14, -10); offCtx.lineTo(10, -10); 
            offCtx.lineTo(14, -6); offCtx.lineTo(14, 6);
            offCtx.lineTo(10, 10); offCtx.lineTo(-14, 10);
            offCtx.closePath();
            offCtx.fill();

            offCtx.fillStyle = '#1a1a1a';
            offCtx.beginPath(); offCtx.arc(-2, -5, 3.5, 0, Math.PI * 2); offCtx.fill(); 
            offCtx.fillStyle = '#2980b9';
            offCtx.fillRect(4, 4, 4, 3); 
            
            offCtx.fillStyle = '#2d3436';
            offCtx.fillRect(-10, 4, 6, 4); 
            offCtx.fillRect(-10, -8, 2, 2); 

            offCtx.fillStyle = hullColor;
            offCtx.fillRect(14, -2, 42, 4);
            
            offCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            offCtx.fillRect(28, -2.1, 3, 4.2);
            offCtx.fillRect(34, -2.1, 2, 4.2);

            offCtx.fillStyle = darkHull;
            offCtx.fillRect(18, -2.5, 6, 5);
            offCtx.fillRect(40, -2.2, 4, 4.4);
            
            offCtx.fillStyle = '#2d3436';
            offCtx.fillRect(52, -3.5, 7, 7);
            offCtx.fillStyle = '#1a1a1a';
            offCtx.fillRect(54, -4, 2, 8); 
        });

        const s = turretImg.width;
        ctx.drawImage(turretImg, -s/2, -s/2);
    }
}

export class AntiAirVehicle extends TurretUnit {
    static editorConfig = { category: 'vehicle', icon: 'anti-air', name: '대공포' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'anti-air';
        this.name = '자주 대공포';
        this.speed = 1.3;
        this.fireRate = 100; // 연사 속도 상향 (150 -> 100)
        this.damage = 8;
        this.attackRange = 600;
        this.visionRange = 10;
        this.attackTargets = ['air'];
        this.size = 80;
        this.cargoSize = 5;
        this.population = 3; 
        this.muzzleOffset = 85; // 포신이 길어졌으므로 오프셋 상향 (50 -> 85)
        this.projectileSpeed = 40; // 대공포 탄속 상향 (22 -> 40)
        this.hitEffectType = 'flak';

        this.armorType = 'light';
        this.weaponType = 'bullet';

        this.ammoType = 'bullet';
        this.maxAmmo = 400; // 탄약 용량 상향 (연사력 대응)
        this.ammo = 400;
        this.ammoConsumption = 2; // 한 번에 2발씩 소모
        
        this.turretRotationSpeed = 0.1;
    }

    getPartBitmap(type, partName, drawFn) {
        // 대공포는 실시간 레이더 애니메이션을 위해 포탑 캐시를 쓰지 않거나, 
        // 부모의 getPartBitmap을 호출하되 drawTurret에서 본체만 캐싱하도록 설계됨
        return super.getPartBitmap(type, partName, drawFn);
    }

    // AntiAir는 쌍열포 발사를 위해 performAttack 오버라이드
    performAttack() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate || !this.target) return;

        if (this.ammo < this.ammoConsumption) {
            if (now - (this._lastAmmoMsgTime || 0) > 2000) {
                this.engine.addEffect?.('system', this.x, this.y - 30, '#ff3131', '탄약 부족!');
                this._lastAmmoMsgTime = now;
            }
            return;
        }
        this.ammo -= this.ammoConsumption;

        // --- 이중 총구 발사 로직 (포탑 각도 반영) ---
        const lateralOffset = 18; 
        const barrelOffsets = [lateralOffset, -lateralOffset];

        barrelOffsets.forEach(sideOffset => {
            // 포탑 각도(turretAngle) 기준으로 발사 위치 계산
            const spawnX = this.x + Math.cos(this.turretAngle) * this.muzzleOffset + Math.cos(this.turretAngle + Math.PI/2) * sideOffset;
            const spawnY = this.y + Math.sin(this.turretAngle) * this.muzzleOffset + Math.sin(this.turretAngle + Math.PI/2) * sideOffset;

            if (this.engine.addEffect) {
                this.engine.addEffect('muzzle', spawnX, spawnY, '#fff');
            }

            const options = {
                speed: this.projectileSpeed,
                ownerId: this.ownerId,
                isIndirect: false
            };

            this.engine.entityManager.spawnProjectileECS(
                spawnX, 
                spawnY, 
                this.target, 
                this.damage, 
                options
            );
        });

        this.lastFireTime = now;
    }

    drawBody(ctx) {
        ctx.scale(2.2, 2.2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-16, -12, 34, 26);

        ctx.fillStyle = '#3a4118';
        ctx.beginPath();
        ctx.moveTo(-18, -11); ctx.lineTo(14, -11);
        ctx.lineTo(18, -6); ctx.lineTo(18, 6);
        ctx.lineTo(14, 11); ctx.lineTo(-18, 11);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#2d3212';
        ctx.fillRect(-18, -13, 32, 3);
        ctx.fillRect(-18, 10, 32, 3);
        
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-14, -6, 6, 12);
    }

    drawTurret(ctx) {
        const turretImg = this.getPartBitmap(this.type, 'turret', (offCtx) => {
            offCtx.scale(2.2, 2.2);
            const turretGrd = offCtx.createLinearGradient(-10, -10, 10, 10);
            turretGrd.addColorStop(0, '#4b5320');
            turretGrd.addColorStop(1, '#2d3212');
            offCtx.fillStyle = turretGrd;
            offCtx.beginPath();
            offCtx.moveTo(-10, -10); offCtx.lineTo(8, -10);
            offCtx.lineTo(12, -6); offCtx.lineTo(12, 6);
            offCtx.lineTo(8, 10); offCtx.lineTo(-10, 10);
            offCtx.closePath();
            offCtx.fill();

            offCtx.fillStyle = '#1e272e';
            offCtx.fillRect(-4, -12, 10, 3);
            offCtx.fillRect(-4, 9, 10, 3);

            offCtx.fillStyle = '#2d3436';
            offCtx.fillRect(10, -8, 24, 2.5); 
            offCtx.fillStyle = '#1a1a1a';
            offCtx.fillRect(30, -8.5, 6, 3.5); 
            
            offCtx.fillStyle = '#2d3436';
            offCtx.fillRect(10, 5.5, 24, 2.5);
            offCtx.fillStyle = '#1a1a1a';
            offCtx.fillRect(30, 5, 6, 3.5);

            offCtx.fillStyle = '#2980b9';
            offCtx.globalAlpha = 0.8;
            offCtx.fillRect(2, -3, 4, 6);
        });

        const s = turretImg.width;
        ctx.drawImage(turretImg, -s/2, -s/2);

        // --- 실시간 레이더 애니메이션 (캐시에서 제외) ---
        ctx.save();
        ctx.scale(2.2, 2.2);
        ctx.translate(-8, 0);
        const radarScan = (Date.now() / 400) % (Math.PI * 2);
        ctx.rotate(radarScan);
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 6, -1, 1); 
        ctx.stroke();
        ctx.fillStyle = '#00d2ff';
        ctx.fillRect(2, -0.5, 4, 1);
        ctx.restore();
    }
}

export class MobileICBMLauncher extends TurretUnit {
    static editorConfig = { category: 'vehicle', icon: 'icbm-launcher', name: '이동식 ICBM 발사대' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'icbm-launcher';
        this.name = '이동식 ICBM 발사대';
        this.speed = 1.0; // 매우 느림
        this.baseSpeed = 1.0;
        this.fireRate = 8000; // 매우 긴 재장전 시간
        this.damage = 5000; // 압도적인 데미지
        this.attackRange = 3000; // 맵 전체 수준의 사거리
        this.visionRange = 10;
        this.recoil = 0;
        this.size = 110; // 더 거대함
        this.cargoSize = 15;
        this.population = 6; // 다수의 운용 인원
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.maxTransitionTime = 120; // 시즈 모드 전환에 긴 시간 소요
        this.raiseAngle = 0;

        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.maxFireDelay = 180; // 3초 카운트다운 (60fps * 3)
        this.pendingFirePos = { x: 0, y: 0 };
        this.attackTargets = ['ground', 'sea'];

        this.armorType = 'heavy';
        this.weaponType = 'missile';

        this.ammoType = 'nuclear-missile';
        this.maxAmmo = 2; // 탄약 제한적
        this.ammo = 2;
        this.hp = 1500;
        this.maxHp = 1500;
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.raiseAngle = 0;
        this.turretAngle = 0;
        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.speed = this.baseSpeed || 1.0;
        this.pendingFirePos = { x: 0, y: 0 };
        this.recoil = 0;
    }

    getSkillConfig(cmd) {
        const skills = {
            'siege': { type: 'state', handler: this.toggleSiege },
            'manual_fire': { type: 'targeted', handler: this.fireAt }
        };
        return skills[cmd];
    }

    toggleSiege() {
        if (this.isTransitioning || this.isFiring) return;

        // 시즈 모드 사운드 즉시 시작
        this.siegeSoundInstance = this.engine.audioSystem.play('siege_mode', { volume: 0.2, loop: true, cooldown: 0 });

        this.isTransitioning = true;
        this.transitionTimer = 0;
        this.destination = null;
        this.speed = 0;
        this.engine.addEffect?.('system', this.x, this.y, '#fff', this.isSieged ? '발사대 수평 전환 중...' : '전략 미사일 기립 중...');
    }

    update(deltaTime) {
        const prevAngle = this.angle;
        // TurretUnit의 update를 호출하지 않고 BaseUnit 수준의 이동/공격 로직만 호출 (시즈 모드 특수성 때문)
        Object.getPrototypeOf(TurretUnit.prototype).update.call(this, deltaTime);

        if (this.isSieged) {
            this.angle = prevAngle;
        }

        if (this.isSieged && !this.isTransitioning) {
            if (this.isFiring) {
                const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
                let diff = targetAngle - this.turretAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                this.turretAngle += diff * 0.008; // 매우 느리고 신중한 회전

                if (Math.abs(diff) < 0.05) {
                    this.fireDelayTimer++;
                }
            }
        } else if (!this.isSieged) {
            // [수정] 이동 중에는 포탑을 차체 정면에 즉시 고정 (Travel Lock)
            this.turretAngle = this.angle;
        }

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

                // 시즈 모드 사운드 중단
                if (this.siegeSoundInstance) {
                    this.siegeSoundInstance.pause();
                    this.siegeSoundInstance = null;
                }
            }
        }

        if (this.isFiring) {
            if (this.fireDelayTimer === 1) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', '3');
            if (this.fireDelayTimer === 60) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', '2');
            if (this.fireDelayTimer === 120) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', '1');
            if (this.fireDelayTimer === 165) { // LAUNCH! 텍스트 및 실제 발사보다 15프레임 빠르게
                this.engine.audioSystem.play('missile_flight', { volume: 0.3 });
            }
            if (this.fireDelayTimer === 175) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', 'LAUNCH!');

            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire({ skipSound: true });
                this.isFiring = false;
                this.fireDelayTimer = 0;
            }
        }
    }

    attack() {
        if (this.isSieged && !this.isTransitioning && !this.isFiring) {
            const now = Date.now();
            if (now - this.lastFireTime > this.fireRate && this.target) {
                this.pendingFirePos = { x: this.target.x, y: this.target.y };
                this.executeFire();
            }
        }
    }

    fireAt(targetX, targetY) {
        if (!this.isSieged || this.isTransitioning || this.isFiring) return;
        if (this.ammo <= 0) {
            this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '핵탄두 고갈!');
            return;
        }
        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        if (dist > this.attackRange) return;

        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            this.isFiring = true;
            this.fireDelayTimer = 0;
            this.pendingFirePos = { x: targetX, y: targetY };
            this.engine.addEffect?.('system', this.x, this.y - 60, '#f1c40f', '전략 핵 미사일 발사 시퀀스 개시');
        }
    }

    executeFire(options = {}) {
        if (this.ammo <= 0) return;
        const { x: targetX, y: targetY } = this.pendingFirePos;
        
        const totalAngle = this.turretAngle; // [수정] 절대 각도 사용
        const launchDist = 40;
        const spawnX = this.x + Math.cos(totalAngle) * launchDist;
        const spawnY = this.y + Math.sin(totalAngle) * launchDist;

        if (!options.skipSound) {
            this.engine.audioSystem.play('missile_flight', { volume: 0.3 });
        }

        const totalDistance = Math.hypot(targetX - spawnX, targetY - spawnY);
        const peakHeight = Math.max(400, totalDistance * 0.7);

        this.engine.entityManager.create('nuclear-missile', spawnX, spawnY, {
            startX: spawnX,
            startY: spawnY,
            targetX: targetX,
            targetY: targetY,
            damage: this.damage,
            ownerId: this.ownerId,
            totalDistance: totalDistance,
            peakHeight: peakHeight,
            moveAngle: Math.atan2(targetY - spawnY, targetX - spawnX)
        }, 'neutral');

        this.ammo--;
        this.lastFireTime = Date.now();
        this.recoil = 25;
        for(let i=0; i<8; i++) {
            this.engine.addEffect?.('smoke', spawnX, spawnY);
        }
    }

    drawBody(ctx) {
        ctx.scale(2.5, 2.5);
        if (this.raiseAngle > 0) {
            const outDist = this.raiseAngle * 12;
            ctx.fillStyle = '#1e272e';
            const outriggers = [
                { x: -25, y: -12, dx: -1, dy: -1 }, { x: 0, y: -12, dx: 0, dy: -1 }, { x: 25, y: -12, dx: 1, dy: -1 },
                { x: -25, y: 12, dx: -1, dy: 1 }, { x: 0, y: 12, dx: 0, dy: 1 }, { x: 25, y: 12, dx: 1, dy: 1 }
            ];
            outriggers.forEach(o => {
                ctx.save();
                ctx.translate(o.x + o.dx * outDist, o.y + o.dy * outDist);
                ctx.fillRect(-3, -3, 6, 6);
                ctx.strokeStyle = '#95a5a6';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(-o.dx * outDist, -o.dy * outDist); ctx.lineTo(0, 0); ctx.stroke();
                ctx.restore();
            });
        }
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-35, -12, 70, 24);
        ctx.fillStyle = '#000';
        for(let i=0; i<4; i++) {
            ctx.fillRect(-30 + i*20, -14, 12, 4);
            ctx.fillRect(-30 + i*20, 10, 12, 4);
        }
        ctx.fillStyle = '#34495e';
        ctx.fillRect(20, -12, 15, 24);
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(30, -10, 3, 20);
    }

    drawTurret(ctx) {
        ctx.scale(2.5, 2.5);
        ctx.translate(-10, 0);
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        const canisterLen = 50 - (this.raiseAngle * 15);
        if (this.raiseAngle > 0.1) {
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(5, -4, 15 * this.raiseAngle, 3);
            ctx.fillRect(5, 1, 15 * this.raiseAngle, 3);
        }
        const mslGrd = ctx.createLinearGradient(0, -10, 0, 10);
        mslGrd.addColorStop(0, '#34495e');
        mslGrd.addColorStop(0.5, '#2d3436');
        mslGrd.addColorStop(1, '#1e272e');
        ctx.fillStyle = mslGrd;
        ctx.fillRect(-5, -10, canisterLen, 20);
        ctx.fillStyle = '#f1c40f';
        for(let i=0; i<3; i++) {
            ctx.fillRect(5 + i*12, -10, 3, 20);
        }
        if (this.raiseAngle > 0.8) {
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.arc(canisterLen - 10, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(canisterLen - 10, 0, 6, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(canisterLen - 8, -8, 4, 16);
        }

        if (this.isSieged) {
            const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(241, 196, 15, ${0.3 + pulse * 0.7})`;
            ctx.beginPath(); ctx.arc(-20, -8, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-20, 8, 3, 0, Math.PI * 2); ctx.fill();
        }
    }
}

export class Train extends PlayerUnit {
    static editorConfig = { category: 'vehicle', icon: 'train', name: '기차' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'train';
        this.name = '기차';
        this.speed = 0;
        this.fireRate = 1000;
        this.damage = 0;
        this.color = '#7f8c8d';
        this.attackRange = 0;
        this.visionRange = 4;
        this.size = 120; // 길쭉한 형태를 위해 크게 설정
        this.cargoSize = 99; // 수송 불가
        this.population = 10; // 대규모 운송 수단 설정
        this.hp = 2000;
        this.maxHp = 2000;
        this.attackTargets = []; // 공격 불가

        this.ammoType = null;
        this.maxAmmo = 0;
        this.ammo = 0;
    }

    attack() {
        // 공격 기능 없음
    }

    update(deltaTime) {
        // BaseUnit의 update를 호출하여 충돌(밀어내기) 로직은 실행하되,
        // 자체적인 이동 명령(destination)은 무시함
        super.update(deltaTime);
        if (this._destination) {
            this._destination = null;
            this.path = [];
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.scale(2, 2);

        // --- 그림자 (Depth 효과) ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-38, -8, 80, 26);

        // 1. 하부 구동부 프레임
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-42, -13, 84, 26);

        // 2. 바퀴 (심플한 현대식 보기 대차 느낌)
        ctx.fillStyle = '#0a0a0a';
        for (let i = -32; i <= 32; i += 16) {
            ctx.fillRect(i - 6, -15, 12, 4);
            ctx.fillRect(i - 6, 11, 12, 4);
        }

        // 3. 메인 바디 (박스형 기관차 본체)
        // 측면 명암을 위한 그라데이션
        const bodyGrd = ctx.createLinearGradient(0, -11, 0, 11);
        bodyGrd.addColorStop(0, '#2c3e50'); // 상단 어두운 파랑
        bodyGrd.addColorStop(0.3, '#34495e'); // 메인 컬러
        bodyGrd.addColorStop(1, '#1a252f'); // 하단 쉐이딩
        ctx.fillStyle = bodyGrd;
        ctx.fillRect(-40, -11, 80, 22);

        // 4. 전면부 (기관실 방향)
        // 전면 유리창 및 경사면 표현
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(30, -11);
        ctx.lineTo(42, -9);
        ctx.lineTo(42, 9);
        ctx.lineTo(30, 11);
        ctx.closePath();
        ctx.fill();

        // 전면 유리 (Light Blue)
        ctx.fillStyle = '#85c1e9';
        ctx.beginPath();
        ctx.moveTo(34, -8);
        ctx.lineTo(41, -7);
        ctx.lineTo(41, 7);
        ctx.lineTo(34, 8);
        ctx.closePath();
        ctx.fill();

        // 5. 상단 디테일 (루프 및 환풍구)
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-35, -12, 60, 2); // 루프 라인
        ctx.fillRect(-35, 10, 60, 2);

        // 환풍기/팬 디테일
        ctx.fillStyle = '#1a1a1a';
        for (let i = -20; i <= 10; i += 15) {
            ctx.beginPath();
            ctx.arc(i, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            // 팬 날개 느낌
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(i - 3, 0); ctx.lineTo(i + 3, 0);
            ctx.moveTo(i, -3); ctx.lineTo(i, 3);
            ctx.stroke();
        }

        // 6. 측면 도어 및 점검창
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(-10, -11, 8, 22); // 중앙 출입문
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-9, -10, 6, 20);

        // 7. 하이라이트 및 범퍼
        ctx.fillStyle = '#f1c40f'; // 노란색 안전 경고선
        ctx.fillRect(40, -11, 2, 22);
        ctx.fillRect(-42, -11, 2, 22);

        // 헤드라이트 (쌍등)
        const pulse = Math.sin(Date.now() / 250) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + pulse * 0.3})`;
        ctx.beginPath(); ctx.arc(41, -5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(41, 5, 2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}

export class FreightCar extends PlayerUnit {
    static editorConfig = { category: 'vehicle', icon: 'freight-car', name: '화물칸' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'freight-car';
        this.name = '화물칸';
        this.speed = 0;
        this.fireRate = 1000;
        this.damage = 0;
        this.color = '#95a5a6';
        this.attackRange = 0;
        this.visionRange = 2;
        this.size = 110; 
        this.cargoSize = 99; // 수송 불가
        this.population = 0;
        this.hp = 1500;
        this.maxHp = 1500;
        this.attackTargets = [];

        this.ammoType = null;
        this.maxAmmo = 0;
        this.ammo = 0;
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this._destination) {
            this._destination = null;
            this.path = [];
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.scale(2, 2);

        // --- 그림자 ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-38, -8, 76, 26);

        // 1. 하부 프레임 및 연결부
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-42, -12, 84, 24);
        // 커플러 (연결기) 표현
        ctx.fillRect(-45, -3, 6, 6);
        ctx.fillRect(39, -3, 6, 6);

        // 2. 바퀴 (보기 대차)
        ctx.fillStyle = '#0a0a0a';
        for (let i = -30; i <= 30; i += 60) {
            ctx.fillRect(i - 6, -14, 12, 4);
            ctx.fillRect(i - 6, 10, 12, 4);
        }

        // 3. 컨테이너 본체
        const bodyGrd = ctx.createLinearGradient(0, -10, 0, 10);
        bodyGrd.addColorStop(0, '#7f8c8d');
        bodyGrd.addColorStop(0.5, '#95a5a6');
        bodyGrd.addColorStop(1, '#707b7c');
        ctx.fillStyle = bodyGrd;
        ctx.fillRect(-38, -10, 76, 20);

        // 컨테이너 주름(수직선) 디테일
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let i = -32; i <= 32; i += 8) {
            ctx.beginPath();
            ctx.moveTo(i, -10);
            ctx.lineTo(i, 10);
            ctx.stroke();
        }

        // 4. 상단 루프 디테일
        ctx.fillStyle = '#707b7c';
        ctx.fillRect(-35, -11, 70, 2);
        ctx.fillRect(-35, 9, 70, 2);

        // 6. 안전 반사판
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-38, 6, 3, 2);
        ctx.fillRect(35, 6, 3, 2);

        ctx.restore();
    }
}

export class SAMLauncher extends TurretUnit {
    static editorConfig = { category: 'vehicle', icon: 'anti-air', name: '자주 대공 미사일' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'sam-launcher';
        this.name = '자주 대공 미사일 (SAM)';
        this.speed = 1.2;
        this.fireRate = 3500;
        this.damage = 250;
        this.attackRange = 700;
        this.visionRange = 12;
        this.attackTargets = ['air']; // 오직 공중만 타격
        this.size = 85;
        this.cargoSize = 8;
        this.population = 3;
        this.hp = 1200;
        this.maxHp = 1200;
        this.muzzleOffset = 40;
        
        this.armorType = 'heavy'; // 장갑형
        this.weaponType = 'missile';
        
        this.ammoType = 'missile';
        this.maxAmmo = 8;
        this.ammo = 8;
        
        this.turretRotationSpeed = 0.08;
    }

    attack() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate || !this.target) return;

        // 포탑 조준 정렬 확인 (TurretUnit 로직 활용)
        const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        let diff = targetAngle - this.turretAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > 0.15) return;

        const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
        if (dist > this.attackRange) return;

        if (this.ammo <= 0) return;

        this.engine.audioSystem.play('missile_flight', { volume: 0.25 });
        
        this.engine.entityManager.create('guided-missile', this.x, this.y, {
            target: this.target,
            damage: this.damage,
            ownerId: this.ownerId,
            flightAngle: this.turretAngle 
        }, 'neutral');

        this.ammo--;
        this.lastFireTime = now;
    }

    drawBody(ctx) {
        ctx.scale(2.2, 2.2);
        const hullColor = '#3a4118'; 
        const darkHull = '#2d3212';  

        ctx.fillStyle = darkHull;
        ctx.fillRect(-20, -13, 40, 26);

        ctx.fillStyle = hullColor;
        ctx.beginPath();
        ctx.roundRect(-20, -11, 40, 22, 2);
        ctx.fill();

        ctx.fillStyle = '#1a1a1a';
        for(let i=-15; i<=15; i+=10) {
            ctx.fillRect(i-3, -14, 6, 2);
            ctx.fillRect(i-3, 12, 6, 2);
        }
    }

    drawTurret(ctx) {
        const turretImg = this.getPartBitmap(this.type, 'turret', (offCtx) => {
            offCtx.scale(2.2, 2.2);
            const hullColor = '#3a4118'; 
            const darkHull = '#2d3212';  
            const lightHull = '#4b5320'; 

            offCtx.fillStyle = darkHull;
            offCtx.beginPath();
            offCtx.moveTo(-12, -10); offCtx.lineTo(8, -10); offCtx.lineTo(12, -6);
            offCtx.lineTo(12, 6); offCtx.lineTo(8, 10); offCtx.lineTo(-12, 10);
            offCtx.closePath();
            offCtx.fill();

            offCtx.fillStyle = lightHull;
            offCtx.fillRect(-6, -6, 12, 12);
            offCtx.fillStyle = '#1a1a1a';
            offCtx.fillRect(2, -4, 3, 8); 

            const drawCanisterBank = (offsetY) => {
                offCtx.save();
                offCtx.translate(0, offsetY);
                offCtx.fillStyle = darkHull;
                offCtx.fillRect(-2, -4, 22, 9); 
                offCtx.fillStyle = hullColor;
                offCtx.fillRect(-4, -5, 22, 9);
                offCtx.fillStyle = '#000';
                const holes = [-2.2, 2.2];
                holes.forEach((hy) => {
                    offCtx.beginPath();
                    offCtx.arc(16, hy, 1.8, 0, Math.PI * 2);
                    offCtx.fill();
                });
                offCtx.restore();
            };
            drawCanisterBank(-6); 
            drawCanisterBank(6);
        });

        const s = turretImg.width;
        ctx.drawImage(turretImg, -s/2, -s/2);

        // --- 실시간 레이더 애니메이션 & 탄두 표시 (캐시 제외) ---
        ctx.save();
        ctx.scale(2.2, 2.2);
        
        // 탄두(미사일) 표시
        const hullColor = '#3a4118'; 
        const drawMissileHeads = (offsetY) => {
            const holes = [-2.2, 2.2];
            holes.forEach((hy, idx) => {
                const globalIdx = (offsetY < 0 ? 0 : 2) + idx;
                if (this.ammo > globalIdx) {
                    ctx.fillStyle = '#95a5a6'; 
                    ctx.beginPath(); ctx.arc(15.5, hy + offsetY, 1.2, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#ff3131'; 
                    ctx.beginPath(); ctx.arc(16.5, hy + offsetY, 0.8, 0, Math.PI * 2); ctx.fill();
                }
            });
        };
        drawMissileHeads(-6);
        drawMissileHeads(6);

        // 레이더
        ctx.translate(-8, 0);
        const radarRot = (Date.now() / 800) % (Math.PI * 2);
        ctx.rotate(radarRot);
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-2, -1, 4, 2);
        ctx.fillStyle = '#2d3212'; // darkHull
        ctx.fillRect(-1, -8, 2, 16);
        ctx.fillStyle = '#3a4118'; // hullColor
        ctx.fillRect(-2, -8, 2, 16);
        if (Math.sin(Date.now() / 100) > 0) {
            ctx.fillStyle = '#00d2ff';
            ctx.fillRect(-2, -6, 1, 2);
        }
        ctx.restore();
    }
}
