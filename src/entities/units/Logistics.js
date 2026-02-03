import { PlayerUnit } from './BaseUnit.js';

export class MilitaryTruck extends PlayerUnit {
    static editorConfig = { category: 'logistics', icon: 'military-truck', name: '군용 트럭' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'military-truck';
        this.name = '군용 트럭';
        this.speed = 2.0;
        this.hp = 600;
        this.maxHp = 600;
        this.population = 2; // 운전병 + 선탑자
        this.size = 80;
        this.cargoSize = 15; // 다른 수송기에 탈 수는 있지만 큰 부피 차지

        this.armorType = 'light';

        this.cargo = [];
        this.cargoCapacity = 5; // 수송량 5
        this.isUnloading = false;
        this.unloadTimer = 0;
        this.unloadInterval = 400;
    }

    getOccupiedSize() {
        return this.cargo.reduce((sum, unit) => sum + (unit.cargoSize || 1), 0);
    }

    getSkillConfig(cmd) {
        if (cmd === 'unload_all') return { type: 'instant', handler: this.startUnloading };
        return null;
    }

    loadUnit(unit) {
        const uSize = unit.cargoSize || 1;
        if (this.isUnloading || (this.getOccupiedSize() + uSize) > this.cargoCapacity) return false;

        unit.isBoarded = true;
        unit.command = 'stop';
        unit.destination = null;
        unit.path = [];
        this.cargo.push(unit);

        if (this.engine.selectedEntities) {
            this.engine.selectedEntities = this.engine.selectedEntities.filter(e => e !== unit);
        }
        this.engine.addEffect?.('system', this.x, this.y - 20, '#ffff00', '유닛 탑승');

        if (this.engine.updateBuildMenu) this.engine.updateBuildMenu();
        return true;
    }

    startUnloading() {
        if (this.cargo.length === 0) return;
        this.isUnloading = true;
        this.unloadTimer = 0;
    }

    update(deltaTime) {
        if (this.isUnloading) {
            this.unloadTimer += deltaTime;
            if (this.unloadTimer >= this.unloadInterval) {
                this.unloadTimer = 0;
                const unit = this.cargo.shift();

                const rearDist = 45;
                unit.x = this.x + Math.cos(this.angle + Math.PI) * rearDist;
                unit.y = this.y + Math.sin(this.angle + Math.PI) * rearDist;
                unit.isBoarded = false;
                unit.active = true;
                unit.angle = this.angle + Math.PI;
                unit.destination = {
                    x: unit.x + Math.cos(this.angle + Math.PI) * 50,
                    y: unit.y + Math.sin(this.angle + Math.PI) * 50
                };

                if (this.cargo.length === 0) this.isUnloading = false;
            }
        }
        super.update(deltaTime);
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();

        // 1. 바퀴 (6개 - 대형 트럭)
        ctx.fillStyle = '#111';
        const wheelPositions = [
            { x: 20, y: -22 }, { x: 20, y: 18 },   // 전륜
            { x: -10, y: -22 }, { x: -10, y: 18 }, // 중륜
            { x: -25, y: -22 }, { x: -25, y: 18 }  // 후륜
        ];
        wheelPositions.forEach(p => ctx.fillRect(p.x, p.y, 12, 6));

        // 2. 섀시 및 몸체 (Chassis)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-35, -18, 70, 36);

        // 3. 운전석 (Cab - 2.5D)
        ctx.fillStyle = '#3a4118'; // 국방색
        ctx.fillRect(15, -18, 25, 36);
        // 유리창
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(32, -15, 6, 30);
        // 헤드라이트
        ctx.fillStyle = '#fff';
        ctx.fillRect(38, -16, 2, 6);
        ctx.fillRect(38, 10, 2, 6);

        // 4. 적재함 (Cargo Bed - 캔버스 덮개 느낌)
        const cargoGrd = ctx.createLinearGradient(-35, 0, 15, 0);
        cargoGrd.addColorStop(0, '#4b5320');
        cargoGrd.addColorStop(1, '#556644');
        ctx.fillStyle = cargoGrd;
        ctx.beginPath();
        ctx.roundRect(-35, -20, 50, 40, 5);
        ctx.fill();

        // 덮개 주름 디테일
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let i = -30; i < 10; i += 10) {
            ctx.beginPath(); ctx.moveTo(i, -20); ctx.lineTo(i, 20); ctx.stroke();
        }

