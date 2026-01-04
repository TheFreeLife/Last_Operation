import { Entity } from '../BaseEntity.js';

export class Resource extends Entity {
    constructor(x, y, type = 'gold') {
        super(x, y);
        this.type = type;
        this.isResource = true; // ReferenceError 방지를 위한 타입 플래그
        this.size = 80; // 2x2 타일 크기
        this.width = 80;
        this.height = 80;
        this.covered = false;

        switch (type) {
            case 'oil': this.color = '#2F4F4F'; this.name = '석유'; break;
            case 'gold': this.color = '#FFD700'; this.name = '금'; break;
            case 'iron': this.color = '#a5a5a5'; this.name = '철'; break;
            default: this.color = '#778899'; this.name = '자원'; break;
        }
    }

    draw(ctx) {
        if (this.covered) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'oil') {
            // [석유: 천연 타르 늪 컨셉]
            // 1. 깊은 검은색 중심부
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath();
            ctx.ellipse(0, 0, 35, 25, Math.PI / 10, 0, Math.PI * 2);
            ctx.fill();

            // 2. 주변으로 번진 기름 얼룩
            ctx.fillStyle = 'rgba(20, 30, 20, 0.6)';
            for (let i = 0; i < 5; i++) {
                const ang = (i * Math.PI * 2) / 5;
                ctx.beginPath();
                ctx.ellipse(Math.cos(ang) * 20, Math.sin(ang) * 15, 15, 10, ang, 0, Math.PI * 2);
                ctx.fill();
            }

            // 3. 점성 있는 기포 (Bubbling effect)
            ctx.fillStyle = '#1a1a1a';
            const bubbleTime = Date.now() / 1000;
            for (let i = 0; i < 3; i++) {
                const bx = Math.sin(bubbleTime + i) * 15;
                const by = Math.cos(bubbleTime * 0.7 + i) * 10;
                const size = (Math.sin(bubbleTime * 2 + i) + 1) * 3;
                if (size > 1) {
                    ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();
                }
            }

        } else if (this.type === 'gold') {
            // [금: 거친 원석 결정 컨셉]
            const drawGoldSppike = (sx, sy, w, h, ang) => {
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(ang);
                // 어두운 황금색 베이스
                ctx.fillStyle = '#b8860b';
                ctx.beginPath();
                ctx.moveTo(-w / 2, 0); ctx.lineTo(0, -h); ctx.lineTo(w / 2, 0); ctx.closePath();
                ctx.fill();
                // 밝은 금색 면
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.moveTo(0, -h); ctx.lineTo(w / 2, 0); ctx.lineTo(0, 0); ctx.closePath();
                ctx.fill();
                ctx.restore();
            };

            // 바닥에 깔린 자갈들
            ctx.fillStyle = '#5d4037';
            for (let i = 0; i < 8; i++) {
                ctx.beginPath(); ctx.arc((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 40, 3, 0, Math.PI * 2); ctx.fill();
            }

            // 솟아오른 금 결정체들
            drawGoldSppike(-15, 10, 20, 35, -0.2);
            drawGoldSppike(10, 5, 25, 45, 0.1);
            drawGoldSppike(5, 15, 15, 25, 0.4);
            drawGoldSppike(-5, -5, 12, 20, -0.5);

            // 반짝임 입자
            if (Math.sin(Date.now() / 300) > 0.5) {
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(12, -25, 2, 0, Math.PI * 2); ctx.fill();
            }

        } else if (this.type === 'iron') {
            // [철: 산화된 금속 암반 컨셉]
            const drawIronRock = (rx, ry, rw, rh, color) => {
                ctx.save();
                ctx.translate(rx, ry);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(-rw / 2, rh / 2); ctx.lineTo(-rw / 2 + 5, -rh / 2);
                ctx.lineTo(rw / 2, -rh / 2 + 5); ctx.lineTo(rw / 2, rh / 2); ctx.closePath();
                ctx.fill();
                // 금속 질감 하이라이트
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.stroke();
                ctx.restore();
            };

            // 1. 산화된 붉은 흙 (Rust/Oxidation)
            ctx.fillStyle = 'rgba(139, 69, 19, 0.4)';
            ctx.beginPath(); ctx.ellipse(0, 5, 40, 25, 0, 0, Math.PI * 2); ctx.fill();

            // 2. 무거운 철광석 바위들
            drawIronRock(0, 0, 50, 35, '#333');      // 메인 바위
            drawIronRock(-20, 15, 30, 20, '#444');   // 앞쪽 바위
            drawIronRock(25, 5, 25, 25, '#2c3e50');  // 우측 바위

            // 3. 금속 줄기 (Metallic veins)
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-20, -5); ctx.lineTo(10, 0); ctx.lineTo(20, 10);
            ctx.stroke();
        }
        ctx.restore();
    }
}
