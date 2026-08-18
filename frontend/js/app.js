import { Model } from './Model.js';
import { View } from './View.js';
import { Controller } from './Controller.js';
import { MockClient } from './MockClient.js';
import { LobbyView } from './LobbyView.js';
import { LobbyMockClient } from './LobbyMockClient.js';
import { Network } from './Network.js';

// main.py сейчас реализует только echo — CREATE_ROOM/JOIN_ROOM/START_GAME
// на сервере не обрабатываются (см. комментарий в начале Network.js).
// Переключить на реальный WebSocket-контракт лобби — когда backend
// пройдёт "Этап 6: Lobby integration" из дорожной карты.
const USE_REAL_BACKEND = false;

document.addEventListener('DOMContentLoaded', () => {
    const gameModel = new Model();
    const gameView = new View();
    const lobbyView = new LobbyView();

    // Controller подписывается на эти хендлеры ниже, чтобы транспорт
    // (мок или реальный) не знал ничего про DOM
    const handlers = {
        onRoomState: (room) => controller.onRoomState(room),
        onError: (message) => controller.onNetworkError(message),
        onGameStarted: () => controller.onGameStarted()
    };

    const lobbyTransport = USE_REAL_BACKEND
        ? new Network(handlers)
        : new LobbyMockClient(handlers);

    const controller = new Controller(gameModel, gameView, lobbyView, lobbyTransport);

    // Игровой MockClient — как было, для game-screen (не про лобби)
    const gameMockClient = new MockClient(() => {
        gameView.render(gameModel.state.nodes);
    });
    controller.network = gameMockClient;

    console.log(`Терминал инициализирован. MVC связан. Лобби: ${USE_REAL_BACKEND ? 'реальный WebSocket' : 'мок (backend ещё не готов)'}.`);
});
