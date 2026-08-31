import pytest
from pydantic import ValidationError

from models import (
    DefenceLevel,
    GameState,
    GameStatus,
    Room,
    RoomStatus,
    Task,
)

from network_models import (
    AnswerTaskMessage,
    AttackNodeMessage,
    AttackResolvedMessage,
    AttackStartedMessage,
    CreateRoomMessage,
    ErrorMessage,
    GameFinishedMessage,
    GameStartedMessage,
    GameStateMessage,
    JoinRoomMessage,
    MapPreview,
    MapPreviewNode,
    NodeUpgradedMessage,
    RoomCreatedMessage,
    RoomJoinedMessage,
    ResumeSessionMessage,
    SessionResumedMessage,
    RoomStateMessage,
    StartGameMessage,
    UpgradeNodeMessage,
    RoomPlayerState,
)


def test_create_room_message_accepts_valid_data():
    message = CreateRoomMessage(
        type="CREATE_ROOM",
        request_id="req_123",
        nickname="Alice",
    )

    assert message.type == "CREATE_ROOM"
    assert message.request_id == "req_123"
    assert message.nickname == "Alice"


def test_create_room_message_rejects_wrong_type():
    with pytest.raises(ValidationError):
        CreateRoomMessage(
            type="JOIN_ROOM",
            request_id="req_123",
            nickname="Alice",
        )


def test_create_room_message_requires_request_id():
    with pytest.raises(ValidationError):
        CreateRoomMessage(
            type="CREATE_ROOM",
            nickname="Alice",
        )


def test_room_created_message_accepts_valid_data():
    message = RoomCreatedMessage(
        type="ROOM_CREATED",
        request_id="req_123",
        room_id="room_1",
        player_id="player_1",
        is_host=True,
        session_token="private-token",
    )

    assert message.type == "ROOM_CREATED"
    assert message.request_id == "req_123"
    assert message.room_id == "room_1"
    assert message.player_id == "player_1"
    assert message.is_host is True    
    assert message.session_token == "private-token"


def test_room_created_message_rejects_wrong_type():
    with pytest.raises(ValidationError):
        RoomCreatedMessage(
            type="ROOM_STATE",
            request_id="req_123",
            room_id="room_1",
            player_id="player_1",
            is_host=True,
        )    


def test_error_message_accepts_valid_data():
    message = ErrorMessage(
        type="ERROR",
        request_id="req_123",
        code="ROOM_NOT_FOUND",
        message="Room does not exist.",
    )

    assert message.type == "ERROR"
    assert message.request_id == "req_123"
    assert message.code == "ROOM_NOT_FOUND"
    assert message.message == "Room does not exist."        


def test_error_message_allows_missing_request_id():
    message = ErrorMessage(
        type="ERROR",
        code="INTERNAL_ERROR",
        message="Internal server error.",
    )

    assert message.request_id is None    


def test_join_room_message_accepts_valid_data():
    message = JoinRoomMessage(
        type="JOIN_ROOM",
        request_id="req_1",
        room_id="room_1",
        nickname="Bob",
    )

    assert message.type == "JOIN_ROOM"
    assert message.request_id == "req_1"
    assert message.room_id == "room_1"
    assert message.nickname == "Bob"


def test_join_room_message_rejects_wrong_type():
    with pytest.raises(ValidationError):
        JoinRoomMessage(
            type="CREATE_ROOM",
            request_id="req_1",
            room_id="room_1",
            nickname="Bob",
        )


def test_start_game_message_accepts_valid_data():
    message = StartGameMessage(
        type="START_GAME",
        request_id="req_2",
    )

    assert message.type == "START_GAME"
    assert message.request_id == "req_2"            


def test_attack_node_message_accepts_valid_data():
    message = AttackNodeMessage(
        type="ATTACK_NODE",
        request_id="req_3",
        node_id="B",
    )

    assert message.type == "ATTACK_NODE"
    assert message.request_id == "req_3"
    assert message.node_id == "B"    


def test_answer_task_message_accepts_valid_data():
    message = AnswerTaskMessage(
        type="ANSWER_TASK",
        request_id="req_4",
        task_id="task_1",
        answer="SELECT * FROM users;",
    )

    assert message.type == "ANSWER_TASK"
    assert message.request_id == "req_4"
    assert message.task_id == "task_1"
    assert message.answer == "SELECT * FROM users;"    


