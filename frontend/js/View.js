export class View {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Выносим логику в отдельный метод и вызываем при старте
        this.resizeCanvas();

        // Слушаем изменение размера окна
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    render(nodes) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Центр экрана для Core Server[cite: 1, 2]
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        nodes.forEach(node => {
            const x = node.id === 0 ? centerX : centerX + node.x;
            const y = node.id === 0 ? centerY : centerY + node.y;

            this.ctx.beginPath();
            this.ctx.arc(x, y, 15, 0, Math.PI * 2);

            // Окрашивание узлов по уровням защиты
            if (node.defenceLevel === 1) {
                this.ctx.fillStyle = '#FBBF24';
            } else if (node.defenceLevel === 2) {
                this.ctx.fillStyle = '#F97316';
            } else if (node.defenceLevel === 3) {
                this.ctx.fillStyle = '#EF4444';
            } else {
                this.ctx.fillStyle = '#94A3B8';
            }

            this.ctx.fill();
            this.ctx.closePath();
        });
    }
}