const AVATAR_COLORS = ['#4F46E5', '#10B981', '#FBBF24', '#F97316', '#818CF8'];
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

export class LobbyView {
    constructor() {
        // Экран входа
        this.screenEntry = document.getElementById('screen-entry');
        this.nicknameInput = document.getElementById('nickname-input');
        this.nicknameError = document.getElementById('nickname-error');
        this.modeCreateBtn = document.getElementById('mode-create');
        this.modeJoinBtn = document.getElementById('mode-join');
        this.codeField = document.getElementById('entry-code-field');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.roomCodeError = document.getElementById('room-code-error');
        this.entrySubmit = document.getElementById('entry-submit');
        this.entryNetworkError = document.getElementById('entry-network-error');

        // Экран лобби
        this.screenLobby = document.getElementById('screen-lobby');
        this.lobbyRoomCode = document.getElementById('lobby-room-code');
        this.playerListEl = document.getElementById('player-list');
        this.playerCountEl = document.getElementById('player-count');
        this.startBtn = document.getElementById('start-game-btn');
        this.startHint = document.getElementById('start-hint');
        this.waitingHost = document.getElementById('waiting-host');
        this.copyBtn = document.getElementById('copy-code-btn');
        this.leaveBtn = document.getElementById('leave-room-btn');

        // Тосты и оверлей старта
        this.toastStack = document.getElementById('toast-stack');
        this.startOverlay = document.getElementById('start-overlay');
        this.startCountEl = document.getElementById('start-count');

        // Фоновый граф
        this.canvas = document.getElementById('bg-graph');
        this.ctx = this.canvas.getContext('2d');
        this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());

