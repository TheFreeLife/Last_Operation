export class DamageText {
    constructor(x, y, text, color = '#ff3131') {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.timer = 0;
        this.duration = 1000;
        this.active = true;
        this.arrived = false; // Filter 대응
        this.offsetY = 0;
    }

    update(deltaTime) {
        this.timer += deltaTime;
        this.offsetY -= 0.5; // 위로 떠오름
        if (this.timer >= this.duration) this.active = false;
    }

    draw(ctx) {
        const p = this.timer / this.duration;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y + this.offsetY);
        ctx.restore();
    }
}
