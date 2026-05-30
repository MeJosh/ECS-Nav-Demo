# API And WebSocket Reference

The server runs a single authoritative Simulation World. REST endpoints are useful for inspection, system toggles, and request/response commands. The WebSocket route creates Participants and streams live State Updates.

Default base URL:

```text
http://localhost:3001
```

## World Snapshot

Most read paths return or broadcast a `WorldSnapshot`:

```ts
interface WorldSnapshot {
  tick: number;
  entities: string[];
  components: {
    position: Record<string, { x: number; y: number }>;
    destinationReference: Record<string, { entityId: string }>;
    movementVector: Record<string, { dx: number; dy: number }>;
    appearance: Record<string, {
      color: string;
      shape: "circle" | "square";
      radius?: number;
      size?: number;
    }>;
    name: Record<string, { value: string }>;
    participantOwnership: Record<string, { participantId: string }>;
    pathNode: Record<string, { preferredPath: true }>;
    pathConnections: Record<string, { entityIds: string[] }>;
    pathAttachment: Record<string, { fromEntityId: string; toEntityId: string }>;
  };
  systems: {
    steering: boolean;
    movement: boolean;
  };
}
```

Entity IDs are opaque. Use components to determine what an entity is and how systems can affect it.

## REST Endpoints

### `GET /api/state`

Returns the current world snapshot.

```sh
curl http://localhost:3001/api/state
```

### `GET /api/systems`

Returns enabled state for the server systems.

```json
{
  "steering": true,
  "movement": true
}
```

### `PATCH /api/systems/:systemId`

Enables or disables a system. Supported `systemId` values are `steering` and `movement`.

Request:

```json
{
  "enabled": false
}
```

Response:

```json
{
  "id": "movement",
  "enabled": false
}
```

Errors:

- `404` for an unknown system.
- `400` when `enabled` is not a boolean.

### `POST /api/participants/:participantId/destination`

Moves a known Participant's Destination Entity.

Request:

```json
{
  "x": 240,
  "y": 180
}
```

Response:

```json
{
  "ok": true,
  "movingEntityId": "ent_2",
  "destinationEntityId": "ent_1"
}
```

Errors:

- `400` when `x` or `y` is missing or not numeric.
- `404` for an unknown Participant.

The browser client usually sends destination updates over WebSocket because the server assigns the current connection's Participant ID during join.

### `POST /api/path-nodes`

Creates a Path Node at a world position.

Request:

```json
{
  "x": 100,
  "y": 200
}
```

Response:

```json
{
  "entityId": "ent_3"
}
```

### `DELETE /api/path-nodes/:entityId`

Deletes a Path Node and removes its Path Connections from neighboring nodes.

Response:

```json
{
  "ok": true
}
```

Returns `404` when the entity is not a Path Node.

### `POST /api/path-connections`

Creates bidirectional Path Connectivity between two different Path Nodes.

Request:

```json
{
  "fromEntityId": "ent_3",
  "toEntityId": "ent_4"
}
```

Response:

```json
{
  "ok": true,
  "fromEntityId": "ent_3",
  "toEntityId": "ent_4"
}
```

Returns `400` when either ID is missing, either entity is not a Path Node, or both IDs are the same.

### `DELETE /api/path-connections/:fromEntityId/:toEntityId`

Removes Path Connectivity between two Path Nodes.

Response:

```json
{
  "ok": true
}
```

Returns `404` when the connection does not exist.

## WebSocket Route

Connect to:

```text
ws://localhost:3001/ws
```

On connection, the server:

1. Assigns a transient Participant ID like `participant-1`.
2. Creates that Participant's Moving Entity and Destination Entity.
3. Sends a `participant.joined` message to the connecting socket.
4. Sends a `world.snapshot` message to the connecting socket.
5. Broadcasts the latest `world.snapshot` to all connected sockets.

### Server Messages

Participant join:

```json
{
  "type": "participant.joined",
  "participantId": "participant-1",
  "movingEntityId": "ent_2",
  "destinationEntityId": "ent_1"
}
```

World snapshot:

```json
{
  "type": "world.snapshot",
  "snapshot": {
    "tick": 12,
    "entities": ["ent_1", "ent_2"],
    "components": {
      "position": {},
      "destinationReference": {},
      "movementVector": {},
      "appearance": {},
      "name": {},
      "participantOwnership": {},
      "pathNode": {},
      "pathConnections": {},
      "pathAttachment": {}
    },
    "systems": {
      "steering": true,
      "movement": true
    }
  }
}
```

### Client Commands

Set the connected Participant's destination:

```json
{
  "type": "destination.set",
  "x": 360,
  "y": 240
}
```

Create a Path Node:

```json
{
  "type": "pathNode.create",
  "x": 120,
  "y": 220
}
```

Delete a Path Node:

```json
{
  "type": "pathNode.delete",
  "entityId": "ent_3"
}
```

Create a Path Connection:

```json
{
  "type": "pathConnection.create",
  "fromEntityId": "ent_3",
  "toEntityId": "ent_4"
}
```

Delete a Path Connection:

```json
{
  "type": "pathConnection.delete",
  "fromEntityId": "ent_3",
  "toEntityId": "ent_4"
}
```

After a command changes the Simulation World, the server broadcasts a fresh full `world.snapshot`.

## Simulation Timing

`startSimulation` runs enabled systems every 50 ms by default. Each step runs the Steering System first, then the Movement System, then increments `tick` and broadcasts a snapshot.

The initial demo intentionally broadcasts full snapshots rather than deltas. See [adr/0002-broadcast-full-world-snapshots-in-the-initial-demo.md](adr/0002-broadcast-full-world-snapshots-in-the-initial-demo.md).
