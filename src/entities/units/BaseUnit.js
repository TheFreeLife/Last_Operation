import { Entity } from '../BaseEntity.js';

/**
 * BaseUnit (구 PlayerUnit)
 * 모든 플레이어 유닛의 기본 클래스
 */
export class BaseUnit extends Entity {
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
        this.canBypassObstacles = false; // 장애물 통과 가능 여부

        // --- 탄약 시스템 속성 ---
        this.ammoType = null; // 'bullet', 'shell', 'missile'
        this.maxAmmo = 0;
        this.ammo = 0;
        this.ammoConsumption = 1; // 기본 발당 소모량

        // 공격 특성 설정
        this.attackType = 'hitscan'; // 'hitscan' (즉시 타격) 또는 'projectile' (탄환 발사)
        this.explosionRadius = 0;    // 0보다 크면 범위 공격 적용
        this.hitEffectType = 'bullet'; // 기본 피격 효과

        // [최적화] 타겟팅 연산 부하 분산을 위한 타이머
        this.targetingTimer = Math.random() * 500;
    }

    get destination() { return this._destination; }
    set destination(value) {
        this._destination = value;
        // 새로운 목적지가 설정되면 수송기 탑승 명령은 취소됨
        if (value && this.transportTarget) {
            this.transportTarget = null;
        }

        if (value) {
            if (this.domain === 'air') {
                // 공중 유닛은 장애물을 무시하고 목적지까지 직선으로 비행
                this.path = [{ x: value.x, y: value.y }];
            } else {
                // [수정] worldToGrid를 거치지 않고 직접 월드 좌표를 전달
                this.engine.flowField.generate(value.x, value.y, this.sizeClass);
                this.path = []; 
            }
            this.pathRecalculateTimer = 1000;
        } else {
            this.path = [];
        }
    }

    /**
     * 유닛의 크기에 따른 Size Class 반환 (1x1, 2x2, 3x3 등)
     */
    get sizeClass() {
        if (this.size <= 48) return 1;
        if (this.size <= 96) return 2;
        return 3;
    }

    get sizeCategoryName() {
        const sc = this.sizeClass;
        if (sc === 1) return '소형 (1x1)';
        if (sc === 2) return '대형 (2x2)';
        return '초대형 (3x3)';
    }

    // 공통 공격 처리 로직
    performAttack() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate || !this.target) return;

        // --- 탄약 체크 로직 ---
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

        // --- 총구 화염 (Muzzle Flash) 생성 ---
        if (this.engine.addEffect) {
            // 유닛 타입별 총구 오프셋 (단순화된 계산)
            let barrelLen = this.size * 0.6;
            if (this.type === 'tank') barrelLen = 60;
            else if (this.type === 'artillery') barrelLen = 80;
            else if (this.type === 'sniper') barrelLen = 40;

            const mx = this.x + Math.cos(this.angle) * barrelLen;
            const my = this.y + Math.sin(this.angle) * barrelLen;
            
            // 전차나 자주포는 대형 포구 화염 (전용 효과)
            if (this.type === 'tank' || this.type === 'artillery' || this.type === 'missile-launcher') {
                this.engine.addEffect('muzzle_large', mx, my, '#ff8c00');
            } else {
                this.engine.addEffect('muzzle', mx, my, '#fff');
            }
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
            // 범위 공격 (전차 등)
            const radiusSq = this.explosionRadius * this.explosionRadius;
            const entities = this.engine.entities;

            const applyAoE = (ent) => {
                if (!ent || ent.hp === undefined || !ent.active || ent.hp <= 0) return;
                if (!this.attackTargets.includes(ent.domain || 'ground')) return;

                const relation = this.engine.getRelation(this.ownerId, ent.ownerId);
                if (this.manualTarget !== ent && (relation === 'self' || relation === 'ally')) return;

                const dx = ent.x - tx;
                const dy = ent.y - ty;
                if (dx * dx + dy * dy <= radiusSq) {
                    ent.takeDamage(this.damage);
                }
            };

            entities.enemies.forEach(applyAoE);
            entities.units.forEach(applyAoE);
            entities.neutral.forEach(applyAoE);
            
            // 피격 파티클 (폭발)
            if (this.engine.addEffect) {
                this.engine.addEffect('explosion', tx, ty, '#ff4500');
            }
        } else {
            // 단일 대상 공격 (보병 등)
            if (this.target && typeof this.target.takeDamage === 'function') {
                this.target.takeDamage(this.damage);
                
                // 피격 파티클 (스파크)
                if (this.engine.addEffect) {
                    this.engine.addEffect('hit', tx, ty, this.color || '#fff');
                }
            } else {
                // 타겟이 부적절하면 타겟 해제
                this.target = null;
                this.manualTarget = null;
            }
        }
    }

    executeProjectileAttack() {
        // ECS 기반 고성능 투사체 생성
        const options = {
            speed: (this.type === 'anti-air') ? 18 : 8,
            explosionRadius: this.explosionRadius || 0,
            ownerId: this.ownerId
        };

        this.engine.entityManager.spawnProjectileECS(
            this.x, 
            this.y, 
            this.target, 
            this.damage, 
            options
        );
    }

    // [최적화] 상태 기반 비트맵 캐시 키 반환
    getCacheKey() {
        // 변신 중이거나 특수 상태일 때는 실시간 렌더링을 위해 null 반환 가능
        if (this.isTransitioning) return null;
        return this.type;
    }

    update(deltaTime) {
        if (!this.alive || this.isBoarded) return;
        if (this.targetingTimer > 0) this.targetingTimer -= deltaTime;
        if (this.hitTimer > 0) this.hitTimer -= deltaTime;

        // --- 공수 강하 낙하 로직 ---
        if (this.isFalling) {
            this.fallTimer += deltaTime;
            if (this.fallTimer >= this.fallDuration) {
                this.isFalling = false;
                // 도메인 복구 (스카웃 등 원래 공중 유닛이면 air 유지)
                this.domain = (this.type === 'scout-plane' || this.type === 'drone') ? 'air' : 'ground';
                // 착륙 이펙트 (먼지 등)
                if (this.engine.addEffect) {
                    this.engine.addEffect('system', this.x, this.y, '#fff', '착륙 완료!');
                }
            }
            return; // 낙하 중에는 이동/공격 불가
        }

        // --- 수송기 탑승 로직 추가 ---
        if (this.transportTarget) {
            const target = this.transportTarget;
            const occupied = target.getOccupiedSize ? target.getOccupiedSize() : 0;
            const hasSpace = (occupied + (this.cargoSize || 1)) <= (target.cargoCapacity || 10);

            if (!target.active || target.hp <= 0 || (target.altitude !== undefined && target.altitude > 0.1) || !hasSpace) {
                this.transportTarget = null;
                this.command = 'stop';
            } else {
                const entranceDist = target.type === 'cargo-plane' ? 110 : 40;
                const entranceX = target.x + Math.cos(target.angle + Math.PI) * entranceDist;
                const entranceY = target.y + Math.sin(target.angle + Math.PI) * entranceDist;

                const d = Math.hypot(this.x - entranceX, this.y - entranceY);

                if (d < 40) {
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

        // 1. --- Command Logic & Targeting ---
        const enemies = this.engine.entities.enemies;
        let bestTarget = null;
        let minDistToMe = Infinity;

        let canActuallyAttack = (typeof this.attack === 'function' && this.damage > 0);
        if (this.type === 'missile-launcher') canActuallyAttack = false;

        if (canActuallyAttack && this.command !== 'move') {
            if (this.manualTarget) {
                const isTargetDead = (this.manualTarget.active === false) || (this.manualTarget.hp <= 0);
                const targetDomain = this.manualTarget.domain || 'ground';
                const canHit = this.attackTargets.includes(targetDomain);

                if (isTargetDead) {
                    this.manualTarget = null;
                    this.command = 'stop';
                    this.destination = null;
                } else if (canHit) {
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

            if (!bestTarget && !this.manualTarget && this.targetingTimer <= 0) {
                this.targetingTimer = 200 + Math.random() * 100;
                const potentialTargets = this.engine.entityManager && this.engine.entityManager.getNearby
                    ? this.engine.entityManager.getNearby(this.x, this.y, this.attackRange)
                    : [
                        ...this.engine.entities.enemies,
                        ...this.engine.entities.neutral,
                        ...this.engine.entities.units
                    ];

                for (const e of potentialTargets) {
                    if (e === this || !e.active || e.hp <= 0 || e.isBoarded) continue;

                    const relation = this.engine.getRelation(this.ownerId, e.ownerId);
                    if (relation !== 'enemy') continue;

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
            const distToFinal = Math.hypot(this._destination.x - this.x, this._destination.y - this.y);

            if (distToFinal < 10) {
                this.isInitialExit = false; // 출격 모드 해제
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
                // [Flow Field 이동 연산]
                if (this.domain === 'air') {
                    this.angle = Math.atan2(this._destination.y - this.y, this._destination.x - this.x);
                } else {
                    const vector = this.engine.flowField.getFlowVector(this.x, this.y, this.sizeClass);
                    if (vector.x !== 0 || vector.y !== 0) {
                        // 유동장 벡터 방향으로 부드럽게 회전
                        const targetAngle = Math.atan2(vector.y, vector.x);
                        const angleDiff = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
                        this.angle += angleDiff * 0.15; // 회전 감도
                    } else if (distToFinal > 5) {
                        // 유동장이 없거나 목적지 타일에 도달했지만, 물리적으로 아직 거리가 남은 경우 직선 이동
                        const targetAngle = Math.atan2(this._destination.y - this.y, this._destination.x - this.x);
                        const angleDiff = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
                        this.angle += angleDiff * 0.15;
                    }
                }
                this.moveWithCollision(Math.min(this.speed, distToFinal));
            }
        }

        // --- 강력한 밀어내기 (Anti-Stuck & Units) ---
        let pushX = 0;
        let pushY = 0;

        // 1. 유닛 간 충돌 (SpatialGrid를 사용하여 주변 유닛만 검사 - O(N) 최적화)
        // 검색 반경: 내 크기 + 상대 최대 크기(대략 60) 정도면 충분
        const neighborRadius = this.size + 40;
        const neighbors = this.engine.entityManager.getNearby(this.x, this.y, neighborRadius);

        for (const other of neighbors) {
            // 자신 제외, 비활성 제외, 탑승 중 제외, 다른 도메인(공중 vs 지상) 제외
            if (other === this || !other.active || other.hp <= 0 || other.isBoarded) continue;
            // 유닛이 아닌 것(건물 등)은 제외 (건물 충돌은 moveWithCollision에서 처리됨)
            if (!other.speed && other.type !== 'wall') continue; 
            
            if (other.isFalling || this.isFalling) continue;
            if (this.domain !== other.domain) continue;

            const d = Math.hypot(this.x - other.x, this.y - other.y);
            const minDist = (this.size + other.size) * 0.5; // 선택 박스와 일치하도록 0.5로 변경
            
            if (d < minDist && d > 0.1) { // 0 나누기 방지
                const pushAngle = Math.atan2(this.y - other.y, this.x - other.x);
                const force = (minDist - d) / minDist; // 가까울수록 강하게 밈
                pushX += Math.cos(pushAngle) * force * 1.5;
                pushY += Math.sin(pushAngle) * force * 1.5;
            }
        }

        // 2. 장애물 끼임 탈출 (건물 및 자원) - [중복 로직 제거 및 최적화]
        // 위에서 이미 pushX/pushY가 아닌 직접 좌표 수정으로 처리했으므로 
        // 여기서의 중복 검사는 건너뛰거나 push 벡터 방식으로 통일할 수 있으나, 
        // 하단은 유닛 간 밀어내기 위주로 재편성합니다.

        this.x += pushX;
        this.y += pushY;

        const mapW = this.engine.tileMap.cols * this.engine.tileMap.tileSize;
        const mapH = this.engine.tileMap.rows * this.engine.tileMap.tileSize;
        this.x = Math.max(this.size / 2, Math.min(mapW - this.size / 2, this.x));
        this.y = Math.max(this.size / 2, Math.min(mapH - this.size / 2, this.y));

        if (this.hp <= 0) this.alive = false;
    }

    // [수송 유닛 공통] 하차 처리 로직
    processUnloading(deltaTime) {
        if (!this.isUnloading || this.cargo.length === 0) {
            this.isUnloading = false;
            return;
        }

        this.unloadTimer += deltaTime;
        if (this.unloadTimer >= this.unloadInterval) {
            this.unloadTimer = 0;
            const unit = this.cargo.shift();

            // 후방 하차 위치 계산
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

    // [헬퍼] 충돌을 고려한 이동 처리 (점 기반 이동 + 원형 반발력 시스템)
    moveWithCollision(dist) {
        if (this.domain === 'air') {
            this.x += Math.cos(this.angle) * dist;
            this.y += Math.sin(this.angle) * dist;
            return;
        }

        const tileMap = this.engine.tileMap;
        const moveX = Math.cos(this.angle) * dist;
        const moveY = Math.sin(this.angle) * dist;
        
        // 이동 가능 여부 체크 (Size Class 기반 영역 체크)
        const canPass = (wx, wy) => {
            const sc = this.sizeClass;
            const ts = tileMap.tileSize;
            // 유닛 중심(wx, wy)으로부터 좌상단 격자(gx, gy) 계산
            const gx = Math.floor(wx / ts - (sc - 1) / 2);
            const gy = Math.floor(wy / ts - (sc - 1) / 2);
            return tileMap.isPassableArea(gx, gy, sc);
        };

        // --- 1. 전진 시도 ---
        if (canPass(this.x + moveX, this.y + moveY)) {
            this.x += moveX;
            this.y += moveY;
        } else {
            // --- 2. 슬라이딩 시도 ---
            if (canPass(this.x + moveX, this.y)) {
                this.x += moveX;
            } else if (canPass(this.x, this.y + moveY)) {
                this.y += moveY;
            }
        }

        // --- 3. 능동적 벽 반발력 ---
        const curG = tileMap.worldToGrid(this.x, this.y);
        const searchRange = Math.ceil(this.sizeClass / 2) + 1;
        const minDist = this.size * 0.5; // 선택 박스 절반 크기와 일치하도록 변경

        for (let dy = -searchRange; dy <= searchRange; dy++) {
            for (let dx = -searchRange; dx <= searchRange; dx++) {
                const tx = curG.x + dx;
                const ty = curG.y + dy;
                const tile = tileMap.grid[ty]?.[tx];
                
                if (tile && !tile.passable) {
                    const wallLeft = tx * tileMap.tileSize;
                    const wallTop = ty * tileMap.tileSize;
                    const wallRight = wallLeft + tileMap.tileSize;
                    const wallBottom = wallTop + tileMap.tileSize;

                    const closestX = Math.max(wallLeft, Math.min(this.x, wallRight));
                    const closestY = Math.max(wallTop, Math.min(this.y, wallBottom));

                    const d = Math.hypot(this.x - closestX, this.y - closestY);

                    if (d < minDist) {
                        const pushAngle = Math.atan2(this.y - closestY, this.x - closestX);
                        const force = (minDist - d) / minDist;
                        this.x += Math.cos(pushAngle) * force * 4;
                        this.y += Math.sin(pushAngle) * force * 4;
                    }
                }
            }
        }
    }

    attack() { }
}

// 하위 호환성을 위해 별칭 제공
export const PlayerUnit = BaseUnit;
