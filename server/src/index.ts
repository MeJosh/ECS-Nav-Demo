import { buildApp, startSimulation } from "./app.ts";
import { createSimulationHost } from "@ecs-nav-demo/simulation";

const port = Number(process.env.PORT ?? 3001);
const listenHost = process.env.HOST ?? "0.0.0.0";
const simulationHost = createSimulationHost({ movementPerStep: 5 });
const app = await buildApp({ host: simulationHost });

startSimulation(app, simulationHost);

await app.listen({ port, host: listenHost });
