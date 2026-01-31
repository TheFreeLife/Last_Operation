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
        this.domain = 'projectile'; // 타겟팅 제외를 위한 도메인 설정

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
            ...this.engine.entities.units
        ];

        potentialTargets.forEach(target => {
            if (!target || target.hp === undefined) return;

            const targetDomain = target.domain || 'ground';
            if (!this.attackTargets.includes(targetDomain)) return;

            const dist = Math.hypot(this.x - target.x, this.y - target.y);
            const targetSize = target.size || 40;
            if (dist <= this.radius + targetSize / 2) {
                target.takeDamage(this.damage);
            }
        });

        // 타일(벽) 피해 추가
        const tileMap = this.engine.tileMap;
        if (tileMap) {
            const gridRadius = Math.ceil(this.radius / tileMap.tileSize);
            const center = tileMap.worldToGrid(this.x, this.y);
            
            for (let dy = -gridRadius; dy <= gridRadius; dy++) {
                for (let dx = -gridRadius; dx <= gridRadius; dx++) {
                    const gx = center.x + dx;
                    const gy = center.y + dy;
                    if (gx < 0 || gx >= tileMap.cols || gy < 0 || gy >= tileMap.rows) continue;
                    
                    const wall = tileMap.layers.wall[gy][gx];
                    if (wall && wall.id) {
                        const worldPos = tileMap.gridToWorld(gx, gy);
                        const dist = Math.hypot(worldPos.x - this.x, worldPos.y - this.y);
                        if (dist <= this.radius + tileMap.tileSize / 2) {
                            tileMap.damageTile(gx, gy, this.damage);
                        }
                    }
                }
            }
        }

        // 단일 대형 폭발 효과 발생
        if (this.engine.addEffect) {
            this.engine.addEffect('explosion', this.x, this.y);
        }
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

        // 포탄 본체
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 금속 광택 하이라이트
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.ellipse(-3, -4, 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 꼬리 날개 (X자 형태 표현)
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-8, -14, 16, 2); // 가로 핀
        ctx.fillRect(-2, -18, 4, 10); // 세로 핀

        ctx.restore();
    }
}
