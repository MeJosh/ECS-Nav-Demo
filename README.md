# ECS Navigation Demo

ECS Navigation Demo is a small full-stack TypeScript project for exploring server-owned Entity Component System movement, live state updates, and preferred-path navigation.

The server owns the authoritative Simulation World. Browser clients connect as transient Participants, render the same world snapshot, and send Input Commands such as "move my destination" or "create a path node." The demo keeps the moving parts intentionally visible: entities are just IDs with components, systems derive movement from component state, and clients receive the resulting world state over WebSockets.

## What It Demonstrates

- An ECS-style world with entities, components, and server-run systems.
- Participant-owned moving entities that steer toward destination entities.
- A shared Preferred Path graph made from Path Nodes and Path Connections.
- REST endpoints for world inspection, system toggles, and scriptable commands.
- WebSocket messages for participant joining, client commands, and live world snapshots.
- A lightweight Bun monorepo split into `client`, `server`, and `shared` packages.

## Repository Layout

```text
client/   Vue + Vite client that renders the Simulation World and sends input
server/   Fastify server, ECS world model, systems, REST API, and WebSocket route
shared/   Cross-boundary TypeScript types used by the client and server
docs/     Architecture notes and API-oriented documentation
```

## Prerequisites

- [Bun](https://bun.sh/) 1.2 or newer.
- A modern browser with WebSocket support.

## Quick Start

From a fresh clone:

```sh
bun install
bun run dev
```

The root `dev` script starts both workspaces:

- API and WebSocket server: `http://localhost:3001`
- Vite client: usually `http://localhost:3000`

Open the Vite URL in one or more browser windows. Each connection becomes a Participant with its own moving circle and destination square.

Basic interactions:

- Left-click anywhere in the viewport to move your destination.
- Right-click empty space to create a Path Node.
- Drag from one Path Node to another to create a Path Connection.
- Right-click a Path Node to delete it.
- Right-click a Path Connection to delete it.

For a scripted walkthrough from a clean checkout, see [docs/quick-start.md](docs/quick-start.md).

## Useful Commands

```sh
bun install              # install workspace dependencies
bun run dev              # run client and server together
bun run dev:server       # run only the Fastify API/WebSocket server
bun run dev:client       # run only the Vite client
bun test                 # run Bun tests
bun run typecheck        # typecheck all workspaces
```

The server reads `PORT` and defaults to `3001`. In development, Vite proxies `/api` and `/ws` to `VITE_SERVER_URL` or `http://localhost:3001`.

```sh
PORT=4001 bun run dev:server
VITE_SERVER_URL=http://localhost:4001 bun run dev:client
```

## API And WebSocket Docs

The server exposes REST endpoints under `/api` and a WebSocket route at `/ws`.

Common examples:

```sh
curl http://localhost:3001/api/state
curl http://localhost:3001/api/systems
curl -X PATCH http://localhost:3001/api/systems/movement \
  -H 'content-type: application/json' \
  -d '{"enabled": false}'
```

See [docs/api-websocket.md](docs/api-websocket.md) for endpoint payloads, WebSocket message examples, and the world snapshot shape.

## Project Vocabulary

The project uses a small domain language around Simulation Worlds, Participants, Destination Entities, Preferred Paths, and Systems. See [CONTEXT.md](CONTEXT.md) for the canonical terminology.

Architecture decisions are captured in [docs/adr](docs/adr).
