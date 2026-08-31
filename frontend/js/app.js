import { Model } from './Model.js';
import { View } from './View.js';
import { Controller } from './Controller.js';
import { LobbyView } from './LobbyView.js';
import { Network } from './Network.js';

document.addEventListener('DOMContentLoaded', () => {
    const gameModel = new Model();
    const gameView = new View();
    const lobbyView = new LobbyView();

    let controller;

    const handlers = {
        onRoomState: (room) =>
            controller.onRoomState(room),

        onRoomLeft: (message) =>
            controller.onRoomLeft(message),

        onError: (message) =>
            controller.onNetworkError(message),

        onGameStarted: () =>
            controller.onGameStarted(),

        onGameState: (gameState) =>
            controller.onGameState(gameState),

        onAttackStarted: (message) =>
            controller.onAttackStarted(message),

        onAttackResolved: (message) =>
            controller.onAttackResolved(message),

        onAttackCancelled: (message) =>
            controller.onAttackCancelled(message),

        onNodeUpgraded: (message) =>
            controller.onNodeUpgraded(message),

        onGameFinished: (message) =>
            controller.onGameFinished(message),

        onConnectionStateChange: (state) =>
            controller.onConnectionStateChange(state),

        onSessionResumed: (message) =>
            controller.onSessionResumed(message),
    };

    const network = new Network(handlers);

    controller = new Controller(
        gameModel,
        gameView,
        lobbyView,
        network,
    );

    network.resumeStoredSession?.();

    console.log(
        'Терминал инициализирован. ' +
        'Lobby и game используют real WebSocket.'
    );
});
