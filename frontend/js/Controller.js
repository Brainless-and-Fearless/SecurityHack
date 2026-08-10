export class Controller {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        // 1. Поиск элементов в DOM (аналог dict.get('key'))
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.joinBtn = document.getElementById('join-btn');
        this.nicknameInput = document.getElementById('nickname-input'); //[cite: 1]
        this.roomInput = document.getElementById('room-input'); //[cite: 1]

        // 2. Запуск прослушивания событий
        this.initEvents();
    }

    initEvents() {
        // Аналог декоратора @router.message() — ждем клика
        this.joinBtn.addEventListener('click', () => {
            this.startGame();
        });
    }

    startGame() {
    const nickname = this.nicknameInput.value;
    if (!nickname) {
        alert("Пожалуйста, введите Никнейм!");
        return;
    }

    // Переключение видимости через CSS-классы
    this.lobbyScreen.classList.add('hidden');
    this.gameScreen.classList.remove('hidden');

    console.log(`Агент ${nickname} успешно подключен к системе.`);

    // 1. Просим Мозг сгенерировать Ядро (Core Server)
    this.model.generateNodes();

    // 2. Просим Вид отрисовать узлы на холсте
    this.view.render(this.model.state.nodes);

    // 3. Запускаем игровую экономику (MockClient)
    if (this.network) {
        this.network.startSimulation();
    }
}
}