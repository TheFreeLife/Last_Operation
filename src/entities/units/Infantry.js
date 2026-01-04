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

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

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

            // 1. 전술 백팩 (입체감 강화)
            ctx.fillStyle = '#2d3310'; // 측면 어두운 면
            ctx.fillRect(-10.5, -5, 6, 10);
            ctx.fillStyle = '#3a4118'; // 윗면 밝은 면
            ctx.fillRect(-10, -5, 5, 10);
            // MOLLE 웨빙 디테일
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.5;
            for (let i = -3; i <= 3; i += 3) {
                ctx.beginPath(); ctx.moveTo(-10, i); ctx.lineTo(-5, i); ctx.stroke();
            }

            // 2. 바디 (전투복 & 레이어드 아머)
            // 전투복 (디지털 패턴 느낌의 점 찍기)
            ctx.fillStyle = '#556644';
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3a4118'; // 미세 패턴
            ctx.fillRect(-2, 2, 1, 1); ctx.fillRect(2, -3, 1, 1);

            // 플레이트 캐리어 (입체적 돌출)
            ctx.fillStyle = '#4b5320';
            ctx.beginPath();
            ctx.roundRect(-2.5, -5, 7, 10, 1);
            ctx.fill();
            // 조끼 상단 어깨끈
            ctx.fillStyle = '#3a4118';
            ctx.fillRect(-2, -5, 2, 2);
            ctx.fillRect(-2, 3, 2, 2);

            // 탄창 파우치 (돌출된 입체)
            ctx.fillStyle = '#2d3310';
            ctx.fillRect(0.5, -3.5, 2.5, 7); // 파우치 베이스
            ctx.fillStyle = '#3a4118'; // 각 파우치 덮개
            ctx.fillRect(1, -3, 2, 1.5);
            ctx.fillRect(1, -0.5, 2, 1.5);
            ctx.fillRect(1, 2, 2, 1.5);

            // 3. 헬멧 (High-Cut 입체형)
            const hGrd = ctx.createRadialGradient(1, -1, 1, 1, 0, 5);
            hGrd.addColorStop(0, '#6b7a4d');
            hGrd.addColorStop(1, '#4b5320');
            ctx.fillStyle = hGrd;
            ctx.beginPath(); ctx.arc(1, 0, 4.8, 0, Math.PI * 2); ctx.fill();

            // NVG 마운트 (이마 부분)
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(4.5, -1.2, 1.5, 2.4);

            // 사이드 레일 및 헤드셋
            ctx.fillStyle = '#2d3436';
            ctx.fillRect(1, -4.8, 2.5, 1.2); // 레일
            ctx.fillRect(1, 3.6, 2.5, 1.2);
            ctx.fillStyle = '#1e272e';
            ctx.beginPath(); ctx.arc(1, -4.2, 1.8, 0, Math.PI * 2); ctx.fill(); // 헤드셋 컵
            ctx.beginPath(); ctx.arc(1, 4.2, 1.8, 0, Math.PI * 2); ctx.fill();

            // 4. 전술 소총 (Custom AR-15 Style)
            ctx.save();
            ctx.translate(3.5, 2);
            if (isShooting) ctx.translate(-1.2, 0);

            // 개머리판 및 스톡 봉
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(-3, -0.8, 4, 1.6);
            ctx.fillStyle = '#2d3436';
            ctx.beginPath(); ctx.roundRect(-4, -1.5, 3, 3, 0.5); ctx.fill();

            // 총몸 (Receiver & Magazine Well)
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(1, -1.5, 9, 3.5);
            ctx.fillStyle = '#2d3436'; // 상부 리시버 요철
            ctx.fillRect(2, -1.8, 6, 1);

            // 탄창 (Magpul Style)
            ctx.fillStyle = '#3a4118';
            ctx.beginPath(); ctx.roundRect(6.5, 1, 2.2, 4.5, 0.5); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)'; // 탄창 홈
            ctx.beginPath(); ctx.moveTo(7, 2); ctx.lineTo(7, 4.5); ctx.stroke();

            // 총열 및 레일 (Handguard)
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(10, -1.2, 11, 2.4);
            ctx.fillStyle = '#2d3436'; // 피카티니 레일 표현
            for (let i = 11; i < 20; i += 2) ctx.fillRect(i, -1.5, 1, 3);

            // 조준경 (EOTech Style Holo Sight)
            ctx.fillStyle = '#111';
            ctx.fillRect(4, -3.2, 4, 2);
            ctx.fillStyle = 'rgba(0, 210, 255, 0.4)'; // 렌즈 반사
            ctx.fillRect(7, -2.8, 1, 1.2);

            // 소염기 및 가스 블록
            ctx.fillStyle = '#000';
            ctx.fillRect(21, -1.2, 3, 2.4);

            // 팔 및 손 (전술 장갑)
            ctx.fillStyle = '#556644';
            ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill(); // 어깨/소매
            ctx.beginPath(); ctx.arc(10, 2.2, 2.5, 0, Math.PI * 2); ctx.fill(); // 앞팔
            ctx.fillStyle = '#2d3436'; // 장갑
            ctx.beginPath(); ctx.arc(2, 0.5, 2.2, 0, Math.PI * 2); ctx.fill(); // 오른손
            ctx.beginPath(); ctx.arc(14, 1.2, 2.2, 0, Math.PI * 2); ctx.fill(); // 왼손

            // 총구 화염 (부드러운 순간 광원만 표시)
            if (isShooting) {
                ctx.save();
                ctx.translate(22, 0); // 총구 위치

                const flashSize = 15 + Math.random() * 10;
                const alpha = 0.4 + Math.random() * 0.2;

                // 부드러운 구형 광원 (Glow)
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashSize);
                grad.addColorStop(0, `rgba(255, 215, 0, ${alpha})`);
                grad.addColorStop(0.5, `rgba(255, 165, 0, ${alpha * 0.3})`);
                grad.addColorStop(1, 'transparent');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, flashSize, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            ctx.restore();
            ctx.restore();
        });

        ctx.restore();

        // 아군 체력 바 (분대 통합 표시)
        const barW = 40;
        const barY = this.y - 35;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 5);
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
        this.hitEffectType = 'hit';
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
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);

        const isShooting = (this.target && (Date.now() - this.lastFireTime < 200));

        // 1. 길리 슈트 (Ghillie Suit - 몸체 덮개)
        ctx.fillStyle = '#2d3310'; // 어두운 숲색

        // 단순화된 위장 망토 (Hooded Cloak)
        ctx.beginPath();
        // 어깨에서 등으로 떨어지는 망토 형태
        ctx.moveTo(0, -5);
        ctx.bezierCurveTo(-8, -5, -10, 0, -8, 5); // 왼쪽 라인
        ctx.lineTo(0, 6); // 하단
        ctx.bezierCurveTo(8, 5, 8, -5, 0, -5); // 오른쪽 라인
        ctx.fill();

        // 텍스처 패턴 (지저분하지 않게 단순 점)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(-4, -2, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, 1, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-2, 3, 1.5, 0, Math.PI * 2); ctx.fill();

        // 몸통 (엎드린 자세 느낌)
        ctx.fillStyle = '#2d3310';
        ctx.beginPath();
        ctx.ellipse(-2, 0, 6, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 머리 (후드/베일)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        // 스코프를 보는 눈
        ctx.fillStyle = '#111';
        ctx.fillRect(2, -1, 2, 2);

        // 3. 대구경 저격 소총 (Anti-Materiel Rifle)
        ctx.save();
        ctx.translate(4, 1); // 견착 위치

        if (isShooting) {
            ctx.translate(-2, 0); // 강한 반동
        }

        // 총몸 (Body)
        ctx.fillStyle = '#2f3640';
        ctx.fillRect(0, -1.5, 8, 3);
        // 개머리판 (Stock - 조절형)
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-4, -1, 4, 2);
        ctx.fillRect(-4, 0.5, 3, 1); // 칙패드

        // 긴 총열 (Long Barrel)
        ctx.fillStyle = '#2f3640';
        ctx.fillRect(8, -1, 16, 2);
        // 소염기 (Muzzle Brake)
        ctx.fillStyle = '#111';
        ctx.fillRect(24, -1.5, 4, 3);

        // 대형 스코프 (High-Power Scope)
        ctx.fillStyle = '#111';
        ctx.fillRect(2, -3.5, 8, 2); // 경통
        ctx.fillStyle = '#00d2ff'; // 렌즈 반사
        ctx.beginPath(); ctx.arc(2, -2.5, 1, 0, Math.PI * 2); ctx.fill();

        // 양각대 (Bipod - 펼침)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(18, 0); ctx.lineTo(20, -4);
        ctx.moveTo(18, 0); ctx.lineTo(20, 4);
        ctx.stroke();

        // 위장 랩 (Rifle Wrap)
        ctx.fillStyle = '#4b5320';
        ctx.beginPath(); ctx.ellipse(12, 0, 3, 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(18, 0, 2, 1, -0.5, 0, Math.PI * 2); ctx.fill();

        // 오른손 (그립)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(0, 1, 2, 0, Math.PI * 2); ctx.fill();
        // 왼손 (개머리판 지지 - 정밀 사격 자세)
        ctx.beginPath(); ctx.arc(-2, 2, 2, 0, Math.PI * 2); ctx.fill();

        // 발사 이펙트 (강력한 충격파)
        if (isShooting) {
            ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
            ctx.beginPath();
            ctx.moveTo(28, 0);
            ctx.lineTo(35, -3); ctx.lineTo(38, 0); ctx.lineTo(35, 3);
            ctx.fill();

            // 측면 가스 분출
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(26, -1); ctx.lineTo(28, -5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(26, 1); ctx.lineTo(28, 5); ctx.stroke();
        }

        ctx.restore();
        ctx.restore();

        // 아군 체력 바
        const barW = 20;
        const barY = this.y - 20;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 3);
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
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2); // 2배 확대

        const isWorking = (this.command === 'repair' || (this.command === 'build' && this.buildingTarget));

        // 작업 애니메이션: 전술 망치질
        let hammerAngle = 0;
        let hammerOffset = 0;
        if (isWorking) {
            // 속도 조절: 100 -> 250 (느리게)
            const cycle = (Date.now() / 250) % Math.PI;
            hammerAngle = Math.sin(cycle * 4) * 0.9;
            hammerOffset = Math.sin(cycle * 4) * 2;
        }

        // 1. 전술 백팩 (Military Backpack)
        ctx.fillStyle = '#3a4118'; // 짙은 국방색
        ctx.fillRect(-11, -6, 6, 12);
        // 결속 끈/장비 (MOLLE webbing 느낌)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-11, -4, 6, 1);
        ctx.fillRect(-11, 3, 6, 1);
        // 야전삽 (등에 부착)
        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.ellipse(-11, 0, 2, 4, 0, 0, Math.PI * 2); ctx.fill();

        // 2. 몸체 (전투복 & 방탄 조끼)
        // 전투복 (Olive Drab)
        ctx.fillStyle = '#556644';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();

        // 방탄 조끼 (Plate Carrier - Coyote Brown or Dark Green)
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-3, -5, 7, 10);
        // 탄입대/파우치 디테일
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-3, 1, 3, 3);
        ctx.fillRect(1, 1, 3, 3);

        // 3. 머리 (전술 헬멧)
        // 헬멧 (MICH/ACH Style)
        ctx.fillStyle = '#4b5320';
        ctx.beginPath(); ctx.arc(1.5, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        // 헬멧 귀덮개/헤드셋
        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(1.5, -4, 2, 0, Math.PI * 2); ctx.fill(); // 왼쪽 귀
        ctx.beginPath(); ctx.arc(1.5, 4, 2, 0, Math.PI * 2); ctx.fill();  // 오른쪽 귀

        // 전술 고글 (헬멧 위에 얹음)
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(2, -3, 2, 6);
        ctx.fillStyle = '#34495e'; // 렌즈
        ctx.fillRect(2.5, -2.5, 1, 2);
        ctx.fillRect(2.5, 0.5, 1, 2);

        // 4. 양손 & 전술 브리칭 해머 (Tactical Hammer)
        ctx.save();
        ctx.translate(3, 2);

        if (isWorking) {
            // 작업 시: 망치질 애니메이션
            ctx.rotate(hammerAngle);
            ctx.translate(hammerOffset, 0);
        } else {
            // 대기 시: 위로 대각선으로 들고 있음 (Ready Position)
            ctx.rotate(-Math.PI / 4); // -45도 회전
            ctx.translate(-2, 0); // 회전 축 보정
        }

        // 팔 (전투복 소매 - 걷어올림)
        ctx.fillStyle = '#556644';
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        // 살색 팔뚝
        ctx.fillStyle = '#eebb99';
        ctx.beginPath(); ctx.arc(1.5, 0, 2, 0, Math.PI * 2); ctx.fill();

        // 망치 자루 (조금 더 짧게 잡음)
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(2, -1, 12, 2); // 길이 14 -> 12

        // 망치 헤드 (위치 당김: 14 -> 12)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(12, -3.5, 5, 7);
        // 타격부
        ctx.fillStyle = '#636e72';
        ctx.fillRect(17, -3.5, 1, 7); // 19 -> 17
        ctx.beginPath(); ctx.moveTo(12, -1); ctx.lineTo(10, 0); ctx.lineTo(12, 1); ctx.fill(); // 뒤쪽 스파이크

        // 전술 장갑
        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(7, 0, 2.5, 0, Math.PI * 2); ctx.fill(); // 오른손 (8 -> 7)
        ctx.beginPath(); ctx.arc(3, 0, 2.5, 0, Math.PI * 2); ctx.fill(); // 왼손 (4 -> 3)

        // 작업 효과 (스파크 대신 파편/먼지)
        if (isWorking && Math.abs(hammerAngle) > 0.6) {
            ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(20 + Math.random() * 4, (Math.random() - 0.5) * 8, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
        ctx.restore();

        // 아군 체력 바
        const barW = 24;
        const barY = this.y - 28;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}
