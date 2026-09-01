import { Model } from './Model.js';
import { View } from './View.js';
import { Controller } from './Controller.js';
import { LobbyView } from './LobbyView.js';
import { Network } from './Network.js';
import { BestiaryView } from './BestiaryView.js';

document.addEventListener('DOMContentLoaded', () => {
    const gameModel = new Model();
    const gameView = new View();
    const lobbyView = new LobbyView();
    const bestiaryView = new BestiaryView();

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

        onKnowledgeCatalog: (message) =>
            controller.onKnowledgeCatalog(message),

        onKnowledgeOpened: (message) =>
            controller.onKnowledgeOpened(message),

        onKnowledgeLocked: (message) =>
            controller.onKnowledgeLocked(message),

        onKnowledgeChallengeFailed: (message) =>
            controller.onKnowledgeChallengeFailed(message),

        onKnowledgeUnlocked: (message) =>
            controller.onKnowledgeUnlocked(message),
    };

    const network = new Network(handlers);

    controller = new Controller(
        gameModel,
        gameView,
        lobbyView,
        network,
        bestiaryView,
    );

    network.resumeStoredSession?.();

    console.log(
        'Терминал инициализирован. ' +
        'Lobby и game используют real WebSocket.'
    );
});
