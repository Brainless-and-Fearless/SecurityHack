// Мок-транспорт лобби.
//
// main.py сейчас принимает и отдаёт только { type: "message", message }
// (голое эхо) — CREATE_ROOM / JOIN_ROOM / ROOM_STATE / START_GAME на
// сервере ещё не реализованы (см. project_current_state_report, этап 6
// дорожной карты). Пока это не сделано, лобби работает на этом клиенте,
// чтобы UI можно было полноценно тестировать и показывать.
//
// Как только backend реализует WebSocket-контракт лобби — в app.js
// достаточно заменить `new LobbyMockClient(handlers)` на
// `new Network(handlers)`. Оба класса реализуют один и тот же интерфейс:
//   createRoom(nickname)
//   joinRoom(nickname, code)
//   leaveRoom()
//   startGame()
// и вызывают handlers.onRoomState(room) / handlers.onError(message) / handlers.onGameStarted()

const DEMO_NAMES = ['Neo', 'Trinity', 'Sm1th', 'Root_X', 'Ph4ntom', 'Byte', 'Cipher', 'Ghost'];
const MAX_PLAYERS = 8;

export class LobbyMockClient {
    constructor(handlers) {
        this.handlers = handlers;
        this.room = null;
    }

    _emit() {
        this.handlers.onRoomState({ ...this.room });
    }

    _generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let out = '';
        for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
    }

    createRoom(nickname) {
        const you = { id: 'p1', name: nickname, isHost: true, status: 'online' };
        this.room = {
            you,
            roomCode: this._generateRoomCode(),
            players: [you]
        };
        this._emit();
        // Открываем консольный хук для ручного теста без бэкенда
        this._exposeDebugHook();
    }

    joinRoom(nickname, code) {
        if (!code || code.length < 4) {
            this.handlers.onError('Комната с таким кодом не найдена');
            return;
        }
        const you = { id: 'p1', name: nickname, isHost: false, status: 'online' };
        this.room = {
            you,
            roomCode: code.toUpperCase(),
            players: [
                { id: 'h', name: 'Хост_комнаты', isHost: true, status: 'online' },
                you
            ]
        };
        this._emit();
        this._exposeDebugHook();
    }

    leaveRoom() {
        this.room = null;
    }

    startGame() {
        if (!this.room) return;
        if (this.room.players.length < 2) {
            this.handlers.onError('Нужно минимум 2 игрока, чтобы начать');
            return;
        }
        this.handlers.onGameStarted();
    }

    // ---- Хелперы только для ручной проверки состояний в консоли браузера ----
    // Пример: window.__lobbyDebug.addPlayer()
    _exposeDebugHook() {
        window.__lobbyDebug = {
            addPlayer: () => {
                if (!this.room || this.room.players.length >= MAX_PLAYERS) {
                    this.handlers.onError('Комната заполнена — свободных мест нет');
                    return;
                }
                const name = DEMO_NAMES[this.room.players.length % DEMO_NAMES.length] + Math.floor(Math.random() * 90);
                this.room.players.push({ id: 'd' + Date.now(), name, isHost: false, status: 'online' });
                this._emit();
            },
            removePlayer: () => {
                if (!this.room || this.room.players.length <= 1) return;
                const removed = this.room.players.pop();
                if (removed.isHost && this.room.players.length) {
                    this.room.players[0].isHost = true;
                }
                this._emit();
            },
            toggleReconnect: () => {
                if (!this.room) return;
                const target = this.room.players.find(p => p.id !== this.room.you.id) || this.room.players[0];
                target.status = target.status === 'reconnecting' ? 'online' : 'reconnecting';
                this._emit();
            },
            transferHost: () => {
                if (!this.room) return;
                const me = this.room.players.find(p => p.id === this.room.you.id);
                const other = this.room.players.find(p => p.id !== this.room.you.id);
                if (!other) return;
                me.isHost = false;
                other.isHost = true;
                this._emit();
            },
            simulateError: (type) => {
                const messages = {
                    full: 'Комната заполнена — свободных мест нет',
                    notfound: 'Комната с таким кодом не найдена'
                };
                this.handlers.onError(messages[type] || 'Неизвестная ошибка');
            }
        };
    }
}
