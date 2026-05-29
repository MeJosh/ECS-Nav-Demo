import { buildApp, startSimulation } from "./app";
import { createWorld } from "./ecs/world";

const port = Number(Bun.env.PORT ?? 3001);
const world = createWorld({ movementPerStep: 5 });
const app = await buildApp({ world });

startSimulation(app, world);

await app.listen({ port, host: "0.0.0.0" });
