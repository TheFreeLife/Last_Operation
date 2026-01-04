export class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.width = 40;  // Default 1x1
        this.height = 40; // Default 1x1
        this.size = 40;   // Default for circles
        this.domain = 'ground'; // 'ground', 'air', 'sea' (기본값 지상)
        this.attackTargets = ['ground', 'sea']; // 공격 가능 대상 (기본값 지상/해상)
        this.popCost = 0; // 인구수 비용 (유닛용)
        this.popProvide = 0; // 인구수 제공 (건물용)
        this.passable = false; // 통과 가능 여부 (기본값: 불가능)
        
        // 소유권 속성 추가
        this.ownerId = 1; // 기본적으로 플레이어 1 (사용자) 소유
        
        // 건설 관련 속성
        this.isUnderConstruction = false;
        this.buildProgress = 0; // 0 to 1
        this.totalBuildTime = 0;
        this.targetResource = null; // 건설 중인 자원 객체 보관용
        
        // 피격 효과 관련
        this.hitTimer = 0;
    }

    // 피격 처리 공통 메서드
    takeDamage(amount) {
        if (this.hp === undefined || !this.active) return;
        this.hp -= amount;
        this.hitTimer = 150; // 150ms 동안 피격 상태 유지 (깜빡임 효과용)
        
        if (this.hp <= 0) {
            this.active = false;
            if (this.alive !== undefined) this.alive = false;
        }
    }

    // 대상이 이 주체(Entity/Projectile)로부터 피해를 입을 수 있는지 확인
    canDamage(target, engine) {
        if (!target || !target.active || target.hp === undefined) return false;
        
        // 1. 도메인 확인 (공중/지상 등)
        if (!this.attackTargets.includes(target.domain)) return false;

        // 2. 관계 확인 (아군 사격 방지)
        if (engine && engine.getRelation) {
            const relation = engine.getRelation(this.ownerId, target.ownerId);
            // 강제 공격 대상(manualTarget)인 경우 관계에 상관없이 공격 허용
            if (this.manualTarget === target) return true;
            
            if (relation === 'self' || relation === 'ally') return false; // 자신 및 아군은 공격 불가
            if (relation === 'neutral') return false; // 중립은 명시적 명령 전까지 공격 불가
        }

        return true;
    }

    drawConstruction(ctx) {
        if (!this.isUnderConstruction) return;
        
        const w = this.width || this.size || 40;
        const h = this.height || this.size || 40;
        
        // 1. 건설 부지 가이드 (점선)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(this.x - w/2, this.y - h/2, w, h);
        
        // 2. 진행 바
        const barW = w * 0.8;
        const barH = 6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barW/2, this.y + h/2 + 5, barW, barH);
        ctx.fillStyle = '#f1c40f'; // 건설은 노란색
        ctx.fillRect(this.x - barW/2, this.y + h/2 + 5, barW * this.buildProgress, barH);
        ctx.restore();
    }

    getSelectionBounds() {
        const w = this.width || this.size || 40;
        const h = this.height || this.size || 40;
        return {
            left: this.x - w / 2,
            right: this.x + w / 2,
            top: this.y - h / 2,
            bottom: this.y + h / 2
        };
    }

    // --- 자동 계산 로직 추가 ---
    // 유닛의 크기에 따른 물리 충돌 반경 (0.45는 대형 유닛 우회 마진 포함)
    get collisionRadius() {
        return (this.size || 40) * 0.45;
    }

    // 길찾기 엔진에 전달할 크기
    get pathfindingSize() {
        return this.size || 40;
    }
}

export class Base extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'base';
        this.name = '총사령부';
        this.ownerId = 1; // 플레이어 1 소유 명시
        this.maxHp = 99999999;
        this.hp = 99999999;
        this.width = 360;  // 9 tiles * 40
        this.height = 240; // 6 tiles * 40
        this.size = 360;
        this.passable = false; // 통과 불가 명시
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 1000;
        this.isGenerator = true; // 전력 생산 가능
        this.powerOutput = 500;  // 기본 제공 전력량
        this.popProvide = 40; // 사령부 기본 인구수 제공
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 130; // 9x6 건물 남쪽 출입구
                let unit = new CombatEngineer(this.x, spawnY, engine);
                unit.isInitialExit = true; // 건물 밖으로 나갈 때까지 충돌 무시
                unit.destination = { x: this.x, y: this.y + 170 };
                engine.entities.units.push(unit);
                this.spawnQueue.shift();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 2.5D Projection Constants
        const depth = 35; 
        const angle = -Math.PI / 4; 
        const dx = Math.cos(angle) * depth;
        const dy = Math.sin(angle) * depth;

        // Building Dimensions
        const totalW = 320;
        const baseH = 110;
        const centerH = 150; 
        const startX = -totalW / 2 - 15;
        const startY = -40;

        const yBase = startY;           
        const yCenter = startY - (centerH - baseH); 
        const yBottom = startY + baseH; 

        // [변수 선언부 이동] Entry Path에서 사용하기 위해 상단으로 배치
        const centerW = 100;
        const wingW = (totalW - centerW) / 2;
        const x1 = startX;
        const x2 = startX + wingW;
        const x3 = startX + wingW + centerW;
        const x4 = startX + totalW;

        // --- 0. 진입로 (Entry Path Only) ---
        const plazaW = 360;
        const plazaH = 240;
        const pStartX = -plazaW / 2;
        const pStartY = yBottom - 20;

        // 0.5 진입로 (Entry Path - Styled)
        const pathW = 60; // 정문 너비와 동일하게 맞춤
        const pathEndW = 80; // 바깥쪽은 약간 넓어지게
        const pathX = x2 + (centerW - pathW) / 2; // 정문 중앙 좌표 기준 (이제 x2 참조 가능)
        
        // 정문 바로 앞에서 시작
        const entOffset = 15; 
        const pdxStart = -Math.cos(angle) * entOffset;
        const pdyStart = -Math.sin(angle) * entOffset;
        
        const pathStartX = pathX + pdxStart;
        const pathStartY = yBottom + pdyStart;
        
        const pathLen = 50;
        const plx = -Math.cos(angle) * pathLen;
        const ply = -Math.sin(angle) * pathLen;

        // 진입로 바닥 (Gradient Asphalt)
        const pGrad = ctx.createLinearGradient(pathStartX, pathStartY, pathStartX + plx, pathStartY + ply);
        pGrad.addColorStop(0, '#546e7a');
        pGrad.addColorStop(1, '#455a64');
        ctx.fillStyle = pGrad;
        
        ctx.beginPath();
        ctx.moveTo(pathStartX, pathStartY); // 좌상
        ctx.lineTo(pathStartX + pathW, pathStartY); // 우상
        ctx.lineTo(pathStartX + pathW/2 + pathEndW/2 + plx, pathStartY + ply); // 우하
        ctx.lineTo(pathStartX + pathW/2 - pathEndW/2 + plx, pathStartY + ply); // 좌하
        ctx.closePath();
        ctx.fill();

        // 진입로 경계 및 연석 (Raised Curb)
        const curbH = 4; // 연석 높이
        
        // 좌측 연석
        ctx.fillStyle = '#95a5a6'; // 연석 윗면
        ctx.beginPath();
        ctx.moveTo(pathStartX, pathStartY);
        ctx.lineTo(pathStartX + pathW/2 - pathEndW/2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW/2 - pathEndW/2 + plx - 4, pathStartY + ply); // 두께
        ctx.lineTo(pathStartX - 4, pathStartY);
        ctx.fill();
        
        ctx.fillStyle = '#7f8c8d'; // 연석 측면 (그림자)
        ctx.beginPath();
        ctx.moveTo(pathStartX + pathW/2 - pathEndW/2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW/2 - pathEndW/2 + plx - 4, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW/2 - pathEndW/2 + plx - 4, pathStartY + ply + curbH);
        ctx.lineTo(pathStartX + pathW/2 - pathEndW/2 + plx, pathStartY + ply + curbH);
        ctx.fill();

        // 우측 연석
        ctx.fillStyle = '#95a5a6'; // 연석 윗면
        ctx.beginPath();
        ctx.moveTo(pathStartX + pathW, pathStartY);
        ctx.lineTo(pathStartX + pathW/2 + pathEndW/2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW/2 + pathEndW/2 + plx + 4, pathStartY + ply); // 두께
        ctx.lineTo(pathStartX + pathW + 4, pathStartY);
        ctx.fill();
        
        ctx.fillStyle = '#7f8c8d'; // 연석 측면
        ctx.beginPath();
        ctx.moveTo(pathStartX + pathW/2 + pathEndW/2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW/2 + pathEndW/2 + plx + 4, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW/2 + pathEndW/2 + plx + 4, pathStartY + ply + curbH);
        ctx.lineTo(pathStartX + pathW/2 + pathEndW/2 + plx, pathStartY + ply + curbH);
        ctx.fill();

        // --- 1. 건물 본체 구조 (Main Structure Only) ---
        // (변수 선언부는 위로 이동됨)
        
        const colors = {
            front: '#ecf0f1', 
            roof: '#ffffff',  
            side: '#bdc3c7',
            sideDark: '#95a5a6'
        };

        // 측면 (Sides)
        ctx.fillStyle = colors.side;
        ctx.beginPath();
        ctx.moveTo(x4, yBase); ctx.lineTo(x4 + dx, yBase + dy);
        ctx.lineTo(x4 + dx, yBottom + dy); ctx.lineTo(x4, yBottom);
        ctx.fill();

        // 지붕 (Roofs)
        ctx.fillStyle = colors.roof;
        ctx.beginPath(); // 좌측 윙
        ctx.moveTo(x1, yBase); ctx.lineTo(x1 + dx, yBase + dy);
        ctx.lineTo(x2 + dx, yBase + dy); ctx.lineTo(x2, yBase); ctx.fill();
        ctx.beginPath(); // 중앙 타워
        ctx.moveTo(x2, yCenter); ctx.lineTo(x2 + dx, yCenter + dy);
        ctx.lineTo(x3 + dx, yCenter + dy); ctx.lineTo(x3, yCenter); ctx.fill();
        ctx.beginPath(); // 우측 윙
        ctx.moveTo(x3, yBase); ctx.lineTo(x3 + dx, yBase + dy);
        ctx.lineTo(x4 + dx, yBase + dy); ctx.lineTo(x4, yBase); ctx.fill();

        // 중앙 타워 노출된 측면
        ctx.fillStyle = colors.side;
        ctx.beginPath();
        ctx.moveTo(x3, yCenter); ctx.lineTo(x3 + dx, yCenter + dy);
        ctx.lineTo(x3 + dx, yBase + dy); ctx.lineTo(x3, yBase); ctx.fill();

        // 전면 (Front Faces)
        ctx.fillStyle = colors.front;
        ctx.beginPath();
        ctx.moveTo(x1, yBase); ctx.lineTo(x2, yBase); ctx.lineTo(x2, yCenter);
        ctx.lineTo(x3, yCenter); ctx.lineTo(x3, yBase); ctx.lineTo(x4, yBase);
        ctx.lineTo(x4, yBottom); ctx.lineTo(x1, yBottom); ctx.closePath(); ctx.fill();
        
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        ctx.stroke();

        // --- 1.5 정면 조경 (Landscaping in front) ---
        const drawBush = (bx, by, bSize) => {
            // 수풀 (Bush)
            ctx.fillStyle = '#27ae60';
            ctx.beginPath(); ctx.arc(bx, by, bSize, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath(); ctx.arc(bx - bSize*0.3, by - bSize*0.3, bSize*0.6, 0, Math.PI*2); ctx.fill();
            
            // 작은 꽃들 (Tiny flowers)
            const flowers = [{x:-2, y:1, c:'#e74c3c'}, {x:3, y:-2, c:'#f1c40f'}, {x:0, y:4, c:'#fff'}];
            flowers.forEach(f => {
                ctx.fillStyle = f.c;
                ctx.beginPath(); ctx.arc(bx + f.x, by + f.y, 1.5, 0, Math.PI*2); ctx.fill();
            });
        };

        const drawFlowerBed = (fbx, fby, fbw, fbh) => {
            // 화단 틀 (Stone Frame)
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(fbx - 2, fby - 2, fbw + 4, fbh + 4);
            ctx.fillStyle = '#34495e'; // 흙
            ctx.fillRect(fbx, fby, fbw, fbh);
            
            // 수풀들 배치
            for(let i=0; i<3; i++) {
                drawBush(fbx + 10 + i * (fbw/3), fby + fbh/2, 8);
            }
        };

        // 입구 좌우에 화단 배치
        drawFlowerBed(x1 + 10, yBottom + 5, 80, 15);
        drawFlowerBed(x3 + 10, yBottom + 5, 80, 15);

        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        ctx.stroke();

        // --- 1.5 돌출형 정문 (Protruding Entrance - Fixed) ---
        const entW = 60;
        const entH = 45;
        const entX = x2 + (centerW - entW) / 2;
        const entY = yBottom - entH;
        
        // 돌출 깊이 설정 (앞으로 튀어나오게 반전)
        const pDepth = 15; 
        // angle이 -45도(우상단 향함)이므로, 앞으로 나오려면 +135도(좌하단) 방향이어야 함.
        // 즉, dx, dy의 부호를 반대로 적용
        const pdx = -Math.cos(angle) * pDepth;
        const pdy = -Math.sin(angle) * pDepth;

        // 1. 돌출된 구조물 지붕 (Roof of protruding entrance)
        ctx.fillStyle = '#bdc3c7'; // 건물 측면색과 동일
        ctx.beginPath();
        ctx.moveTo(entX, entY); 
        ctx.lineTo(entX + entW, entY); 
        ctx.lineTo(entX + entW + pdx, entY + pdy); 
        ctx.lineTo(entX + pdx, entY + pdy); 
        ctx.closePath();
        ctx.fill();

        // 2. 돌출된 구조물 측면 (Right Side Wall)
        ctx.fillStyle = '#95a5a6'; // 건물 짙은 측면색
        ctx.beginPath();
        ctx.moveTo(entX + entW, entY); 
        ctx.lineTo(entX + entW + pdx, entY + pdy); 
        ctx.lineTo(entX + entW + pdx, yBottom + pdy); 
        ctx.lineTo(entX + entW, yBottom); 
        ctx.closePath();
        ctx.fill();

        // 3. 정면 프레임 (Front Face)
        ctx.fillStyle = '#95a5a6'; // 프레임도 짙은 회색으로 통일
        ctx.fillRect(entX + pdx, entY + pdy, entW, entH);

        // 4. 유리문 디테일 (Glass Door)
        ctx.fillStyle = '#2c3e50'; // 창문과 동일한 유리색
        ctx.fillRect(entX + pdx + 4, entY + pdy + 4, entW - 8, entH - 4);
        
        // 문 중앙 분할선
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(entX + pdx + entW/2 - 1, entY + pdy + 4, 2, entH - 4);

        // 5. 캐노피 (Canopy)
        const cDepth = 25;
        const cdx = -Math.cos(angle) * cDepth;
        const cdy = -Math.sin(angle) * cDepth;
        
        ctx.fillStyle = '#7f8c8d'; // 짙은 석재색
        ctx.beginPath();
        ctx.moveTo(entX - 4 + pdx, entY + pdy); 
        ctx.lineTo(entX + entW + 4 + pdx, entY + pdy);
        ctx.lineTo(entX + entW + 4 + cdx, entY + cdy); 
        ctx.lineTo(entX - 4 + cdx, entY + cdy);
        ctx.closePath();
        ctx.fill();
        
        // 캐노피 측면 두께
        ctx.fillStyle = '#636e72';
        ctx.beginPath();
        ctx.moveTo(entX + entW + 4 + pdx, entY + pdy);
        ctx.lineTo(entX + entW + 4 + cdx, entY + cdy);
        ctx.lineTo(entX + entW + 4 + cdx, entY + cdy + 4);
        ctx.lineTo(entX + entW + 4 + pdx, entY + pdy + 4);
        ctx.fill();

        // 입구 바닥 조명 (앞으로 그림자처럼)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(entX + pdx, yBottom + pdy);
        ctx.lineTo(entX + entW + pdx, yBottom + pdy);
        ctx.lineTo(entX + entW + 10 + pdx, yBottom + 10 + pdy);
        ctx.lineTo(entX - 10 + pdx, yBottom + 10 + pdy);
        ctx.fill();

        // --- 2. 창문 디테일 ---
        ctx.fillStyle = '#2c3e50'; 
        const winW = 12; const winH = 10;
        for(let r=0; r<6; r++) {
            for(let c=0; c<7; c++) {
                ctx.fillRect(x1 + 15 + c*15, yBase + 15 + r*15, winW, winH);
                ctx.fillRect(x3 + 10 + c*15, yBase + 15 + r*15, winW, winH);
            }
        }

        // 중앙 유리창 (Glass - Upper part only)
        const gCols = 4; 
        const gRows = 5; // 정문 공간 확보를 위해 행 수 감소 (8 -> 5)
        const gMargin = 15;
        const gAreaW = centerW - gMargin * 2;
        const gAreaH = (yBottom - yCenter) - 25;
        const gWinW = (gAreaW - (gCols - 1) * 4) / gCols; 
        const gWinH = (gAreaH - (8 - 1) * 4) / 8; // 높이 비율은 유지
        
        for(let r=0; r<gRows; r++) {
            for(let c=0; c<gCols; c++) {
                const wx = x2 + gMargin + c * (gWinW + 4);
                const wy = yCenter + 15 + r * (gWinH + 4);
                ctx.fillStyle = '#34495e'; 
                ctx.fillRect(wx, wy, gWinW, gWinH);
            }
        }

        // --- 3. 옥상 디테일 (Tactical Flag) ---
        const flagX = x2 + centerW/2 + dx * 0.5;
        const flagY = yCenter + dy * 0.5;
        
        ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(flagX, flagY); ctx.lineTo(flagX, flagY - 45); ctx.stroke();
        
        // 깃발 본체 (Tactical Black)
        ctx.fillStyle = '#1a1a1a'; 
        ctx.fillRect(flagX, flagY - 45, 32, 22);
        
        // 무채색 엠블럼
        const ex = flagX + 16; 
        const ey = flagY - 34;
        ctx.strokeStyle = '#dfe6e9'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ex - 10, ey - 4); ctx.lineTo(ex, ey - 10); ctx.lineTo(ex + 10, ey - 4);
        ctx.lineTo(ex + 8, ey + 8); ctx.lineTo(ex, ey + 4); ctx.lineTo(ex - 8, ey + 8);
        ctx.closePath(); ctx.stroke();
        
        // 태극 문양 (색상 복구)
        ctx.fillStyle = '#ff3131'; ctx.beginPath(); ctx.arc(ex, ey - 1, 4.5, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#00d2ff'; ctx.beginPath(); ctx.arc(ex, ey - 1, 4.5, 0, Math.PI); ctx.fill();

        // --- 4. 옥상 부속 시설 (Rooftop Assets - Drawn LAST) ---
        
        // 1. 좌측 윙 옥상 앞쪽: 위성 통신 안테나
        const satX = x1 + (wingW / 2); 
        const satY = yBase - 15; 
        
        // 안테나 지지대
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath(); ctx.ellipse(satX, satY, 12, 6, 0, 0, Math.PI*2); ctx.fill(); 
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(satX - 3, satY - 25, 6, 25); 
        
        // 접시 안테나 (회전)
        ctx.save();
        ctx.translate(satX, satY - 25);
        ctx.rotate(-Math.PI / 5); 
        
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI, true); ctx.fill();
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI*2); ctx.fill();
        
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.stroke();
        ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(0, -20, 2, 0, Math.PI*2); ctx.fill();
        
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.shadowColor = 'red'; ctx.shadowBlur = 5;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();

        // 2. 우측 윙 옥상 앞쪽: 전술 냉각/발전 유닛
        const coolX = x3 + (wingW / 2);
        const coolY = yBase - 30; 
        
        // 유닛 본체
        ctx.fillStyle = '#34495e'; 
        ctx.fillRect(coolX, coolY, 25, 20);
        
        ctx.fillStyle = '#2c3e50'; 
        ctx.beginPath();
        ctx.moveTo(coolX, coolY);
        ctx.lineTo(coolX + 10, coolY - 10);
        ctx.lineTo(coolX + 35, coolY - 10);
        ctx.lineTo(coolX + 25, coolY);
        ctx.fill();
        
        ctx.fillStyle = '#2c3e50'; 
        ctx.beginPath();
        ctx.moveTo(coolX + 25, coolY);
        ctx.lineTo(coolX + 35, coolY - 10);
        ctx.lineTo(coolX + 35, coolY + 10);
        ctx.lineTo(coolX + 25, coolY + 20);
        ctx.fill();

        // 팬(Fan) 디테일
        ctx.fillStyle = '#1a252f';
        ctx.beginPath(); ctx.arc(coolX + 12.5, coolY + 10, 7, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(coolX + 5.5, coolY + 10); ctx.lineTo(coolX + 19.5, coolY + 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(coolX + 12.5, coolY + 3); ctx.lineTo(coolX + 12.5, coolY + 17); ctx.stroke();

        // 상태 표시등
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(coolX + 28, coolY + 2, 3, 3);
        ctx.fillStyle = '#3498db';
        ctx.fillRect(coolX + 28, coolY + 7, 3, 3);

        ctx.restore();

        // --- UI (Command Center HUD) ---
        const barWidth = 280;
        const barY = this.y - 160; 
        const hpP = this.hp / this.maxHp;

        ctx.fillStyle = 'rgba(10, 20, 30, 0.8)';
        ctx.fillRect(this.x - barWidth/2 - 10, barY - 20, barWidth + 20, 45);
        ctx.strokeStyle = 'rgba(189, 195, 199, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - barWidth/2 - 10, barY - 20, barWidth + 20, 45);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(this.x - barWidth/2, barY + 10, barWidth, 10);
        ctx.fillStyle = hpP > 0.3 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(this.x - barWidth/2, barY + 10, hpP * barWidth, 10);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`COMMAND CENTER`, this.x - barWidth/2, barY + 2);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(hpP*100)}%`, this.x + barWidth/2, barY + 2);
    }
}

export class Generator extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'generator';
        this.size = 30;
        this.color = '#ffff00';
        this.maxHp = 80;
        this.hp = 80;
    }
}

export class PipeLine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'pipe-line';
        this.passable = true;
        this.maxHp = 80;
        this.hp = 80;
        this.size = 30;
        this.isConnected = false; // Whether connected to Base
    }

    update() {}

    draw(ctx, allEntities, engine) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        const neighbors = { n: null, s: null, e: null, w: null };
        if (allEntities && engine) {
            allEntities.forEach(other => {
                if (other === this) return;
                
                // 건물의 절반 크기 계산 (기본값 20)
                const otherHW = (other.width || 40) / 2;
                const otherHH = (other.height || 40) / 2;
                const myHW = 20;
                const myHH = 20;

                // 중심점 간의 거리
                const dx = Math.abs(other.x - this.x);
                const dy = Math.abs(other.y - this.y);

                // 범용 인접 체크 (상하좌우로 딱 붙어 있는지 확인)
                const margin = 2;
                const isAdjacentX = dx <= (otherHW + myHW) + margin && dy < Math.max(otherHH, myHH);
                const isAdjacentY = dy <= (otherHH + myHH) + margin && dx < Math.max(otherHW, myHW);

                                        if (isAdjacentX || isAdjacentY) {
                                            const pipeTransmitters = ['pipe-line', 'refinery', 'gold-mine', 'iron-mine', 'storage', 'base'];
                                            const isTransmitter = pipeTransmitters.includes(other.type) || (other.maxHp === 99999999);                    
                    if (isTransmitter) {
                        if (isAdjacentX) {
                            if (other.x > this.x) neighbors.e = other;
                            else neighbors.w = other;
                        } else {
                            if (other.y > this.y) neighbors.s = other;
                            else neighbors.n = other;
                        }
                    }
                }
            });
        }

        const finalNeighbors = {
            n: !!neighbors.n,
            s: !!neighbors.s,
            e: !!neighbors.e,
            w: !!neighbors.w
        };

        ctx.save();
        // Pipe Style: Thicker and industrial look
        ctx.lineWidth = 8;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = this.isConnected ? '#9370DB' : '#555'; // 공급 중일 때 전체가 보라색
        const halfSize = 20;
        
        const drawSegment = (dirX, dirY) => {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + dirX * halfSize, this.y + dirY * halfSize);
            ctx.stroke();
            
            // Inner liquid flow line
            if (this.isConnected) {
                ctx.save();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#DDA0DD'; // 더 밝은 보라색으로 흐름 강조
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + dirX * halfSize, this.y + dirY * halfSize);
                ctx.stroke();
                ctx.restore();
            }
        };

        if (finalNeighbors.n) drawSegment(0, -1);
        if (finalNeighbors.s) drawSegment(0, 1);
        if (finalNeighbors.w) drawSegment(-1, 0);
        if (finalNeighbors.e) drawSegment(1, 0);

        if (!finalNeighbors.n && !finalNeighbors.s && !finalNeighbors.w && !finalNeighbors.e) {
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, Math.PI * 2); ctx.fill();
        }

        // Joint/Valve
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}

export class Wall extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'wall';
        this.name = '철조망';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 200; // 벽보다 내구도 하향
        this.hp = 200;
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 바닥 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-18, 5, 36, 12);

        // 2. 수직 지지대 (Posts - 2.5D)
        const drawPost = (px, py) => {
            const pHeight = 25;
            // 벽면 (깊이)
            ctx.fillStyle = '#3a2a1a'; // 어두운 나무색
            ctx.fillRect(px, py - pHeight, 4, pHeight);
            // 앞면
            ctx.fillStyle = '#5d4037'; // 밝은 나무색
            ctx.fillRect(px - 2, py - pHeight - 2, 4, pHeight);
            // 윗면 (입체)
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(px - 2, py - pHeight - 2, 4, 2);
        };

        drawPost(-15, 10); // 좌측 기둥
        drawPost(15, 10);  // 우측 기둥

        // 3. 가시 철사 (Barbed Wires - X자 교차)
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 1]); // 가시 느낌을 위한 점선

        // 상단 가로선
        ctx.beginPath();
        ctx.moveTo(-15, -12); ctx.lineTo(15, -12);
        ctx.stroke();

        // 중앙 X자 교차선
        ctx.beginPath();
        ctx.moveTo(-15, -12); ctx.lineTo(15, 8);
        ctx.moveTo(15, -12); ctx.lineTo(-15, 8);
        ctx.stroke();

        // 하단 가로선
        ctx.beginPath();
        ctx.moveTo(-15, 8); ctx.lineTo(15, 8);
        ctx.stroke();

        ctx.setLineDash([]);

        // 4. 가시 디테일 (작은 점들)
        ctx.fillStyle = '#bdc3c7';
        for(let i=0; i<5; i++) {
            const tx = -15 + i*7.5;
            ctx.fillRect(tx, -13, 2, 2);
            ctx.fillRect(tx, 7, 2, 2);
        }

        ctx.restore();

        // HP 바
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 25, (this.hp / this.maxHp) * 30, 3);
    }
}

export class CoalGenerator extends Generator {
    constructor(x, y) {
        super(x, y);
        this.type = 'coal-generator';
        this.color = '#ff6600';
        this.width = 40;
        this.height = 40;
        this.maxHp = 150;
        this.hp = 150;
        this.maxFuel = 500;
        this.fuel = 500;
    }

    update(deltaTime) {
        if (this.isUnderConstruction) return;
        if (this.fuel > 0) {
            this.fuel -= deltaTime / 1000;
            if (this.fuel < 0) this.fuel = 0;
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#444';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(0, -5, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.stroke();
        const flicker = (this.fuel > 0) ? ((Math.random() * 0.2) + 0.8) : 0;
        ctx.fillStyle = `rgba(255, 100, 0, ${flicker})`;
        ctx.beginPath(); ctx.arc(0, -5, 6, 0, Math.PI * 2); ctx.fill();
        if (this.fuel > 0) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
            const time = Date.now() / 1000;
            const smokeY = -20 - (time % 1) * 15;
            const smokeSize = 5 + (time % 1) * 5;
            ctx.beginPath(); ctx.arc(Math.sin(time * 2) * 3, smokeY, smokeSize, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class PowerLine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'power-line';
        this.passable = true;
        this.maxHp = 50;
        this.hp = 50;
        this.size = 30;
        this.isPowered = false;
    }

    update() {}

    draw(ctx, allEntities, engine) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        const neighbors = { n: null, s: null, e: null, w: null };
                if (allEntities && engine) {
                    allEntities.forEach(other => {
                        if (other === this) return;
        
                        const otherHW = (other.width || 40) / 2;
                        const otherHH = (other.height || 40) / 2;
                        const myHW = 20;
                        const myHH = 20;
        
                        const dx = Math.abs(other.x - this.x);
                        const dy = Math.abs(other.y - this.y);
        
                        const margin = 2;
                        const isAdjacentX = dx <= (otherHW + myHW) + margin && dy < Math.max(otherHH, myHH);
                        const isAdjacentY = dy <= (otherHH + myHH) + margin && dx < Math.max(otherHW, myHW);
        
                        if (isAdjacentX || isAdjacentY) {
                            const transmitterTypes = ['power-line', 'generator', 'coal-generator', 'base', 'airport', 'refinery', 'gold-mine', 'iron-mine', 'storage', 'armory', 'barracks'];
                            // 포탑 타입들도 전선 연결 대상으로 추가
                            const isTransmitter = transmitterTypes.includes(other.type) ||
                                (other.type && other.type.startsWith('turret')) ||
                                (other.maxHp === 99999999);                    
                    if (isTransmitter) {
                        if (isAdjacentX) {
                            if (other.x > this.x) neighbors.e = other;
                            else neighbors.w = other;
                        } else {
                            if (other.y > this.y) neighbors.s = other;
                            else neighbors.n = other;
                        }
                    }
                }
            });
        }

        const finalNeighbors = {
            n: !!neighbors.n,
            s: !!neighbors.s,
            e: !!neighbors.e,
            w: !!neighbors.w
        };

        ctx.save();
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.isPowered ? '#ffff00' : '#444';
        const halfSize = 20;
        if (finalNeighbors.n) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, this.y - halfSize); ctx.stroke(); }
        if (finalNeighbors.s) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, this.y + halfSize); ctx.stroke(); }
        if (finalNeighbors.w) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - halfSize, this.y); ctx.stroke(); }
        if (finalNeighbors.e) { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + halfSize, this.y); ctx.stroke(); }

        if (!finalNeighbors.n && !finalNeighbors.s && !finalNeighbors.w && !finalNeighbors.e) {
            ctx.fillStyle = this.isPowered ? '#ffff00' : '#444';
            ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }
}

export class Refinery extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'refinery';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 200;
        this.hp = 200;
        this.maxFuel = 800;
        this.fuel = 800;
        this.productionRate = 5;
        this.color = '#32cd32';
        this.isConnectedToBase = false; 
        this.connectedTarget = null;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.fuel > 0 && (this.isConnectedToBase || this.connectedTarget)) {
            const amount = this.productionRate * deltaTime / 1000;
            const produced = engine.produceResource('oil', amount, this);
            
            if (produced) {
                this.fuel -= deltaTime / 1000;
                if (this.fuel < 0) this.fuel = 0;
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
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = (this.fuel > 0) ? this.color : '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.fillStyle = '#555';
        ctx.fillRect(-10, -10, 8, 20);
        ctx.fillRect(2, -10, 8, 20);
        ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke();
        if (this.fuel > 0) {
            const liquidHeight = (this.fuel / this.maxFuel) * 18;
            ctx.fillStyle = '#9370DB'; ctx.fillRect(-9, 9 - liquidHeight, 6, liquidHeight);
            ctx.fillStyle = '#ffd700'; ctx.fillRect(3, 9 - liquidHeight, 6, liquidHeight);
        }
        ctx.restore();

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#32cd32';
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class GoldMine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'gold-mine';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 250;
        this.hp = 250;
        this.maxFuel = 1000; // 자원 매장량
        this.fuel = 1000;
        this.productionRate = 8; // 초당 골드 생산량
        this.color = '#FFD700';
        this.isConnectedToBase = false;
        this.connectedTarget = null;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.fuel > 0 && (this.isConnectedToBase || this.connectedTarget)) {
            const amount = this.productionRate * deltaTime / 1000;
            const produced = engine.produceResource('gold', amount, this);
            
            if (produced) {
                this.fuel -= deltaTime / 1000;
                if (this.fuel < 0) this.fuel = 0;
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
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = (this.fuel > 0) ? this.color : '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        
        // 채굴 기계 표현
        ctx.fillStyle = '#666';
        ctx.fillRect(-12, -8, 24, 16);
        const drillAngle = (this.fuel > 0 && (this.isConnectedToBase || this.connectedTarget)) ? (Date.now() / 100) : 0;
        ctx.save();
        ctx.rotate(drillAngle);
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        ctx.restore();

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class IronMine extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'iron-mine';
        this.name = '제철소';
        this.size = 30;
        this.width = 40;
        this.height = 40;
        this.maxHp = 300;
        this.hp = 300;
        this.maxFuel = 1200; // 철 매장량은 금보다 조금 많음
        this.fuel = 1200;
        this.productionRate = 10; // 초당 철 생산량
        this.color = '#a5a5a5';
        this.isConnectedToBase = false;
        this.connectedTarget = null;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        if (this.fuel > 0 && (this.isConnectedToBase || this.connectedTarget)) {
            const amount = this.productionRate * deltaTime / 1000;
            const produced = engine.produceResource('iron', amount, this);
            
            if (produced) {
                this.fuel -= deltaTime / 1000;
                if (this.fuel < 0) this.fuel = 0;
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
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = (this.fuel > 0) ? this.color : '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);

        // 제철 공장 표현 (고열 가마/용광로 느낌)
        ctx.fillStyle = '#444';
        ctx.fillRect(-12, -10, 24, 20);
        
        if (this.fuel > 0 && (this.isConnectedToBase || this.connectedTarget)) {
            // 용광로 열기 표현
            const flicker = Math.random() * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 69, 0, ${flicker})`;
            ctx.beginPath();
            ctx.arc(0, 5, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 35, 30, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 35, (this.hp / this.maxHp) * 30, 3);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 15, this.y - 25, (this.fuel / this.maxFuel) * 30, 4);
    }
}

