import { Entity } from '../BaseEntity.js';
import { CombatEngineer } from '../units/Infantry.js'; // 순환 참조 주의, 필요시 동적 import 또는 구조 변경

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
                // CombatEngineer가 아직 로드되지 않았을 수 있음 (순환 참조)
                // engine.entityClasses.CombatEngineer 등을 사용하는 것이 안전함
                const CombatEngineerClass = engine.entityClasses?.CombatEngineer;

                if (CombatEngineerClass) {
                    let unit = new CombatEngineerClass(this.x, spawnY, engine);
                    unit.isInitialExit = true; // 건물 밖으로 나갈 때까지 충돌 무시
                    unit.destination = { x: this.x, y: this.y + 170 };
                    engine.entities.units.push(unit);
                } else {
                    console.error("CombatEngineer definition not found");
                }
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
        ctx.lineTo(pathStartX + pathW / 2 + pathEndW / 2 + plx, pathStartY + ply); // 우하
        ctx.lineTo(pathStartX + pathW / 2 - pathEndW / 2 + plx, pathStartY + ply); // 좌하
        ctx.closePath();
        ctx.fill();

        // 진입로 경계 및 연석 (Raised Curb)
        const curbH = 4; // 연석 높이

        // 좌측 연석
        ctx.fillStyle = '#95a5a6'; // 연석 윗면
        ctx.beginPath();
        ctx.moveTo(pathStartX, pathStartY);
        ctx.lineTo(pathStartX + pathW / 2 - pathEndW / 2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW / 2 - pathEndW / 2 + plx - 4, pathStartY + ply); // 두께
        ctx.lineTo(pathStartX - 4, pathStartY);
        ctx.fill();

        ctx.fillStyle = '#7f8c8d'; // 연석 측면 (그림자)
        ctx.beginPath();
        ctx.moveTo(pathStartX + pathW / 2 - pathEndW / 2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW / 2 - pathEndW / 2 + plx - 4, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW / 2 - pathEndW / 2 + plx - 4, pathStartY + ply + curbH);
        ctx.lineTo(pathStartX + pathW / 2 - pathEndW / 2 + plx, pathStartY + ply + curbH);
        ctx.fill();

        // 우측 연석
        ctx.fillStyle = '#95a5a6'; // 연석 윗면
        ctx.beginPath();
        ctx.moveTo(pathStartX + pathW, pathStartY);
        ctx.lineTo(pathStartX + pathW / 2 + pathEndW / 2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW / 2 + pathEndW / 2 + plx + 4, pathStartY + ply); // 두께
        ctx.lineTo(pathStartX + pathW + 4, pathStartY);
        ctx.fill();

        ctx.fillStyle = '#7f8c8d'; // 연석 측면
        ctx.beginPath();
        ctx.moveTo(pathStartX + pathW / 2 + pathEndW / 2 + plx, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW / 2 + pathEndW / 2 + plx + 4, pathStartY + ply);
        ctx.lineTo(pathStartX + pathW / 2 + pathEndW / 2 + plx + 4, pathStartY + ply + curbH);
        ctx.lineTo(pathStartX + pathW / 2 + pathEndW / 2 + plx, pathStartY + ply + curbH);
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
            ctx.beginPath(); ctx.arc(bx, by, bSize, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath(); ctx.arc(bx - bSize * 0.3, by - bSize * 0.3, bSize * 0.6, 0, Math.PI * 2); ctx.fill();

            // 작은 꽃들 (Tiny flowers)
            const flowers = [{ x: -2, y: 1, c: '#e74c3c' }, { x: 3, y: -2, c: '#f1c40f' }, { x: 0, y: 4, c: '#fff' }];
            flowers.forEach(f => {
                ctx.fillStyle = f.c;
                ctx.beginPath(); ctx.arc(bx + f.x, by + f.y, 1.5, 0, Math.PI * 2); ctx.fill();
            });
        };

        const drawFlowerBed = (fbx, fby, fbw, fbh) => {
            // 화단 틀 (Stone Frame)
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(fbx - 2, fby - 2, fbw + 4, fbh + 4);
            ctx.fillStyle = '#34495e'; // 흙
            ctx.fillRect(fbx, fby, fbw, fbh);

            // 수풀들 배치
            for (let i = 0; i < 3; i++) {
                drawBush(fbx + 10 + i * (fbw / 3), fby + fbh / 2, 8);
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
        ctx.fillRect(entX + pdx + entW / 2 - 1, entY + pdy + 4, 2, entH - 4);

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
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 7; c++) {
                ctx.fillRect(x1 + 15 + c * 15, yBase + 15 + r * 15, winW, winH);
                ctx.fillRect(x3 + 10 + c * 15, yBase + 15 + r * 15, winW, winH);
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

        for (let r = 0; r < gRows; r++) {
            for (let c = 0; c < gCols; c++) {
                const wx = x2 + gMargin + c * (gWinW + 4);
                const wy = yCenter + 15 + r * (gWinH + 4);
                ctx.fillStyle = '#34495e';
                ctx.fillRect(wx, wy, gWinW, gWinH);
            }
        }

        // --- 3. 옥상 디테일 (Tactical Flag) ---
        const flagX = x2 + centerW / 2 + dx * 0.5;
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
        ctx.beginPath(); ctx.ellipse(satX, satY, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(satX - 3, satY - 25, 6, 25);

        // 접시 안테나 (회전)
        ctx.save();
        ctx.translate(satX, satY - 25);
        ctx.rotate(-Math.PI / 5);

        ctx.fillStyle = '#95a5a6';
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI, true); ctx.fill();
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.stroke();
        ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(0, -20, 2, 0, Math.PI * 2); ctx.fill();

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
        ctx.beginPath(); ctx.arc(coolX + 12.5, coolY + 10, 7, 0, Math.PI * 2); ctx.fill();
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
        ctx.fillRect(this.x - barWidth / 2 - 10, barY - 20, barWidth + 20, 45);
        ctx.strokeStyle = 'rgba(189, 195, 199, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - barWidth / 2 - 10, barY - 20, barWidth + 20, 45);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(this.x - barWidth / 2, barY + 10, barWidth, 10);
        ctx.fillStyle = hpP > 0.3 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(this.x - barWidth / 2, barY + 10, hpP * barWidth, 10);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`COMMAND CENTER`, this.x - barWidth / 2, barY + 2);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(hpP * 100)}%`, this.x + barWidth / 2, barY + 2);
    }
}
