export class View {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.myPlayerId = null;
        this.selectedNodeId = null;
        this.hoveredNodeId = null;
        this.playerColors = [
            '#4F46E5', '#10B981', '#F59E0B', '#EC4899',
            '#06B6D4', '#8B5CF6', '#F97316', '#E11D48'
        ];
        this.playerColorMap = new Map();
        this.nodes = [];

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('click', event => this.handleCanvasClick(event));
        this.canvas.addEventListener('mousemove', event => this.handleMouseMove(event));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredNodeId = null;
            this.canvas.style.cursor = 'default';
        });
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
        const raw = node.defence_level ?? node.defenceLevel ?? 0;
        if (typeof raw === 'string') return Number(raw.replace('K', '')) || 0;
        return Number(raw) || 0;
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

    nodePosition(node) {
        return {
            x: this.canvas.width / 2 + Number(node.x || 0),
            y: this.canvas.height / 2 + Number(node.y || 0)
        };
    }

    getNeighborIds(node) {
        return node.neighbor_ids ?? node.neighborIds ?? [];
    }

    getNodeById(id) {
        return this.nodes.find(node => String(node.id) === String(id));
    }

    computeAttackableIds() {
        const mine = new Set(this.nodes.filter(node => this.getOwner(node) === this.myPlayerId).map(node => String(node.id)));
        const result = new Set();
        for (const node of this.nodes) {
            if (this.getOwner(node) === this.myPlayerId) continue;
            if (this.getNeighborIds(node).some(id => mine.has(String(id)))) result.add(String(node.id));
        }
        return result;
    }

    _pickNode(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        for (const node of this.nodes) {
            const pos = this.nodePosition(node);
            if (Math.hypot(x - pos.x, y - pos.y) <= 32) return node;
        }
        return null;
    }

    handleCanvasClick(event) {
        const node = this._pickNode(event);
        this.selectedNodeId = node ? node.id : null;
        if (this.onNodeSelect) this.onNodeSelect(node);
        this.render(this.nodes);
    }

    handleMouseMove(event) {
        const node = this._pickNode(event);
        this.hoveredNodeId = node ? node.id : null;
        this.canvas.style.cursor = node ? 'pointer' : 'default';
        this.render(this.nodes);
    }

    render(nodes) {
        this.nodes = nodes;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const attackable = this.computeAttackableIds();

        // Draw each edge once.
        const drawn = new Set();
        for (const node of nodes) {
            const from = this.nodePosition(node);
            for (const neighborId of this.getNeighborIds(node)) {
                const key = [String(node.id), String(neighborId)].sort().join(':');
                if (drawn.has(key)) continue;
                const target = this.getNodeById(neighborId);
                if (!target) continue;
                drawn.add(key);
                const to = this.nodePosition(target);
                this.ctx.beginPath();
                this.ctx.moveTo(from.x, from.y);
                this.ctx.lineTo(to.x, to.y);
                this.ctx.strokeStyle = 'rgba(79, 70, 229, 0.16)';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }

        for (const node of nodes) {
            const { x, y } = this.nodePosition(node);
            const ownerId = this.getOwner(node);
            const ownerColor = this.getOwnerColor(ownerId);
            const isMine = ownerId === this.myPlayerId;
            const isSelected = String(node.id) === String(this.selectedNodeId);
            const isHovered = String(node.id) === String(this.hoveredNodeId);
            const isAttackable = attackable.has(String(node.id));
            const isUnderAttack = node.active_attack_player_id != null || node.activeAttackPlayerId != null;
            const level = this.getDefenceLevel(node);
            const radius = 15;

            if (isUnderAttack) {
                const pulse = (Date.now() % 1000) / 1000;
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 5 + pulse * 7, 0, Math.PI * 2);
                this.ctx.strokeStyle = ownerColor;
                this.ctx.globalAlpha = 0.7 - pulse * 0.45;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
            }

            if (isMine) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
                this.ctx.strokeStyle = ownerColor;
                this.ctx.globalAlpha = 0.3;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
            }

            if (isAttackable) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
                this.ctx.setLineDash([4, 4]);
                this.ctx.strokeStyle = ownerColor;
                this.ctx.globalAlpha = 0.8;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                this.ctx.globalAlpha = 1;
            }

            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = ownerId ? ownerColor : '#334155';
            this.ctx.fill();
            this.ctx.strokeStyle = isHovered || isSelected ? '#FFFFFF' : (ownerId ? '#FFFFFF' : '#64748B');
            this.ctx.lineWidth = isSelected ? 3 : (isMine ? 2 : 1);
            this.ctx.stroke();

            if (isSelected) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 11, 0, Math.PI * 2);
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.globalAlpha = 0.8;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
            }

            this.drawDefenceDots(x, y, level, '#FFFFFF');
        }

        if (nodes.some(node => node.active_attack_player_id != null || node.activeAttackPlayerId != null)) {
            requestAnimationFrame(() => this.render(nodes));
        }
    }
}