export class Storage extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'storage';
        this.name = '보급고';
        this.width = 160;  // 4 tiles * 40px
        this.height = 120; // 3 tiles * 40px
        this.size = 160;   // Use max dimension for radius-based checks
        this.maxHp = 2000; // 크기 증가에 따른 체력 상향
        this.hp = 2000;
        this.storedResources = { gold: 0, oil: 0 };
        this.maxCapacity = 2000; // 용량 2배 증가
        this.isConnectedToBase = false; 
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;

        if (this.isConnectedToBase) {
            const transferRate = 50; 
            const amount = transferRate * deltaTime / 1000;
            if (this.storedResources.gold > 0) {
                const transferGold = Math.min(this.storedResources.gold, amount);
                engine.resources.gold += transferGold;
                this.storedResources.gold -= transferGold;
            }
            if (this.storedResources.oil > 0) {
                const transferOil = Math.min(this.storedResources.oil, amount);
                engine.resources.oil += transferOil;
                this.storedResources.oil -= transferOil;
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
        
        // 1. 기반 (Concrete Foundation)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-80, -60, 160, 120);
        ctx.strokeStyle = '#3a4118'; // 경계선
        ctx.lineWidth = 2;
        ctx.strokeRect(-80, -60, 160, 120);

        // 구역 표시선 (노란색 안전 라인)
        ctx.strokeStyle = 'rgba(241, 196, 15, 0.5)';
        ctx.setLineDash([10, 10]);
        ctx.strokeRect(-70, -50, 140, 100);
        ctx.setLineDash([]);

        // 2. 대형 물류 행거 (Main Hangar - 좌측)
        const drawHangar = (hx, hy) => {
            ctx.save();
            ctx.translate(hx, hy);
            
            // 건물 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(5, 5, 70, 90);

            // 벽면 (2.5D)
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, 70, 90); // 바닥면적
            ctx.fillStyle = '#34495e'; // 앞벽
            ctx.fillRect(0, 80, 70, 15);

            // 지붕 (둥근 퀀셋 스타일)
            const grd = ctx.createLinearGradient(0, 0, 70, 0);
            grd.addColorStop(0, '#34495e');
            grd.addColorStop(0.5, '#7f8c8d'); // 하이라이트
            grd.addColorStop(1, '#2c3e50');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, 70, 80);
            
            // 지붕 골조 라인
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1;
            for(let i=10; i<80; i+=10) {
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(70, i); ctx.stroke();
            }

            // 대형 슬라이딩 도어
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(10, 82, 50, 10);
            ctx.strokeStyle = '#f1c40f'; // 안전선
            ctx.beginPath(); 
            ctx.moveTo(10, 92); ctx.lineTo(60, 92); 
            ctx.stroke();

            // 환기구 팬 (지붕 위)
            ctx.fillStyle = '#2d3436';
            ctx.beginPath(); ctx.arc(35, 20, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(35, 60, 5, 0, Math.PI*2); ctx.fill();

            ctx.restore();
        };
        drawHangar(-70, -50);

        // 3. 야외 야적장 (Outdoor Storage - 우측 상단)
        const drawContainer = (cx, cy, color) => {
            ctx.save();
            ctx.translate(cx, cy);
            // 컨테이너 본체
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 25, 10);
            // 음영 및 디테일
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0, 0, 25, 2); // 윗면
            ctx.fillRect(23, 0, 2, 10); // 측면
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.strokeRect(0, 0, 25, 10);
            // 문
            ctx.fillStyle = '#333';
            ctx.fillRect(12, 2, 1, 6);
            ctx.restore();
        };

        // 컨테이너 적재 (랜덤한 느낌으로 배치)
        drawContainer(10, -40, '#2980b9'); // 파란색
        drawContainer(40, -40, '#c0392b'); // 빨간색
        drawContainer(10, -25, '#27ae60'); // 초록색
        drawContainer(15, -50, '#e67e22'); // 주황색 (위에 쌓임)

        // 4. 자원 저장 탱크 (Fuel/Resource Tanks - 우측 하단)
        const drawTank = (tx, ty) => {
            ctx.save();
            ctx.translate(tx, ty);
            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(5, 5, 12, 0, Math.PI*2); ctx.fill();
            // 탱크 본체 (원통형 입체)
            const tGrad = ctx.createLinearGradient(-10, 0, 10, 0);
            tGrad.addColorStop(0, '#7f8c8d');
            tGrad.addColorStop(0.5, '#ecf0f1');
            tGrad.addColorStop(1, '#95a5a6');
            ctx.fillStyle = tGrad;
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
            // 파이프 연결부
            ctx.fillStyle = '#34495e';
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        };
        drawTank(20, 20);
        drawTank(50, 20);
        drawTank(20, 45);
        drawTank(50, 45);

        // 5. 자원 게이지 UI (현대적인 디지털 패널 스타일)
        const totalStored = this.storedResources.gold + this.storedResources.oil;
        if (totalStored > 0) {
            ctx.save();
            ctx.translate(5, -10); // 중앙 부근
            
            // 패널 배경
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(-30, 0, 60, 6);
            
            const goldW = (this.storedResources.gold / this.maxCapacity) * 60;
            const oilW = (this.storedResources.oil / this.maxCapacity) * 60;
            
            // 자원 바
            ctx.fillStyle = '#f1c40f'; // Gold
            ctx.fillRect(-30, 1, goldW, 4);
            ctx.fillStyle = '#8e44ad'; // Oil
            ctx.fillRect(-30 + goldW, 1, oilW, 4);
            
            ctx.restore();
        }

        // 상태 표시등 (연결됨)
        if (this.isConnectedToBase) {
            ctx.fillStyle = '#00d2ff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00d2ff';
            ctx.beginPath(); ctx.arc(-60, -50, 3, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();

        // 7. HP 바 상시 표시
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 40, this.y - 70, 80, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 40, this.y - 70, (this.hp / this.maxHp) * 80, 5);
    }
}