        this.entryMode = 'create';
    }

    _resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ---------- Экран входа ----------
    setEntryMode(mode) {
        this.entryMode = mode;
        this.modeCreateBtn.classList.toggle('active', mode === 'create');
        this.modeJoinBtn.classList.toggle('active', mode === 'join');
        this.modeCreateBtn.setAttribute('aria-selected', mode === 'create');
        this.modeJoinBtn.setAttribute('aria-selected', mode === 'join');
        this.codeField.classList.toggle('open', mode === 'join');
        this.entrySubmit.textContent = mode === 'create' ? 'Создать комнату' : 'Войти в комнату';
        this.roomCodeError.textContent = '';
    }

    clearEntryErrors() {
        this.nicknameError.textContent = '';
        this.roomCodeError.textContent = '';
        this.entryNetworkError.textContent = '';
        this.nicknameInput.classList.remove('input-error');
        this.roomCodeInput.classList.remove('input-error');
    }

    showEntryFieldError(field, message) {
        if (field === 'nickname') {
            this.nicknameError.textContent = message;
            this.nicknameInput.classList.add('input-error');
        } else if (field === 'roomCode') {
            this.roomCodeError.textContent = message;
            this.roomCodeInput.classList.add('input-error');
        } else {
            this.entryNetworkError.textContent = message;
        }
    }

    resetEntryForm() {
        this.nicknameInput.value = '';
        this.roomCodeInput.value = '';
        this.clearEntryErrors();
        this.setEntryMode('create');
    }

    showEntryScreen() {
        this.screenLobby.classList.add('hidden');
        this.screenEntry.classList.remove('hidden');
    }

    showLobbyScreen() {
        this.screenEntry.classList.add('hidden');
        this.screenLobby.classList.remove('hidden');
    }

    hideAll() {
        this.screenEntry.classList.add('hidden');
        this.screenLobby.classList.add('hidden');
    }

    // ---------- Экран лобби ----------
    renderRoom(room) {
        this.lobbyRoomCode.textContent = room.roomCode;

        this.playerListEl.innerHTML = '';
        room.players.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'player-row' + (p.id === room.you.id ? ' is-you' : '');
            const initial = p.name.charAt(0).toUpperCase();
            row.innerHTML = `
                <div class="avatar" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">${initial}</div>
                <div class="player-meta">
                    <div class="player-name-row">
                        ${p.isHost ? '<span class="host-crown" title="Хост комнаты">♛</span>' : ''}
                        <span class="player-name ${p.isHost ? 'rank-elite' : ''}">${this._escapeHtml(p.name)}</span>
                        ${p.id === room.you.id ? '<span class="you-tag">(вы)</span>' : ''}
                    </div>
                    <div class="status-line">
                        <span class="status-dot ${p.status === 'reconnecting' ? 'reconnecting' : ''}"></span>
                        <span>${p.status === 'reconnecting' ? 'переподключение…' : 'в сети'}</span>
                    </div>
                </div>
            `;
            this.playerListEl.appendChild(row);
        });
        for (let i = room.players.length; i < MAX_PLAYERS; i++) {
            const empty = document.createElement('div');
            empty.className = 'player-slot-empty';
            empty.innerHTML = `<div class="avatar-ghost"></div><span>Свободное место</span>`;
            this.playerListEl.appendChild(empty);
        }

        const count = room.players.length;
        this.playerCountEl.textContent = `${count}/${MAX_PLAYERS}`;
        this.playerCountEl.classList.toggle('full', count >= MAX_PLAYERS);

        const iAmHost = room.players.find(p => p.id === room.you.id)?.isHost;
        if (iAmHost) {
            this.startBtn.classList.remove('hidden');
            this.waitingHost.classList.add('hidden');
            const canStart = count >= MIN_PLAYERS;
            this.startBtn.disabled = !canStart;
            if (canStart) {
                this.startHint.classList.add('hidden');
            } else {
                this.startHint.classList.remove('hidden');
                this.startHint.classList.add('warn');
                this.startHint.textContent = `Нужно ещё минимум ${MIN_PLAYERS - count} игрок(а), чтобы начать`;
            }
        } else {
            this.startBtn.classList.add('hidden');
            this.startHint.classList.add('hidden');
            this.waitingHost.classList.remove('hidden');
        }

        this._room = room;
        this._drawMapPreview();
    }

    clearMapPreview() {
        this._room = null;
        this._drawMapPreview();
    }

    flashCopied() {
        this.copyBtn.classList.add('copied');
        this.copyBtn.textContent = '✓';
        setTimeout(() => { this.copyBtn.classList.remove('copied'); this.copyBtn.textContent = '⧉'; }, 1200);
    }

    // ---------- Тосты ----------
    showToast(type, message, timeout = 3200) {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        const icon = type === 'error' ? '⚠' : (type === 'success' ? '✓' : 'ℹ');
        el.innerHTML = `<span class="icon">${icon}</span><span>${this._escapeHtml(message)}</span>`;
        this.toastStack.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity .2s ease';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 200);
        }, timeout);
    }

    // ---------- Синхронный старт ----------
    runStartCountdown(onDone) {
        this.startOverlay.classList.remove('hidden');
        let n = 3;
        this.startCountEl.textContent = n;
        const t = setInterval(() => {
            n -= 1;
            if (n <= 0) {
                clearInterval(t);
                this.startCountEl.textContent = 'GO';
                setTimeout(() => {
                    this.startOverlay.classList.add('hidden');
                    if (onDone) onDone();
                }, 500);
            } else {
                this.startCountEl.textContent = n;
            }
        }, 700);
    }


    _drawMapPreview() {
        const preview = this._room?.mapPreview;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        const scale = Math.min(w, h) * 0.42;

        if (!preview) {
            return;
        }

        const positions = new Map();

        for (const node of preview.nodes) {
            positions.set(node.id, {
                x: cx + node.x * scale,
                y: cy + node.y * scale,
            });
        }

        // Рёбра карты.
        ctx.strokeStyle = 'rgba(79,70,229,0.22)';
        ctx.lineWidth = 1;

        for (const [sourceId, targetId] of preview.edges) {
            const source = positions.get(sourceId);
            const target = positions.get(targetId);

            if (!source || !target) {
                continue;
            }

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
        }

        // Узлы карты.
        for (const node of preview.nodes) {
            const position = positions.get(node.id);

            if (!position) {
                continue;
            }

            const isSpawn =
                preview.spawnNodes.includes(node.id);

            const radius = isSpawn ? 7 : 4;

            ctx.fillStyle = isSpawn
                ? '#FBBF24'
                : '#818CF8';

            ctx.beginPath();
            ctx.arc(
                position.x,
                position.y,
                radius,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
    }


    startAmbientLoop() {
       const step = () => {
            this._drawMapPreview();
            this._raf = requestAnimationFrame(step);
        };
        step();
    }

    stopAmbientLoop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