def test_upgrade_node_message_accepts_valid_data():
    message = UpgradeNodeMessage(
        type="UPGRADE_NODE",
        request_id="req_5",
        node_id="A",
    )

    assert message.type == "UPGRADE_NODE"
    assert message.request_id == "req_5"
    assert message.node_id == "A"    


def test_node_upgraded_message_reports_authoritative_upgrade_details():
    message = NodeUpgradedMessage(
        type="NODE_UPGRADED",
        request_id="req_upgrade",
        node_id="A",
        from_level=DefenceLevel.K1,
        to_level=DefenceLevel.K2,
        cost=10.0,
    )

    assert message.type == "NODE_UPGRADED"
    assert message.request_id == "req_upgrade"
    assert message.node_id == "A"
    assert message.from_level == DefenceLevel.K1
    assert message.to_level == DefenceLevel.K2
    assert message.cost == 10.0


def test_room_joined_message_accepts_valid_data():
    message = RoomJoinedMessage(
        type="ROOM_JOINED",
        request_id="req_6",
        room_id="room_1",
        player_id="player_2",
        is_host=False,
        session_token="private-token",
    )

    assert message.type == "ROOM_JOINED"
    assert message.request_id == "req_6"
    assert message.room_id == "room_1"
    assert message.player_id == "player_2"
    assert message.is_host is False    
    assert message.session_token == "private-token"


def test_resume_session_messages_accept_private_session_contract():
    request = ResumeSessionMessage(
        type="RESUME_SESSION",
        request_id="req_resume",
        session_token="private-token",
    )
    response = SessionResumedMessage(
        type="SESSION_RESUMED",
        request_id="req_resume",
        player_id="player_1",
        room_id="ABC234",
        is_host=True,
        game_id="game_1",
    )

    assert request.session_token == "private-token"
    assert response.player_id == "player_1"
    assert response.room_id == "ABC234"
    assert response.is_host is True
    assert response.game_id == "game_1"


def test_game_started_message_accepts_valid_data():
    message = GameStartedMessage(
        type="GAME_STARTED",
        room_id="room_1",
        game_id="game_1",
    )

    assert message.type == "GAME_STARTED"
    assert message.room_id == "room_1"
    assert message.game_id == "game_1"    


def test_game_state_message_accepts_valid_data():
    game = GameState(
        status=GameStatus.RUNNING,
        players={},
        nodes={},
        tasks={},
        remaining_time_seconds=900,
    )

    message = GameStateMessage(
        type="GAME_STATE",
        game_id="game_1",
        game=game,
    )

    assert message.type == "GAME_STATE"
    assert message.game_id == "game_1"
    assert message.game == game    


def test_attack_started_message_accepts_valid_data():
    task = Task(
        id="task_1",
        player_id="player_1",
        node_id="B",
        question="Question",
        defence_level=DefenceLevel.K1,
    )

    message = AttackStartedMessage(
        type="ATTACK_STARTED",
        request_id="req_7",
        node_id="B",
        task=task,
    )

    assert message.type == "ATTACK_STARTED"
    assert message.request_id == "req_7"
    assert message.node_id == "B"
    assert message.task == task


def test_attack_resolved_message_accepts_valid_data():
    message = AttackResolvedMessage(
        type="ATTACK_RESOLVED",
        request_id="req_7",
        node_id="B",
        success=True,
        score_change=10,
    )

    assert message.type == "ATTACK_RESOLVED"
    assert message.request_id == "req_7"
    assert message.node_id == "B"
    assert message.success is True
    assert message.score_change == 10


def test_game_finished_message_accepts_valid_data():
    message = GameFinishedMessage(
        type="GAME_FINISHED",
        game_id="game_1",
        winner_id="player_1",
        scores={
            "player_1": 120,
            "player_2": 95,
        },
    )

    assert message.type == "GAME_FINISHED"
    assert message.game_id == "game_1"
    assert message.winner_id == "player_1"
    assert message.scores == {
        "player_1": 120,
        "player_2": 95,
    }        


def test_game_finished_message_allows_draw():
    message = GameFinishedMessage(
        type="GAME_FINISHED",
        game_id="game_1",
        winner_id=None,
        scores={
            "player_1": 100,
            "player_2": 100,
        },
    )

    assert message.winner_id is None    


