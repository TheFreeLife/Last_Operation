import { Entity } from '../BaseEntity.js';

/**
 * PlayerUnit - 모든 플레이어 유닛의 기본 클래스
 * 기존 Entities.js의 PlayerUnit을 그대로 유지하되 약간 정리
 */
export class BaseUnit extends Entity {
    constructor(x, y, engine) {
        super(x, y);
        this.engine = engine;
        this.attackRange = 250;
        this.visionRange = 5;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 1;
        this.target = null;
        this.lastFireTime = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.alive = true;
        this.size = 40;
        this.damage = 0;
        this._destination = null;
        this.path = [];
        this.pathRecalculateTimer = 0;
        this.command = 'stop';
        this.patrolStart = null;
        this.patrolEnd = null;
        this.domain = 'ground';
        this.attackTargets = ['ground', 'sea'];
        this.canBypassObstacles = false;
        this.isInitialExit = false;
        this.popCost = 0;

        // 탄약 시스템
        this.ammoType = null;
        this.maxAmmo = 0;
        this.ammo = 0;
        this.ammoConsumption = 1;

        // 공격 특성
        this.attackType = 'hitscan';
        this.explosionRadius = 0;
        this.hitEffectType = 'bullet';

        this.fireRate = 1000;
    }

    get destination() { return this._destination; }
    set destination(value) {
        this._destination = value;
        if (value && this.transportTarget) {
            this.transportTarget = null;
        }

        if (value) {
            if (this.domain === 'air') {
                this.path = [{ x: value.x, y: value.y }];
            } else {
                this.path = this.engine.pathfinding.findPath(
                    this.x, this.y, value.x, value.y,
                    this.canBypassObstacles, this.pathfindingSize
                ) || [];

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

    performAttack() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate || !this.target) return;

        if (this.maxAmmo > 0) {
            if (this.ammo < this.ammoConsumption) {
                if (now - (this._lastAmmoMsgTime || 0) > 2000) {
                    this.engine.addEffect?.('system', this.x, this.y - 30, '#ff3131', '탄약 부족!');
                    this._lastAmmoMsgTime = now;
                }
                return;
            }
            this.ammo -= this.ammoConsumption;
        }

        if (this.attackType === 'hitscan') {
            this.executeHitscanAttack();
        } else if (this.attackType === 'projectile') {
            this.executeProjectileAttack();
        }

        this.lastFireTime = now;
    }

    executeHitscanAttack() {
        const tx = this.target.x;
        const ty = this.target.y;

        if (this.explosionRadius > 0) {
            const nearby = this.engine.entityManager?.getNearby(tx, ty, this.explosionRadius) || [];
            for (const ent of nearby) {
                if (this.canDamage(ent, this.engine)) {
                    ent.takeDamage(this.damage);
                }
            }
        } else {
            this.target.takeDamage(this.damage);
        }

        if (this.engine.addEffect) {
            const effect = this.hitEffectType || (this.explosionRadius > 0 ? 'explosion' : 'hit');
            this.engine.addEffect(effect, tx, ty, this.color || '#fff');
        }
    }

    executeProjectileAttack() {
        const { Projectile } = this.engine.entityClasses;
        const p = new Projectile(this.x, this.y, this.target, this.damage, this.color || '#ffff00', this);

        if (this.explosionRadius > 0) {
            p.type = 'shell';
            p.explosionRadius = this.explosionRadius;
        } else if (this.type === 'anti-air') {
            p.type = 'tracer';
            p.speed = 18;
        }

        this.engine.entities.projectiles.push(p);
    }

    update(deltaTime) {
        if (!this.alive) return;
        if (this.hitTimer > 0) this.hitTimer -= deltaTime;

        // 공수 강하 낙하 로직
        if (this.isFalling) {
            this.fallTimer += deltaTime;
            if (this.fallTimer >= this.fallDuration) {
                this.isFalling = false;
                this.domain = (this.type === 'scout-plane' || this.type === 'drone') ? 'air' : 'ground';
                if (this.engine.addEffect) {
                    this.engine.addEffect('system', this.x, this.y, '#fff', '착륙 완료!');
                }
            }
            return;
        }

        // 수송기 탑승 로직
        if (this.transportTarget) {
            const target = this.transportTarget;
            const occupied = target.getOccupiedSize ? target.getOccupiedSize() : 0;
            const hasSpace = (occupied + (this.cargoSize || 1)) <= (target.cargoCapacity || 10);

            if (!target.active || target.hp <= 0 || (target.altitude !== undefined && target.altitude > 0.1) || !hasSpace) {
                this.transportTarget = null;
                this.command = 'stop';
            } else {
                const entranceDist = target.type === 'cargo-plane' ? 90 : 40;
                const entranceX = target.x + Math.cos(target.angle + Math.PI) * entranceDist;
                const entranceY = target.y + Math.sin(target.angle + Math.PI) * entranceDist;

                const d = Math.hypot(this.x - entranceX, this.y - entranceY);

                if (d < 15) {
                    if (target.loadUnit && target.loadUnit(this)) {
                        this.transportTarget = null;
                        return;
                    }
                } else {
                    if (!this._destination || Math.hypot(this._destination.x - entranceX, this._destination.y - entranceY) > 40) {
                        this._destination = { x: entranceX, y: entranceY };
                        this.path = this.engine.pathfinding.findPath(this.x, this.y, entranceX, entranceY, this.canBypassObstacles, this.pathfindingSize) || [];
                    }
                }
            }
        }

        // 타겟팅 - EntityManager 사용으로 최적화
        let bestTarget = null;

        const canActuallyAttack = (typeof this.attack === 'function' && this.damage > 0 && this.type !== 'engineer');

        if (canActuallyAttack && this.command !== 'move') {
            if (this.manualTarget) {
                const isTargetDead = (this.manualTarget.active === false) || (this.manualTarget.hp <= 0);
                if (isTargetDead) {
                    this.manualTarget = null;
                    this.command = 'stop';
                    this.destination = null;
                } else {
                    const distToManual = Math.hypot(this.manualTarget.x - this.x, this.manualTarget.y - this.y);
                    if (distToManual <= this.attackRange) {
                        bestTarget = this.manualTarget;
                    } else {
                        if (!this._destination || Math.hypot(this._destination.x - this.manualTarget.x, this._destination.y - this.manualTarget.y) > 40) {
                            this.destination = { x: this.manualTarget.x, y: this.manualTarget.y };
                        }
                    }
                }
            }

            if (!bestTarget && !this.manualTarget) {
                // EntityManager 사용 (있으면)
                const nearby = this.engine.entityManager?.getNearby(
                    this.x, this.y, this.attackRange,
                    (e) => {
                        if (e === this || !e.active || e.hp <= 0) return false;
                        const relation = this.engine.getRelation(this.ownerId, e.ownerId);
                        if (relation !== 'enemy') return false;
                        const enemyDomain = e.domain || 'ground';
                        return this.attackTargets.includes(enemyDomain);
                    }
                ) || [];

                if (nearby.length > 0) {
                    nearby.sort((a, b) => {
                        const distA = Math.hypot(a.x - this.x, a.y - this.y);
                        const distB = Math.hypot(b.x - this.x, b.y - this.y);
                        return distA - distB;
                    });
                    bestTarget = nearby[0];
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
            // 경로 따라가기
            while (this.path.length > 0) {
                const waypoint = this.path[0];
                const distToWaypoint = Math.hypot(waypoint.x - this.x, waypoint.y - this.y);
                if (distToWaypoint < 5) {
                    this.path.shift();
                } else {
                    break;
                }
            }

            if (this.path.length > 0) {
                const waypoint = this.path[0];
                this.angle = Math.atan2(waypoint.y - this.y, waypoint.x - this.x);
                this.moveWithCollision(this.speed);
            } else {
                const distToFinal = Math.hypot(this._destination.x - this.x, this._destination.y - this.y);
                if (distToFinal < 3) {
                    this.isInitialExit = false;
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
                    this.angle = Math.atan2(this._destination.y - this.y, this._destination.x - this.x);
                    this.moveWithCollision(Math.min(this.speed, distToFinal));

                    this.pathRecalculateTimer -= deltaTime;
                    if (this.pathRecalculateTimer <= 0) {
                        this.destination = this._destination;
                    }
                }
            }
        }

        // 유닛 간 밀어내기
        let pushX = 0;
        let pushY = 0;

        const allUnits = [...this.engine.entities.units, ...this.engine.entities.enemies, ...this.engine.entities.neutral];
        for (const other of allUnits) {
            if (other === this || !other.active || other.hp <= 0 || other.isBoarded) continue;
            if (other.isFalling || this.isFalling) continue;
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
        this.x = Math.max(this.size / 2, Math.min(mapW - this.size / 2, this.x));
        this.y = Math.max(this.size / 2, Math.min(mapH - this.size / 2, this.y));

        if (this.hp <= 0) this.alive = false;
    }

    processUnloading(deltaTime) {
        if (!this.isUnloading || !this.cargo || this.cargo.length === 0) {
            this.isUnloading = false;
            return;
        }

        this.unloadTimer += deltaTime;
        if (this.unloadTimer >= this.unloadInterval) {
            this.unloadTimer = 0;
            const unit = this.cargo.shift();

            const rearDist = this.type === 'cargo-plane' ? 80 : 40;
            const rearX = this.x + Math.cos(this.angle + Math.PI) * rearDist;
            const rearY = this.y + Math.sin(this.angle + Math.PI) * rearDist;

            unit.isBoarded = false;
            unit.active = true;
            unit.x = rearX;
            unit.y = rearY;
            unit.angle = this.angle + Math.PI;

            const exitDestX = rearX + Math.cos(this.angle + Math.PI) * 40;
            const exitDestY = rearY + Math.sin(this.angle + Math.PI) * 40;
            unit.destination = { x: exitDestX, y: exitDestY };

            if (this.cargo.length === 0) this.isUnloading = false;
        }
    }

    moveWithCollision(dist) {
        const nextX = this.x + Math.cos(this.angle) * dist;
        const nextY = this.y + Math.sin(this.angle) * dist;

        let canMoveX = true;
        let canMoveY = true;

        if (this.domain === 'ground' && !this.isFalling && !this.isInitialExit) {
            const obstacles = [...this.engine.getAllBuildings(), ...this.engine.entities.resources.filter(r => !r.covered)];
            const unitRadius = this.collisionRadius;

            for (const b of obstacles) {
                if (b === this || b.passable) continue;

                const { Resource } = this.engine.entityClasses || {};
                if (Resource && b instanceof Resource) {
                    const minCollisionDist = unitRadius + (b.size * 0.5);
                    if (Math.hypot(nextX - b.x, this.y - b.y) < minCollisionDist) canMoveX = false;
                    if (Math.hypot(this.x - b.x, nextY - b.y) < minCollisionDist) canMoveY = false;
                } else {
                    const bounds = b.getSelectionBounds();
                    const margin = unitRadius;

                    const isCurrentlyInside = (this.x > bounds.left && this.x < bounds.right &&
                        this.y > bounds.top && this.y < bounds.bottom);

                    if (nextX + margin > bounds.left && nextX - margin < bounds.right && (this.y + margin > bounds.top && this.y - margin < bounds.bottom)) {
                        if (!isCurrentlyInside) canMoveX = false;
                    }
                    if (this.x + margin > bounds.left && this.x - margin < bounds.right && (nextY + margin > bounds.top && nextY - margin < bounds.bottom)) {
                        if (!isCurrentlyInside) canMoveY = false;
                    }
                }
            }
        }

        if (canMoveX) this.x = nextX;
        if (canMoveY) this.y = nextY;
    }

    attack() { }
}

// 하위 호환성을 위해 별칭 제공
export const PlayerUnit = BaseUnit;
