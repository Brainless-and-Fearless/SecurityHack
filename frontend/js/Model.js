export class Model {
    constructor() {
        this.state = {
            players: {},
            nodes: [],
            myPlayerId: null,
            resources: 100,
            remainingTimeSeconds: 10 * 60
        };
    }

    generateNodes() {
        const myId = this.state.myPlayerId ?? 'player-1';
        this.state.nodes = [
            { id: 'core', owner_id: myId, defence_level: 3, neighbor_ids: ['n1', 'n2'], active_attack_player_id: null, x: 0, y: 0 },
            { id: 'n1', owner_id: myId, defence_level: 2, neighbor_ids: ['core', 'n3', 'n4'], active_attack_player_id: null, x: -150, y: -150 },
            { id: 'n2', owner_id: null, defence_level: 1, neighbor_ids: ['core', 'n5'], active_attack_player_id: null, x: 150, y: -150 },
            { id: 'n3', owner_id: 'player-2', defence_level: 3, neighbor_ids: ['n1', 'n6'], active_attack_player_id: null, x: -300, y: 0 },
            { id: 'n4', owner_id: null, defence_level: 1, neighbor_ids: ['n1', 'n5'], active_attack_player_id: null, x: 0, y: 150 },
            { id: 'n5', owner_id: 'player-3', defence_level: 2, neighbor_ids: ['n2', 'n4'], active_attack_player_id: 'player-1', x: 300, y: 0 },
            { id: 'n6', owner_id: 'player-2', defence_level: 1, neighbor_ids: ['n3'], active_attack_player_id: null, x: -150, y: 150 }
        ];
    }

    setNodesFromGameState(gameState, myPlayerId = null) {
        this.state.myPlayerId = myPlayerId;
        const source = gameState?.nodes ?? {};
        this.state.nodes = Object.entries(source).map(([id, node]) => ({
            ...node,
            id: node.id ?? id,
            owner_id: node.owner_id ?? null,
            defence_level: node.defence_level ?? 0,
            neighbor_ids: node.neighbor_ids ?? [],
            active_attack_player_id: node.active_attack_player_id ?? null
        }));
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
        this.state.myPlayerId = null;
        this.state.resources = 100;
        this.state.remainingTimeSeconds = 10 * 60;
    }
}