def test_room_player_state_accepts_valid_data():
    player = RoomPlayerState(
        id="player_1",
        name="Alice",
        isHost=True,
        status="online",
    )

    assert player.id == "player_1"
    assert player.name == "Alice"
    assert player.is_host is True
    assert player.status == "online"


def test_room_state_message_accepts_frontend_contract():
    player = RoomPlayerState(
        id="player_1",
        name="Alice",
        isHost=True,
        status="online",
    )

    message = RoomStateMessage(
        type="ROOM_STATE",
        you=player,
        roomCode="A7FK3M",
        players=[player],
    )

    assert message.type == "ROOM_STATE"
    assert message.you == player
    assert message.room_code == "A7FK3M"
    assert message.players == [player]    


def test_room_state_message_rejects_invalid_room_code():
    player = RoomPlayerState(
        id="player_1",
        name="Alice",
        isHost=True,
        status="online",
    )

    with pytest.raises(ValidationError):
        RoomStateMessage(
            type="ROOM_STATE",
            you=player,
            roomCode="ABC",
            players=[player],
        )    


def test_room_state_message_serializes_for_frontend():
    player = RoomPlayerState(
        id="player_1",
        name="Alice",
        is_host=True,
        status="online",
    )

    message = RoomStateMessage(
        type="ROOM_STATE",
        you=player,
        room_code="A7FK3M",
        players=[player],
    )

    data = message.model_dump(
        mode="json",
        by_alias=True,
    )

    assert data["roomCode"] == "A7FK3M"
    assert data["you"]["isHost"] is True


def test_map_preview_accepts_valid_data():
    preview = MapPreview(
        orbit_count=3,
        nodes=[
            MapPreviewNode(
                id="n1_0",
                orbit=1,
                x=0.21,
                y=-0.03,
            ),
            MapPreviewNode(
                id="n3_0",
                orbit=3,
                x=0.58,
                y=0.12,
            ),
        ],
        edges=[
            ("n1_0", "n1_1"),
            ("n1_0", "n2_0"),
        ],
        spawn_nodes=[
            "n3_0",
            "n3_4",
        ],
    )

    assert preview.orbit_count == 3
    assert len(preview.nodes) == 2
    assert preview.nodes[0].id == "n1_0"
    assert preview.nodes[0].orbit == 1
    assert preview.nodes[0].x == 0.21
    assert preview.nodes[0].y == -0.03

    assert preview.edges == [
        ("n1_0", "n1_1"),
        ("n1_0", "n2_0"),
    ]

    assert preview.spawn_nodes == [
        "n3_0",
        "n3_4",
    ]


def test_map_preview_serializes_with_frontend_field_names():
    preview = MapPreview(
        orbit_count=3,
        nodes=[
            MapPreviewNode(
                id="n1_0",
                orbit=1,
                x=0.2,
                y=0.1,
            ),
        ],
        edges=[
            ("n1_0", "n1_1"),
        ],
        spawn_nodes=[
            "n3_0",
        ],
    )

    data = preview.model_dump(
        mode="json",
        by_alias=True,
    )

    assert data["orbitCount"] == 3
    assert data["spawnNodes"] == ["n3_0"]
    assert data["nodes"][0]["id"] == "n1_0"
    assert data["nodes"][0]["orbit"] == 1    


def test_room_state_message_accepts_map_preview():
    player = RoomPlayerState(
        id="player_1",
        name="Alice",
        is_host=True,
        status="online",
    )

    preview = MapPreview(
        orbit_count=3,
        nodes=[
            MapPreviewNode(
                id="n1_0",
                orbit=1,
                x=0.2,
                y=0.1,
            ),
        ],
        edges=[],
        spawn_nodes=["n3_0"],
    )

    message = RoomStateMessage(
        type="ROOM_STATE",
        room_code="ABC234",
        you=player,
        players=[player],
        map_preview=preview,
    )

    data = message.model_dump(
        mode="json",
        by_alias=True,
    )

    assert data["type"] == "ROOM_STATE"
    assert data["roomCode"] == "ABC234"

    assert data["mapPreview"]["orbitCount"] == 3
    assert data["mapPreview"]["nodes"][0]["id"] == "n1_0"
    assert data["mapPreview"]["spawnNodes"] == ["n3_0"]
