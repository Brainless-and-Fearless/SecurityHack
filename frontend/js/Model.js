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
        // Добавляем центральный узел (Core Server)
        this.state.nodes.push({
            id: 0,
            owner: null,
            defenceLevel: 0, // Максимальная защита K=3
            x: 0, 
            y: 0
        });
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