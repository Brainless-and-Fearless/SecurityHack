export class Model {
    constructor() {
        this.state = {
            gameId: null,
            status: 'waiting',
            players: {},
            nodes: {},
            tasks: {},
            remainingTimeSeconds: 0,
        };
    }

    applyGameState(gameId, gameState) {
        this.state.gameId = gameId;
        this.state.status = gameState.status;
        this.state.players = gameState.players;
        this.state.nodes = gameState.nodes;
        this.state.tasks = gameState.tasks;
        this.state.remainingTimeSeconds =
            gameState.remaining_time_seconds;
    }
}