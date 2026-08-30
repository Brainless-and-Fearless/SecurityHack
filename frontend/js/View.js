export class View {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.myPlayerId = null;
        this.playerColors = [
            '#4F46E5', // индиго
            '#10B981', // изумрудный
            '#F59E0B', // янтарный
            '#EC4899', // розовый
            '#06B6D4', // циан
            '#8B5CF6', // фиолетовый
            '#F97316', // оранжевый
            '#E11D48'  // красный
        ];
        this.playerColorMap = new Map();

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setMyPlayerId(playerId) {
        this.myPlayerId = playerId;
    }

    getOwner(node) {
        return node.owner_id ?? node.owner ?? null;
    }

    getDefenceLevel(node) {
        const level = node.defence_level ?? node.defenceLevel;

        if (level === 'K1') return 1;
        if (level === 'K2') return 2;
        if (level === 'K3') return 3;

        return Number(level) || 0;
    }

    getOwnerColor(ownerId) {
        if (!ownerId) return '#334155';

        if (!this.playerColorMap.has(ownerId)) {
            const color = this.playerColors[this.playerColorMap.size % this.playerColors.length];
            this.playerColorMap.set(ownerId, color);
        }

        return this.playerColorMap.get(ownerId);
    }

    drawDefenceDots(x, y, level, color) {
        // 1 точка = K1, 2 = K2, 3 = K3
        const dots = Math.max(0, Math.min(3, level));
        const spacing = 7;
        const startX = x - ((dots - 1) * spacing) / 2;

        for (let i = 0; i < dots; i++) {
            this.ctx.beginPath();
            this.ctx.arc(startX + i * spacing, y + 25, 2.5, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
        }
    }

    render(nodes) {
        const renderGeneration =
            (this._renderGeneration ?? 0) + 1;

        this._renderGeneration = renderGeneration;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._renderedNodePositions = new Map();

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const scale = Math.min(
            this.canvas.width,
            this.canvas.height
        ) * 0.42;

        nodes.forEach(node => {
            const x =
                centerX + node.x * scale;

            const y =
                centerY + node.y * scale;
            this._renderedNodePositions.set(node.id, { x, y } );
            const ownerId = this.getOwner(node);
            const defenceLevel = this.getDefenceLevel(node);
            const ownerColor = this.getOwnerColor(ownerId);
            const isMine = this.myPlayerId !== null && ownerId === this.myPlayerId;
            const isUnderAttack = node.active_attack_player_id != null || node.activeAttackPlayerId != null;

            const radius = 15;

            // Пульсация при захвате/атаке.
            if (isUnderAttack) {
                const pulse = (Date.now() % 1000) / 1000;
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 5 + pulse * 6, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(239, 68, 68, ${0.65 - pulse * 0.45})`;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }

            // Небольшое свечение своего узла.
            if (isMine) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
                this.ctx.strokeStyle = ownerColor;
                this.ctx.globalAlpha = 0.35;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
            }

            // Сам узел: цвет теперь обозначает владельца.
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = ownerId ? ownerColor : '#334155';
            this.ctx.fill();

            // Белая обводка сохраняет читаемость узла.
            this.ctx.strokeStyle = ownerId ? '#FFFFFF' : '#64748B';
            this.ctx.lineWidth = isMine ? 2 : 1;
            this.ctx.stroke();

            // Точки показывают K1/K2/K3.
            this.drawDefenceDots(x, y, defenceLevel, ownerId ? '#FFFFFF' : '#CBD5E1');
        });

        // Анимация нужна только пока есть атакуемые узлы.
        if (nodes.some(node => node.active_attack_player_id != null || node.activeAttackPlayerId != null)) {
            requestAnimationFrame(() => {
                if (
                    renderGeneration
                    !== this._renderGeneration
                ) {
                    return;
                }

                this.render(nodes);
            });
        }
    }

    getNodeAtPoint(nodes, clientX, clientY) {
        if (!this.canvas) {
            return null;
        }

        const rect = this.canvas.getBoundingClientRect();

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const clickableRadius = 22;

        for (const node of nodes) {
            let nodeX;
            let nodeY;

            if (
                typeof this._renderedNodePositions === 'object' &&
                this._renderedNodePositions !== null
            ) {
                const rendered =
                    this._renderedNodePositions.get(node.id);

                if (rendered) {
                    nodeX = rendered.x;
                    nodeY = rendered.y;
                }
            }

            if (
                nodeX === undefined ||
                nodeY === undefined
            ) {
                if (
                    typeof node.x !== 'number' ||
                    typeof node.y !== 'number'
                ) {
                    continue;
                }

                nodeX =
                    node.id === 0
                        ? centerX
                        : centerX + node.x;

                nodeY =
                    node.id === 0
                        ? centerY
                        : centerY + node.y;
            }

            const dx = x - nodeX;
            const dy = y - nodeY;

            if (
                Math.sqrt(dx * dx + dy * dy)
                <= clickableRadius
            ) {
                return node.id;
            }
        }

        return null;
    }

}
