import { Entity } from '../BaseEntity.js';

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
        for (let i = 0; i < 5; i++) {
            const tx = -15 + i * 7.5;
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
