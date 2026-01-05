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
        ctx.save();

        // 1. 바닥 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-18, 5, 36, 12);

        // 2. 수직 지지대
        const drawPost = (px, py) => {
            const pHeight = 25;
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(px - 2, py - pHeight - 2, 4, pHeight);
        };

        drawPost(-15, 10);
        drawPost(15, 10);

        // 3. 가시 철사
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-15, -12); ctx.lineTo(15, -12);
        ctx.moveTo(-15, -12); ctx.lineTo(15, 8);
        ctx.moveTo(15, -12); ctx.lineTo(-15, 8);
        ctx.moveTo(-15, 8); ctx.lineTo(15, 8);
        ctx.stroke();

        ctx.restore();
    }
}
