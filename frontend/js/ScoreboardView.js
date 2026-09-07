export class ScoreboardView {
    constructor() {
        this.panel = document.getElementById('scoreboard-panel');
        this.body = document.getElementById('scoreboard-body');
        this.closeButton = document.getElementById('scoreboard-close-btn');
        this.openButton = document.getElementById('scoreboard-open-btn');
        this.clear();

        this.closeButton.addEventListener('click', () => {
            this.setCollapsed(true);
            this.openButton.focus();
        });
        this.openButton.addEventListener('click', () => {
            this.setCollapsed(false);
            this.closeButton.focus();
        });
    }

    render(state, currentPlayerId) {
        if (!state.gameId || state.status === 'waiting') {
            this.clear();
            return;
        }
        if (this.gameId !== state.gameId) {
            this.gameId = state.gameId;
            this.collapsed = false;
        }

        const nodeCounts = new Map();
        for (const node of Object.values(state.nodes)) {
            nodeCounts.set(node.owner_id, (nodeCounts.get(node.owner_id) ?? 0) + 1);
        }
        const players = Object.values(state.players)
            .map((player, index) => ({ player, index }))
            .sort((a, b) => b.player.score - a.player.score || a.index - b.index);
        const rows = players.map(({ player }) => {
            const row = document.createElement('tr');
            if (player.id === currentPlayerId) row.classList.add('is-you');
            for (const value of [player.nickname, player.score, nodeCounts.get(player.id) ?? 0]) {
                const cell = document.createElement('td');
                cell.textContent = String(value);
                row.appendChild(cell);
            }
            return row;
        });
        this.body.replaceChildren(...rows);
        this.setCollapsed(this.collapsed);
    }

    setCollapsed(collapsed) {
        this.collapsed = collapsed;
        this.panel.classList.toggle('hidden', collapsed);
        this.openButton.classList.toggle('hidden', !collapsed);
        this.openButton.setAttribute('aria-expanded', String(!collapsed));
    }

    clear() {
        this.gameId = null;
        this.collapsed = false;
        this.body.replaceChildren();
        this.panel.classList.add('hidden');
        this.openButton.classList.add('hidden');
        this.openButton.setAttribute('aria-expanded', 'false');
    }
}
