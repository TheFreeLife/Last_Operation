import { CombatLogic } from '../../engine/systems/CombatLogic.js';

export class FallingBomb {
    constructor(x, y, engine) {
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        this.x = x;
        this.y = y;
        this.engine = engine;
        this.damage = 300;
        this.ownerId = 0;
        this.timer = 0;
        this.duration = 800; // 낙하 시간을 0.8초로 단축
        this.active = true;
        this.arrived = false;
        this.radius = 120;
        this.scale = 0.6;
        this.type = 'bomb';
        this.domain = 'projectile';
        this.isIndirect = true;
        this.visible = true; // 렌더링 필터 통과를 위해 명시적 설정
        this.alive = true;   // 생존 상태 설정
        this.startAltitude = 60; 
        this.attackTargets = ['ground', 'sea'];
    }

    getCacheKey() {
        return null; // 낙하 애니메이션을 위해 캐싱 방지
    }

    update(deltaTime) {
        if (!this.active) return;
        this.timer += deltaTime;

        const progress = Math.min(1, this.timer / this.duration);
        
        // 중력 가속도 효과 (Ease-In Quadratic)
        this.fallProgress = Math.pow(progress, 2);

        // 원근감: 높은 고도(약간 크게) -> 지면(실제 크기)
        // 1.2(하늘) -> 0.6(지면)
        this.scale = 1.2 - (this.fallProgress * 0.6);

        // 낙하 중 기류에 의한 흔들림 (크기가 작아졌으므로 흔들림 폭도 줄임)
        this.jitterX = (Math.random() - 0.5) * (1 - progress) * 2;

        if (this.timer >= this.duration) {
            this.explode();
            this.active = false;
            this.arrived = true;
        }
    }

    explode() {
        CombatLogic.handleImpact(this.engine, this.x, this.y, {
            radius: this.radius,
            damage: this.damage,
            weaponType: 'shell', // 상성 시스템 적용
            isIndirect: true, // 지붕 판정 활성화
            effectType: 'explosion'
        });
    }

    draw(ctx) {
        if (!this.active) return;

        const progress = this.timer / this.duration;
        const currentAltitude = this.startAltitude * (1 - this.fallProgress);
        
        ctx.save();
        
        // RenderSystem에서 이미 (this.x, this.y)로 translate 되어 있으므로
        // 여기서는 (0, 0)을 기준으로 그림
        
        // 1. 지면 낙하 지점 표시
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + progress * 0.3})`;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. 지면 그림자 (목표 지점인 0,0에 고정)
        const shadowAlpha = 0.1 + progress * 0.3;
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15 * (1.5 - progress), 7 * (1.5 - progress), 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. 떨어지는 포탄 본체 (고도만큼 Y축 위로 오프셋)
        ctx.translate(this.jitterX || 0, -currentAltitude);
        ctx.scale(this.scale, this.scale);

        // 포탄 몸통
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 하이라이트
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(-3, -4, 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // 꼬리 날개
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-10, -16, 20, 3);
        ctx.fillRect(-2, -20, 4, 12);
        
        // 뇌관 (빨간색 노즈콘)
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(0, 15, 5, 0, Math.PI, true);
        ctx.fill();

        ctx.restore();
    }
}