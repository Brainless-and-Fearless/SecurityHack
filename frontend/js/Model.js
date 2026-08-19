export class Model {
    constructor() {
        this.state = {
            players: {},
            nodes: []
        };
    }

    // Временная mock-карта для фронтенда.
    // Когда backend начнёт присылать GAME_STATE, эти поля можно будет
    // напрямую заполнять данными сервера.
    generateNodes() {
        const myPlayerId = 'player_0';

        this.state.players = {
            player_0: { id: 'player_0', nickname: 'Diana', colorIndex: 0 },
            player_1: { id: 'player_1', nickname: 'Neuro', colorIndex: 1 },
            player_2: { id: 'player_2', nickname: 'Agent', colorIndex: 2 }
        };

        this.state.nodes = [
            {
                id: 0,
                ownerId: 'player_0',
                myPlayerId,
                colorIndex: 0,
                defenceLevel: 1,
                x: 0,
                y: 0,
                captured: false,
                neighborIds: [1, 2]
            },
            {
                id: 1,
                ownerId: 'player_1',
                myPlayerId,
                colorIndex: 1,
                defenceLevel: 2,
                x: 150,
                y: -90,
                captured: false,
                neighborIds: [0, 2, 3]
            },
            {
                id: 2,
                ownerId: null,
                myPlayerId,
                colorIndex: null,
                defenceLevel: 1,
                x: 120,
                y: 110,
                captured: false,
                neighborIds: [0, 1, 3, 4]
            },
            {
                id: 3,
                ownerId: 'player_2',
                myPlayerId,
                colorIndex: 2,
                defenceLevel: 3,
                x: 290,
                y: 10,
                captured: false,
                neighborIds: [1, 2, 5],
                activeAttackPlayerId: 'player_0'
            },
            {
                id: 4,
                ownerId: 'player_0',
                myPlayerId,
                colorIndex: 0,
                defenceLevel: 3,
                x: -130,
                y: 130,
                captured: true,
                neighborIds: [2, 5]
            },
            {
                id: 5,
                ownerId: null,
                myPlayerId,
                colorIndex: null,
                defenceLevel: 2,
                x: 250,
                y: 160,
                captured: false,
                neighborIds: [3, 4]
            }
        ];
    }

    // Бизнес-логика обработки результатов взлома
    updateScore(nickname, isSuccess, kLevel) {
        if (this.state.players[nickname] === undefined) {
            this.state.players[nickname] = 0;
        }

        if (isSuccess) {
            this.state.players[nickname] += kLevel * 5;
        } else {
            this.state.players[nickname] -= kLevel * 3;
        }
    }
}
