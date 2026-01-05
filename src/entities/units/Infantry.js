import { PlayerUnit } from './BaseUnit.js';

export class Rifleman extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'rifleman';
        this.name = '보병 분대'; // 이름 변경
        this.speed = 0.9;
        this.fireRate = 150; // 분대 사격 연사력 조정
        this.damage = 15;    // 분대 통합 공격력 15
        this.attackRange = 200; // 사거리 소폭 상향
        this.size = 60;      // 분대 크기에 맞춰 선택 영역 확장
        this.visionRange = 5;
        this.hp = 210;       // 3인 통합 체력 (70*3)
        this.maxHp = 210;
        this.attackTargets = ['ground', 'sea', 'air'];
        this.cargoSize = 3;  // 분대이므로 적재 용량 증가
        this.attackType = 'hitscan';
        this.hitEffectType = 'bullet';
        this.popCost = 1;

        this.ammoType = 'bullet';
        this.maxAmmo = 150;
        this.ammo = 150;
        this.ammoConsumption = 3;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }

        // 삼각형 대열 오프셋 (중심 기준)
        const formation = [
            { x: 15, y: 0 },   // 리더 (앞)
            { x: -12, y: -18 }, // 좌측 후방
            { x: -12, y: 18 }   // 우측 후방
        ];

        formation.forEach((pos, index) => {
            ctx.save();
            ctx.translate(pos.x, pos.y);

            // 분대원마다 미세한 각도 및 애니메이션 차이 부여 (생동감)
            const individualOffset = (index * 1234) % 100;
            const breathing = Math.sin((Date.now() + individualOffset) / 400) * 0.5;
            ctx.rotate(breathing * 0.05);
            ctx.scale(1.8, 1.8);

            const isShooting = (this.target && (Date.now() - this.lastFireTime < 200));

            // 0. 하부 그림자 (부드러운 타원)
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI * 2); ctx.fill();

            // 1. 전술 백팩
            ctx.fillStyle = '#2d3310';
            ctx.fillRect(-10.5, -5, 6, 10);
            ctx.fillStyle = '#3a4118';
            ctx.fillRect(-10, -5, 5, 10);

            // 2. 바디 (전투복 & 레이어드 아머)
            ctx.fillStyle = '#556644';
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();

            // 플레이트 캐리어
            ctx.fillStyle = '#4b5320';
            ctx.beginPath();
            ctx.roundRect(-2.5, -5, 7, 10, 1);
            ctx.fill();

            // 3. 헬멧
            ctx.fillStyle = '#4b5320';
            ctx.beginPath(); ctx.arc(1, 0, 4.8, 0, Math.PI * 2); ctx.fill();

            // 4. 전술 소총
            ctx.save();
            ctx.translate(3.5, 2);
            if (isShooting) ctx.translate(-1.2, 0);

            ctx.fillStyle = '#1e272e';
            ctx.fillRect(1, -1.5, 9, 3.5);
            ctx.fillRect(10, -1.2, 11, 2.4);

            // 팔 및 손
            ctx.fillStyle = '#556644';
            ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 2.2, 2.5, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
            ctx.restore();
        });
    }
}

