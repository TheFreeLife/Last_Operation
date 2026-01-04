/**
 * Entity - 모든 엔티티의 기본 클래스
 */
export class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.width = 40;  // Default 1x1
        this.height = 40; // Default 1x1
        this.size = 40;   // Default for circles
        this.domain = 'ground'; // 'ground', 'air', 'sea'
        this.attackTargets = ['ground', 'sea'];
        this.popCost = 0; // 인구수 비용 (유닛용)
        this.popProvide = 0; // 인구수 제공 (건물용)
        this.passable = false;
        this.isBoarded = false;

        this.ownerId = 1;

        this.isUnderConstruction = false;
        this.buildProgress = 0;
        this.totalBuildTime = 0;
        this.targetResource = null;

        this.hitTimer = 0;

        // 컴포넌트 시스템
        this.components = new Map();
    }

    /**
     * 컴포넌트 추가
     */
    addComponent(component) {
        const name = component.constructor.name;
        this.components.set(name, component);
        component.entity = this;
        return this;
    }

    /**
     * 컴포넌트 가져오기
     */
    getComponent(ComponentClass) {
        const name = ComponentClass.name;
        return this.components.get(name);
    }

    /**
     * 컴포넌트 제거
     */
    removeComponent(ComponentClass) {
        const name = ComponentClass.name;
        const component = this.components.get(name);
        if (component) {
            component.entity = null;
            this.components.delete(name);
        }
    }

    takeDamage(amount) {
        if (this.hp === undefined || !this.active) return;
        this.hp -= amount;
        this.hitTimer = 150;

        if (this.hp <= 0) {
            this.active = false;
            if (this.alive !== undefined) this.alive = false;
        }
    }

    canDamage(target, engine) {
        if (!target || !target.active || target.hp === undefined) return false;

        if (!this.attackTargets.includes(target.domain)) return false;

        if (engine && engine.getRelation) {
            const relation = engine.getRelation(this.ownerId, target.ownerId);
            if (this.manualTarget === target) return true;

            if (relation === 'self' || relation === 'ally') return false;
            if (relation === 'neutral') return false;
        }

        return true;
    }

    drawConstruction(ctx) {
        if (!this.isUnderConstruction) return;

        const w = this.width || this.size || 40;
        const h = this.height || this.size || 40;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(this.x - w / 2, this.y - h / 2, w, h);

        const barW = w * 0.8;
        const barH = 6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barW / 2, this.y + h / 2 + 5, barW, barH);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(this.x - barW / 2, this.y + h / 2 + 5, barW * this.buildProgress, barH);
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

    get collisionRadius() {
        return (this.size || 40) * 0.45;
    }

    get pathfindingSize() {
        return this.size || 40;
    }
}
