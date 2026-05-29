<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { EntityId, ServerMessage, WorldSnapshot } from "@ecs-nav-demo/shared";

interface ParticipantState {
  participantId: string;
  movingEntityId: EntityId;
  destinationEntityId: EntityId;
}

const snapshot = ref<WorldSnapshot | null>(null);
const participant = ref<ParticipantState | null>(null);
const socket = ref<WebSocket | null>(null);
const serverUrl = import.meta.env.VITE_SERVER_URL?.trim() || window.location.origin;

const positionedEntities = computed(() => {
  if (!snapshot.value) {
    return [];
  }

  return snapshot.value.entities
    .map((entityId) => ({
      entityId,
      position: snapshot.value?.components.position[entityId],
      appearance: snapshot.value?.components.appearance[entityId],
      name: snapshot.value?.components.name[entityId]
    }))
    .filter((entity) => entity.position && entity.appearance);
});

const squares = computed(() =>
  positionedEntities.value.filter((entity) => entity.appearance?.shape === "square")
);

const circles = computed(() =>
  positionedEntities.value.filter((entity) => entity.appearance?.shape === "circle")
);

function connect() {
  const wsUrl = new URL("/ws", serverUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(wsUrl);
  socket.value = ws;

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    if (message.type === "participant.joined") {
      participant.value = {
        participantId: message.participantId,
        movingEntityId: message.movingEntityId,
        destinationEntityId: message.destinationEntityId
      };
      return;
    }
    if (message.type === "world.snapshot") {
      snapshot.value = message.snapshot;
    }
  });
}

function setDestination(event: MouseEvent) {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.value.send(
    JSON.stringify({
      type: "destination.set",
      x: event.clientX,
      y: event.clientY
    })
  );
}

onMounted(connect);

onBeforeUnmount(() => {
  socket.value?.close();
});
</script>

<template>
  <main class="viewport" @click="setDestination">
    <svg class="world" aria-label="ECS navigation world">
      <rect class="background" width="100%" height="100%" />

      <rect
        v-for="entity in squares"
        :key="entity.entityId"
        :x="(entity.position?.x ?? 0) - (entity.appearance?.size ?? 16) / 2"
        :y="(entity.position?.y ?? 0) - (entity.appearance?.size ?? 16) / 2"
        :width="entity.appearance?.size ?? 16"
        :height="entity.appearance?.size ?? 16"
        :fill="entity.appearance?.color"
        class="destination"
      >
        <title>{{ entity.name?.value ?? entity.entityId }}</title>
      </rect>

      <circle
        v-for="entity in circles"
        :key="entity.entityId"
        :cx="entity.position?.x ?? 0"
        :cy="entity.position?.y ?? 0"
        :r="entity.appearance?.radius ?? 6"
        :fill="entity.appearance?.color"
        class="moving-entity"
      >
        <title>{{ entity.name?.value ?? entity.entityId }}</title>
      </circle>
    </svg>
  </main>
</template>
