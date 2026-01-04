import { Entity } from '../BaseEntity.js';

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
                    const wx = bx + (w + 0.5) * winSpacing - winW / 2;

                    // 베란다 복구 (직각형 돌출)
                    ctx.fillStyle = '#95a5a6';
                    ctx.fillRect(wx - 4, fy + winH - 2, winW + 8, 4);
                    ctx.fillStyle = '#bdc3c7';
                    ctx.fillRect(wx - 4, fy + winH - 5, winW + 8, 3);

                    // 창문 (단순 직각형)
                    // 전기가 들어올 때만 위치 기반으로 창문을 더 넓게 펼쳐서 켬 (밀집도 하향)
                    const lightSeed = Math.sin(f * 2.1 + w * 3.7 + this.x * 0.5 + this.y * 0.5);
                    let isLit = (lightSeed > 0.5); // 임계값을 0.5로 높여 더 듬성듬성하게 배치

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
            ctx.beginPath(); ctx.ellipse(tx + 2, ty + 2, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#27ae60';
            ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath(); ctx.arc(tx - 2, ty - 2, 5, 0, Math.PI * 2); ctx.fill();
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
        ctx.fillRect(this.x - barW / 2, barY, barW, 8);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 8);
    }
}
