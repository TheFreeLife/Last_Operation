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

        this.name = '전략 드론 사출 모함';

        this.size = 125; // 초대형 (Class 3)

        this.hp = 1200;

        this.maxHp = 1200;

        this.attackRange = 850; // 범위 소폭 상향

        

        this.droneCount = 20; // 수송 드론 수

        this.maxDroneCount = 20;

        this.isSortieActive = false;

        this.sortieTimer = 0;

        this.sortieInterval = 600; // 0.6초마다 한 대씩 사출

        this.launchedDrones = []; // 현재 이 트럭이 관리하는 드론들

        

        this.armorType = 'light';

        this.cargoSize = 25; // 수송 불가 수준의 거대 체급

    }



    getSkillConfig(cmd) {

        if (cmd === 'sortie') return { type: 'toggle', handler: this.toggleSortie };

        return super.getSkillConfig(cmd);

    }



    toggleSortie() {

        this.isSortieActive = !this.isSortieActive;

        if (this.isSortieActive) {

            this.engine.addEffect?.('system', this.x, this.y - 40, '#39ff14', '드론 사출 시스템 가동');

        } else {

            this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '시스템 대기 모드');

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

            this.isSortieActive = false;

            return;

        }



        // 트럭 위치에서 드론 생성 (군집 드론)

        const drone = this.engine.entityManager.create('carrier-drone', this.x, this.y, {

            ownerId: this.ownerId,

            parentTruck: this,

            isAutoSuicide: true 

        });



        if (drone) {

            this.droneCount--;

            this.launchedDrones.push(drone);

            

            const angle = Math.random() * Math.PI * 2;

            const dist = 50;

            drone.destination = {

                x: this.x + Math.cos(angle) * dist,

                y: this.y + Math.sin(angle) * dist

            };



            if (this.droneCount <= 0) {

                this.isSortieActive = false;

                this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '모든 드론 출격 완료');

            }

        }

    }



    draw(ctx) {

        if (this.isUnderConstruction) {

            this.drawConstruction(ctx);

            return;

        }

        ctx.save();



        // 1. 거대 8륜 중장갑 섀시 (8x8 Heavy Chassis)

        ctx.fillStyle = '#0a0a0a';

        const wheelPositions = [

            { x: 40, y: -30 }, { x: 40, y: 26 },   // 1축

            { x: 15, y: -30 }, { x: 15, y: 26 },   // 2축

            { x: -10, y: -30 }, { x: -10, y: 26 }, // 3축

            { x: -35, y: -30 }, { x: -35, y: 26 }  // 4축

        ];

        wheelPositions.forEach(p => ctx.fillRect(p.x, p.y, 20, 10));



        // 2. 메인 프레임 (Super-Long Frame)

        ctx.fillStyle = '#1e272e';

        ctx.fillRect(-60, -26, 125, 52);



                // 3. 지휘 통제형 운전석 (Command Cab)



                ctx.fillStyle = '#f5f6fa'; // 헤드 부분 하얀색으로 변경



                ctx.beginPath();



                ctx.moveTo(30, -26);



                ctx.lineTo(65, -26);



                ctx.lineTo(75, -15);



                ctx.lineTo(75, 15);



                ctx.lineTo(65, 26);



                ctx.lineTo(30, 26);



                ctx.closePath();



                ctx.fill();

        

        // 장갑 유리창 (분할형)

        ctx.fillStyle = '#2c3e50';

        ctx.fillRect(55, -22, 12, 20);

        ctx.fillRect(55, 2, 12, 20);

        

        // 서치라이트 및 LED

        ctx.fillStyle = '#fff';

        ctx.fillRect(70, -18, 4, 10);

        ctx.fillRect(70, 8, 4, 10);



        // 4. 거대 드론 격납/사출 모듈

        const moduleGrd = ctx.createLinearGradient(-55, 0, 30, 0);

        moduleGrd.addColorStop(0, '#2c3e50');

        moduleGrd.addColorStop(0.5, '#34495e');

        moduleGrd.addColorStop(1, '#2c3e50');

        ctx.fillStyle = moduleGrd;

        ctx.beginPath();

        ctx.roundRect(-55, -30, 95, 60, 5);

        ctx.fill();



        // 냉각용 그릴 및 패널 라인

        ctx.fillStyle = '#1a252f';

        for(let i=0; i<4; i++) {

            ctx.fillRect(-48 + i*10, -26, 5, 12);

            ctx.fillRect(-48 + i*10, 14, 5, 12);

        }



        // 5. 정밀 자동 사출 시스템 (Precision Launch System)

        ctx.save();

        ctx.translate(-15, 0);

        

        // 사출구 메커니즘 베이스

        ctx.fillStyle = '#1e272e';

        ctx.fillRect(-25, -20, 50, 40);

        

        if (this.isSortieActive && this.droneCount > 0) {

            // 시스템 가동 연출 (강렬한 코어 빛)

            ctx.fillStyle = '#000';

            ctx.fillRect(-20, -16, 40, 32);

            

            const pulse = Math.sin(Date.now() / 80) * 0.5 + 0.5;

            const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);

            grd.addColorStop(0, `rgba(0, 210, 255, ${0.8 * pulse})`); // 시원한 파란색 코어

            grd.addColorStop(1, 'transparent');

            ctx.fillStyle = grd;

            ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();

            

            // 개방된 전동 슬라이딩 도어

            ctx.fillStyle = '#34495e';

            ctx.fillRect(-20, -28, 40, 10);

            ctx.fillRect(-20, 18, 40, 10);

        } else {

            // 폐쇄된 고강도 장갑 셔터

            ctx.fillStyle = '#2c3e50';

            ctx.fillRect(-20, -16, 40, 32);

            ctx.strokeStyle = '#1a252f';

            ctx.lineWidth = 2;

            for(let i=-15; i<=15; i+=10) {

                ctx.strokeRect(i-2, -12, 4, 24);

            }

        }

        ctx.restore();



        // 6. 통신 및 위성 추적 어레이 (Comms Array)

        ctx.strokeStyle = '#bdc3c7';

        ctx.lineWidth = 2;

        

        // 회전하는 레이더 (가동 시)

        if (this.isSortieActive) {

            const rot = (Date.now() / 300) % (Math.PI * 2);

            ctx.save();

            ctx.translate(-45, 0);

            ctx.rotate(rot);

            ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();

            ctx.fillStyle = '#95a5a6';

            ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI*2); ctx.fill();

            ctx.restore();

        }

        

        // 듀얼 통신 안테나

        const antL = this.isSortieActive ? 45 : 20;

        ctx.beginPath();

        ctx.moveTo(-52, -15); ctx.lineTo(-58, -15 - antL);

        ctx.moveTo(-52, 15); ctx.lineTo(-58, 15 + antL);

        ctx.stroke();



        // 7. 시각적 디테일 (Hazard & Status)

        ctx.fillStyle = '#f1c40f'; // 노란색 경고 마킹

        ctx.fillRect(15, -30, 8, 5); ctx.fillRect(15, 25, 8, 5);

        

        // 상태 표시등 (전원 인가 상태)

        const statusColor = (this.droneCount > 0) ? '#39ff14' : '#ff3131';

        ctx.fillStyle = statusColor;

        ctx.beginPath(); ctx.arc(68, 0, 2.5, 0, Math.PI*2); ctx.fill();



        ctx.restore();



        // 하단 수량바 (거대해진 체급에 맞춰 조정)

        if (this.droneCount < this.maxDroneCount) {

            const barW = 60;

            const barH = 5;

            const bx = this.x - barW / 2;

            const by = this.y + 45;

            ctx.fillStyle = 'rgba(0,0,0,0.6)';

            ctx.fillRect(bx, by, barW, barH);

            ctx.fillStyle = (this.droneCount > 5) ? '#00d2ff' : '#ff3131';

            ctx.fillRect(bx, by, (this.droneCount / this.maxDroneCount) * barW, barH);

            ctx.strokeStyle = '#fff';

            ctx.lineWidth = 1;

            ctx.strokeRect(bx, by, barW, barH);

        }

    }

}

    