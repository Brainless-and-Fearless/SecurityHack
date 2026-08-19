export class Model {
    constructor() {
        this.state = {
            players: {},
            nodes: [],
            resources: 100,
            remainingTimeSeconds: 10 * 60
        };
    }

    generateNodes() {
        this.state.nodes.push({
            id: 0,
            owner: null,
            defenceLevel: 0,
            x: 0,
            y: 0
        });
    }

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

    resetGame() {
        this.state.players = {};
        this.state.nodes = [];
        this.state.resources = 100;
        this.state.remainingTimeSeconds = 10 * 60;
    }
}
