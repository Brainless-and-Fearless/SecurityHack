export class View {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.animationFrame = null;
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    render(nodes) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Связи между соседями, если backend их уже передаёт.
        this.drawConnections(nodes, centerX, centerY);

        nodes.forEach(node => {
            const x = node.id === 0 ? centerX : centerX + (node.x || 0);
            const y = node.id === 0 ? centerY : centerY + (node.y || 0);
            this.drawNode(node, x, y);
        });
    }

    drawConnections(nodes, centerX, centerY) {
        const nodeById = new Map(nodes.map(node => [node.id, node]));
        const drawn = new Set();

        nodes.forEach(node => {
            if (!Array.isArray(node.neighborIds)) return;

            const x1 = node.id === 0 ? centerX : centerX + (node.x || 0);
            const y1 = node.id === 0 ? centerY : centerY + (node.y || 0);

            node.neighborIds.forEach(neighborId => {
                const neighbor = nodeById.get(neighborId);
                if (!neighbor) return;

                const key = [node.id, neighbor.id].sort().join('-');
                if (drawn.has(key)) return;
                drawn.add(key);

                const x2 = neighbor.id === 0 ? centerX : centerX + (neighbor.x || 0);
                const y2 = neighbor.id === 0 ? centerY : centerY + (neighbor.y || 0);

                this.ctx.strokeStyle = 'rgba(255,255,255,0.10)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            });
        });
    }

    drawNode(node, x, y) {
        const radius = 22;
        const defenceLevel = Number(node.defenceLevel ?? node.defence_level ?? 0);
        const ownerId = node.ownerId ?? node.owner_id ?? node.owner ?? null;
        const myPlayerId = node.myPlayerId ?? null;
        const isMine = ownerId !== null && ownerId === myPlayerId;
        const isUnderAttack = node.activeAttackPlayerId != null || node.active_attack_player_id != null;

        const playerColors = [
            '#4F46E5', // indigo
            '#10B981', // emerald
            '#F59E0B', // amber
            '#EC4899', // pink
            '#06B6D4', // cyan
            '#8B5CF6', // violet
            '#F97316', // orange
            '#E11D48'  // red
        ];

        let ownerColor = '#475569';
        if (node.ownerColor) {
            ownerColor = node.ownerColor;
        } else if (Number.isInteger(node.colorIndex)) {
            ownerColor = playerColors[node.colorIndex % playerColors.length];
        }

        // Для старого backend owner может быть строкой player_0/player_1.
        if (!node.ownerColor && typeof ownerId === 'string') {
            const match = ownerId.match(/(\d+)$/);
            if (match) ownerColor = playerColors[Number(match[1]) % playerColors.length];
        }

        // Захватывающийся узел мягко пульсирует красным.
        if (isUnderAttack) {
            const pulse = (Math.sin(Date.now() / 220) + 1) / 2;
            this.ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + pulse * 0.55})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius + 7 + pulse * 5, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Цвет игрока показываем не заливкой, а неоновой обводкой.
        // Так K1/K2/K3 можно спокойно показывать точками и не смешивать значения.
        this.ctx.shadowColor = ownerColor;
        this.ctx.shadowBlur = ownerId !== null ? 12 : 0;
        this.ctx.strokeStyle = ownerId !== null ? ownerColor : '#475569';
        this.ctx.lineWidth = isMine ? 3 : 2;
        this.ctx.fillStyle = '#0F172A';

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Состояние узла в центре:
        // свободный ○, твой ◎, чужой ○, захваченный ●.
        this.ctx.fillStyle = ownerId !== null ? ownerColor : '#94A3B8';
        this.ctx.strokeStyle = ownerColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        if (node.captured) {
            this.ctx.arc(x, y, 7, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            this.ctx.arc(x, y, isMine ? 8 : 7, 0, Math.PI * 2);
            this.ctx.stroke();

            if (isMine) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // K1/K2/K3 = 1/2/3 маленькие точки под узлом.
        const dots = Math.max(0, Math.min(3, defenceLevel));
        const spacing = 7;
        const startX = x - ((dots - 1) * spacing) / 2;
        for (let i = 0; i < dots; i++) {
            this.ctx.fillStyle = ownerId !== null ? ownerColor : '#94A3B8';
            this.ctx.beginPath();
            this.ctx.arc(startX + i * spacing, y + radius + 9, 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    startAnimation(nodesProvider) {
        const animate = () => {
            const nodes = nodesProvider();
            if (Array.isArray(nodes)) this.render(nodes);
            this.animationFrame = requestAnimationFrame(animate);
        };
        cancelAnimationFrame(this.animationFrame);
        animate();
    }

    stopAnimation() {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
    }
}
