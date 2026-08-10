import { Model } from './Model.js';
import { View } from './View.js';
import { Controller } from './Controller.js';
import { MockClient } from './MockClient.js'; 

document.addEventListener('DOMContentLoaded', () => {
    const gameModel = new Model();
    const gameView = new View();
    const gameController = new Controller(gameModel, gameView);

    // 1. Создаем имитацию сервера и передаем callback
    const mockClient = new MockClient(() => {
        // Эта стрелочная функция будет вызываться каждый "тик" таймера
        gameView.render(gameModel.state.nodes);
    });

    // 2. Передаем клиент в контроллер, чтобы обрабатывать взломы
    gameController.network = mockClient;

    console.log("Терминал инициализирован. MVC связан.");
});