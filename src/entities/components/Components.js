/**
 * Component - 모든 컴포넌트의 기본 클래스
 */
export class Component {
    constructor() {
        this.entity = null;
    }

    update(deltaTime, engine) { }
}

/**
 * HealthComponent - HP 및 피격 관리
 */
export class HealthComponent extends Component {
    constructor(maxHp) {
        super();
        this.maxHp = maxHp;
        this.hp = maxHp;
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.entity.active = false;
            if (this.entity.alive !== undefined) {
                this.entity.alive = false;
            }
        }
    }

    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }

    getHealthPercent() {
        return this.hp / this.maxHp;
    }
}

/**
 * MovementComponent - 이동 및 경로탐색
 */
export class MovementComponent extends Component {
    constructor(speed, domain = 'ground') {
        super();
        this.speed = speed;
        this.domain = domain;
        this._destination = null;
        this.path = [];
        this.pathRecalculateTimer = 0;
        this.canBypassObstacles = false;
    }

    setDestination(x, y, engine) {
        this._destination = { x, y };

        if (this.domain === 'air') {
            this.path = [{ x, y }];
        } else {
            this.path = engine.pathfinding.findPath(
                this.entity.x,
                this.entity.y,
                x,
                y,
                this.canBypassObstacles,
                this.entity.pathfindingSize
            ) || [];
        }

        this.pathRecalculateTimer = 1000;
    }

    update(deltaTime, engine) {
        if (!this._destination) return;

        // 경로 따라가기
        while (this.path.length > 0) {
            const waypoint = this.path[0];
            const dist = Math.hypot(waypoint.x - this.entity.x, waypoint.y - this.entity.y);
            if (dist < 5) {
                this.path.shift();
            } else {
                break;
            }
        }

        if (this.path.length > 0) {
            const waypoint = this.path[0];
            const angle = Math.atan2(waypoint.y - this.entity.y, waypoint.x - this.entity.x);
            this.entity.angle = angle;

            this.entity.x += Math.cos(angle) * this.speed;
            this.entity.y += Math.sin(angle) * this.speed;
        } else {
            const distToFinal = Math.hypot(this._destination.x - this.entity.x, this._destination.y - this.entity.y);
            if (distToFinal < 3) {
                this._destination = null;
            } else {
                const angle = Math.atan2(this._destination.y - this.entity.y, this._destination.x - this.entity.x);
                this.entity.angle = angle;

                const moveSpeed = Math.min(this.speed, distToFinal);
                this.entity.x += Math.cos(angle) * moveSpeed;
                this.entity.y += Math.sin(angle) * moveSpeed;
            }
        }
    }
}

/**
 * CombatComponent - 공격 및 타겟팅
 */
export class CombatComponent extends Component {
    constructor(options = {}) {
        super();
        this.range = options.range || 150;
        this.damage = options.damage || 10;
        this.fireRate = options.fireRate || 1000;
        this.attackType = options.attackType || 'hitscan'; // 'hitscan' or 'projectile'
        this.explosionRadius = options.explosionRadius || 0;
        this.hitEffectType = options.hitEffectType || 'bullet';

        this.target = null;
        this.lastFireTime = 0;

        // 탄약 시스템
        this.ammoType = options.ammoType || null;
        this.maxAmmo = options.maxAmmo || 0;
        this.ammo = options.maxAmmo || 0;
        this.ammoConsumption = options.ammoConsumption || 1;
    }

    findTarget(engine) {
        const nearby = engine.entityManager?.getNearby(
            this.entity.x,
            this.entity.y,
            this.range,
            (ent) => {
                if (ent === this.entity || !ent.active || ent.hp <= 0) return false;
                const relation = engine.getRelation(this.entity.ownerId, ent.ownerId);
                return relation === 'enemy';
            }
        ) || [];

        if (nearby.length > 0) {
            // 가장 가까운 적 선택
            nearby.sort((a, b) => {
                const distA = Math.hypot(a.x - this.entity.x, a.y - this.entity.y);
                const distB = Math.hypot(b.x - this.entity.x, b.y - this.entity.y);
                return distA - distB;
            });
            this.target = nearby[0];
        } else {
            this.target = null;
        }
    }

    attack(engine) {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate || !this.target) return;

        // 탄약 확인
        if (this.maxAmmo > 0) {
            if (this.ammo < this.ammoConsumption) {
                if (now - (this._lastAmmoMsgTime || 0) > 2000) {
                    engine.addEffect?.('system', this.entity.x, this.entity.y - 30, '#ff3131', '탄약 부족!');
                    this._lastAmmoMsgTime = now;
                }
                return;
            }
            this.ammo -= this.ammoConsumption;
        }

        if (this.attackType === 'hitscan') {
            this.executeHitscanAttack(engine);
        } else if (this.attackType === 'projectile') {
            this.executeProjectileAttack(engine);
        }

        this.lastFireTime = now;
    }

    executeHitscanAttack(engine) {
        const tx = this.target.x;
        const ty = this.target.y;

        if (this.explosionRadius > 0) {
            // 범위 공격
            const nearby = engine.entityManager?.getNearby(tx, ty, this.explosionRadius) || [];
            for (const ent of nearby) {
                if (this.entity.canDamage(ent, engine)) {
                    ent.takeDamage(this.damage);
                }
            }
        } else {
            // 단일 타격
            this.target.takeDamage(this.damage);
        }

        if (engine.addEffect) {
            const effect = this.hitEffectType || (this.explosionRadius > 0 ? 'explosion' : 'hit');
            engine.addEffect(effect, tx, ty, this.entity.color || '#fff');
        }
    }

    executeProjectileAttack(engine) {
        const { Projectile } = engine.entityClasses || {};
        if (!Projectile) return;

        const p = new Projectile(this.entity.x, this.entity.y, this.target, this.damage, this.entity.color || '#ffff00', this.entity);

        if (this.explosionRadius > 0) {
            p.type = 'shell';
            p.explosionRadius = this.explosionRadius;
        }

        engine.entities.projectiles.push(p);
        engine.entityManager?.spatialGrid.add(p);
    }

    update(deltaTime, engine) {
        // 타겟 검색 및 공격
        if (this.entity.command !== 'move') {
            this.findTarget(engine);
            if (this.target) {
                this.entity.angle = Math.atan2(this.target.y - this.entity.y, this.target.x - this.entity.x);
                this.attack(engine);
            }
        }
    }
}

/**
 * ProductionComponent - 유닛 생산 큐 관리
 */
export class ProductionComponent extends Component {
    constructor(productionTime = 5000) {
        super();
        this.productionTime = productionTime;
        this.queue = []; // { type, timer }
    }

    requestUnit(unitType) {
        this.queue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.entity.isUnderConstruction) return;

        if (this.queue.length > 0) {
            const current = this.queue[0];
            current.timer += deltaTime;

            if (current.timer >= this.productionTime) {
                // 유닛 생산 완료 (실제 생성은 각 건물 클래스에서 처리)
                this.onUnitProduced(current.type, engine);
                this.queue.shift();
            }
        }
    }

    onUnitProduced(unitType, engine) {
        // 오버라이드 가능한 메서드
        // 각 건물 클래스에서 구체적인 유닛 생성 로직 구현
    }

    getProgress() {
        if (this.queue.length === 0) return 0;
        return this.queue[0].timer / this.productionTime;
    }
}
