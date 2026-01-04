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