export class Sniper extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'sniper';
        this.name = '저격수';
        this.speed = 0.8; // 소총병보다 약간 느림
        this.fireRate = 2000; // 2초에 한 번 발사
        this.damage = 70;
        this.attackRange = 450;
        this.size = 24;
        this.visionRange = 10; // 시야가 매우 넓음
        this.hp = 40;
        this.maxHp = 40;
        this.attackTargets = ['ground', 'sea', 'air'];
        this.attackType = 'hitscan';
        this.hitEffectType = 'hit'; // 피격 이펙트 타입 설정
        this.popCost = 1;

        this.ammoType = 'bullet';
        this.maxAmmo = 10;
        this.ammo = 10;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.scale(2, 2);

        const isShooting = (this.target && (Date.now() - this.lastFireTime < 200));

        // 1. 길리 슈트
        ctx.fillStyle = '#2d3310';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.bezierCurveTo(-8, -5, -10, 0, -8, 5);
        ctx.lineTo(0, 6);
        ctx.bezierCurveTo(8, 5, 8, -5, 0, -5);
        ctx.fill();

        // 2. 머리
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();

        // 3. 대구경 저격 소총
        ctx.save();
        ctx.translate(4, 1);
        if (isShooting) ctx.translate(-2, 0);

        ctx.fillStyle = '#2f3640';
        ctx.fillRect(0, -1.5, 8, 3);
        ctx.fillRect(8, -1, 16, 2);

        ctx.restore();
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
        this.targetObject = null;
        this.currentSharedTask = null; // 현재 맡은 공유 작업
        this.buildingTarget = null; // 현재 짓고 있는 건물 객체
        this.myGroupQueue = null; // 이 유닛이 속한 건설 그룹의 큐 (배열 참조)
        this.stuckTimer = 0; // 도달 불가능한 건설지 체크용 타이머
        this.popCost = 1;
    }

    clearBuildQueue() {
        // 1. 현재 짓고 있는 실체화된 건물 취소 및 제거
        if (this.buildingTarget && this.buildingTarget.isUnderConstruction) {
            const buildInfo = this.engine.buildingRegistry[this.buildingTarget.type];
            if (buildInfo) {
                // 자원 환불 (남은 진행도에 상관없이 전액 환불 또는 비례 환불 가능 - 여기선 전액)
                this.engine.resources.gold += buildInfo.cost;
                
                // 타일 점유 해제
                this.engine.clearBuildingTiles(this.buildingTarget);

                // 엔티티 목록에서 제거
                const list = this.engine.entities[buildInfo.list];
                if (list) {
                    const idx = list.indexOf(this.buildingTarget);
                    if (idx !== -1) list.splice(idx, 1);
                }

                // [중요] EntityManager 및 공간 그리드에서 제거 (렌더링 잔상 방지)
                if (this.engine.entityManager) {
                    this.engine.entityManager.remove(this.buildingTarget);
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

                    // [버그 수정] 건물 내부 끼임 방지 강화: 건물의 실제 범위를 계산하여 외곽으로 밀어냄
                    const bounds = this.buildingTarget.getSelectionBounds ? 
                                   this.buildingTarget.getSelectionBounds() : 
                                   { left: this.buildingTarget.x - 40, right: this.buildingTarget.x + 40, 
                                     top: this.buildingTarget.y - 40, bottom: this.buildingTarget.y + 40 };
                    
                    const margin = this.size / 2 + 10;
                    // 현재 위치가 건물 경계 내부인지 확인
                    if (this.x > bounds.left - 5 && this.x < bounds.right + 5 &&
                        this.y > bounds.top - 5 && this.y < bounds.bottom + 5) {
                        
                        // 상하좌우 중 가장 가까운 외곽 계산
                        const distL = Math.abs(this.x - (bounds.left - margin));
                        const distR = Math.abs(this.x - (bounds.right + margin));
                        const distT = Math.abs(this.y - (bounds.top - margin));
                        const distB = Math.abs(this.y - (bounds.bottom + margin));
                        const minDist = Math.min(distL, distR, distT, distB);

                        if (minDist === distL) this.x = bounds.left - margin;
                        else if (minDist === distR) this.x = bounds.right + margin;
                        else if (minDist === distT) this.y = bounds.top - margin;
                        else this.y = bounds.bottom + margin;

                        // 밀려난 위치를 새로운 목적지로 설정하여 자연스럽게 멈추게 함
                        this.destination = { x: this.x, y: this.y };
                        this.path = [];
                    }

                    if (this.buildingTarget.targetResource) {
                        const resList = this.engine.entities.resources;
                        const resIdx = resList.indexOf(this.buildingTarget.targetResource);
                        if (resIdx !== -1) resList.splice(resIdx, 1);
                    }

                    // 건물 건설 완료 시 인구수 갱신 트리거
                    if (this.engine.updatePopulation) {
                        this.engine.updatePopulation();

                        // 시각적 알림 추가
                        const msg = this.buildingTarget.type === 'apartment' ? '보급 한도 증가 (+10)' : '건설 완료';
                        const color = this.buildingTarget.type === 'apartment' ? '#39ff14' : '#fff';
                        this.engine.addEffect?.('system', this.buildingTarget.x, this.buildingTarget.y - 40, color, msg);
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

                    // [추가] 도달 불가능한 지점 체크: 이동 중인데 속도가 거의 없다면 stuck 타이머 증가
                    if (this.path.length === 0 && Math.hypot(this.x - closestX, this.y - closestY) > 50) {
                        this.stuckTimer += deltaTime;
                        if (this.stuckTimer > 3000) { // 3초 이상 못 가면 포기
                            this.engine.addEffect?.('system', this.x, this.y - 30, '#ff3131', '경로 차단됨: 건설 취소');
                            this.clearBuildQueue();
                            this.command = 'stop';
                            this.stuckTimer = 0;
                        }
                    } else {
                        this.stuckTimer = 0;
                    }
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
        ctx.scale(2, 2); // 2배 확대

        const isWorking = (this.command === 'repair' || (this.command === 'build' && this.buildingTarget));

        // 1. 전술 백팩
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-11, -6, 6, 12);

        // 2. 몸체
        ctx.fillStyle = '#556644';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();

        // 3. 머리 (전술 헬멧)
        ctx.fillStyle = '#4b5320';
        ctx.beginPath(); ctx.arc(1.5, 0, 4.5, 0, Math.PI * 2); ctx.fill();

        // 4. 양손 & 전술 브리칭 해머
        ctx.save();
        ctx.translate(3, 2);

        if (isWorking) {
            ctx.rotate(Math.sin((Date.now() / 250) * 4) * 0.9);
        } else {
            ctx.rotate(-Math.PI / 4);
        }

        ctx.fillStyle = '#1e272e';
        ctx.fillRect(2, -1, 12, 2); 
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(12, -3.5, 5, 7);

        ctx.restore();
        ctx.restore();
    }
}
