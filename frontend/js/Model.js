export class Model {
    constructor() {
        // this.state — аналог self.state в Python (внутри __init__)
        this.state = {
            players: {}, // Словарь очков: { 'Agent007': 15 }
            nodes: []    // Массив (список) узлов-объектов
        };
    }

    // Инициализация стартового состояния
    generateNodes() {
    // 1. Добавляем центральный узел (Core Server)
    this.state.nodes.push({
        id: 0,
        owner: null,
        defenceLevel: 0, // Максимальная защита K=3[cite: 8, 9]
        x: 0, 
        y: 0
    });

    // 2. Генерируем орбиту узлов вокруг ядра
    const totalNodes = 6; // Количество узлов на первой орбите
    const radius = 120;   // Радиус орбиты в пикселях

    for (let i = 0; i < totalNodes; i++) {
        // Вычисляем угол для каждого узла в радианах
        const angle = (i * 2 * Math.PI) / totalNodes;
        
        // Переводим полярные координаты в декартовы (X и Y) через тригонометрию
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        this.state.nodes.push({
            id: i + 1,
            owner: null,
            defenceLevel: 0, // Распределяем уровни защиты K от 1 до 3[cite: 8, 9]
            x: x,
            y: y
        });
    }
}

    // Бизнес-логика обработки результатов взлома
    updateScore(nickname, isSuccess, kLevel) {
        if (this.state.players[nickname] === undefined) {
            this.state.players[nickname] = 0;
        }
        
        if (isSuccess) {
            this.state.players[nickname] += kLevel * 5; //
        } else {
            this.state.players[nickname] -= kLevel * 3; //
        }
    }
}