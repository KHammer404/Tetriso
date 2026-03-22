export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export class ParticleSystem {
  particles: Particle[] = [];

  emit(x: number, y: number, color: string, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        this.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            maxLife: 0.5 + Math.random() * 0.5,
            color
        });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity
        p.life -= dt / p.maxLife;
        if (p.life <= 0) {
            this.particles.splice(i, 1);
        }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        const size = 3 * p.life;
        ctx.fillRect(p.x - size/2, p.y - size/2, size, size);
    }
    ctx.restore();
  }
}
