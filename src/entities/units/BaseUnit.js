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
        this.population = 1; // 인구수 (현실적인 승무원/대원 수)
        this.alive = true;
        this.size = 40; // 20 -> 40
        this.damage = 0; // 하위 클래스에서 정의
        this._destination = null;
        this.path = []; // A* 경로 저장용
        this.pathRecalculateTimer = 0;
        this.command = null; // 'move', 'attack', 'build'
        this.domain = 'ground'; // 'ground', 'air', 'sea'
        this.attackTargets = ['ground', 'sea']; // 공격 가능 대상
        this.canBypassObstacles = false; // 장애물 통과 가능 여부

        // --- 탄약 시스템 속성 ---
        this.ammoType = null; // 'bullet', 'shell', 'missile'
        this.maxAmmo = 0;
        this.ammo = 0;
        this.ammoConsumption = 1; // 기본 발당 소모량

        // 공격 특성 설정
        this.attackType = 'projectile'; // 모든 유닛은 투사체 방식
        this.explosionRadius = 0;    // 범위 공격 반경
        this.isIndirect = false;     // 곡사 여부
        this.muzzleOffset = 30;      // 발사구 오프셋 (자기 피격 방지)
        this.projectileSpeed = 12;   // 투사체 속도
        this.hitEffectType = 'bullet'; // 피격 효과 타입

        // --- 상성 시스템 추가 ---
        this.armorType = 'infantry'; // 'infantry', 'light', 'heavy'
        this.weaponType = 'bullet';  // 'bullet', 'sniper', 'shell', 'missile'

        // [최적화] 타겟팅 연산 부하 분산을 위한 타이머
        this.targetingTimer = Math.random() * 500;

        // --- AI 시스템 속성 ---
        this.aiState = 'guard'; // 'guard', 'patrol', 'search', 'chase'
        this.aiRadius = 300;     // 순찰 반경
        this.aiOrigin = { x, y }; // AI 초기 위치 (순찰 기준점)
        this.aiWanderTimer = 0;   // 탐색/순찰 시 무작위 이동 타이머
        this.isAiControlled = false; // 적군(ownerId=2)일 경우 true로 설정됨
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        
        // 기본 상태 리셋 (Factory Defaults)
        this.active = true;
        this.alive = true;
        this.hp = this.maxHp || 100;
        
        this.target = null;
        this.manualTarget = null;
        this.command = null;
        this._destination = null;
        this.path = [];
        this.pathRecalculateTimer = 0;
        this.transportTarget = null;
        this.isBoarded = false;
        this.ammo = this.maxAmmo || 0;
        this.lastFireTime = 0;
        this.isFalling = false;
        this.isUnloading = false;
        this.targetingTimer = Math.random() * 500;
        this.hitTimer = 0;
        
        this.cargo = [];
        this.unloadTimer = 0;
        this.isTransitioning = false;
        this.isInitialExit = false;
        this._lastAmmoMsgTime = 0;
        this._lastLandingBlockedMsgTime = 0;

        this.aiOrigin = { x, y };
        this.aiWanderTimer = 0;
        this.isAiControlled = false; 
        
        this.baseAiState = this.aiState || 'guard';
        if (this.aiRadius === undefined) this.aiRadius = 300;
    }

    /**
     * EntityManager에서 options가 할당된 후 호출됨
     */
    onPropertiesSet() {
        // 소유자에 따른 AI 제어권 설정
        this.isAiControlled = (this.ownerId !== 1);
        
        // HP 보정
        if (this.hp <= 0 && this.maxHp > 0) this.hp = this.maxHp;

        // 이전 생의 추격 상태가 남지 않도록 초기화
        if (this.aiState === 'chase') {
            this.aiState = 'guard';
        }
        this.baseAiState = this.aiState || 'guard';
    }

    get destination() { return this._destination; }
    set destination(value) {
        this._destination = value;
        // 새로운 목적지가 설정되면 수송기 탑승 명령은 취소됨
        if (value && this.transportTarget) {
            this.transportTarget = null;
        }

                if (value) {
                    const isAirUnit = this.domain === 'air' || (this.altitude !== undefined && (this.altitude > 0 || this.type === 'bomber' || this.type === 'cargo-plane' || this.type === 'helicopter' || this.type === 'scout-plane'));
                    
                    if (isAirUnit) {
                        // 공중 유닛(또는 이륙 예정인 유닛)은 장애물을 무시하고 직선 비행
                        this.path = [{ x: value.x, y: value.y }];
                    } else {                // 소유주에 따른 유동장 선택
                const ff = (this.ownerId === 2) ? this.engine.enemyFlowField : this.engine.flowField;
                ff.generate(value.x, value.y, this.sizeClass, this.domain);
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

        // [추가] 사거리 체크: 타겟이 실제 사거리 내에 있을 때만 발사
        const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
        if (dist > this.attackRange) return;

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
            const mx = this.x + Math.cos(this.angle) * this.muzzleOffset;
            const my = this.y + Math.sin(this.angle) * this.muzzleOffset;
            
            // 명시적 효과 타입이 지정되어 있으면 사용, 아니면 기본 로직 사용
            let effectType = this.muzzleEffectType;
            if (!effectType) {
                if (this.explosionRadius > 20 || this.type === 'missile-launcher') {
                    effectType = 'muzzle_large';
                } else {
                    effectType = 'muzzle';
                }
            }
            
            this.engine.addEffect(effectType, mx, my, '#ff8c00');
        }

        // 모든 공격은 이제 투사체 방식
        this.executeProjectileAttack();

        this.lastFireTime = now;
    }

    executeProjectileAttack() {
        // 발사 위치 계산 (오프셋 기반)
        const spawnX = this.x + Math.cos(this.angle) * this.muzzleOffset;
        const spawnY = this.y + Math.sin(this.angle) * this.muzzleOffset;

        // ECS 기반 고성능 투사체 생성
        const options = {
            speed: this.projectileSpeed,
            explosionRadius: this.explosionRadius || 0,
            ownerId: this.ownerId,
            isIndirect: this.isIndirect, // 곡사 여부 전달
            weaponType: this.weaponType  // 무기 상성 타입 전달
        };

        this.engine.entityManager.spawnProjectileECS(
            spawnX, 
            spawnY, 
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
                this.command = null;
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
                // [추가] 타일 타겟 HP 동기화
                if (this.manualTarget.type === 'tile') {
                    const tile = this.engine.tileMap.grid[this.manualTarget.gy]?.[this.manualTarget.gx];
                    if (tile) this.manualTarget.hp = tile.hp;
                    else this.manualTarget.hp = 0;
                }

                const isTargetDead = (this.manualTarget.active === false) || (this.manualTarget.hp <= 0);
                const targetDomain = this.manualTarget.domain || 'ground';
                const canHit = this.attackTargets.includes(targetDomain);
                
                // [추가] 시야 상실 체크 (플레이어 유닛 전용)
                const isTargetHidden = this.ownerId === 1 && !this.engine.tileMap.isInSight(this.manualTarget.x, this.manualTarget.y) && !(this.engine.debugSystem?.isFullVision);

                if (isTargetDead || isTargetHidden || !canHit) {
                    this.manualTarget = null;
                    this.command = null;
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

                // [수정] 발견 반경: 시야(타일) * 48(px) * 1.5
                // 적 유닛은 자신의 탐지 반경 내에 있는 아군만 발견할 수 있음
                const detectionRange = (this.visionRange || 5) * 48 * 1.5;

                const potentialTargets = this.engine.entityManager && this.engine.entityManager.getNearby
                    ? this.engine.entityManager.getNearby(this.x, this.y, detectionRange)
                    : [
                        ...this.engine.entities.enemies,
                        ...this.engine.entities.neutral,
                        ...this.engine.entities.units
                    ];

                for (const e of potentialTargets) {
                    if (e === this || !e.active || e.hp <= 0 || e.isBoarded) continue;

                    const relation = this.engine.getRelation(this.ownerId, e.ownerId);
                    if (relation !== 'enemy') continue;

                    // [수정] 시야 및 천장 판정 체크 (플레이어/적 공통)
                    if (!(this.engine.debugSystem?.isFullVision)) {
                        // 1. 플레이어 유닛은 아군 공유 시야(Fog of War) 내에 있는 적만 타겟팅 가능
                        if (this.ownerId === 1) {
                            if (!this.engine.tileMap.isInSight(e.x, e.y)) continue;
                        }

                        // 2. 천장(실내) 판정: 외부에 있는 유닛은 내부를 볼 수 없음
                        const targetGrid = this.engine.tileMap.worldToGrid(e.x, e.y);
                        const targetTile = this.engine.tileMap.grid[targetGrid.y]?.[targetGrid.x];
                        const targetHasCeiling = targetTile && this.engine.tileMap.layers.ceiling[targetGrid.y]?.[targetGrid.x]?.id && targetTile.ceilingHp > 0;

                        if (targetHasCeiling) {
                            // 공중 유닛은 내부를 볼 수 없음
                            const isAir = (this.domain === 'air' || (this.altitude !== undefined && this.altitude > 0.1));
                            if (isAir) continue;

                            // 지상 유닛은 동일한 방(roomId)에 있을 때만 내부 유닛을 볼 수 있음
                            const myGrid = this.engine.tileMap.worldToGrid(this.x, this.y);
                            const myTile = this.engine.tileMap.grid[myGrid.y]?.[myGrid.x];
                            const myHasCeiling = myTile && this.engine.tileMap.layers.ceiling[myGrid.y]?.[myGrid.x]?.id && myTile.ceilingHp > 0;

                            if (!myHasCeiling || myTile.roomId !== targetTile.roomId) {
                                continue;
                            }
                        }
                    }

                    const enemyDomain = e.domain || 'ground';
                    if (!this.attackTargets.includes(enemyDomain)) continue;

                    const distToMe = Math.hypot(e.x - this.x, e.y - this.y);
                    // 사거리가 아닌 탐지 반경(시야 1.5배) 내에 있는지 확인
                    if (distToMe <= detectionRange && distToMe < minDistToMe) {
                        minDistToMe = distToMe;
                        bestTarget = e;
                    }
                }
            }
        }

        // [추가] 실시간 타겟 유효성 체크 (도메인 변화 대응)
        const finalBestTarget = bestTarget || this.target;
        if (finalBestTarget && finalBestTarget.active && finalBestTarget.hp > 0) {
            const currentTargetDomain = finalBestTarget.domain || 'ground';
            if (!this.attackTargets.includes(currentTargetDomain)) {
                bestTarget = null;
                this.target = null;
                if (this.manualTarget === finalBestTarget) this.manualTarget = null;
            } else {
                bestTarget = finalBestTarget;
            }
        }
        
        this.target = bestTarget;

        // --- 적군 AI 행동 로직 ---
        if (this.isAiControlled) {
            this.updateAIBehavior(deltaTime);
        }

        if (this.target) {
            let tx = this.target.x;
            let ty = this.target.y;

            // [추가] 고층 구조물(관제탑 등) 조준점 보정
            if (this.target.type === 'tile') {
                const wall = this.engine.tileMap.layers.wall[this.target.gy]?.[this.target.gx];
                if (wall && this.engine.tileMap.wallRegistry[wall.id]?.isTall) {
                    ty -= 40; // 관제탑의 몸통 부분을 조준하도록 Y좌표 보정
                }
            }

            const distToTarget = Math.hypot(ty - this.y, tx - this.x);
            const inRange = distToTarget <= this.attackRange;

            // [수정] 이동 중이 아닐 때만 타겟 방향으로 회전
            // 단, 상하 분리 유닛(turretAngle 보유)은 사거리 내에서 하단부(angle)를 고정하여 포탑만 돌아가게 함
            if (!this._destination) {
                if (this.turretAngle === undefined || !inRange) {
                    this.angle = Math.atan2(ty - this.y, tx - this.x);
                }
            }
            
            if (inRange) {
                this.attack();
                // 사거리 내에 들어오면 공격을 위해 정지 (어택땅 또는 추격 중일 때)
                if (this.command === 'attack' || (this.isAiControlled && this.aiState === 'chase')) {
                    this._destination = null;
                    this.path = [];
                }
            } else {
                // 사거리 밖이면 타겟 방향으로 이동 (어택땅 또는 추격 중일 때)
                if (this.command === 'attack' || (this.isAiControlled && this.aiState === 'chase')) {
                    if (!this._destination || Math.hypot(this._destination.x - tx, this._destination.y - ty) > 40) {
                        this.destination = { x: tx, y: ty };
                    }
                }
            }
        } 
        
        // [수정] else if를 if로 변경하여 타겟이 있어도 목적지가 있으면 이동하도록 함 (추격 가능)
        if (this._destination) {
            const distToFinal = Math.hypot(this._destination.x - this.x, this._destination.y - this.y);

            if (distToFinal < 10) {
                this.isInitialExit = false; // 출격 모드 해제
                this._destination = null;
                if (this.command !== 'build') this.command = null;
            } else {
                // [Flow Field 이동 연산]
                if (this.domain === 'air') {
                    this.angle = Math.atan2(this._destination.y - this.y, this._destination.x - this.x);
                    this.moveWithCollision(Math.min(this.speed, distToFinal));
                } else {
                    const ff = (this.ownerId === 2) ? this.engine.enemyFlowField : this.engine.flowField;
                    
                    // [추가] 주기적으로 유동장 재생성 요청 (장애물 파괴 시 반영을 위함)
                    this.pathRecalculateTimer -= deltaTime;
                    if (this.pathRecalculateTimer <= 0) {
                        ff.generate(this._destination.x, this._destination.y, this.sizeClass, this.domain);
                        this.pathRecalculateTimer = 2000; // 2초마다 갱신
                    }

                    const vector = ff.getFlowVector(this.x, this.y, this._destination.x, this._destination.y, this.sizeClass, this.domain);
                    if (vector.x !== 0 || vector.y !== 0) {
                        // 유동장 벡터 방향으로 부드럽게 회전
                        const targetAngle = Math.atan2(vector.y, vector.x);
                        const angleDiff = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
                        this.angle += angleDiff * 0.15; // 회전 감도
                    } else if (distToFinal < 40) {
                        // 목적지에 매우 근접했거나 유동장 타일에 도달했지만 물리적 거리가 남은 경우에만 직선 이동 허용
                        const targetAngle = Math.atan2(this._destination.y - this.y, this._destination.x - this.x);
                        const angleDiff = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
                        this.angle += angleDiff * 0.15;
                    }
                    
                    this.moveWithCollision(Math.min(this.speed, distToFinal), vector);
                }
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
            // 유닛이 아닌 것(건물 등)은 제외 (단, 속도가 0인 유닛도 충돌 계산에는 포함하여 겹침 방지)
            if (other.type === 'missile' || other.type === 'bomb' || other.type === 'projectile') continue;
            if (!(other instanceof BaseUnit) && other.type !== 'wall') continue; 
            
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

        // 3. [추가] 밀려난 후 벽에 박히지 않도록 지형 충돌 해결 (Wall Repulsion)
        if (this.domain !== 'air') {
            const tileMap = this.engine.tileMap;
            const curG = tileMap.worldToGrid(this.x, this.y);
            const searchRange = Math.ceil(this.sizeClass / 2) + 1;
            const minDist = this.size * 0.5;

            for (let dy = -searchRange; dy <= searchRange; dy++) {
                for (let dx = -searchRange; dx <= searchRange; dx++) {
                    const tx = curG.x + dx;
                    const ty = curG.y + dy;
                    const tile = tileMap.grid[ty]?.[tx];
                    
                    if (tile && !tileMap.isPassableArea(tx, ty, 1, this.domain)) {
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
                            // 벽에서 강력하게 밀어냄
                            this.x += Math.cos(pushAngle) * force * 5;
                            this.y += Math.sin(pushAngle) * force * 5;
                        }
                    }
                }
            }
        }

        const mapW = this.engine.tileMap.cols * this.engine.tileMap.tileSize;
        const mapH = this.engine.tileMap.rows * this.engine.tileMap.tileSize;
        this.x = Math.max(this.size / 2, Math.min(mapW - this.size / 2, this.x));
        this.y = Math.max(this.size / 2, Math.min(mapH - this.size / 2, this.y));

        // --- 체력 저하 시 연기 발생 로직 (차량 계열) ---
        if (this.active && (this.armorType === 'light' || this.armorType === 'heavy')) {
            const hpRatio = this.hp / this.maxHp;
            if (hpRatio < 0.5) {
                const smokeChance = (0.5 - hpRatio) * 0.2;
                if (Math.random() < smokeChance) {
                    const ox = (Math.random() - 0.5) * (this.size * 0.5);
                    const oy = (Math.random() - 0.5) * (this.size * 0.5);
                    
                    // HP에 따른 연기 색상 결정
                    let smokeColor = '#999'; // 연한 회색 (50% 부근)
                    if (hpRatio < 0.2) smokeColor = '#222'; // 검은 연기 (위험)
                    else if (hpRatio < 0.35) smokeColor = '#555'; // 진한 회색
                    
                    this.engine.addEffect?.('smoke', this.x + ox, this.y + oy, smokeColor);
                }
            }
        }

        if (this.hp <= 0 && this.active) {
            this.onDeath();
        }
    }

    onDeath() {
        if (!this.active) return;

        // 1. 파괴 효과 생성 (탄환 명중과 분리된 유닛 전용 효과)
        if (this.engine.addEffect) {
            let effectType = 'death_vehicle';
            if (this.armorType === 'infantry') {
                effectType = 'death_infantry';
            } else if (this.size > 100 || this.type === 'icbm-launcher' || this.armorType === 'heavy') {
                effectType = 'death_heavy';
            }
            this.engine.addEffect(effectType, this.x, this.y);
        }

        // 2. 민심 시스템: 적 처치 시 민심 2% 획득 (플레이어 유닛이 적 유닛을 죽였을 때)
        // 여기서는 단순하게 죽은 유닛이 적군(ownerId=2)이면 민심을 올림
        if (this.ownerId === 2 && this.engine.publicSentiment !== undefined) {
            this.engine.publicSentiment = Math.min(100, this.engine.publicSentiment + 2);
        }

        // 3. 부모 클래스의 사망 처리 호출
        super.onDeath();
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
    moveWithCollision(dist, flowVector = null) {
        if (this.domain === 'air') {
            this.x += Math.cos(this.angle) * dist;
            this.y += Math.sin(this.angle) * dist;
            return;
        }

        // 유동장 데이터가 없고 목적지가 멀면 이동하지 않음 (장애물 돌파 방지)
        const distToFinal = this._destination ? Math.hypot(this._destination.x - this.x, this._destination.y - this.y) : 0;
        if (!flowVector || (flowVector.x === 0 && flowVector.y === 0)) {
            if (distToFinal > 40) return;
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
            return tileMap.isPassableArea(gx, gy, sc, this.domain);
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
                
                if (tile && !tileMap.isPassableArea(tx, ty, 1, this.domain)) {
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

    updateAIBehavior(deltaTime) {
        // 타겟이 있으면 추격 모드로 자동 전환 및 수동 타겟으로 고정 (끝까지 추적)
        if (this.target) {
            if (this.aiState !== 'chase') {
                this.aiState = 'chase';
                this.manualTarget = this.target; // 수동 타겟으로 설정하여 끝까지 추적하게 함
            }
            this.command = 'attack';
            return;
        }

        // 수동 타겟이 살아있다면 계속 추격 상태 유지
        if (this.manualTarget && this.manualTarget.active && this.manualTarget.hp > 0) {
            this.aiState = 'chase';
            this.command = 'attack';
            return;
        }

        // 타겟이 없는 상태에서의 행동
        switch (this.aiState) {
            case 'chase':
                // 추격 중이었는데 타겟이 사라짐(처치) -> 원래의 기본 행동으로 복귀
                this.aiState = this.baseAiState;
                this.manualTarget = null;
                this.destination = null;
                break;

            case 'guard':
                // 가만히 대기 (타겟 발견은 update()의 메인 타겟팅 로직에서 처리됨)
                break;

            case 'patrol':
                this.updateWanderBehavior(deltaTime, this.aiRadius);
                break;

            case 'search':
                // 맵 전체 탐색 (반경을 매우 크게 설정)
                this.updateWanderBehavior(deltaTime, 10000);
                break;
        }
    }

    updateWanderBehavior(deltaTime, radius) {
        if (this._destination) return; // 이미 이동 중이면 대기

        this.aiWanderTimer -= deltaTime;
        if (this.aiWanderTimer <= 0) {
            let foundValidPoint = false;
            let finalX = 0;
            let finalY = 0;
            let attempts = 0;
            const maxAttempts = 10;

            const mapW = this.engine.tileMap.cols * this.engine.tileMap.tileSize;
            const mapH = this.engine.tileMap.rows * this.engine.tileMap.tileSize;

            while (!foundValidPoint && attempts < maxAttempts) {
                // 무작위 목적지 생성
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius;
                const tx = this.aiOrigin.x + Math.cos(angle) * dist;
                const ty = this.aiOrigin.y + Math.sin(angle) * dist;

                finalX = Math.max(100, Math.min(mapW - 100, tx));
                finalY = Math.max(100, Math.min(mapH - 100, ty));

                // 목적지 타일이 통과 가능한지 확인
                const gx = Math.floor(finalX / this.engine.tileMap.tileSize);
                const gy = Math.floor(finalY / this.engine.tileMap.tileSize);
                
                if (this.engine.tileMap.isPassableArea(gx, gy, this.sizeClass, this.domain)) {
                    foundValidPoint = true;
                }
                attempts++;
            }

            if (foundValidPoint) {
                this.destination = { x: finalX, y: finalY };
            }
            this.aiWanderTimer = 2000 + Math.random() * 4000; // 2~6초 후 다음 이동 결정
        }
    }
}

// 하위 호환성을 위해 별칭 제공
export const PlayerUnit = BaseUnit;