export class PlayerUnit extends Entity {
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
        this.canBypassObstacles = false; // 장애물(건물 등) 통과 가능 여부
        this.isInitialExit = false; // 생산 후 건물 밖으로 나가는 중인지 여부
        this.popCost = 0; // 초기화 로직 보강 시 필요
        
        // --- 탄약 시스템 속성 ---
        this.ammoType = null; // 'bullet', 'shell', 'missile'
        this.maxAmmo = 0;
        this.ammo = 0;
        this.ammoConsumption = 1; // 기본 발당 소모량
        
        // 공격 특성 설정
        this.attackType = 'hitscan'; // 'hitscan' (즉시 타격) 또는 'projectile' (탄환 발사)
        this.explosionRadius = 0;    // 0보다 크면 범위 공격 적용
        this.hitEffectType = 'bullet'; // 기본 피격 효과
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
                // 지상 유닛은 기존대로 A* 경로 탐색 수행 (중앙 집중형 크기 로직 사용)
                this.path = this.engine.pathfinding.findPath(this.x, this.y, value.x, value.y, this.canBypassObstacles, this.pathfindingSize) || [];
                
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

    // 공통 공격 처리 로직
    performAttack() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate || !this.target) return;

        // --- 탄약 체크 로직 ---
        if (this.maxAmmo > 0) { // 탄약 시스템을 사용하는 유닛인 경우
            if (this.ammo < this.ammoConsumption) {
                // 탄약 부족 알림
                if (now - (this._lastAmmoMsgTime || 0) > 2000) {
                    this.engine.addEffect?.('system', this.x, this.y - 30, '#ff3131', '탄약 부족!');
                    this._lastAmmoMsgTime = now;
                }
                return;
            }
            // 탄약 소모 (설정된 소모량만큼 차감)
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

                // 범위 공격 (전차 등)

                const radiusSq = this.explosionRadius * this.explosionRadius;

                const entities = this.engine.entities;

    

                const applyAoE = (ent) => {

                    if (!ent || ent.hp === undefined || !ent.active || ent.hp <= 0) return;

                    if (!this.attackTargets.includes(ent.domain || 'ground')) return;

                    

                    const relation = this.engine.getRelation(this.ownerId, ent.ownerId);

                    // 자신 및 아군 오사 방지 (수동 타겟 제외)

                    if (this.manualTarget !== ent && (relation === 'self' || relation === 'ally')) return;

    

                    const dx = ent.x - tx;

                    const dy = ent.y - ty;

                    if (dx * dx + dy * dy <= radiusSq) {

                        ent.takeDamage(this.damage);

                    }

                };

    

                if (entities.base) applyAoE(entities.base);

                entities.enemies.forEach(applyAoE);

                entities.units.forEach(applyAoE);

                entities.neutral.forEach(applyAoE);

                

                const bLists = ['turrets', 'generators', 'powerLines', 'walls', 'airports', 'refineries', 'goldMines', 'ironMines', 'storage', 'armories', 'barracks', 'pipeLines'];

                for (const listName of bLists) {

                    const list = entities[listName];

                    if (list) list.forEach(applyAoE);

                }

            } else {

                // 단일 대상 공격 (보병, 대공포 등)

                this.target.takeDamage(this.damage);

            }

    

            if (this.engine.addEffect) {

                // 유닛 타입별 커스텀 효과 타입 전달 (기본값 hit)

                const effect = this.hitEffectType || (this.explosionRadius > 0 ? 'explosion' : 'hit');

                this.engine.addEffect(effect, tx, ty, this.color || '#fff');

            }

        }

    executeProjectileAttack() {
        const { Projectile } = this.engine.entityClasses;
        const p = new Projectile(this.x, this.y, this.target, this.damage, this.color || '#ffff00', this);
        
        // 유닛 설정값 전달
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

        // --- 강력한 끼임 방지 ( foolproof anti-stuck ) ---
        if (this.domain === 'ground' && !this.isFalling && !this.isInitialExit) {
            const obstacles = [...this.engine.getAllBuildings(), ...this.engine.entities.resources.filter(r => !r.covered)];
            const unitRadius = this.collisionRadius; // 중앙화된 반경 사용

            for (const b of obstacles) {
                if (b === this || b.passable) continue;
                
                if (b instanceof Resource) {
                    const d = Math.hypot(this.x - b.x, this.y - b.y);
                    const minD = unitRadius + (b.size * 0.5);
                    if (d < minD) {
                        const ang = Math.atan2(this.y - b.y, this.x - b.x);
                        this.x = b.x + Math.cos(ang) * minD;
                        this.y = b.y + Math.sin(ang) * minD;
                    }
                } else {
                    const bounds = b.getSelectionBounds();
                    const margin = unitRadius;
                    // 건물 내부에 있는지 확인
                    if (this.x + margin > bounds.left && this.x - margin < bounds.right &&
                        this.y + margin > bounds.top && this.y - margin < bounds.bottom) {
                        
                        // 가장 가까운 바깥 지점 찾기
                        const dL = Math.abs(this.x - (bounds.left - margin));
                        const dR = Math.abs(this.x - (bounds.right + margin));
                        const dT = Math.abs(this.y - (bounds.top - margin));
                        const dB = Math.abs(this.y - (bounds.bottom + margin));
                        const min = Math.min(dL, dR, dT, dB);
                        
                        if (min === dL) this.x = bounds.left - margin;
                        else if (min === dR) this.x = bounds.right + margin;
                        else if (min === dT) this.y = bounds.top - margin;
                        else if (min === dB) this.y = bounds.bottom + margin;
                    }
                }
            }
        }

        // --- 수송기 탑승 로직 추가 ---
        if (this.transportTarget) {
            const target = this.transportTarget;
            // 여유 공간(부피) 체크
            const occupied = target.getOccupiedSize ? target.getOccupiedSize() : 0;
            const hasSpace = (occupied + (this.cargoSize || 1)) <= (target.cargoCapacity || 10);

            // 수송기가 없거나 파괴되었거나 이륙했거나 꽉 찼으면 중단
            if (!target.active || target.hp <= 0 || target.altitude > 0.1 || !hasSpace) {
                this.transportTarget = null;
                this.command = 'stop';
            } else {
                // 수송기 후방 정중앙 입구 위치 계산 (중심에서 뒤로 90px)
                const entranceDist = 90;
                const entranceX = target.x + Math.cos(target.angle + Math.PI) * entranceDist;
                const entranceY = target.y + Math.sin(target.angle + Math.PI) * entranceDist;
                
                const d = Math.hypot(this.x - entranceX, this.y - entranceY);
                
                // 후방 입구에 가까워지면 탑승
                if (d < 45) {
                    if (target.loadUnit && target.loadUnit(this)) {
                        this.transportTarget = null;
                        return; 
                    }
                } else {
                    // 장애물 회피를 위해 정식 길찾기 경로 생성
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

        let canActuallyAttack = (typeof this.attack === 'function' && this.damage > 0 && this.type !== 'engineer');
        if (this.type === 'missile-launcher') canActuallyAttack = false;

        if (canActuallyAttack && this.command !== 'move') {
            // [1. 점사(Focus Fire) 로직] 플레이어가 직접 대상을 클릭한 경우
            if (this.manualTarget) {
                const isTargetDead = (this.manualTarget.active === false) || (this.manualTarget.hp <= 0);
                const targetDomain = this.manualTarget.domain || 'ground';
                const canHit = this.attackTargets.includes(targetDomain);

                if (isTargetDead) {
                    this.manualTarget = null;
                    this.command = 'stop';
                    this.destination = null;
                } else if (canHit) {
                    // 강제 공격: 수동 타겟이 지정되면 관계와 상관없이 타겟으로 확정
                    const distToManual = Math.hypot(this.manualTarget.x - this.x, this.manualTarget.y - this.y);
                    
                    if (distToManual <= this.attackRange) {
                        bestTarget = this.manualTarget; // 사거리 안이면 공격 대상 확정
                    } else {
                        // 사거리 밖이면 추격 시작
                        if (!this._destination || Math.hypot(this._destination.x - this.manualTarget.x, this._destination.y - this.manualTarget.y) > 40) {
                            this.destination = { x: this.manualTarget.x, y: this.manualTarget.y };
                        }
                    }
                }
            } 
            
            // [2. 자동 타겟팅 로직] 수동 지정 대상이 없을 때만 수행 (어택땅 등)
            if (!bestTarget && !this.manualTarget) {
                const potentialTargets = [
                    ...this.engine.entities.enemies, 
                    ...this.engine.entities.neutral,
                    ...this.engine.entities.units,
                    ...this.engine.getAllBuildings()
                ];

                for (const e of potentialTargets) {
                    if (e === this || !e.active || e.hp <= 0) continue;
                    
                    // 관계 확인 (적군만 자동 타겟팅)
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
            // 2. --- A* Path Following ---
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
                    this.angle = Math.atan2(this._destination.y - this.y, this._destination.x - this.x);
                    this.moveWithCollision(Math.min(this.speed, distToFinal));

                    this.pathRecalculateTimer -= deltaTime;
                    if (this.pathRecalculateTimer <= 0) {
                        this.destination = this._destination; 
                    }
                }
            }
        }

        // --- 강력한 밀어내기 (Anti-Stuck & Units) ---
        let pushX = 0;
        let pushY = 0;

        // 1. 유닛 간 충돌
        const allUnits = [...this.engine.entities.units, ...this.engine.entities.enemies, ...this.engine.entities.neutral];
        for (const other of allUnits) {
            if (other === this || !other.active || other.hp <= 0) continue;
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

        // 2. 장애물 끼임 탈출 (건물 및 자원)
        if (this.domain === 'ground' && !this.isFalling && !this.isInitialExit) {
            const obstacles = [...this.engine.getAllBuildings(), ...this.engine.entities.resources.filter(r => !r.covered)];
            for (const b of obstacles) {
                if (b === this || b.passable) continue;
                
                if (b instanceof Resource) {
                    const d = Math.hypot(this.x - b.x, this.y - b.y);
                    const minDist = (this.size * 0.2) + (b.size * 0.5); 
                    if (d < minDist) {
                        const pushAngle = Math.atan2(this.y - b.y, this.x - b.x);
                        // 원형 자원에서 밖으로 밀어내는 힘 강화
                        const force = (minDist - d) / minDist * 5.0; 
                        pushX += Math.cos(pushAngle) * force;
                        pushY += Math.sin(pushAngle) * force;
                    }
                } else {
                    const bounds = b.getSelectionBounds();
                    // 건물의 실제 영역보다 약간 더 넓게 탈출 판정
                    const margin = 2; 
                    
                    if (this.x > bounds.left - margin && this.x < bounds.right + margin &&
                        this.y > bounds.top - margin && this.y < bounds.bottom + margin) {
                        
                        // 네 방향 중 가장 가까운 밖으로 계산
                        const distL = this.x - (bounds.left - 5);
                        const distR = (bounds.right + 5) - this.x;
                        const distT = this.y - (bounds.top - 5);
                        const distB = (bounds.bottom + 5) - this.y;
                        
                        const minD = Math.min(distL, distR, distT, distB);
                        const pushForce = 4.0; // 매우 강력하게 밀어냄
                        
                        if (minD === distL) pushX -= pushForce;
                        else if (minD === distR) pushX += pushForce;
                        else if (minD === distT) pushY -= pushForce;
                        else if (minD === distB) pushY += pushForce;
                    }
                }
            }
        }

        this.x += pushX;
        this.y += pushY;

        const mapW = this.engine.tileMap.cols * this.engine.tileMap.tileSize;
        const mapH = this.engine.tileMap.rows * this.engine.tileMap.tileSize;
        this.x = Math.max(this.size/2, Math.min(mapW - this.size/2, this.x));
        this.y = Math.max(this.size/2, Math.min(mapH - this.size/2, this.y));

        if (this.hp <= 0) this.alive = false;
    }

    // [헬퍼] 충돌을 고려한 이동 처리 (슬라이딩)
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
                
                if (b instanceof Resource) {
                    const minCollisionDist = unitRadius + (b.size * 0.5);
                    if (Math.hypot(nextX - b.x, this.y - b.y) < minCollisionDist) canMoveX = false;
                    if (Math.hypot(this.x - b.x, nextY - b.y) < minCollisionDist) canMoveY = false;
                } else {
                    const bounds = b.getSelectionBounds();
                    const margin = unitRadius;
                    
                    // 현재 위치가 이미 건물 안인지 확인 (탈출 허용을 위해)
                    const isCurrentlyInside = (this.x > bounds.left && this.x < bounds.right && 
                                               this.y > bounds.top && this.y < bounds.bottom);

                    // X축 이동 시 충돌 확인
                    if (nextX + margin > bounds.left && nextX - margin < bounds.right && (this.y + margin > bounds.top && this.y - margin < bounds.bottom)) {
                        // 밖에서 안으로 들어가는 것만 막음
                        if (!isCurrentlyInside) canMoveX = false;
                    }
                    // Y축 이동 시 충돌 확인
                    if (this.x + margin > bounds.left && this.x - margin < bounds.right && (nextY + margin > bounds.top && nextY - margin < bounds.bottom)) {
                        if (!isCurrentlyInside) canMoveY = false;
                    }
                }
            }
        }

        if (canMoveX) this.x = nextX;
        if (canMoveY) this.y = nextY;
    }

    attack() {}
}