        // 5. 후방 적재함 문
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-37, -15, 4, 30);

        ctx.restore();

        // [수정] 수송기 스타일의 상세 적재 정보 UI
        if (this.cargo.length > 0) {
            const occupiedSize = this.getOccupiedSize();
            const barWidth = 50;
            const barHeight = 6;
            const bx = this.x - barWidth / 2;
            const by = this.y + 30;

            // 배경
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(bx, by, barWidth, barHeight);

            // 적재 게이지 (부피 기준)
            const fillWidth = (occupiedSize / this.cargoCapacity) * barWidth;
            ctx.fillStyle = '#00d2ff';
            ctx.fillRect(bx, by, fillWidth, barHeight);

            // 테두리
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barWidth, barHeight);

            // 텍스트 정보 (부피 기준)
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${occupiedSize} / ${this.cargoCapacity}`, this.x, by + 16);

            // [추가] 적재 유닛 타입별 점(Dot) 표시
            this.cargo.forEach((u, idx) => {
                const dotX = bx + 5 + idx * 8;
                const dotY = by + 10;
                let dotColor = '#fff';
                if (u.type === 'tank') dotColor = '#39ff14';
                else if (u.type === 'rifleman') dotColor = '#556644';
                else if (u.type === 'missile-launcher') dotColor = '#ff3131';

                ctx.fillStyle = dotColor;
                ctx.beginPath(); ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2); ctx.fill();
            });
        }
    }
}

export class MedicalTruck extends MilitaryTruck {
    static editorConfig = { category: 'logistics', icon: 'medical-truck', name: '의무 차량' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'medical-truck';
        this.name = '의무 차량';
        this.speed = 1.8;
        this.hp = 800;
        this.maxHp = 800;
        this.population = 3;
        this.size = 80;
        
        // 에너지 충전 시스템 (주변 의무병 지원)
        this.energyRestoreRate = 15; // 초당 활력 충전량
        this.attackRange = 250;      // 충전 범위
        this.energy = 250;
        this.maxEnergy = 250;
        this.energyConsumptionRate = 12; // 충전 시 본인 에너지 소모율
        this.energyRegenRate = 8;
        this.chargingMedics = [];    // 현재 충전 중인 의무병 목록
    }

    getCacheKey() {
        if ((this.chargingMedics && this.chargingMedics.length > 0) || this.energy < this.maxEnergy) return null;
        return this.type;
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (!this.active || this.hp <= 0) return;

        const isMoving = this.destination !== null;
        this.chargingMedics = [];

        // 활력이 있을 때만 충전 시도
        if (this.energy > 1.0) {
            const frameRestore = this.energyRestoreRate * deltaTime / 1000;
            const neighbors = this.engine.entityManager.getNearby(this.x, this.y, this.attackRange);
            
            for (const unit of neighbors) {
                if (unit === this || unit.ownerId !== 1 || !unit.active || unit.hp <= 0) continue;
                
                // 오직 의무병(Medic)만 충전 대상
                if (unit.type === 'medic' && unit.energy < unit.maxEnergy) {
                    const dist = Math.hypot(this.x - unit.x, this.y - unit.y);
                    if (dist <= this.attackRange) {
                        const toRestore = Math.min(frameRestore, unit.maxEnergy - unit.energy);
                        if (toRestore > 0.001) {
                            unit.energy += toRestore;
                            this.chargingMedics.push(unit);
                        }
                    }
                }
            }
        }

        // 활력 소모 및 재생 로직
        if (this.chargingMedics.length > 0) {
            const totalConsumption = this.energyConsumptionRate * this.chargingMedics.length * deltaTime / 1000;
            this.energy = Math.max(0, this.energy - totalConsumption);
        } else if (!isMoving) {
            this.energy = Math.min(this.maxEnergy, this.energy + (this.energyRegenRate * deltaTime / 1000));
        }
    }

    draw(ctx) {
        // 에너지 전송 빔 렌더링
        if (this.chargingMedics.length > 0) {
            ctx.save();
            if (this.angle) ctx.rotate(-this.angle);
            this.chargingMedics.forEach(unit => {
                const relX = unit.x - this.x;
                const relY = unit.y - this.y;
                
                // 에너지 공급용 하늘색 빔
                ctx.strokeStyle = 'rgba(0, 210, 255, 0.4)';
                ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(relX, relY); ctx.stroke();

                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 15]);
                ctx.lineDashOffset = -Date.now() / 20;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(relX, relY); ctx.stroke();
            });
            ctx.restore();
        }

        super.draw(ctx);

        // 의무 차량 마크
        ctx.save();
        ctx.translate(-10, 0);
        this.ctx = ctx; // [임시] super.draw에서 필요한 경우 대비
        ctx.fillStyle = '#fff';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-6, -2, 12, 4);
        ctx.restore();

        // 활력 게이지
        if (this.energy < this.maxEnergy) {
            ctx.save();
            const barW = 50;
            const barH = 5;
            const bx = -barW / 2;
            const by = 45;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(bx, by, barW, barH);
            ctx.fillStyle = '#00d2ff';
            ctx.fillRect(bx, by, (this.energy / this.maxEnergy) * barW, barH);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barW, barH);
            ctx.restore();
        }
    }
}

export class DroneContainerTruck extends MilitaryTruck {
    static editorConfig = { category: 'logistics', icon: 'drone-truck', name: '드론 사출 차량' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'drone-truck';
        this.name = '드론 사출 차량';
        this.hp = 1000;
        this.maxHp = 1000;
        this.attackRange = 800; // 드론 자동 인지 및 조종 범위
        
        this.droneCount = 20; // 수송 드론 수
        this.maxDroneCount = 20;
        this.isSortieActive = false;
        this.sortieTimer = 0;
        this.sortieInterval = 600; // 0.6초마다 한 대씩 사출
        this.launchedDrones = []; // 현재 이 트럭이 관리하는 드론들
        
        this.armorType = 'light';
    }

    getSkillConfig(cmd) {
        if (cmd === 'sortie') return { type: 'toggle', handler: this.toggleSortie };
        return super.getSkillConfig(cmd);
    }

    toggleSortie() {
        this.isSortieActive = !this.isSortieActive;
        if (this.isSortieActive) {
            this.engine.addEffect?.('system', this.x, this.y - 40, '#39ff14', '드론 사출 개시!');
        } else {
            this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '사출 중단');
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (!this.active || this.hp <= 0) return;

        // 드론 사출 로직
        if (this.isSortieActive && this.droneCount > 0) {
            this.sortieTimer += deltaTime;
            if (this.sortieTimer >= this.sortieInterval) {
                this.sortieTimer = 0;
                this.launchDrone();
            }
        }

        // 관리 리스트 정제 (파괴된 드론 제거)
        this.launchedDrones = this.launchedDrones.filter(d => d.active && d.hp > 0);
    }

        launchDrone() {
            if (this.droneCount <= 0) {
                this.isSortieActive = false; // 사출 완료 시 문 닫기
                return;
            }

            // 트럭 위치에서 드론 생성 (군집 드론)
            const drone = this.engine.entityManager.create('carrier-drone', this.x, this.y, {
                ownerId: this.ownerId,
                parentTruck: this,
                isAutoSuicide: true // 자동 자폭 AI 활성화
            });

            if (drone) {
                this.droneCount--;
                this.launchedDrones.push(drone);
                
                // 살짝 밖으로 튀어나오는 연출
                const angle = Math.random() * Math.PI * 2;
                const dist = 40;
                drone.destination = {
                    x: this.x + Math.cos(angle) * dist,
                    y: this.y + Math.sin(angle) * dist
                };

                // 마지막 드론을 내보냈으면 즉시 사출 모드 종료
                if (this.droneCount <= 0) {
                    this.isSortieActive = false;
                    this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '드론 전량 사출 완료');
                }
            }
        }

    

        draw(ctx) {

            super.draw(ctx);

    

            // 컨테이너 상단 해치 렌더링 (사출 중일 때 열린 모습)

            ctx.save();

            ctx.translate(-10, 0);

            

            // 메인 컨테이너 박스

            ctx.fillStyle = '#2d3436';

            ctx.fillRect(-20, -15, 40, 30);

            

            if (this.isSortieActive && this.droneCount > 0) {

                // 열린 해치 (빨간 경고등 효과)

                ctx.fillStyle = '#c0392b';

                ctx.fillRect(-15, -12, 30, 24);

                const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;

                ctx.fillStyle = `rgba(255, 0, 0, ${0.3 * pulse})`;

                ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();

            } else {

                // 닫힌 해치 (빗금 패턴)

                ctx.strokeStyle = '#636e72';

                ctx.lineWidth = 1;

                for(let i=-15; i<=15; i+=5) {

                    ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i+3, 12); ctx.stroke();

                }

            }

            ctx.restore();

        }

    }

    