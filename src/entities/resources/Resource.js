import { Entity } from '../BaseEntity.js';

export class Resource extends Entity {
    constructor(x, y, engine, type = 'gold') {
        super(x, y);
        this.engine = engine;
        this.isResource = true;
        this.size = 80;
        this.width = 80;
        this.height = 80;
        this.covered = false;

        // 초기 타입 설정 (Setter가 호출됨)
        this.type = (typeof type === 'string') ? type : 'gold';
    }

    // [수정] 타입이 바뀔 때마다 시각적 속성(색상, 이름)을 동기화
    set type(val) {
        this._type = val;
        switch (val) {
            case 'oil': this.color = '#2F4F4F'; this.name = '석유'; break;
            case 'gold': this.color = '#FFD700'; this.name = '금'; break;
            case 'iron': this.color = '#a5a5a5'; this.name = '철'; break;
            default: this.color = '#778899'; this.name = '자원'; break;
        }
    }

    get type() {
        return this._type;
    }

    draw(ctx) {
        if (this.covered) return;
        ctx.save();

        if (this.type === 'oil') {
            // [석유: 천연 타르 늪 컨셉]
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath();
            ctx.ellipse(0, 0, 35, 25, Math.PI / 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(20, 30, 20, 0.6)';
            for (let i = 0; i < 5; i++) {
                const ang = (i * Math.PI * 2) / 5;
                ctx.beginPath();
                ctx.ellipse(Math.cos(ang) * 20, Math.sin(ang) * 15, 15, 10, ang, 0, Math.PI * 2);
                ctx.fill();
            }

        } else if (this.type === 'gold') {
            // [금: 거친 원석 결정 컨셉]
            const drawGoldSppike = (sx, sy, w, h, ang) => {
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(ang);
                ctx.fillStyle = '#b8860b';
                ctx.beginPath();
                ctx.moveTo(-w / 2, 0); ctx.lineTo(0, -h); ctx.lineTo(w / 2, 0); ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.moveTo(0, -h); ctx.lineTo(w / 2, 0); ctx.lineTo(0, 0); ctx.closePath();
                ctx.fill();
                ctx.restore();
            };

            ctx.fillStyle = '#5d4037';
            ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();

            drawGoldSppike(-15, 10, 20, 35, -0.2);
            drawGoldSppike(10, 5, 25, 45, 0.1);
            drawGoldSppike(-5, -5, 12, 20, -0.5);

        } else if (this.type === 'iron') {
            // [철: 산화된 금속 암반 컨셉]
            ctx.fillStyle = 'rgba(139, 69, 19, 0.4)';
            ctx.beginPath(); ctx.ellipse(0, 5, 40, 25, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#333';
            ctx.fillRect(-25, -15, 50, 30);
            ctx.fillStyle = '#444';
            ctx.fillRect(-10, 0, 30, 20);
        }
        ctx.restore();
    }
}