export class Tank extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'tank';
        this.name = '전차';
        this.speed = 1.8; // 1.2 -> 1.8 (1.5배 상향)
        this.fireRate = 1800; 
        this.damage = 200;     
        this.color = '#39ff14';
        this.attackRange = 360; 
        this.visionRange = 6; // 전차 시야: 보병보다 넓음
        this.explosionRadius = 40; // 폭발 반경 추가
        this.cargoSize = 10; // 전차 부피 10
        this.hp = 1000;
        this.maxHp = 1000;
        this.attackType = 'hitscan';
        this.hitEffectType = 'explosion';
        this.popCost = 3;
        
        this.ammoType = 'shell';
        this.maxAmmo = 20;
        this.ammo = 20;
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

        const time = Date.now();
        const recoil = (time - this.lastFireTime < 150) ? 3 : 0;

        // 1. 하부 및 궤도 (Bottom Layer)
        ctx.fillStyle = '#1a1a1a'; // 어두운 궤도 내부
        ctx.fillRect(-14, -13, 28, 26);
        
        // 궤도 윗면 디테일
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-14, -13, 28, 4); // 좌측 궤도
        ctx.fillRect(-14, 9, 28, 4);   // 우측 궤도

        // 2. 사이드 스커트 (Side Skirts) - 차체 옆면 두께감
        ctx.fillStyle = '#3a4118'; // 어두운 녹색 (측면 장갑)
        ctx.fillRect(-15, -14, 30, 5);
        ctx.fillRect(-15, 9, 30, 5);
        
        // 스커트 분할선 (Panel Lines)
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 0.5;
        for(let i=-10; i<=10; i+=6) {
            ctx.beginPath(); ctx.moveTo(i, -14); ctx.lineTo(i, -9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, 9); ctx.lineTo(i, 14); ctx.stroke();
        }

        // 3. 메인 차체 (Hull) - 입체 박스 형태
        // 차체 측면 두께 (Depth)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-14, -9, 28, 18);
        
        // 차체 상판 (Main Deck) - 밝은 녹색
        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.moveTo(-14, -9); ctx.lineTo(10, -9); // 후면부
        ctx.lineTo(16, -6); ctx.lineTo(16, 6);   // 전면 경사 장갑
        ctx.lineTo(10, 9); ctx.lineTo(-14, 9);   // 측면
        ctx.closePath();
        ctx.fill();
        
        // 차체 전면 하부 경사 (2.5D 입체감)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath();
        ctx.moveTo(16, -6); ctx.lineTo(18, -4); ctx.lineTo(18, 4); ctx.lineTo(16, 6);
        ctx.fill();

        // 엔진 그릴 및 후방 디테일
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-12, -6, 7, 12);
        for(let i=0; i<3; i++) {
            ctx.strokeStyle = '#1a1a1a';
            ctx.beginPath(); ctx.moveTo(-11+i*2, -5); ctx.lineTo(-11+i*2, 5); ctx.stroke();
        }

        // 4. 포탑 (Turret) - 상하 레이어 구분
        ctx.save();
        ctx.translate(-3 - recoil * 0.5, 0); 

        // 포탑 하부 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-6, -8, 18, 16);

        // 포탑 측면 (두께)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(6, -8); ctx.lineTo(11, -4);
        ctx.lineTo(11, 4); ctx.lineTo(6, 8); ctx.lineTo(-8, 8);
        ctx.fill();

        // 포탑 상판 (Wedge-shaped Upper Plate)
        ctx.fillStyle = '#556644';
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(5, -8); ctx.lineTo(10, -4);
        ctx.lineTo(10, 4); ctx.lineTo(5, 8); ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();
        
        // 포탑 모서리 하이라이트
        ctx.strokeStyle = '#6ab04c';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 전차장 조준경 (CITV) - 입체 원통
        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(0, -4, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(0, -4, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#00d2ff'; // 렌즈 반사
        ctx.fillRect(0.5, -4.5, 1, 1);

        // 해치 (Hatches)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(-4, 3, 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(-4, 3, 3, 0, Math.PI*2); ctx.stroke();

        // 5. 주포 (120mm Smoothbore Gun)
        ctx.save();
        ctx.translate(10, 0);
        
        // 포방패 (Mantlet) - 입체 박스
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, -3.5, 5, 7);
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(0, -3.5, 4, 7);
        
        // 포신 (Main Gun)
        const gunX = -recoil;
        ctx.fillStyle = '#1e272e';
        // 메인 포신
        ctx.fillRect(gunX, -1.2, 30, 2.4);
        
        // 서멀 슬리브 디테일 (Thermal Sleeves)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(gunX + 8, -1.6, 5, 3.2);
        ctx.fillRect(gunX + 18, -1.6, 4, 3.2);
        
        // 포구 동적 보정 장치 (MRS) 및 머즐
        ctx.fillStyle = '#000';
        ctx.fillRect(gunX + 30, -1.5, 2, 3);

        // 사격 이펙트
        if (recoil > 0) {
            ctx.save();
            ctx.translate(32, 0);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            grad.addColorStop(0.3, 'rgba(255, 215, 0, 0.7)');
            grad.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // 6. 안테나 및 기타 부착물
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-14, -14); ctx.stroke();
        
        // 연막탄 발사기 (Smoke Launchers)
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(2, -8.5, 3, 2);
        ctx.fillRect(2, 6.5, 3, 2);

        ctx.restore();
        ctx.restore();

        // 아군 체력 바
        const barW = 30;
        const barY = this.y - 35;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class Missile extends Entity {
    constructor(startX, startY, targetX, targetY, damage, engine, source = null) {
        super(startX, startY);
        this.source = source;
        this.ownerId = source ? source.ownerId : 0;
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.engine = engine;
        this.speed = 7; // 비행 속도 상향 (4 -> 7)
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.totalDistance = Math.hypot(targetX - startX, targetY - startY);
        this.active = true;
        this.explosionRadius = 80; // 약 2칸 반경
        this.arrived = false;
        this.explosionTimer = 0;
        this.maxExplosionTime = 120; // 약 2초간 지속 (충분한 연기 감상 시간)
        // 거리에 따라 고도를 동적으로 조절 (최소 200, 최대 600)
        this.peakHeight = Math.max(200, Math.min(this.totalDistance * 0.4, 600));
        this.trail = [];
    }

    update(deltaTime) {
        if (!this.active && !this.arrived) return;

        if (this.active) {
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);

            if (progress >= 1) {
                this.explode();
            } else {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
                
                const altitude = Math.sin(progress * Math.PI) * this.peakHeight;
                this.trail.push({x: this.x, y: this.y - altitude, alpha: 1.0});
                if (this.trail.length > 25) this.trail.shift();
            }
        } else if (this.arrived) {
            this.explosionTimer++;
            if (this.explosionTimer >= this.maxExplosionTime) {
                this.arrived = false;
            }
        }
        
        this.trail.forEach(p => p.alpha -= 0.04);
        this.trail = this.trail.filter(p => p.alpha > 0);
    }

    explode() {
        this.active = false;
        this.arrived = true;
        this.explosionTimer = 0;
        
        this.smokeParticles = [];
        for(let i = 0; i < 15; i++) {
            this.smokeParticles.push({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * this.explosionRadius * 0.8,
                size: 30 + Math.random() * 30,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4 - 0.5,
                color: Math.random() > 0.5 ? '#7f8c8d' : '#95a5a6'
            });
        }

        const targets = [
            ...this.engine.entities.enemies, 
            ...this.engine.entities.neutral,
            ...this.engine.entities.units,
            ...this.engine.getAllBuildings()
        ];

        targets.forEach(target => {
            if (!target || target.hp === undefined || !target.active || target.hp <= 0) return;

            // 공중 유닛 공격 제외
            if (target.domain === 'air') return;

            // 관계 체크 (자신 및 아군 오사 방지)
            const relation = this.engine.getRelation(this.ownerId, target.ownerId);
            const isManualTarget = (this.source && this.source.manualTarget === target);
            
            // 강제 공격 대상이면 관계 무시
            if (!isManualTarget && (relation === 'self' || relation === 'ally')) return;

            const dist = Math.hypot(target.x - this.targetX, target.y - this.targetY);
            if (dist <= this.explosionRadius) {
                target.takeDamage(this.damage);
            }
        });
    }

    draw(ctx) {
        if (!this.active && !this.arrived) return;

        // 1. 비행 연기 트레일
        this.trail.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha * 0.5;
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        if (this.active) {
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);
            const altitude = Math.sin(progress * Math.PI) * this.peakHeight;

            // 2. 그림자 (고도에 따라 크기 변화)
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#000';
            const shadowSize = Math.max(5, 10 * (1 - altitude/this.peakHeight));
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 3. 미사일 본체
            ctx.save();
            ctx.translate(this.x, this.y - altitude);
            
            // --- 정밀 탄도 각도 계산 (접선 벡터) ---
            // 수평 속도 벡터
            const vx = Math.cos(this.angle);
            const vy = Math.sin(this.angle);
            
            // 수직 고도 변화율 (sin 미분 -> cos)
            // altitude = peakHeight * sin(progress * PI)
            // d(altitude)/d(progress) = peakHeight * PI * cos(progress * PI)
            const dAlt = this.peakHeight * Math.PI * Math.cos(progress * Math.PI);
            
            // progress = dist / totalDist 이므로 d(progress)/dt 연쇄법칙 적용
            // 최종적으로 비행 기울기 산출
            const flightAngle = Math.atan2(vy * this.totalDistance - dAlt, vx * this.totalDistance);
            
            ctx.rotate(flightAngle);
            
            ctx.fillStyle = '#f5f6fa';
            ctx.beginPath();
            ctx.moveTo(16, 0); ctx.lineTo(6, -3); ctx.lineTo(-12, -3); ctx.lineTo(-12, 3); ctx.lineTo(6, 3);
            ctx.closePath(); ctx.fill();
            
            ctx.fillStyle = '#2d3436';
            ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-12, -7); ctx.lineTo(-12, -3); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-12, 7); ctx.lineTo(-12, 3); ctx.closePath(); ctx.fill();
            
            const flameSize = 4 + Math.random() * 3;
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(-13, 0, flameSize, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e67e22';
            ctx.beginPath(); ctx.arc(-13, 0, flameSize * 0.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.arrived) {
            ctx.save();
            const progress = this.explosionTimer / this.maxExplosionTime;
            const fireAlpha = Math.max(0, 1 - progress * 4); // 화염은 아주 짧게 (0.5초 이내)
            const smokeAlpha = Math.max(0, 1 - progress);   // 연기는 2초 동안 서서히
            
            // 1. 잔류 연기 효과 (Lingering Smoke)
            if (this.smokeParticles) {
                this.smokeParticles.forEach(p => {
                    const shiftX = p.vx * this.explosionTimer;
                    const shiftY = p.vy * this.explosionTimer;
                    const size = p.size * (1 + progress * 2); // 연기가 대폭 확산
                    
                    ctx.save();
                    ctx.globalAlpha = smokeAlpha * 0.95; // 연기 농도 대폭 강화
                    ctx.fillStyle = p.color; 
                    ctx.beginPath();
                    const px = this.targetX + Math.cos(p.angle) * p.dist + shiftX;
                    const py = this.targetY + Math.sin(p.angle) * p.dist + shiftY;
                    ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            // 2. 충격파 고리
            if (progress < 0.2) {
                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, this.explosionRadius * Math.pow(progress/0.2, 0.5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - progress/0.2) * 0.8})`;
                ctx.lineWidth = 5;
                ctx.stroke();
            }

            // 3. 메인 화염 (Fire)
            if (fireAlpha > 0) {
                const grad = ctx.createRadialGradient(this.targetX, this.targetY, 0, this.targetX, this.targetY, this.explosionRadius);
                grad.addColorStop(0, `rgba(255, 255, 255, ${fireAlpha})`);
                grad.addColorStop(0.3, `rgba(255, 215, 0, ${fireAlpha * 0.9})`);
                grad.addColorStop(1, `rgba(255, 69, 0, 0)`);
                
                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, this.explosionRadius * (1 + progress), 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            }
            
            ctx.restore();
        }
    }
}

export class MissileLauncher extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'missile-launcher';
        this.name = '이동식 미사일 발사대';
        this.speed = 1.4; 
        this.baseSpeed = 1.4;
        this.fireRate = 2500;
        this.damage = 350;
        this.attackRange = 1800; 
        this.visionRange = 8;
        this.recoil = 0;
        this.canBypassObstacles = false;
        this.cargoSize = 10;

        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.maxTransitionTime = 60;
        this.raiseAngle = 0;

        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.maxFireDelay = 45;
        this.pendingFirePos = { x: 0, y: 0 };
        this.attackType = 'projectile';
        this.attackTargets = ['ground', 'sea']; 
        this.popCost = 3;
        
        this.ammoType = 'missile';
        this.maxAmmo = 6;
        this.ammo = 6;
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
        this.isTransitioning = true;
        this.transitionTimer = 0;
        this.destination = null; 
        this.speed = 0;         
        this.engine.addEffect?.('system', this.x, this.y, '#fff', this.isSieged ? '시즈 해제 중...' : '시즈 모드 설정 중...');
    }

    update(deltaTime) {
        super.update(deltaTime);

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
                if (this.isSieged) this.destination = null; 
            }
        }

        if (this.isFiring) {
            this.fireDelayTimer++;
            const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.angle += angleDiff * 0.15;

            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire();
                this.isFiring = false;
                this.fireDelayTimer = 0;
            }
        }
    }

    attack() {
        if (this.isSieged && !this.isTransitioning && !this.isFiring) {
            this.performAttack();
        }
    }

    fireAt(targetX, targetY) {
        if (!this.isSieged || this.isTransitioning || this.isFiring) return;
        
        // 탄약 체크 추가
        if (this.ammo <= 0) {
            if (this.engine.addEffect) {
                this.engine.addEffect('system', this.x, this.y - 40, '#ff3131', '미사일 고갈!');
            }
            return;
        }

        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        if (dist > this.attackRange) return;

        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            this.isFiring = true;
            this.fireDelayTimer = 0;
            this.pendingFirePos = { x: targetX, y: targetY };
        }
    }

    executeFire() {
        if (this.ammo <= 0) return; // 안전장치

        const { x: targetX, y: targetY } = this.pendingFirePos;
        const launchDist = 35 * 2;
        const tiltDir = Math.cos(this.angle) >= 0 ? -1 : 1;
        const visualAngle = this.angle + (tiltDir * (Math.PI / 10) * this.raiseAngle);
        
        const spawnX = this.x + Math.cos(visualAngle) * launchDist;
        const spawnY = this.y + Math.sin(visualAngle) * launchDist;

        const missile = new Missile(spawnX, spawnY, targetX, targetY, this.damage, this.engine, this);
        missile.peakHeight = Math.max(missile.peakHeight, 150); 
        
        this.engine.entities.projectiles.push(missile);
        
        // 탄약 1발 소모
        this.ammo--;
        
        this.lastFireTime = Date.now();
        this.recoil = 15; 
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.recoil > 0) {
            ctx.translate(-this.recoil, 0);
            this.recoil *= 0.85;
            if (this.recoil < 0.1) this.recoil = 0;
        }

        ctx.scale(2, 2); 
        
        if (this.raiseAngle > 0) {
            ctx.fillStyle = '#636e72';
            const extend = 8 * this.raiseAngle;
            ctx.fillRect(-15, -12 - extend, 4, 4);
            ctx.fillRect(-15, 8 + extend, 4, 4);
            ctx.fillRect(11, -12 - extend, 4, 4);
            ctx.fillRect(11, 8 + extend, 4, 4);
        }

        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-22, -10, 44, 20);
        
        ctx.fillStyle = '#34495e';
        ctx.fillRect(12, -10, 10, 20);
        ctx.fillStyle = '#81ecec';
        ctx.fillRect(16, -8, 4, 16);
        
        ctx.fillStyle = '#1a1a1a';
        const wheelX = [-17, -7, 3, 13];
        wheelX.forEach(x => {
            ctx.fillRect(x, -12, 6, 3);
            ctx.fillRect(x, 9, 6, 3);
        });

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-20, -8, 30, 16);

        ctx.save();
        ctx.translate(-15, 0);
        const tiltDir = Math.cos(this.angle) >= 0 ? -1 : 1;
        ctx.rotate(tiltDir * (Math.PI / 10) * this.raiseAngle); 
        
        ctx.fillStyle = '#4b5320'; 
        const scaleS = 1 + (this.raiseAngle * 0.1);
        const canisterLen = 32 * scaleS;
        ctx.fillRect(0, -7, canisterLen, 14);
        
        ctx.strokeStyle = '#3a4118';
        for(let i = 4; i <= 28; i += 4) {
            ctx.beginPath(); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke();
        }
        
        // 해치 개방 애니메이션
        const hatchProgress = this.isFiring ? (this.fireDelayTimer / this.maxFireDelay) : 0;
        ctx.fillStyle = '#2d3436';
        if (hatchProgress < 0.1) {
            ctx.fillRect(canisterLen - 2, -7, 3, 14);
        } else {
            const openDist = 8 * Math.min(hatchProgress * 1.5, 1);
            ctx.fillRect(canisterLen - 2, -7 - openDist, 3, 7); // 상단
            ctx.fillRect(canisterLen - 2, 0 + openDist, 3, 7);  // 하단
            if (hatchProgress > 0.6) {
                ctx.fillStyle = `rgba(255, 165, 0, ${(hatchProgress - 0.6) * 2.5})`;
                ctx.fillRect(canisterLen - 4, -4, 4, 8);
            }
        }

        if (this.recoil > 5) {
            ctx.save();
            ctx.translate(canisterLen, 0);
            ctx.fillStyle = '#ff4500';
            ctx.beginPath(); ctx.arc(5, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath(); ctx.arc(8, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // 발사 준비 중 스파크 효과
        if (this.isFiring && this.fireDelayTimer > 15) {
            ctx.save();
            ctx.translate(15, 0);
            ctx.fillStyle = '#f1c40f';
            for(let i=0; i<3; i++) {
                ctx.fillRect(Math.random()*15, (Math.random()-0.5)*15, 2, 2);
            }
            ctx.restore();
        }

        ctx.strokeStyle = '#95a5a6';
        ctx.beginPath(); ctx.moveTo(-18, -7); ctx.lineTo(-24, -13); ctx.stroke();
        ctx.restore();

        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        if (this.isFiring) {
            ctx.fillStyle = '#e67e22'; // 발사 준비 게이지
            ctx.fillRect(this.x - barW/2, barY, (this.fireDelayTimer / this.maxFireDelay) * barW, 4);
        } else {
            ctx.fillStyle = this.isSieged ? '#f1c40f' : '#2ecc71'; 
            ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
        }
    }
}

export class Artillery extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'artillery';
        this.name = '자주포';
        this.speed = 0.9;
        this.fireRate = 4000; // 매우 느린 연사
        this.damage = 100;    // 강력한 한 방
        this.attackRange = 600; 
        this.explosionRadius = 60; 
        this.cargoSize = 5; // 자주포 부피 5
        this.attackType = 'projectile';
        this.popCost = 4;
        
        this.ammoType = 'shell';
        this.maxAmmo = 20;
        this.ammo = 20;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) { this.drawConstruction(ctx); return; }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);
        
        // 1. 하부 궤도 및 차체 (Chassis)
        ctx.fillStyle = '#1a1a1a'; // 궤도 색상
        ctx.fillRect(-16, -11, 32, 22);
        
        ctx.fillStyle = '#4b5320'; // 올리브 드랩 (메인 차체)
        ctx.beginPath();
        ctx.moveTo(-15, -10); ctx.lineTo(15, -10);
        ctx.lineTo(18, -8); ctx.lineTo(18, 8); ctx.lineTo(15, 10);
        ctx.lineTo(-15, 10); ctx.lineTo(-18, 8); ctx.lineTo(-18, -8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3a4118';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 보기륜 (Wheels) 디테일
        ctx.fillStyle = '#2d3436';
        for(let i = -12; i <= 12; i += 6) {
            ctx.beginPath(); ctx.arc(i, -10, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(i, 10, 2, 0, Math.PI * 2); ctx.fill();
        }

        // 2. 거대 박스형 포탑 (Turret)
        ctx.save();
        // 포탑은 차체보다 약간 뒤쪽에 위치
        ctx.translate(-2, 0);
        
        ctx.fillStyle = '#556644';
        ctx.fillRect(-10, -9, 22, 18);
        ctx.strokeStyle = '#2d3436';
        ctx.strokeRect(-10, -9, 22, 18);
        
        // 포탑 상부 디테일 (해치 및 장비)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-2, -6, 6, 6); // 메인 해치
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(8, -8, 2, 16); // 포탑 후면 바스켓 느낌
        
        // 3. 초장거리 포신 (Main Gun)
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(12, -2, 28, 4); // 매우 긴 포신
        
        // 제퇴기 (Muzzle Brake)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(38, -3, 4, 6);
        ctx.strokeStyle = '#111';
        ctx.strokeRect(38, -3, 4, 6);
        
        // 포신 뿌리 부분 (Gun Mantlet)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(10, -4, 4, 8);

        // 4. 안테나 (Antenna)
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-8, -7); ctx.lineTo(-15, -15);
        ctx.stroke();
        
        ctx.restore();
        
        // 5. 전면 라이트
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(16, -7, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 7, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
        this.drawHealthBar(ctx);
    }

    drawHealthBar(ctx) {
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class AntiAirVehicle extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'anti-air';
        this.name = '자주 대공포';
        this.speed = 1.3;
        this.fireRate = 150; // 기관포 느낌을 위해 매우 빠른 연사 (800 -> 150)
        this.damage = 8;    // 연사력이 높아졌으므로 발당 데미지 하향
        this.attackRange = 600;
        this.visionRange = 10;
        this.attackTargets = ['air']; // 공중 유닛만 공격 가능
        this.lastBarrelSide = 1; // 사격 포구 번갈아 가기 위한 상태
        this.cargoSize = 5; // 대공포 적재 용량 5
        this.attackType = 'hitscan';
        this.hitEffectType = 'flak';
        this.popCost = 3;
        
        this.ammoType = 'bullet';
        this.maxAmmo = 200;
        this.ammo = 200;
        this.ammoConsumption = 2;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) { this.drawConstruction(ctx); return; }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);

        const time = Date.now();
        const recoil = (time - this.lastFireTime < 150) ? 2 : 0;

        // 1. 하부 궤도 (Tracks) - 2.5D 측면
        ctx.fillStyle = '#1a1a1a'; // 궤도 측면 그림자
        ctx.fillRect(-14, -14, 30, 28);
        
        ctx.fillStyle = '#2d3436'; // 궤도 윗면
        ctx.fillRect(-14, -14, 30, 5); // 좌측 궤도
        ctx.fillRect(-14, 9, 30, 5);   // 우측 궤도
        
        // 휠 디테일
        ctx.fillStyle = '#000';
        for(let i=0; i<4; i++) {
            ctx.fillRect(-10 + i*7, -14, 2, 5);
            ctx.fillRect(-10 + i*7, 9, 2, 5);
        }

        // 2. 차체 (Chassis) - 입체형
        // 차체 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-12, -8, 26, 18);

        // 차체 측면 (두께)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-12, -9, 24, 18);
        
        // 차체 상판 (Main Deck)
        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.moveTo(-12, -9); ctx.lineTo(12, -9); // 후면
        ctx.lineTo(16, -7); ctx.lineTo(16, 7);   // 전면 경사 시작
        ctx.lineTo(12, 9); ctx.lineTo(-12, 9);   // 우측면
        ctx.closePath();
        ctx.fill();
        
        // 엔진 그릴 (후방)
        ctx.fillStyle = '#2d3436';
        for(let i=0; i<3; i++) ctx.fillRect(-10 + i*3, -5, 2, 10);

        // 3. 포탑 (Turret) - 입체 박스
        ctx.save();
        // 포탑 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(-5, -8, 12, 16);

        // 포탑 베이스 (링)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();

        // 포탑 본체 측면 (어두운 면)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-6, -7, 12, 14);
        
        // 포탑 상판 (밝은 면)
        ctx.fillStyle = '#556644';
        ctx.fillRect(-6, -7, 10, 14);
        // 포탑 모서리 하이라이트
        ctx.strokeStyle = '#6ab04c';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-6, -7, 10, 14);

        // 4. 레이더 시스템 (2.5D)
        // 전방 추적 레이더 (Tracking Radar)
        ctx.fillStyle = '#2f3542';
        ctx.beginPath(); ctx.arc(6, 0, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#a4b0be'; // 렌즈/센서
        ctx.beginPath(); ctx.arc(7, 0, 1.5, 0, Math.PI*2); ctx.fill();

        // 후방 탐색 레이더 (Search Radar) - 회전 및 입체감
        ctx.save();
        ctx.translate(-7, 0);
        const radarAngle = this.active ? time / 600 : 0;
        ctx.rotate(radarAngle);
        
        // 레이더 접시 (Dish)
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(-2, -8, 4, 16); // 메인 바
        ctx.fillStyle = '#7f8c8d'; // 뒷면/두께
        ctx.fillRect(-3, -8, 1, 16);
        // 안테나 그릴 표현
        ctx.fillStyle = '#333';
        ctx.fillRect(-1, -6, 2, 12);
        ctx.restore();

        // 5. 쌍열 35mm 기관포 (Oerlikon KDA)
        const drawGunSystem = (side) => { // side: 1 or -1
            ctx.save();
            ctx.translate(-2, side * 9); 

            // 포신 구동부 (Housing) - 입체
            ctx.fillStyle = '#3a4118'; // 측면
            ctx.fillRect(-6, -3, 12, 6);
            ctx.fillStyle = '#4b5320'; // 윗면
            ctx.fillRect(-6, -3, 10, 6);
            
            // 포신 (Barrel)
            ctx.fillStyle = '#1e272e';
            const kick = (side === 1 && recoil > 0) || (side === -1 && recoil > 0) ? recoil : 0;
            
            // 총열 덮개/방열판
            ctx.fillRect(4, -2, 8, 4);
            // 긴 포신
            ctx.fillRect(12 - kick, -1, 20, 2);
            
            // 소염기 (Muzzle Brake)
            ctx.fillStyle = '#000';
            ctx.fillRect(32 - kick, -1.5, 4, 3);
            
            // 탄띠 급탄부 (Ammo Feed)
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.moveTo(-2, side * -2); 
            ctx.lineTo(-2, side * -5); // 포탑 쪽으로 연결
            ctx.stroke();

            // 발사 이펙트
            if (kick > 0) {
                ctx.fillStyle = `rgba(255, 200, 50, ${0.7 + Math.random()*0.3})`;
                ctx.beginPath();
                ctx.moveTo(36, 0);
                ctx.lineTo(45, -3); ctx.lineTo(48, 0); ctx.lineTo(45, 3);
                ctx.fill();
                
                // 연기
                ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
                ctx.beginPath(); ctx.arc(38, 0, 3 + Math.random()*2, 0, Math.PI*2); ctx.fill();
            }

            ctx.restore();
        };

        drawGunSystem(-1);
        drawGunSystem(1);

        ctx.restore();
        ctx.restore();
        this.drawHealthBar(ctx);
    }

    drawHealthBar(ctx) {
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

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
            ctx.beginPath(); ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI*2); ctx.fill();

            // 1. 전술 백팩 (입체감 강화)
            ctx.fillStyle = '#2d3310'; // 측면 어두운 면
            ctx.fillRect(-10.5, -5, 6, 10);
            ctx.fillStyle = '#3a4118'; // 윗면 밝은 면
            ctx.fillRect(-10, -5, 5, 10);
            // MOLLE 웨빙 디테일
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.5;
            for(let i=-3; i<=3; i+=3) {
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
            ctx.beginPath(); ctx.arc(1, -4.2, 1.8, 0, Math.PI*2); ctx.fill(); // 헤드셋 컵
            ctx.beginPath(); ctx.arc(1, 4.2, 1.8, 0, Math.PI*2); ctx.fill();

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
            for(let i=11; i<20; i+=2) ctx.fillRect(i, -1.5, 1, 3);
            
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
            ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI*2); ctx.fill(); // 어깨/소매
            ctx.beginPath(); ctx.arc(10, 2.2, 2.5, 0, Math.PI*2); ctx.fill(); // 앞팔
            ctx.fillStyle = '#2d3436'; // 장갑
            ctx.beginPath(); ctx.arc(2, 0.5, 2.2, 0, Math.PI*2); ctx.fill(); // 오른손
            ctx.beginPath(); ctx.arc(14, 1.2, 2.2, 0, Math.PI*2); ctx.fill(); // 왼손

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
        ctx.fillRect(this.x - barW/2, barY, barW, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 5);
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
        ctx.beginPath(); ctx.arc(-4, -2, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, 1, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-2, 3, 1.5, 0, Math.PI*2); ctx.fill();
        
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
        ctx.beginPath(); ctx.arc(2, -2.5, 1, 0, Math.PI*2); ctx.fill();

        // 양각대 (Bipod - 펼침)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(18, 0); ctx.lineTo(20, -4);
        ctx.moveTo(18, 0); ctx.lineTo(20, 4);
        ctx.stroke();

        // 위장 랩 (Rifle Wrap)
        ctx.fillStyle = '#4b5320';
        ctx.beginPath(); ctx.ellipse(12, 0, 3, 1.5, 0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(18, 0, 2, 1, -0.5, 0, Math.PI*2); ctx.fill();

        // 오른손 (그립)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(0, 1, 2, 0, Math.PI*2); ctx.fill();
        // 왼손 (개머리판 지지 - 정밀 사격 자세)
        ctx.beginPath(); ctx.arc(-2, 2, 2, 0, Math.PI*2); ctx.fill();

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
        ctx.fillRect(this.x - barW/2, barY, barW, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 3);
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
                    
                    // [버그 수정] 건물 내부 끼임 방지: 실제로 겹쳤을 때만 자연스럽게 바깥으로 탈출
                    const currentGrid = this.engine.tileMap.worldToGrid(this.x, this.y);
                    const currentTile = this.engine.tileMap.grid[currentGrid.y]?.[currentGrid.x];
                    
                    // 현재 서 있는 타일이 점유(occupied)된 상태일 때만 튕겨내기 수행
                    if (currentTile && currentTile.occupied) {
                        const freeTile = this.engine.pathfinding.findNearestWalkable(currentGrid.x, currentGrid.y);
                        if (freeTile) {
                            const worldPos = this.engine.tileMap.gridToWorld(freeTile.x, freeTile.y);
                            
                            // 1. 탈출 방향을 바라보게 함
                            this.angle = Math.atan2(worldPos.y - this.y, worldPos.x - this.x);
                            
                            // 2. 위치를 외곽으로 어느 정도 밀어내고 (튕겨나가는 시작점)
                            this.x = this.x * 0.3 + worldPos.x * 0.7;
                            this.y = this.y * 0.3 + worldPos.y * 0.7;
                            
                            // 3. 남은 거리는 직선 경로를 강제 주입하여 부드럽게 걸어나오게 함
                            this.destination = worldPos;
                            this.path = [worldPos];
                        }
                    }

                    if (this.buildingTarget.targetResource) {
                        const resList = this.engine.entities.resources;
                        const resIdx = resList.indexOf(this.buildingTarget.targetResource);
                        if (resIdx !== -1) resList.splice(resIdx, 1);
                    }
                    
                    // 건물 건설 완료 시 인구수 및 전력망 갱신 트리거
                    if (this.engine.updatePopulation) {
                        this.engine.needsPowerUpdate = true; // 전력망 갱신 트리거 추가
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
        ctx.beginPath(); ctx.ellipse(-11, 0, 2, 4, 0, 0, Math.PI*2); ctx.fill();

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
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill();
        // 살색 팔뚝
        ctx.fillStyle = '#eebb99'; 
        ctx.beginPath(); ctx.arc(1.5, 0, 2, 0, Math.PI*2); ctx.fill();

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
        ctx.beginPath(); ctx.arc(7, 0, 2.5, 0, Math.PI*2); ctx.fill(); // 오른손 (8 -> 7)
        ctx.beginPath(); ctx.arc(3, 0, 2.5, 0, Math.PI*2); ctx.fill(); // 왼손 (4 -> 3)

        // 작업 효과 (스파크 대신 파편/먼지)
        if (isWorking && Math.abs(hammerAngle) > 0.6) {
            ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
            for(let i=0; i<3; i++) {
                ctx.beginPath(); 
                ctx.arc(20 + Math.random()*4, (Math.random()-0.5)*8, 1.5, 0, Math.PI*2);
                ctx.fill();
            }
        }

        ctx.restore();

        ctx.restore();

        // 아군 체력 바
        const barW = 24;
        const barY = this.y - 28;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class Barracks extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'barracks';
        this.name = '병영';
        this.width = 120; // 3 tiles
        this.height = 120; // 3 tiles
        this.size = 120;
        this.maxHp = 1500;
        this.hp = 1500;
        this.isPowered = false;
        this.spawnQueue = []; // {type, timer}
        this.spawnTime = 1000; 
        this.units = [];
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

        update(deltaTime, engine) {
            if (this.isUnderConstruction) return;
            this.units = this.units.filter(u => u.alive);
            
            if (this.isPowered && this.spawnQueue.length > 0) {
                const current = this.spawnQueue[0];
                current.timer += deltaTime;
                if (current.timer >= this.spawnTime) {
                    const spawnY = this.y + 65;
                    let unit;
                    if (current.type === 'sniper') {
                        unit = new Sniper(this.x, spawnY, engine);
                    } else {
                        unit = new Rifleman(this.x, spawnY, engine);
                    }
                    
                    unit.isInitialExit = true;
                    unit.destination = { x: this.x, y: this.y + 100 };
                    this.units.push(unit);
                    engine.entities.units.push(unit);
                    this.spawnQueue.shift();
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
        
        // 1. 부지 기반
        ctx.fillStyle = '#3b4d3c';
        ctx.fillRect(-60, -60, 120, 120);
        ctx.strokeStyle = '#2d3e2d';
        ctx.strokeRect(-60, -60, 120, 120);

        // 2. 군 막사 건물 2동 (2.5D 입체화)
        const draw3DHut = (hx, hy) => {
            const depth = 12;
            ctx.save();
            ctx.translate(hx, hy);
            
            // 건물 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(-48, -10, 96, 35);

            // 2.5D 벽면 (어두운 부분)
            ctx.fillStyle = '#2d3310';
            ctx.fillRect(-45, 15, 90, depth); // 정면 벽
            // 우측 벽
            ctx.beginPath();
            ctx.moveTo(45, -15); ctx.lineTo(45, 15);
            ctx.lineTo(45 + 3, 15 + depth); ctx.lineTo(45 + 3, -15 + depth);
            ctx.closePath(); ctx.fill();
            
            // 건물 본체 (윗면/옆면)
            ctx.fillStyle = '#4b5320';
            ctx.fillRect(-45, -15, 90, 30);
            
            // 박공 지붕 (Gabled Roof - 입체감 추가)
            // 지붕의 어두운 쪽 (서쪽/북쪽)
            ctx.fillStyle = '#3a4118';
            ctx.beginPath();
            ctx.moveTo(-45, -15); ctx.lineTo(0, -25); ctx.lineTo(45, -15);
            ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
            // 지붕의 밝은 쪽 (동쪽/남쪽)
            ctx.fillStyle = '#556644';
            ctx.beginPath();
            ctx.moveTo(-45, 15); ctx.lineTo(0, 25); ctx.lineTo(45, 15);
            ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();

            // 창문 (입체감 있는 배치)
            ctx.fillStyle = this.isPowered ? '#3498db' : '#111';
            for(let i=0; i<3; i++) {
                ctx.fillRect(-30 + i*25, 5, 10, 6);
            }
            
            ctx.restore();
        };

        draw3DHut(0, -30); // 북쪽 막사
        draw3DHut(0, 30);  // 남쪽 막사

        // 3. 중앙 요소 (게양대 등)
        // 국기 게양대 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-43, 2, 15, 4);
        
        // 게양대 (입체)
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(-46, -25, 3, 25);
        // 깃발
        const flagWave = Math.sin(Date.now() / 300) * 3;
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(-43, -25);
        ctx.lineTo(-25 + flagWave, -25);
        ctx.lineTo(-30 + flagWave, -18);
        ctx.lineTo(-43, -18);
        ctx.closePath(); ctx.fill();

        // 4. 모래주머니 (입체)
        const draw3DSandbags = (sx, sy) => {
            ctx.save();
            ctx.translate(sx, sy);
            for(let i=0; i<2; i++) {
                // 하단층
                ctx.fillStyle = '#a6936a'; // 어두운 면
                ctx.beginPath(); ctx.ellipse(-5 + i*12, 4, 7, 5, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#c2b280'; // 윗면
                ctx.beginPath(); ctx.ellipse(-5 + i*12, 0, 7, 5, 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#8e7a55'; ctx.lineWidth = 0.5; ctx.stroke();
            }
            ctx.restore();
        };
        draw3DSandbags(35, -5);
        draw3DSandbags(35, 10);

        ctx.restore();

        // HP 바 & 생산 UI (기존 로직 유지)
        this.drawUI(ctx);
    }

    drawUI(ctx) {
        const barW = 80;
        const barY = this.y - 85;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barW/2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 6);

        if (this.spawnQueue.length > 0) {
            const qBarY = barY - 14;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 40, qBarY, 80, 8);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 40, qBarY, 80 * progress, 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`훈련 중 (${this.spawnQueue.length})`, this.x, qBarY - 5);
        }
    }
}

export class Armory extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'armory';
        this.name = '병기창';
        this.width = 160; // 4 tiles
        this.height = 120; // 3 tiles
        this.size = 160;
        this.maxHp = 2500;
        this.hp = 2500;
        this.isPowered = false;
        this.spawnQueue = []; 
        this.spawnTime = 1000; 
        this.units = []; 
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        this.units = this.units.filter(u => u.alive);

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                const spawnY = this.y + 65; 
                let unit;
                if (current.type === 'tank') unit = new Tank(this.x, spawnY, engine);
                else if (current.type === 'missile-launcher') unit = new MissileLauncher(this.x, spawnY, engine);
                else if (current.type === 'artillery') unit = new Artillery(this.x, spawnY, engine);
                else if (current.type === 'anti-air') unit = new AntiAirVehicle(this.x, spawnY, engine);
                
                if (unit) {
                    unit.isInitialExit = true;
                    unit.destination = { x: this.x, y: this.y + 100 };
                    this.units.push(unit);
                    engine.entities.units.push(unit);
                }
                this.spawnQueue.shift();
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

        // 2.5D Projection
        const depth = 15; 
        const angle = -Math.PI / 4; 
        const dx = Math.cos(angle) * depth;
        const dy = Math.sin(angle) * depth;

        // Hitbox: [-80, 80] x [-60, 60]
        const bw = 130; 
        const bh = 60;  
        const wallH = 40; 
        const bx = -bw / 2;
        const by = -bh / 2 - 5;

        // 1. 기초 바닥 (Tactical Concrete Foundation)
        ctx.fillStyle = '#2c3e50'; 
        ctx.beginPath();
        ctx.moveTo(bx - 10, by + bh + wallH + 5);
        ctx.lineTo(bx + bw + 10, by + bh + wallH + 5);
        ctx.lineTo(bx + bw + 10 + dx, by + bh + wallH + 5 + dy);
        ctx.lineTo(bx - 10 + dx, by + bh + wallH + 5 + dy);
        ctx.closePath(); ctx.fill();

        // 2. 외벽 및 장갑판 (Reinforced Tactical Walls)
        // 측면
        ctx.fillStyle = '#3d441e'; // 올리브 드랍 (측면 어둡게)
        ctx.beginPath();
        ctx.moveTo(bx + bw, by); ctx.lineTo(bx + bw + dx, by + dy);
        ctx.lineTo(bx + bw + dx, by + bh + wallH + dy); ctx.lineTo(bx + bw, by + bh + wallH);
        ctx.closePath(); ctx.fill();
        
        // 전면 벽 (국방색)
        ctx.fillStyle = '#4b5320'; 
        ctx.fillRect(bx, by, bw, bh + wallH);
        
        // 장갑판 리벳 디테일
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
        for(let i=0; i<bw; i+=30) {
            ctx.strokeRect(bx + i, by, 30, bh + wallH);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(bx + i + 2, by + 2, 2, 2);
            ctx.fillRect(bx + i + 26, by + 2, 2, 2);
        }

        // 3. 지붕 (Heavy Armored Roof)
        const sw = bw / 4;
        for(let i=0; i<4; i++) {
            const rx = bx + i * sw;
            ctx.fillStyle = '#556644'; // 지붕 상단
            ctx.beginPath();
            ctx.moveTo(rx, by); ctx.lineTo(rx + sw, by);
            ctx.lineTo(rx + sw + dx, by + dy); ctx.lineTo(rx + dx, by + dy);
            ctx.closePath(); ctx.fill();
            
            ctx.fillStyle = '#3d441e'; // 지붕 수직면
            ctx.beginPath();
            ctx.moveTo(rx + sw, by); ctx.lineTo(rx + sw + dx, by + dy);
            ctx.lineTo(rx + sw + dx, by + dy - 10); ctx.lineTo(rx + sw, by - 10);
            ctx.closePath(); ctx.fill();

            // 전술 조명
            ctx.fillStyle = this.isPowered ? '#f39c12' : '#2c3e50';
            ctx.fillRect(rx + sw + 2, by - 8, sw - 4, 4);
        }

        // 4. 대형 전술 셔터 (Blast Door)
        const dw = 80; const dh = 45;
        const doorX = -dw/2; const doorY = by + bh + wallH - dh;
        
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(doorX, doorY, dw, dh);
        
        // 셔터 보강재
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        for(let i=0; i<dh; i+=8) {
            ctx.strokeRect(doorX + 5, doorY + i, dw - 10, 4);
        }
        
        // 가동 시 경고등 (Red Blink)
        if (this.isPowered && Math.floor(Date.now()/500)%2 === 0) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(doorX - 8, doorY + 5, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(doorX + dw + 8, doorY + 5, 3, 0, Math.PI*2); ctx.fill();
        }

        // 5. 기계 장치 및 소품
        // 회전 레이더 (전력 있을 때만 회전)
        const radarX = bx + 20; const radarY = by;
        ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(radarX, radarY); ctx.lineTo(radarX, radarY - 15); ctx.stroke();
        const radarRot = this.isPowered ? (Date.now() / 400) : 0;
        ctx.fillStyle = this.isPowered ? '#3498db' : '#2c3e50';
        ctx.beginPath();
        ctx.ellipse(radarX, radarY - 15, Math.abs(12 * Math.cos(radarRot)), 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 냉각 팬
        const fanRotation = this.isPowered ? (Date.now() / 150) : 0;
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.arc(bx + 15, by + 15, 8, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = this.isPowered ? '#00d2ff' : '#7f8c8d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx + 15 + Math.cos(fanRotation)*6, by + 15 + Math.sin(fanRotation)*6);
        ctx.lineTo(bx + 15 - Math.cos(fanRotation)*6, by + 15 - Math.sin(fanRotation)*6);
        ctx.stroke();

        // 탄약 박스 및 드럼통
        const drawProp = (px, py, color, type) => {
            ctx.fillStyle = color;
            if(type==='box') ctx.fillRect(px, py, 12, 8);
            else { ctx.beginPath(); ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI*2); ctx.fill(); ctx.fillRect(px-6, py-10, 12, 10); }
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
        };
        drawProp(bx + bw - 20, by + bh + wallH - 10, '#7f8c8d', 'drum');
        drawProp(bx + bw - 35, by + bh + wallH - 8, '#d35400', 'box');

        ctx.restore();

        this.drawUI(ctx);
    }

    drawUI(ctx) {
        const barW = 120;
        const barY = this.y - 100;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barW/2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 6);

        if (this.spawnQueue.length > 0) {
            const qBarY = barY - 14;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 60, qBarY, 120, 10);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 60, qBarY, 120 * progress, 10);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`무기 생산 중 (${this.spawnQueue.length})`, this.x, qBarY - 5);
        }
    }
}

export class Airport extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'airport';
        this.name = '대형 군용 비행장';
        this.width = 200;  // 5 tiles
        this.height = 280; // 7 tiles
        this.size = 280;
        this.maxHp = 2500; // 크기에 맞춰 체력 상향
        this.hp = 2500;
        this.isPowered = false;
        this.spawnQueue = []; 
        this.spawnTime = 1000; 
        this.units = [];
    }

    requestUnit(unitType) {
        this.spawnQueue.push({ type: unitType, timer: 0 });
        return true;
    }

    update(deltaTime, engine) {
        if (this.isUnderConstruction) return;
        this.units = this.units.filter(u => u.alive);

        if (this.isPowered && this.spawnQueue.length > 0) {
            const current = this.spawnQueue[0];
            current.timer += deltaTime;
            if (current.timer >= this.spawnTime) {
                // 활주로 중앙 부근에서 생성 (오른쪽으로 이동됨)
                let unit;
                if (current.type === 'bomber') {
                    unit = new Bomber(this.x + 55, this.y - 80, engine);
                } else if (current.type === 'cargo-plane') {
                    unit = new CargoPlane(this.x + 55, this.y - 80, engine);
                } else {
                    unit = new ScoutPlane(this.x + 55, this.y - 80, engine);
                }
                
                unit.isInitialExit = true; // 출격 모드 설정 (활주로 이탈 전까지 충돌 무시)
                unit.destination = { x: this.x + 55, y: this.y + 140 };
                this.units.push(unit);
                engine.entities.units.push(unit);
                
                // 수송기의 경우 전용 리스트에도 추가 (렌더링 레이어 대응)
                if (current.type === 'cargo-plane' && engine.entities.cargoPlanes) {
                    engine.entities.cargoPlanes.push(unit);
                }
                
                this.spawnQueue.shift();
                
                // 유닛 생산 후 인구수 갱신
                if (engine.updatePopulation) engine.updatePopulation();
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

        // [추가] 전력 부족 경고 표시
        if (!this.isPowered) {
            ctx.save();
            ctx.fillStyle = '#ff0';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10; ctx.shadowColor = '#000';
            ctx.fillText('⚡!', 0, 20);
            ctx.restore();
        }

        // 1. 거대 베이스 플랫폼 (두께감 있는 콘크리트 슬래브)
        // 하부 그림자 및 측면 두께
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(-100, -140, 205, 285); // 그림자
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-100, -140, 200, 280); // 베이스

        // 콘크리트 타일 텍스처
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for(let i=-100; i<=100; i+=25) {
            ctx.beginPath(); ctx.moveTo(i, -140); ctx.lineTo(i, 140); ctx.stroke();
        }
        for(let j=-140; j<=140; j+=25) {
            ctx.beginPath(); ctx.moveTo(-100, j); ctx.lineTo(100, j); ctx.stroke();
        }

        // 2. 메인 활주로 (입체적인 느낌의 아스팔트) - 오른쪽으로 이동
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(20, -135, 70, 270);
        // 활주로 가장자리 유도 경계선
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, -135, 70, 270);
        
        // 활주로 마킹
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px "Courier New"';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.8;
        ctx.fillText('0 7 R', 55, -110);
        ctx.fillText('2 5 L', 55, 125);
        ctx.globalAlpha = 1.0;

        // 중앙 점선 (입체적인 두께 표현을 위해 두 번 그림)
        ctx.setLineDash([20, 15]);
        ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(55, -130); ctx.lineTo(55, 130); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(55, -130); ctx.lineTo(55, 130); ctx.stroke();
        ctx.setLineDash([]);

        // 3. 유도로 및 대기 구역 (노란색 라인 디테일) - 왼쪽으로 방향 수정
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 0); ctx.lineTo(-20, 0); ctx.lineTo(-20, 130);
        ctx.stroke();

        // 4. 2.5D 입체 격납고 (Hangar complex) - 왼쪽으로 이동
        const drawHangar25D = (dx, dy) => {
            ctx.save();
            ctx.translate(dx, dy);
            
            // 1. 벽면 (그림자쪽)
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-35, -20, 70, 45); // 전체 높이감

            // 2. 정면 도어 (Sliding Doors)
            ctx.fillStyle = '#34495e';
            ctx.fillRect(-30, -5, 60, 20);
            ctx.strokeStyle = '#1a252f';
            for(let i=-30; i<=30; i+=10) {
                ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i, 15); ctx.stroke();
            }

            // 3. 둥근 지붕 (Roof - 입체감)
            const grd = ctx.createLinearGradient(0, -25, 0, 0);
            grd.addColorStop(0, '#95a5a6');
            grd.addColorStop(0.5, '#bdc3c7');
            grd.addColorStop(1, '#7f8c8d');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.ellipse(0, -15, 35, 15, 0, 0, Math.PI, true);
            ctx.lineTo(35, -15); ctx.lineTo(-35, -15);
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        };
        drawHangar25D(-55, 50);
        drawHangar25D(-55, 110);

        // 5. 2.5D 원통형 연료 탱크 (Fuel Tanks) - 왼쪽으로 이동
        const drawTank25D = (dx, dy) => {
            ctx.save();
            ctx.translate(dx, dy);
            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(2, 2, 12, 0, Math.PI*2); ctx.fill();
            // 몸체 (옆면)
            const sideGrd = ctx.createLinearGradient(-12, 0, 12, 0);
            sideGrd.addColorStop(0, '#7f8c8d');
            sideGrd.addColorStop(0.5, '#ecf0f1');
            sideGrd.addColorStop(1, '#95a5a6');
            ctx.fillStyle = sideGrd;
            ctx.fillRect(-12, -15, 24, 25);
            // 윗면 (Top)
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath(); ctx.ellipse(0, -15, 12, 6, 0, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#7f8c8d'; ctx.stroke();
            // 파이프 연결부
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(-4, -20, 8, 3);
            ctx.restore();
        };
        drawTank25D(-30, -50);
        drawTank25D(-60, -50);
        drawTank25D(-90, -50);

        // 6. 3층 구조 2.5D 관제탑 (Advanced Control Tower) - 왼쪽으로 이동
        ctx.save();
        ctx.translate(-70, -110);
        // 1층 하부 구조
        ctx.fillStyle = '#34495e'; ctx.fillRect(-15, 0, 30, 40);
        ctx.fillStyle = '#7f8c8d'; ctx.fillRect(-12, 0, 24, 38);
        // 2층 중간 데크
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(-18, -5, 36, 6);
        // 3층 관제실 (유리 및 조명)
        const towerBlink = Math.sin(Date.now()/400) > 0;
        const towerColor = this.isPowered ? (towerBlink ? '#4fc3f7' : '#0288d1') : '#1c313a';
        ctx.fillStyle = '#263238'; // 프레임
        ctx.beginPath();
        ctx.moveTo(-22, -25); ctx.lineTo(22, -25); ctx.lineTo(18, -5); ctx.lineTo(-18, -5);
        ctx.closePath(); ctx.fill();
        // 유리창
        ctx.fillStyle = towerColor;
        ctx.beginPath();
        ctx.moveTo(-18, -22); ctx.lineTo(18, -22); ctx.lineTo(15, -8); ctx.lineTo(-15, -8);
        ctx.closePath(); ctx.fill();
        // 옥상 장비 및 레이더
        ctx.fillStyle = '#444'; ctx.fillRect(-10, -30, 20, 5);
        ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -55); ctx.stroke();
        ctx.restore();

        // 7. 입체 회전 레이더 디쉬 - 왼쪽으로 이동
        ctx.save();
        ctx.translate(-40, -110);
        ctx.fillStyle = '#555'; ctx.fillRect(-3, 0, 6, 15); // 지지대
        if (this.isPowered) {
            ctx.rotate(Date.now() / 600);
            const dishGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
            dishGrd.addColorStop(0, '#bdc3c7');
            dishGrd.addColorStop(1, '#7f8c8d');
            ctx.fillStyle = dishGrd;
            ctx.beginPath(); ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#333'; ctx.stroke();
            // 레이더 빔 효과
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 80, -0.2, 0.2); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // 8. 야간 항공 유도등 (입체적인 광원 효과) - 오른쪽 활주로에 맞춰 이동
        for(let i=0; i<6; i++) {
            const yPos = -120 + i*48;
            const blink = (Math.floor(Date.now()/300) + i) % 4 === 0;
            if (this.isPowered) {
                ctx.save();
                ctx.globalAlpha = blink ? 1.0 : 0.3;
                ctx.shadowBlur = 10; ctx.shadowColor = '#2ecc71';
                ctx.fillStyle = '#2ecc71';
                ctx.beginPath(); ctx.arc(15, yPos, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(95, yPos, 4, 0, Math.PI*2); ctx.fill();
                ctx.restore();
            }
        }

        ctx.restore();

        // HP 및 생산 바 (기존 유지하되 위치 최적화)
        const barW = 140;
        const barY = this.y - 170;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 10);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 10);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(this.x - barW/2, barY, barW, 10);

        if (this.spawnQueue.length > 0) {
            const qBarY = barY - 18;
            const progress = this.spawnQueue[0].timer / this.spawnTime;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 70, qBarY, 140, 10);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(this.x - 70, qBarY, 140 * progress, 10);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`비행대 출격 대기 중 (${this.spawnQueue.length})`, this.x, qBarY - 5);
        }
    }
}

export class Apartment extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'apartment';
        this.name = '아파트';
        this.width = 160;  // 4 tiles
        this.height = 200; // 5 tiles
        this.size = 200;
        this.maxHp = 3000;
        this.hp = 3000;
        this.isPowered = false;
        this.popProvide = 10;
    }

    update(deltaTime, engine) {
        // 현재는 특별한 로직이 없으므로 비워둡니다.
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. 기반 (Concrete Foundation)
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-80, -100, 160, 200);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.strokeRect(-80, -100, 160, 200);

        // 2. 메인 건물 구조 (2.5D)
        const drawBuilding = (bx, by, bw, bh, elevation, floors) => {
            // 건물 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(bx + 10, by + 10, bw, bh);

            // 뒷면/측면 두께 (Depth)
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(bx, by - elevation, bw + elevation, bh + elevation);

            // 정면 벽 (Main Facade)
            const facadeGrd = ctx.createLinearGradient(bx, by, bx, by + bh);
            facadeGrd.addColorStop(0, '#ecf0f1');
            facadeGrd.addColorStop(1, '#bdc3c7');
            ctx.fillStyle = facadeGrd;
            ctx.fillRect(bx, by, bw, bh);

            // 층별 창문 및 베란다
            const floorHeight = bh / floors;
            const winW = 12;
            const winH = 15;
            const winSpacing = bw / 5;

            for (let f = 0; f < floors; f++) {
                const fy = by + f * floorHeight + 10;
                
                // 층 구분선
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath(); ctx.moveTo(bx, fy - 5); ctx.lineTo(bx + bw, fy - 5); ctx.stroke();

                for (let w = 0; w < 4; w++) {
                    const wx = bx + (w + 0.5) * winSpacing - winW/2;
                    
                    // 베란다 복구 (직각형 돌출)
                    ctx.fillStyle = '#95a5a6';
                    ctx.fillRect(wx - 4, fy + winH - 2, winW + 8, 4);
                    ctx.fillStyle = '#bdc3c7';
                    ctx.fillRect(wx - 4, fy + winH - 5, winW + 8, 3);

                    // 창문 (단순 직각형)
                    // 전기가 들어올 때만 위치 기반으로 창문을 더 넓게 펼쳐서 켬 (밀집도 하향)
                    const lightSeed = Math.sin(f * 2.1 + w * 3.7 + this.x * 0.5 + this.y * 0.5);
                    let isLit = this.isPowered && (lightSeed > 0.5); // 임계값을 0.5로 높여 더 듬성듬성하게 배치

                    ctx.fillStyle = isLit ? '#f1c40f' : '#2c3e50';
                    ctx.fillRect(wx, fy, winW, winH);
                }
            }

            // 옥상 설비 (심플하게 난간만 남김)
            ctx.save();
            ctx.translate(bx, by);
            // 옥상 난간
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 3;
            ctx.strokeRect(2, 2, bw - 4, 4);
            
            ctx.restore();
        };

        // 두 개의 동 배치
        drawBuilding(-70, -80, 60, 160, 10, 8); // A동
        drawBuilding(10, -90, 60, 170, 12, 9);  // B동

        // 3. 1층 입구 조경
        const drawTree = (tx, ty) => {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(tx+2, ty+2, 8, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#27ae60';
            ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath(); ctx.arc(tx-2, ty-2, 5, 0, Math.PI*2); ctx.fill();
        };
        drawTree(-50, 80);
        drawTree(-30, 85);
        drawTree(40, 75);
        drawTree(60, 80);

        // 중앙 현관 캐노피
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-20, 60, 40, 15);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-15, 75, 5, 10);
        ctx.fillRect(10, 75, 5, 10);
        ctx.fillStyle = '#f1c40f'; // 현관 조명
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-15, 70, 30, 5);
        ctx.globalAlpha = 1.0;

        ctx.restore();

        // HP 바
        const barW = 120;
        const barY = this.y - 120;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 8);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 8);
    }
}

export class ScoutPlane extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'scout-plane';
        this.name = '고등 정찰 무인기';
        this.domain = 'air'; 
        this.speed = 4.5;    // 속도 살짝 상향
        this.visionRange = 18; // 정찰 능력 강화
        this.hp = 250;       // 체력 상향
        this.maxHp = 250;
        this.size = 70;      // 크기 대폭 확장
        this.popCost = 1;
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 1. 그림자 (공중에 떠 있는 느낌)
        ctx.save();
        ctx.translate(-5, 5);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(35, 0); ctx.lineTo(-15, -45); ctx.lineTo(-25, 0); ctx.lineTo(-15, 45);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // 2. 주익 (Wings - 델타익 스타일의 세련된 날개)
        const wingGrd = ctx.createLinearGradient(-20, -45, -20, 45);
        wingGrd.addColorStop(0, '#7f8c8d');
        wingGrd.addColorStop(0.5, '#bdc3c7');
        wingGrd.addColorStop(1, '#7f8c8d');
        
        ctx.fillStyle = wingGrd;
        ctx.beginPath();
        ctx.moveTo(10, 0);       // 앞쪽 중앙
        ctx.lineTo(-18, -48);    // 왼쪽 날개 끝
        ctx.lineTo(-28, -48);    // 왼쪽 날개 뒷단
        ctx.lineTo(-15, 0);      // 뒤쪽 중앙
        ctx.lineTo(-28, 48);     // 오른쪽 날개 뒷단
        ctx.lineTo(-18, 48);     // 오른쪽 날개 끝
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 날개 디테일 (플랩 및 라인)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.moveTo(-10, -25); ctx.lineTo(-22, -25);
        ctx.moveTo(-10, 25); ctx.lineTo(-22, 25);
        ctx.stroke();

        // 3. 동체 (Main Body - 유선형 무인기 스타일)
        const bodyGrd = ctx.createLinearGradient(0, -10, 0, 10);
        bodyGrd.addColorStop(0, '#ecf0f1');
        bodyGrd.addColorStop(0.5, '#bdc3c7');
        bodyGrd.addColorStop(1, '#95a5a6');
        
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(40, 0);       // 기수
        ctx.bezierCurveTo(30, -12, 10, -10, -25, -6); // 상단 라인
        ctx.lineTo(-25, 6);      // 하단 끝
        ctx.bezierCurveTo(10, 10, 30, 12, 40, 0);   // 하단 라인
        ctx.fill();
        ctx.stroke();

        // 4. 엔진 배기구 및 제트 화염
        ctx.fillStyle = '#333';
        ctx.fillRect(-28, -5, 5, 10);
        
        if (this.destination || Math.random() > 0.3) {
            const flicker = Math.random() * 5;
            const engineGrd = ctx.createRadialGradient(-30, 0, 2, -35, 0, 15);
            engineGrd.addColorStop(0, '#fff');
            engineGrd.addColorStop(0.4, '#00d2ff');
            engineGrd.addColorStop(1, 'transparent');
            ctx.fillStyle = engineGrd;
            ctx.beginPath();
            ctx.moveTo(-28, -4);
            ctx.lineTo(-45 - flicker, 0);
            ctx.lineTo(-28, 4);
            ctx.fill();
        }

        // 5. 정찰용 센서 터렛 (기수 하단)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(25, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e74c3c'; // 렌즈 안광
        ctx.beginPath();
        ctx.arc(27, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        // 6. 콕핏/위성 안테나 페어링 (무인기 특유의 불룩한 기수)
        ctx.fillStyle = 'rgba(0, 210, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(15, 0, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();

        // 7. 항법등 (깜빡이는 라이트)
        const blink = Math.sin(Date.now() / 200) > 0;
        if (blink) {
            ctx.fillStyle = '#ff3131'; // 좌익단 적색등
            ctx.beginPath(); ctx.arc(-22, -48, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71'; // 우익단 녹색등
            ctx.beginPath(); ctx.arc(-22, 48, 3, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();

        // HP 바 (기체 크기에 맞춰 위치 조정)
        const barW = 50;
        const barY = this.y - 50;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barW/2, barY, barW, 5);
    }
}

export class FallingBomb {
    constructor(x, y, engine, damage = 300, source) {
        this.x = x;
        this.y = y;
        this.engine = engine;
        this.damage = damage;
        this.source = source;
        this.timer = 0;
        this.duration = 1000; // 1초 후 폭발
        this.active = true;
        this.arrived = false; // GameEngine 필터 조건 대응
        this.radius = 120; // 폭발 범위 살짝 확장
        this.scale = 2.0; 
        this.type = 'bomb';
        
        // 폭격기로부터 공격 가능 대상 목록 상속 (폭격기는 기본적으로 지상/해상 공격)
        this.attackTargets = source?.attackTargets || ['ground', 'sea'];
    }

    update(deltaTime) {
        if (!this.active) return;
        this.timer += deltaTime;
        
        // 원근감: 2.0(하늘) -> 1.0(지면)
        this.scale = 2.0 - (this.timer / this.duration);
        
        if (this.timer >= this.duration) {
            this.explode();
            this.active = false;
            this.arrived = true;
        }
    }

    explode() {
        const potentialTargets = [
            ...this.engine.entities.enemies,
            ...this.engine.entities.neutral,
            ...this.engine.entities.units,
            ...this.engine.getAllBuildings()
        ];

        potentialTargets.forEach(target => {
            if (!target || target.hp === undefined) return;
            
            // 도메인 체크: 공격 가능한 대상 도메인인지 확인
            const targetDomain = target.domain || 'ground';
            if (!this.attackTargets.includes(targetDomain)) return;

            const dist = Math.hypot(this.x - target.x, this.y - target.y);
            const targetSize = target.size || 40;
            if (dist <= this.radius + targetSize / 2) {
                target.hp -= this.damage;
                if (target.hp <= 0 && target.active !== undefined) {
                    target.active = false;
                }
            }
        });

        // 폭발 이펙트 추가
        this.engine.entities.projectiles.push({
            x: this.x,
            y: this.y,
            active: true,
            arrived: false,
            timer: 0,
            duration: 600,
            update(dt) {
                this.timer += dt;
                if (this.timer >= this.duration) this.active = false;
            },
            draw(ctx) {
                const p = this.timer / this.duration;
                ctx.save();
                ctx.globalAlpha = 1 - p;
                
                // 중심 화염
                ctx.beginPath();
                ctx.arc(this.x, this.y, 60 * p, 0, Math.PI * 2);
                ctx.fillStyle = '#ff4500';
                ctx.fill();
                
                // 충격파
                ctx.beginPath();
                ctx.arc(this.x, this.y, 100 * p, 0, Math.PI * 2);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.restore();
            }
        });
    }

    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        // 1. 지면 낙하 예상 지점 가이드
        const progress = this.timer / this.duration;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + progress * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * (0.2 + progress * 0.8), 0, Math.PI * 2);
        ctx.stroke();

        // 2. 떨어지는 포탄 본체
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        
        // 포탄 본체 (더 크게 묘사)
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 꼬리 날개
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-6, -12, 12, 3);
        ctx.fillRect(-2, -15, 4, 6);
        
        ctx.restore();
    }
}

export class Bomber extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'bomber';
        this.name = '전략 폭격기';
        this.domain = 'ground'; // 지상 시작
        this.baseSpeed = 2.2; 
        this.airSpeed = 5.0;   // 공중 비행 속도 (7.0 -> 5.0 하향)
        this.speed = 0.5;      // 낮은 속도로 시작
        this.visionRange = 12;
        this.hp = 1200; 
        this.maxHp = 1200;
        this.size = 92;
        this.width = 140;
        this.height = 115;
        this.damage = 0; 
        this.attackTargets = ['ground', 'sea']; 
        
        this.bombTimer = 0;
        this.bombInterval = 500; 

        // 이착륙 시스템
        this.altitude = 0.0; // 지상 시작
        this.isLandingZoneSafe = false;
        this.lastX = x;
        this.lastY = y;
        
        this.isTakeoffStarting = false; // 수동 이륙 플래그
        this.isManualLanding = false;   // 수동 착륙 플래그
        this.maneuverFrameCount = 0;    // 활주 시작 프레임 카운터
        this.takeoffDistance = 0;       // 활주 거리 누적
        this.isBombingActive = false;   // 폭격 모드 활성화 여부
        this.popCost = 6;
        
        this.ammoType = 'shell';
        this.maxAmmo = 12;
        this.ammo = 12;
    }

    // 스킬 설정 정보 제공
    getSkillConfig(cmd) {
        const skills = {
            'bombing': { type: 'toggle', handler: this.toggleBombing },
            'takeoff_landing': { type: 'state', handler: this.toggleTakeoff }
        };
        return skills[cmd];
    }

    toggleBombing() {
        this.isBombingActive = !this.isBombingActive;
    }

    toggleTakeoff() {
        if (this.altitude < 0.1) {
            // 지상이면 이륙 프로세스 시작
            this.isTakeoffStarting = true;
            this.isManualLanding = false;
            this.maneuverFrameCount = 0;
            this.takeoffDistance = 0;
            this.speed = 0.5; // 이륙 시작 시 속도 초기화
            this.command = 'move'; 
            this.destination = null; 
        } else {
            // 공중이면 착륙 프로세스 시작
            this.isManualLanding = true;
            this.isTakeoffStarting = false;
            this.maneuverFrameCount = 0;
            this.command = 'move';
            this.destination = null;
        }
    }

    update(deltaTime) {
        const movedDist = Math.hypot(this.x - this.lastX, this.y - this.lastY);
        this.lastX = this.x;
        this.lastY = this.y;

        // 0. 속도 관리 로직 (이륙 가속 및 공중 고속 비행)
        if (this.isTakeoffStarting) {
            if (this.altitude <= 0) {
                // 1) 활주 중 가속: 0.5에서 baseSpeed까지 (활주 거리 300px 기준)
                const takeoffProgress = Math.min(1.0, this.takeoffDistance / 300);
                this.speed = 0.5 + (this.baseSpeed - 0.5) * takeoffProgress;
            } else {
                // 2) 이륙 상승 중 가속: baseSpeed에서 airSpeed까지 (고도 기준)
                this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
            }
        } else if (this.isManualLanding) {
            // 3) 착륙 시 감속: 고도에 따라 airSpeed에서 baseSpeed까지
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else if (this.altitude > 0) {
            // 4) 일반 비행 중: 고도에 따른 속도 유지
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else {
            // 5) 지상 대기/이동 중
            this.speed = this.baseSpeed;
        }

        // 1. 도메인 판정
        this.domain = (this.altitude > 0.8) ? 'air' : 'ground';

        // 2. 폭격 자동 투하 로직 (폭격 모드가 켜져 있고 충분한 고도일 때만 투하)
        if (this.isBombingActive && this.altitude > 0.8) {
            this.bombTimer += deltaTime;
            if (this.bombTimer >= this.bombInterval) {
                // 탄약 체크
                if (this.ammo > 0) {
                    this.bombTimer = 0;
                    this.ammo--; // 포탄 1발 소모
                    const bomb = new FallingBomb(this.x, this.y, this.engine, 300, this);
                    this.engine.entities.projectiles.push(bomb);
                } else {
                    // 탄약 고갈 시 폭격 중단 및 알림
                    this.isBombingActive = false;
                    if (this.engine.addEffect) {
                        this.engine.addEffect('system', this.x, this.y - 40, '#ff3131', '포탄 고갈! 폭격 중단');
                    }
                }
            }
        }

        // 3. 자동 전진 로직 (이륙 또는 착륙 활주 중일 때)
        if (this.isTakeoffStarting || this.isManualLanding) {
            this.maneuverFrameCount++;

            // 다음 전진 지점 계산 및 지형 충돌 체크
            const nextX = this.x + Math.cos(this.angle) * this.speed;
            const nextY = this.y + Math.sin(this.angle) * this.speed;
            const grid = this.engine.tileMap.worldToGrid(nextX, nextY);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
            
            // 고도가 낮을 때만 지상 장애물에 막힘 (충돌 판정)
            const isBlocked = (this.altitude < 0.7) && (tile && (tile.occupied || !tile.buildable));

            if (!isBlocked) {
                this.x = nextX;
                this.y = nextY;
            }

            // 실제로 움직이고 있는지 확인 (장애물 체크 - 판정 기준)
            const isMoving = this.maneuverFrameCount < 15 || movedDist > this.speed * 0.25;

            if (this.isTakeoffStarting) {
                if (isMoving) {
                    this.takeoffDistance += Math.max(movedDist, this.speed * 0.5); 
                    // 최소 300px 활주 후 상승 시작
                    if (this.takeoffDistance > 300) {
                        this.altitude = Math.min(1.0, this.altitude + 0.015);
                    }
                    if (this.altitude >= 1.0) {
                        this.isTakeoffStarting = false;
                        this.command = 'stop';
                    }
                } else {
                    // 장애물에 막혀 속도가 떨어지면 즉시 이륙 취소
                    if (this.altitude < 0.8) {
                        this.isTakeoffStarting = false;
                        this.altitude = 0;
                        this.command = 'stop';
                    }
                }
            } else if (this.isManualLanding) {
                // 발밑 지형 확인
                const grid = this.engine.tileMap.worldToGrid(this.x, this.y);
                const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
                const isGroundClear = tile && !tile.occupied && tile.buildable;

                if (isMoving) {
                    if (isGroundClear) {
                        // 하강 속도를 절반으로 줄여 착륙 거리를 2배로 연장 (0.015 -> 0.0075)
                        this.altitude = Math.max(0, this.altitude - 0.0075);
                        if (this.altitude <= 0) {
                            this.isManualLanding = false;
                            this.command = 'stop';
                        }
                    } else {
                        // 장애물 위라면 더 천천히 하강하며 평지 탐색
                        this.altitude = Math.max(0.15, this.altitude - 0.005);
                    }
                } else {
                    // 착륙 중 충돌 시 즉시 정지
                    this.isManualLanding = false;
                    this.altitude = 0;
                    this.command = 'stop';
                }
            }
            return;
        }

        super.update(deltaTime);

        // 4. 목적지 지형 확인 (일반 이동 시)
        if (this.destination) {
            const grid = this.engine.tileMap.worldToGrid(this.destination.x, this.destination.y);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
            this.isLandingZoneSafe = tile && !tile.occupied && tile.buildable;
        }

        // 5. 고도 보정 (수동 조작 중이 아닐 때)
        if (this.altitude > 0 && this.altitude < 1.0) {
            if (this.altitude > 0.5) this.altitude = Math.min(1.0, this.altitude + 0.01);
            else this.altitude = Math.max(0, this.altitude - 0.01);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 시각 효과 계산
        const shadowMaxOffset = 15;
        const shadowOffset = shadowMaxOffset * this.altitude;
        
        // 이륙 시 활주 시작부터 엔진 가동 연출
        const isEnginesRunning = this.altitude > 0 || (this.command === 'move' && this.isLandingZoneSafe);
        const propSpeedFactor = isEnginesRunning ? Math.max(0.2, this.altitude) : 0;
        const propAngle = propSpeedFactor > 0 ? (Date.now() / (60 / propSpeedFactor)) % (Math.PI * 2) : 0;

        // 0. 그림자
        ctx.save();
        ctx.translate(-shadowOffset, shadowOffset);
        ctx.globalAlpha = 0.1 + (1.0 - this.altitude) * 0.2;
        ctx.fillStyle = '#000';
        // 날개 그림자
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-20, -75); ctx.lineTo(-35, -75);
        ctx.lineTo(-10, 0); ctx.lineTo(-35, 75); ctx.lineTo(-20, 75);
        ctx.closePath(); ctx.fill();
        // 동체 그림자
        ctx.beginPath();
        ctx.moveTo(60, 0); ctx.bezierCurveTo(60, -14, 50, -16, 40, -16);
        ctx.lineTo(-55, -12); ctx.lineTo(-65, 0); ctx.lineTo(-55, 12);
        ctx.lineTo(40, 16); ctx.bezierCurveTo(50, 16, 60, 14, 60, 0);
        ctx.fill();
        ctx.restore();

        // 1. 주익
        const wingColor = '#2c3e50'; 
        ctx.fillStyle = wingColor;
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-20, -75); ctx.lineTo(-35, -75);
        ctx.lineTo(-10, 0); ctx.lineTo(-35, 75); ctx.lineTo(-20, 75);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1.5; ctx.stroke();

        // 2. 엔진 & 프로펠러
        const engineOffsets = [-28, -52, 28, 52]; 
        engineOffsets.forEach(offset => {
            ctx.save();
            ctx.translate(-8, offset); 
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-10, -6, 26, 12); 
            ctx.strokeStyle = '#000'; ctx.strokeRect(-10, -6, 26, 12);
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath(); ctx.arc(16, 0, 3.5, 0, Math.PI * 2); ctx.fill();
            
            ctx.save();
            ctx.translate(16, 0);
            ctx.rotate(propAngle);
            ctx.fillStyle = '#0a0a0a';
            for(let i=0; i<4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.beginPath(); ctx.ellipse(0, 9, 2.5, 11, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            ctx.restore();
        });

        // 3. 동체
        const bodyGrd = ctx.createLinearGradient(0, -15, 0, 15);
        bodyGrd.addColorStop(0, '#34495e'); bodyGrd.addColorStop(0.5, '#2c3e50'); bodyGrd.addColorStop(1, '#1c2833');
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(60, 0); ctx.bezierCurveTo(60, -14, 50, -16, 40, -16); 
        ctx.lineTo(-55, -12); ctx.lineTo(-65, 0); ctx.lineTo(-55, 12);
        ctx.lineTo(40, 16); ctx.bezierCurveTo(50, 16, 60, 14, 60, 0);
        ctx.fill(); ctx.stroke();

        // 4. 조종석
        ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(48, -6); ctx.bezierCurveTo(52, -5, 52, 5, 48, 6);
        ctx.lineTo(42, 5); ctx.lineTo(42, -6);
        ctx.closePath(); ctx.fill();

        // 5. 꼬리 날개
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-45, 0); ctx.lineTo(-65, -30); ctx.lineTo(-75, -30);
        ctx.lineTo(-60, 0); ctx.lineTo(-75, 30); ctx.lineTo(-65, 30);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        if (this.command === 'bombing') {
            const blink = Math.sin(Date.now() / 150) > 0;
            if (blink) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000'; ctx.fillRect(-20, -6, 40, 12);
            }
        }
        ctx.restore();

        // HP 바
        const barW = 100;
        const barY = this.y - 70;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 6);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x - barW/2, barY, barW, 6);
    }
}



export class CargoPlane extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'cargo-plane';
        this.name = '전략 수송기';
        this.domain = 'ground'; // 지상 시작
        this.baseSpeed = 0.8;   // 지상 이동/활주 속도 (하향)
        this.airSpeed = 2.2;    // 공중 비행 속도 (반으로 하향)
        this.speed = 0.3;       // 초기 속도 (하향)
        this.hp = 1500;
        this.maxHp = 1500;
        this.size = 110;
        this.width = 130;
        this.height = 140;

        // 이착륙 시스템 (폭격기와 동일)
        this.altitude = 0.0; // 지상 시작
        this.isLandingZoneSafe = false;
        this.lastX = x;
        this.lastY = y;
        
        this.isTakeoffStarting = false;
        this.isManualLanding = false;
        this.maneuverFrameCount = 0;
        this.takeoffDistance = 0;

        // --- 수송 시스템 설정 ---
        this.cargo = [];
        this.cargoCapacity = 20; // 최대 부피 20
        this.isUnloading = false;
        this.unloadTimer = 0;
        this.unloadInterval = 300; 
        this.popCost = 4;
    }

    // 현재 적재된 총 부피 계산
    getOccupiedSize() {
        return this.cargo.reduce((sum, unit) => sum + (unit.cargoSize || 1), 0);
    }

    // 스킬 설정 정보 제공
    getSkillConfig(cmd) {
        const skills = {
            'takeoff_landing': { type: 'state', handler: this.toggleTakeoff },
            'unload_all': { type: 'instant', handler: this.startUnloading },
            'combat_drop': { type: 'instant', handler: this.startCombatDrop }
        };
        return skills[cmd];
    }

    // 유닛 탑승 처리
    loadUnit(unit) {
        if (this.isUnloading) return false;
        const uSize = unit.cargoSize || 1;
        if (this.getOccupiedSize() + uSize > this.cargoCapacity) return false;
        if (this.altitude > 0.1) return false;

        unit.active = false; 
        unit.command = 'stop';
        this.cargo.push(unit);
        
        // 엔진 리스트에서 유닛 제거 (업데이트 및 렌더링 루프 제외)
        const idx = this.engine.entities.units.indexOf(unit);
        if (idx > -1) this.engine.entities.units.splice(idx, 1);
        
        return true;
    }

    // 하차 시작
    startUnloading() {
        if (this.altitude > 0.1 || this.cargo.length === 0) return;
        this.isUnloading = true;
        this.unloadTimer = 0;
    }

    // 순차적 하차 처리 (update에서 호출)
    processUnloading(deltaTime) {
        if (!this.isUnloading || this.cargo.length === 0) {
            this.isUnloading = false;
            return;
        }

        this.unloadTimer += deltaTime;
        if (this.unloadTimer >= this.unloadInterval) {
            this.unloadTimer = 0;
            const unit = this.cargo.shift();
            
            // 수송기 뒤쪽 위치 계산
            const rearDist = 80;
            const rearX = this.x + Math.cos(this.angle + Math.PI) * rearDist;
            const rearY = this.y + Math.sin(this.angle + Math.PI) * rearDist;

            unit.active = true;
            unit.x = rearX;
            unit.y = rearY;
            unit.angle = this.angle + Math.PI; // 반대 방향 바라보기
            
            // 하차 후 약간 전진 시키기
            const exitDestX = rearX + Math.cos(this.angle + Math.PI) * 60;
            const exitDestY = rearY + Math.sin(this.angle + Math.PI) * 60;
            unit.destination = { x: exitDestX, y: exitDestY };
            
            this.engine.entities.units.push(unit);

            if (this.cargo.length === 0) this.isUnloading = false;
        }
    }

    startCombatDrop() {
        if (this.altitude < 0.8) {
            this.engine.addEffect?.('system', this.x, this.y, '#ff3131', '고도가 너무 낮습니다!');
            return;
        }
        if (this.cargo.length === 0) {
            this.engine.addEffect?.('system', this.x, this.y, '#ff3131', '탑승한 유닛이 없습니다.');
            return;
        }
        if (this.engine.resources.gold < 100) {
            this.engine.addEffect?.('system', this.x, this.y, '#ff3131', '골드가 부족합니다 (100G)');
            return;
        }

        this.engine.resources.gold -= 100;
        this.isCombatDropping = true;
        this.dropTimer = 0;
        this.engine.addEffect?.('system', this.x, this.y, '#fff', '전투 강하 개시!');
    }

    processCombatDrop(deltaTime) {
        if (!this.isCombatDropping || this.cargo.length === 0) {
            this.isCombatDropping = false;
            return;
        }

        this.dropTimer += deltaTime;
        if (this.dropTimer >= 400) { // 0.4초 간격
            this.dropTimer = 0;
            
            // 투하 위치 확인
            const grid = this.engine.tileMap.worldToGrid(this.x, this.y);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
            
            // 장애물이 있으면 스킵 (다음 이동 위치에서 재시도)
            if (tile && (tile.occupied || !tile.buildable)) {
                return; 
            }

            const unit = this.cargo.shift();
            unit.active = true;
            unit.x = this.x;
            unit.y = this.y;
            unit.domain = 'air'; // 낙하 중 공중 판정
            unit.isFalling = true;
            unit.fallTimer = 0;
            unit.fallDuration = 2000; // 2초간 낙하
            unit.destination = null;
            unit.command = 'stop';

            this.engine.entities.units.push(unit);
            this.engine.addEffect?.('system', this.x, this.y, '#fff', 'Drop!');

            if (this.cargo.length === 0) {
                this.isCombatDropping = false;
                this.engine.addEffect?.('system', this.x, this.y, '#fff', '강하 완료');
            }
        }
    }

    toggleTakeoff() {
        if (this.altitude < 0.1) {
            this.isTakeoffStarting = true;
            this.isManualLanding = false;
            this.maneuverFrameCount = 0;
            this.takeoffDistance = 0;
            this.speed = 0.5;
            this.command = 'move'; 
            this.destination = null; 
        } else {
            this.isManualLanding = true;
            this.isTakeoffStarting = false;
            this.maneuverFrameCount = 0;
            this.command = 'move';
            this.destination = null;
        }
    }

    update(deltaTime) {
        const movedDist = Math.hypot(this.x - this.lastX, this.y - this.lastY);
        this.lastX = this.x;
        this.lastY = this.y;

        // 하차 로직 처리
        if (this.isUnloading) {
            this.processUnloading(deltaTime);
        }

        // 전투 강하 로직
        if (this.isCombatDropping) {
            this.processCombatDrop(deltaTime);
        }

        // 0. 속도 관리 로직
        if (this.isTakeoffStarting) {
            if (this.altitude <= 0) {
                const takeoffProgress = Math.min(1.0, this.takeoffDistance / 350); // 수송기는 더 긴 활주 거리 필요
                this.speed = 0.3 + (this.baseSpeed - 0.3) * takeoffProgress;
            } else {
                this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
            }
        } else if (this.isManualLanding) {
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else if (this.altitude > 0) {
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else {
            this.speed = this.baseSpeed;
        }

        // 1. 도메인 판정
        this.domain = (this.altitude > 0.8) ? 'air' : 'ground';

        // 2. 자동 전진 로직 (이륙 또는 착륙 활주 중일 때)
        if (this.isTakeoffStarting || this.isManualLanding) {
            this.maneuverFrameCount++;

            const nextX = this.x + Math.cos(this.angle) * this.speed;
            const nextY = this.y + Math.sin(this.angle) * this.speed;
            const grid = this.engine.tileMap.worldToGrid(nextX, nextY);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
            
            const isBlocked = (this.altitude < 0.7) && (tile && (tile.occupied || !tile.buildable));

            if (!isBlocked) {
                this.x = nextX;
                this.y = nextY;
            }

            const isMoving = this.maneuverFrameCount < 15 || movedDist > this.speed * 0.25;

            if (this.isTakeoffStarting) {
                if (isMoving) {
                    this.takeoffDistance += Math.max(movedDist, this.speed * 0.5); 
                    if (this.takeoffDistance > 350) {
                        this.altitude = Math.min(1.0, this.altitude + 0.012); // 수송기는 약간 더 천천히 상승
                    }
                    if (this.altitude >= 1.0) {
                        this.isTakeoffStarting = false;
                        this.command = 'stop';
                    }
                } else {
                    if (this.altitude < 0.8) {
                        this.isTakeoffStarting = false;
                        this.altitude = 0;
                        this.command = 'stop';
                    }
                }
            } else if (this.isManualLanding) {
                const grid = this.engine.tileMap.worldToGrid(this.x, this.y);
                const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
                const isGroundClear = tile && !tile.occupied && tile.buildable;

                if (isMoving) {
                    if (isGroundClear) {
                        this.altitude = Math.max(0, this.altitude - 0.006); // 더 완만하게 착륙
                        if (this.altitude <= 0) {
                            this.isManualLanding = false;
                            this.command = 'stop';
                        }
                    } else {
                        this.altitude = Math.max(0.15, this.altitude - 0.004);
                    }
                } else {
                    this.isManualLanding = false;
                    this.altitude = 0;
                    this.command = 'stop';
                }
            }
            return;
        }

        super.update(deltaTime);

        // 3. 고도 보정 (수동 조작 중이 아닐 때)
        if (this.altitude > 0 && this.altitude < 1.0) {
            if (this.altitude > 0.5) this.altitude = Math.min(1.0, this.altitude + 0.01);
            else this.altitude = Math.max(0, this.altitude - 0.01);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const time = Date.now();
        const shadowOffset = 22 * this.altitude;
        
        // 0. 그림자 (더 부드럽게)
        ctx.save();
        ctx.translate(-shadowOffset, shadowOffset);
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-45, -115); ctx.lineTo(-75, -115);
        ctx.lineTo(-35, 0); ctx.lineTo(-75, 115); ctx.lineTo(-45, 115);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(-90, -22, 170, 44);
        ctx.restore();

        // 1. 고익기 주익 (Wing Structure with Control Surfaces)
        const drawWing = () => {
            const wingGrd = ctx.createLinearGradient(0, -115, 0, 115);
            wingGrd.addColorStop(0, '#7f8c8d');
            wingGrd.addColorStop(0.5, '#bdc3c7');
            wingGrd.addColorStop(1, '#7f8c8d');
            ctx.fillStyle = wingGrd;
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-38, -115); ctx.lineTo(-72, -115); // 좌측 날개
            ctx.lineTo(-28, 0);
            ctx.lineTo(-72, 115); ctx.lineTo(-38, 115);  // 우측 날개
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // 플랩 & 에일러론 라인 (날개 가동면)
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.moveTo(-25, -50); ctx.lineTo(-55, -50);
            ctx.moveTo(-25, 50); ctx.lineTo(-55, 50);
            ctx.stroke();
        };
        drawWing();

        // 2. 4발 정밀 제트 엔진 (Engine Nacelles with Exhaust)
        const engineOffsets = [-88, -52, 52, 88];
        engineOffsets.forEach(offset => {
            ctx.save();
            const wingX = -12 - Math.abs(offset) * 0.22; 
            ctx.translate(wingX, offset);
            
            // 배기구 그을린 금속 (Exhaust Cone)
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(-12, -6, 15, 12);
            
            // 엔진 본체
            const engGrd = ctx.createLinearGradient(0, -9, 0, 9);
            engGrd.addColorStop(0, '#34495e'); engGrd.addColorStop(0.5, '#5d6d7e'); engGrd.addColorStop(1, '#2c3e50');
            ctx.fillStyle = engGrd;
            ctx.fillRect(-6, -9, 28, 18);
            ctx.strokeRect(-6, -9, 28, 18);
            
            // 공기 흡입구 및 내부 팬 블레이드 실루엣
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath(); ctx.ellipse(22, 0, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
            
            // 엔진 가동 시 팬 블레이드 회전 효과 (이륙/비행 중일 때만)
            const isEnginesRunning = this.altitude > 0 || this.isTakeoffStarting || (this.command === 'move' && this.destination);
            if (isEnginesRunning) {
                ctx.strokeStyle = '#2c3e50';
                for(let i=0; i<4; i++) {
                    ctx.beginPath(); ctx.moveTo(22, 0); 
                    ctx.lineTo(22 + Math.cos(time/100 + i*Math.PI/2)*3, Math.sin(time/100 + i*Math.PI/2)*5);
                    ctx.stroke();
                }
            }
            ctx.restore();
        });

        // 3. 거대 중량 동체 (Heavy-Lift Fuselage)
        const bodyGrd = ctx.createLinearGradient(0, -25, 0, 25);
        bodyGrd.addColorStop(0, '#7f8c8d');
        bodyGrd.addColorStop(0.2, '#bdc3c7');
        bodyGrd.addColorStop(0.5, '#ecf0f1');
        bodyGrd.addColorStop(0.8, '#bdc3c7');
        bodyGrd.addColorStop(1, '#7f8c8d');
        ctx.fillStyle = bodyGrd;
        
        ctx.beginPath();
        ctx.moveTo(85, 0); // 더 길어진 기수
        ctx.bezierCurveTo(85, -24, 65, -26, 45, -26); 
        ctx.lineTo(-65, -26); 
        ctx.bezierCurveTo(-100, -26, -100, 26, -65, 26); 
        ctx.lineTo(45, 26); 
        ctx.bezierCurveTo(65, 26, 85, 24, 85, 0); 
        ctx.fill();
        ctx.stroke();

        // 기수 레이돔 (Radome) 라인
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.arc(65, 0, 24, -Math.PI/2, Math.PI/2); ctx.stroke();

        // 공중 급유 프로브 (Refueling Probe - 기수 오른쪽)
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(60, -18, 20, 3);
        ctx.strokeRect(60, -18, 20, 3);

        // 랜딩 기어 벌지 & 패널 디테일
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(-25, -29, 60, 5); 
        ctx.fillRect(-25, 24, 60, 5);
        ctx.strokeRect(-25, -29, 60, 5);
        ctx.strokeRect(-25, 24, 60, 5);

        // 4. 조종석 및 관측창
        ctx.fillStyle = '#0a192f';
        ctx.beginPath();
        ctx.moveTo(68, -11); ctx.bezierCurveTo(74, -9, 74, 9, 68, 11);
        ctx.lineTo(55, 10); ctx.lineTo(55, -10); ctx.closePath();
        ctx.fill();
        // 동체 측면 작은 창문들
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for(let i=0; i<3; i++) ctx.fillRect(10 - i*25, -22, 4, 3);

        // 5. T-Tail Complex
        // 수직 미익 기둥 (패널 라인 포함)
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(-92, -4, 35, 8);
        ctx.strokeRect(-92, -4, 35, 8);
        
        // 상부 수평 미익 (High Mounted Elevators)
        ctx.save();
        ctx.translate(-92, 0);
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-18, -48); ctx.lineTo(-32, -48);
        ctx.lineTo(-22, 0); ctx.lineTo(-32, 48); ctx.lineTo(-18, 48);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // 꼬리 끝단 정비창 디테일
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-15, -2, 10, 4);
        ctx.restore();

        // 6. 후면 카고 램프 (Cargo Ramp) 라인
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.moveTo(-60, -26); ctx.lineTo(-95, 0); ctx.lineTo(-60, 26);
        ctx.stroke();

        // 항공 등화 (강화됨)
        const blink = Math.sin(time / 450) > 0;
        ctx.shadowBlur = blink ? 5 : 0;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = blink ? '#ff3131' : '#440000';
        ctx.beginPath(); ctx.arc(-45, -115, 4, 0, Math.PI*2); ctx.fill(); // Left Wing
        ctx.beginPath(); ctx.arc(-45, 115, 4, 0, Math.PI*2); ctx.fill();  // Right Wing
        ctx.beginPath(); ctx.arc(-118, 0, 4, 0, Math.PI*2); ctx.fill();   // Tail Tip
        ctx.shadowBlur = 0;

        // --- 적재량 상세 표시 (선택 시에만) ---
        if (this.engine.selectedEntities.includes(this) && (this.cargo.length > 0)) {
            ctx.save();
            ctx.rotate(-this.angle); // 텍스트 수평 유지
            
            const counts = {};
            this.cargo.forEach(u => {
                const name = u.name || u.type;
                counts[name] = (counts[name] || 0) + 1;
            });

            // 목록 생성 및 상단에 총 용량 추가
            const occupied = this.getOccupiedSize ? this.getOccupiedSize() : this.cargo.length;
            const entries = [
                `적재 용량: ${occupied} / ${this.cargoCapacity}`,
                ...Object.entries(counts).map(([name, count]) => `${name} x ${count}`)
            ];

            const lineHeight = 20;
            const padding = 10;
            
            ctx.font = 'bold 14px "Segoe UI", Arial';
            let maxWidth = 0;
            entries.forEach(text => {
                maxWidth = Math.max(maxWidth, ctx.measureText(text).width);
            });

            const boxWidth = maxWidth + padding * 2;
            const boxHeight = entries.length * lineHeight + padding;
            const boxY = -80 - boxHeight; // 위치를 조금 더 위로

            // 메인 샴퍼 배경
            ctx.fillStyle = 'rgba(10, 20, 30, 0.85)';
            ctx.beginPath();
            ctx.roundRect(-boxWidth/2, boxY, boxWidth, boxHeight, 6);
            ctx.fill();
            
            // 상단 하이라이트 테두리
            ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 텍스트 출력
            ctx.textAlign = 'center';
            entries.forEach((text, i) => {
                // 첫 번째 줄(용량)은 노란색 강조, 나머지는 밝은 흰색/시안
                if (i === 0) {
                    ctx.fillStyle = '#f1c40f';
                    ctx.font = 'bold 14px "Segoe UI", Arial';
                } else {
                    ctx.fillStyle = '#ecf0f1';
                    ctx.font = '13px "Segoe UI", Arial';
                }
                ctx.fillText(text, 0, boxY + padding + 14 + i * lineHeight);
            });
            ctx.restore();
        }

        ctx.restore();

        // HP 바 상시 표시 (수송기 크기에 맞춰 확장)
        const barW = 110;
        const barY = this.y - 85;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW/2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW/2, barY, (this.hp / this.maxHp) * barW, 6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barW/2, barY, barW, 6);
    }
}

export class DamageText {
    constructor(x, y, text, color = '#ff3131') {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.timer = 0;
        this.duration = 1000;
        this.active = true;
        this.arrived = false; // Filter 대응
        this.offsetY = 0;
    }

    update(deltaTime) {
        this.timer += deltaTime;
        this.offsetY -= 0.5; // 위로 떠오름
        if (this.timer >= this.duration) this.active = false;
    }

    draw(ctx) {
        const p = this.timer / this.duration;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y + this.offsetY);
        ctx.restore();
    }
}

export class Enemy extends Entity {
    constructor(x, y) {
        super(x, y);
        this.ownerId = 2; // 플레이어 2 (적) 소유
        this.speed = 1.8;
        this.maxHp = 50;
        this.hp = this.maxHp;
        this.size = 40; // 20 -> 40
        this.damage = 10;
        this.attackRange = 35;
        this.attackInterval = 1000;
        this.lastAttackTime = 0;
        this.currentTarget = null;
        this.path = [];
        this.pathTimer = Math.random() * 2000; // 초기 경로 계산 분산
    }

    update(deltaTime, base, buildings, engine) {
        if (!engine) return;
        if (this.hitTimer > 0) this.hitTimer -= deltaTime;
        const now = Date.now();
        
        // 1. 타겟 결정 로직 (관계 기반)
        if (!this.currentTarget || !this.currentTarget.active || this.currentTarget.hp <= 0) {
            // 가장 가까운 적(Player 1 등) 찾기
            const potentialTargets = [
                engine.entities.base,
                ...engine.entities.units,
                ...engine.getAllBuildings()
            ];

            let minDist = Infinity;
            let bestTarget = null;

            for(const target of potentialTargets) {
                if (!target || !target.active || target.hp <= 0) continue;
                
                // 관계 확인
                if (engine.getRelation(this.ownerId, target.ownerId) === 'enemy') {
                    const d = Math.hypot(this.x - target.x, this.y - target.y);
                    if (d < minDist) {
                        minDist = d;
                        bestTarget = target;
                    }
                }
            }
            this.currentTarget = bestTarget;
        }

        if (!this.currentTarget) return;

        // 2초마다 경로 재계산
        this.pathTimer += deltaTime;
        if (this.pathTimer >= 2000 || (this.path.length === 0 && this.hp > 0)) {
            const pf = engine.pathfinding;
            this.path = pf.findPath(this.x, this.y, this.currentTarget.x, this.currentTarget.y, false, this.pathfindingSize) || [];
            this.pathTimer = 0;
        }

        let moveTarget = this.currentTarget;
        
        // 경로 추종 로직
        while (this.path.length > 0) {
            const waypoint = this.path[0];
            const distToWaypoint = Math.hypot(waypoint.x - this.x, waypoint.y - this.y);
            if (distToWaypoint < 15) {
                this.path.shift();
            } else {
                moveTarget = waypoint;
                break;
            }
        }

        const angleToTarget = Math.atan2(moveTarget.y - this.y, moveTarget.x - this.x);
        this.angle = angleToTarget; // 방향 업데이트
        
        // --- 슬라이딩 충돌 이동 적용 (Enemy도 동일하게) ---
        const dist = this.speed;
        const nextX = this.x + Math.cos(this.angle) * dist;
        const nextY = this.y + Math.sin(this.angle) * dist;

        let canMoveX = true;
        let canMoveY = true;

        const obstacles = [...engine.getAllBuildings(), ...engine.entities.resources.filter(r => !r.covered)];
        const unitRadius = this.collisionRadius;

        for (const b of obstacles) {
            if (b === this || b.passable) continue;
            
            if (b instanceof Resource) {
                const minCollisionDist = unitRadius + (b.size * 0.5);
                if (Math.hypot(nextX - b.x, this.y - b.y) < minCollisionDist) canMoveX = false;
                if (Math.hypot(this.x - b.x, nextY - b.y) < minCollisionDist) canMoveY = false;
            } else {
                const bounds = b.getSelectionBounds();
                const margin = unitRadius;
                if (nextX + margin > bounds.left && nextX - margin < bounds.right && (this.y + margin > bounds.top && this.y - margin < bounds.bottom)) canMoveX = false;
                if (this.x + margin > bounds.left && this.x - margin < bounds.right && (nextY + margin > bounds.top && nextY - margin < bounds.bottom)) canMoveY = false;
            }
        }

        if (canMoveX) this.x = nextX;
        if (canMoveY) this.y = nextY;
        
        // --- 유닛 간 밀어내기 및 끼임 탈출 ---
        let pushX = 0;
        let pushY = 0;
        const allUnits = [...engine.entities.units, ...engine.entities.enemies];
        for (const other of allUnits) {
            if (other === this || !other.active) continue;
            const d = Math.hypot(this.x - other.x, this.y - other.y);
            const minDist = (this.size + other.size) * 0.4;
            if (d < minDist) {
                const pushAngle = Math.atan2(this.y - other.y, this.x - other.x);
                pushX += Math.cos(pushAngle) * 0.5;
                pushY += Math.sin(pushAngle) * 0.5;
            }
        }
        this.x += pushX;
        this.y += pushY;
        
        // 이동 방해 체크 (자체 소속 제외한 건물/유닛 등)
        for (const obs of buildings) {
            if (['power-line', 'pipe-line'].includes(obs.type)) continue;
            if (obs === this) continue;
            const dNext = Math.hypot(nextX - obs.x, nextY - obs.y);
            const minDist = (this.size / 2) + (obs.size / 2) + 2;
            if (dNext < minDist) {
                blockedBy = obs;
                break;
            }
        }

        if (!blockedBy) {
            this.x = nextX;
            this.y = nextY;
        }

        // 공격 로직
        if (this.currentTarget && (this.currentTarget.active !== false) && this.currentTarget.hp > 0) {
            const attackDist = Math.hypot(this.x - this.currentTarget.x, this.y - this.currentTarget.y);
            const rangeThreshold = (this.size/2 + (this.currentTarget.width || this.currentTarget.size || 40)/2 + 5);
            
            if (attackDist <= rangeThreshold) {
                if (now - this.lastAttackTime > this.attackInterval) {
                    this.currentTarget.hp -= this.damage;
                    this.lastAttackTime = now;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 적군 외형: 육각형 모양의 위협적인 기계 유닛
        ctx.fillStyle = '#441111';
        ctx.strokeStyle = '#ff3131';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * (this.size / 2.5);
            const py = Math.sin(angle) * (this.size / 2.5);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 중앙 '코어' (빛남)
        ctx.fillStyle = '#ff3131';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3131';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

        // HP 바 (적군은 빨간색)
        const barY = this.y + this.size / 2 + 5;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - 15, barY, 30, 4);
        ctx.fillStyle = '#ff3131';
        ctx.fillRect(this.x - 15, barY, (this.hp / this.maxHp) * 30, 4);
    }
}

export class Projectile extends Entity {
    constructor(x, y, target, damage, color = '#ffff00', source) {
        super(x, y);
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.source = source;
        this.speed = 8;
        this.size = 6;
        this.type = 'normal'; // 'shell', 'normal', etc.
        this.angle = 0;
        this.explosionRadius = 0; // 0이면 단일 타겟, >0 이면 범위 공격
        this.exploding = false; // 폭발 연출 중인지 여부
        this.explosionTimer = 0;
    }

    explode(engine) {
        if (this.explosionRadius > 0) {
            // 모든 잠재적 타겟 수집
            const targets = [
                engine.entities.base,
                ...engine.entities.enemies, 
                ...engine.entities.units,
                ...engine.entities.neutral,
                ...engine.getAllBuildings()
            ];
            
            // 공격 주체의 공격 가능 대상 목록 가져오기
            const attackTargets = this.source?.attackTargets || ['ground', 'sea'];

            targets.forEach(target => {
                if (!target || target.hp === undefined || !target.active || target.hp <= 0) return;
                
                // 1. 도메인 체크
                const targetDomain = target.domain || 'ground';
                if (!attackTargets.includes(targetDomain)) return;

                // 2. 관계 체크 (적과 중립 모두 스플래시 데미지 입힘, 자신 및 아군 제외)
                const isManualTarget = (this.source && this.source.manualTarget === target);
                const relation = engine.getRelation(this.source.ownerId, target.ownerId);
                
                // 강제 공격 대상이면 관계 무시하고 데미지 적용
                if (!isManualTarget && (relation === 'self' || relation === 'ally')) return;

                const dist = Math.hypot(target.x - this.x, target.y - this.y);
                if (dist <= this.explosionRadius) {
                    target.takeDamage(this.damage);
                }
            });
            this.exploding = true;
            this.explosionTimer = 150; // 150ms 동안 폭발 연출
        } else {
            // 단일 타겟 처리 (이미 hit 체크에서 처리됨)
            this.active = false;
        }
    }

    update(deltaTime, engine) {
        if (this.exploding) {
            this.explosionTimer -= deltaTime;
            if (this.explosionTimer <= 0) this.active = false;
            return;
        }

        if (!this.active) return;
        
        // 타겟 유효성 체크 (active와 alive 모두 고려)
        const isTargetDead = (this.target.active === false) || (this.target.alive === false) || (this.target.hp <= 0);
        if (!this.target || isTargetDead) {
            this.active = false;
            return;
        }

        this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        if (!engine) return;

        // 충돌 체크 함수 (관계 시스템 적용)
        const checkCollision = (other) => {
            if (!other || other === this.source || other.passable) return false;
            
            // 대상이 이미 죽었는지 확인
            const isDead = (other.active === false) || (other.alive === false) || (other.hp <= 0);
            if (isDead) return false;

            // 소스 유닛과 대상의 관계 확인
            const relation = engine.getRelation(this.source.ownerId, other.ownerId);
            
            // 자신, 아군, 중립은 기본적으로 충돌 무시 (단, 강제 공격 대상이면 허용)
            const isManualTarget = (this.source.manualTarget === other);
            if (!isManualTarget && (relation === 'self' || relation === 'ally' || relation === 'neutral')) return false;
            
            // [수정] 곡사 무기는 지상 장애물 통과
            const isIndirectFire = (this.type === 'shell') || (this.source && this.source.type === 'missile-launcher');
            if (isIndirectFire && other.domain === 'ground') return false;

            // 소스 유닛이 장애물 통과 능력이 있으면 비행 중 충돌 무시
            if (this.source && this.source.canBypassObstacles) return false;

            // 공격 가능 도메인인지 확인 (가장 중요)
            if (!this.source.attackTargets.includes(other.domain || 'ground')) return false;

            const bounds = other.getSelectionBounds ? other.getSelectionBounds() : null;
            if (bounds) {
                return this.x >= bounds.left && this.x <= bounds.right && 
                       this.y >= bounds.top && this.y <= bounds.bottom;
            }
            const dist = Math.hypot(this.x - other.x, this.y - other.y);
            const otherSize = other.size || 40;
            return dist < (this.size / 2 + otherSize / 2);
        };

        // 모든 잠재적 타겟에 대해 충돌 체크 (단일 루프로 통합)
        const allPotentialTargets = [
            engine.entities.base,
            ...engine.entities.units,
            ...engine.entities.enemies,
            ...engine.entities.neutral,
            ...engine.getAllBuildings()
        ];

        for (const target of allPotentialTargets) {
            if (checkCollision(target)) {
                if (this.explosionRadius > 0) {
                    this.explode(engine);
                } else {
                    target.hp -= this.damage;
                    if (target.hp <= 0) {
                        if (target.active !== undefined) target.active = false;
                        if (target.alive !== undefined) target.alive = false;
                    }
                    this.active = false;
                }
                return;
            }
        }

        // 목표 도달 체크
        if (Math.hypot(this.x - this.target.x, this.y - this.target.y) < 15) {
            if (this.explosionRadius > 0) {
                this.explode(engine);
            } else {
                this.target.takeDamage(this.damage);
                this.active = false;
            }
        }
    }

    draw(ctx) {
        if (this.exploding) {
            // 폭발 이펙트
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 165, 0, ${this.explosionTimer / 150})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 69, 0, ${this.explosionTimer / 150})`;
            ctx.stroke();
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.type === 'shell') {
            // 전차 포탄 외형
            ctx.fillStyle = '#7f8c8d'; // 금속 회색
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1;
            
            // 포탄 몸체 (길쭉한 타원/사각형 조합)
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-4, -3);
            ctx.lineTo(-8, -3);
            ctx.lineTo(-8, 3);
            ctx.lineTo(-4, 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 추진체 불꽃/빛 (뒤쪽)
            ctx.fillStyle = '#e67e22';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#f39c12';
            ctx.beginPath();
            ctx.arc(-8, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'tracer') {
            // 예광탄 (길쭉한 빨간색 광원)
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            
            // 길쭉한 사각형 (탄환 진행 방향으로)
            ctx.beginPath();
            ctx.roundRect(-8, -1.5, 12, 3, 1.5);
            ctx.fill();
            
            // 더 밝은 중심선
            ctx.fillStyle = '#fff';
            ctx.fillRect(-4, -0.5, 6, 1);
        } else {
            // 일반 발사체 (빛나는 구체)
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

export class Resource extends Entity {
    constructor(x, y, type = 'ore') {
        super(x, y);
        this.type = type;
        this.size = 25;
        this.covered = false; // 건설 중일 때 숨김 처리
        this.initType();
    }

    initType() {
        switch (this.type) {
            case 'coal': this.color = '#333333'; this.name = '석탄'; break;
            case 'oil': this.color = '#2F4F4F'; this.name = '석유'; break;
            case 'gold': this.color = '#FFD700'; this.name = '금'; break;
            case 'iron': this.color = '#a5a5a5'; this.name = '철'; break;
            default: this.color = '#778899'; this.name = '자원'; break;
        }
    }

    draw(ctx) {
        if (this.covered) return; // 건물에 의해 가려졌으면 그리지 않음
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * (this.size / 2);
            const py = Math.sin(angle) * (this.size / 2);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }
}