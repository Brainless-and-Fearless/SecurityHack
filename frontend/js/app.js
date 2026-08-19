import { Model } from './Model.js';
import { View } from './View.js';
import { Controller } from './Controller.js';
import { MockClient } from './MockClient.js';
import { LobbyView } from './LobbyView.js';
import { Network } from './Network.js';

const USE_REAL_BACKEND = true;

document.addEventListener('DOMContentLoaded', () => {
    const gameModel = new Model();
    const gameView = new View();
    const lobbyView = new LobbyView();

    let controller;
    const handlers = {
        onRoomState: (room) => controller.onRoomState(room),
        onError: (message) => controller.onNetworkError(message),
        onGameStarted: () => controller.onGameStarted()
    };

    const lobbyTransport = USE_REAL_BACKEND
        ? new Network(handlers)
        : null;

    controller = new Controller(gameModel, gameView, lobbyView, lobbyTransport);

    // Пока игровой экран всё ещё использует MockClient.
    // Это отдельный следующий этап: подключение GAME_STATE/ATTACK/TASK.
    const gameMockClient = new MockClient(() => {
        gameView.render(gameModel.state.nodes);
    });
    controller.network = gameMockClient;

    console.log('Терминал инициализирован. Лобби: реальный WebSocket. Игровой экран: mock.');
});
