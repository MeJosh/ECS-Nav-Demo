# Quick Start

This guide starts from a clean checkout and gets you to a running local demo you can interact with from the browser and from the command line.

## 1. Install Dependencies

```sh
bun install
```

The repository is a Bun workspace with three packages:

- `client`: the Vue/Vite browser UI.
- `server`: the Fastify API, WebSocket route, and ECS simulation.
- `shared`: TypeScript contracts used on both sides.

## 2. Start The Demo

```sh
bun run dev
```

By default, this starts:

- Server: `http://localhost:3001`
- Client: `http://localhost:3000`

If Vite chooses a different client port, use the URL printed in the terminal.

## 3. Interact In The Browser

Open the client URL. The WebSocket connection creates a Participant and a Controlled Entity Pair:

- A circle is the Moving Entity.
- A square is its Destination Entity.

Try the core interactions:

- Left-click a point to set your destination.
- Open a second browser window to watch multiple Participants share one Simulation World.
- Right-click empty space to create Path Nodes.
- Drag from one Path Node to another to create a Path Connection.
- Right-click a node or connection to remove it.

Moving Entities may prefer a connected path route when it is useful, and they move faster while attached to that route.

## 4. Inspect State With REST

In another terminal, read the authoritative world snapshot:

```sh
curl http://localhost:3001/api/state
```

Read enabled systems:

```sh
curl http://localhost:3001/api/systems
```

Disable movement:

```sh
curl -X PATCH http://localhost:3001/api/systems/movement \
  -H 'content-type: application/json' \
  -d '{"enabled": false}'
```

Re-enable movement:

```sh
curl -X PATCH http://localhost:3001/api/systems/movement \
  -H 'content-type: application/json' \
  -d '{"enabled": true}'
```

## 5. Create A Path From The Command Line

Create two Path Nodes:

```sh
curl -X POST http://localhost:3001/api/path-nodes \
  -H 'content-type: application/json' \
  -d '{"x": 100, "y": 200}'

curl -X POST http://localhost:3001/api/path-nodes \
  -H 'content-type: application/json' \
  -d '{"x": 500, "y": 200}'
```

Each response returns an `entityId`. Use those IDs to create a bidirectional Path Connection:

```sh
curl -X POST http://localhost:3001/api/path-connections \
  -H 'content-type: application/json' \
  -d '{"fromEntityId": "ent_1", "toEntityId": "ent_2"}'
```

The exact IDs depend on what already exists in the Simulation World. Use `/api/state` to confirm the current entity IDs and component state.

## 6. Run Checks

```sh
bun test
bun run typecheck
```

The tests cover the Fastify API and the ECS movement/path behavior.
