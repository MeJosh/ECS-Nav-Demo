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
const isHelpOpen = ref(false);

const helpMarkdown = `
## Using the Demo

### Client Controls

- **Left-click empty space** to set your Destination Entity.
- **Right-click empty space** to create a Path Node.
- **Drag from one Path Node to another** to create a Path Connection.
- **Right-click a Path Node** to delete it.
- **Right-click a Path Connection** to delete it.

### Destination

Your circle is the Moving Entity. Your square is the Destination Entity. When you set a destination, the Client sends an Input Command and the server updates the shared Simulation World.

### Preferred Path

Path Nodes and Path Connections form the Preferred Path. Moving Entities may prefer connected routes while travelling, but the Preferred Path is shared by every Client and is separate from any one destination.

### Editing Priority

Path Node interactions take priority over Path Connection interactions, and Path Connection interactions take priority over empty-space destination input.
`.trim();

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replaceAll(/`([^`]+)`/g, "<code>$1</code>")
    .replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let isListOpen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (isListOpen) {
        html.push("</ul>");
        isListOpen = false;
      }
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      if (isListOpen) {
        html.push("</ul>");
        isListOpen = false;
      }
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^-\s+(.+)$/.exec(trimmed);
    if (listItem) {
      if (!isListOpen) {
        html.push("<ul>");
        isListOpen = true;
      }
      html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    if (isListOpen) {
      html.push("</ul>");
      isListOpen = false;
    }
    html.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  }

  if (isListOpen) {
    html.push("</ul>");
  }

  return html.join("");
}

const renderedHelpMarkdown = computed(() => renderMarkdown(helpMarkdown));

const positionedEntities = computed(() => {
  if (!snapshot.value) {
    return [];
  }

  return snapshot.value.entities
    .map((entityId) => ({
      entityId,
      position: snapshot.value?.components.position[entityId],
      appearance: snapshot.value?.components.appearance[entityId],
      name: snapshot.value?.components.name[entityId],
      pathNode: snapshot.value?.components.pathNode[entityId],
      pathConnections: snapshot.value?.components.pathConnections[entityId]
    }))
    .filter((entity) => entity.position && entity.appearance);
});

const squares = computed(() =>
  positionedEntities.value.filter((entity) => !entity.pathNode && entity.appearance?.shape === "square")
);

const circles = computed(() =>
  positionedEntities.value.filter((entity) => !entity.pathNode && entity.appearance?.shape === "circle")
);

const pathNodes = computed(() =>
  positionedEntities.value.filter((entity) => entity.pathNode && entity.position)
);

const pathConnections = computed(() => {
  const pathNodePositions = new Map(
    pathNodes.value.map((entity) => [entity.entityId, entity.position])
  );
  const connectionKeys = new Set<string>();
  const connections: {
    key: string;
    fromEntityId: EntityId;
    toEntityId: EntityId;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }[] = [];

  for (const entity of pathNodes.value) {
    for (const connectedEntityId of entity.pathConnections?.entityIds ?? []) {
      const key = [entity.entityId, connectedEntityId].sort().join(":");
      const from = pathNodePositions.get(entity.entityId);
      const to = pathNodePositions.get(connectedEntityId);
      if (connectionKeys.has(key) || !from || !to) {
        continue;
      }
      connectionKeys.add(key);
      connections.push({
        key,
        fromEntityId: entity.entityId,
        toEntityId: connectedEntityId,
        from,
        to
      });
    }
  }

  return connections;
});

const dragStartPathNodeId = ref<EntityId | null>(null);
const dragPointerPosition = ref<{ x: number; y: number } | null>(null);
const dragHoverPathNodeId = ref<EntityId | null>(null);
const suppressNextClick = ref(false);

const pathNodePositions = computed(
  () => new Map(pathNodes.value.map((entity) => [entity.entityId, entity.position]))
);

const pathConnectionSets = computed(
  () => new Map(pathNodes.value.map((entity) => [entity.entityId, new Set(entity.pathConnections?.entityIds ?? [])]))
);

const pathConnectionPreview = computed(() => {
  const fromEntityId = dragStartPathNodeId.value;
  if (!fromEntityId) {
    return null;
  }
  const from = pathNodePositions.value.get(fromEntityId);
  if (!from || !dragPointerPosition.value) {
    return null;
  }

  const toEntityId = dragHoverPathNodeId.value;
  const to = toEntityId ? pathNodePositions.value.get(toEntityId) : undefined;
  const canConnect = Boolean(
    toEntityId &&
      to &&
      toEntityId !== fromEntityId &&
      !pathConnectionSets.value.get(fromEntityId)?.has(toEntityId)
  );

  return {
    from,
    to: canConnect && to ? to : dragPointerPosition.value,
    canConnect
  };
});

function sendCommand(command: Record<string, unknown>) {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.value.send(JSON.stringify(command));
}

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
  if (suppressNextClick.value) {
    suppressNextClick.value = false;
    return;
  }
  sendCommand({
    type: "destination.set",
    x: event.clientX,
    y: event.clientY
  });
}

function createPathNode(event: MouseEvent) {
  sendCommand({
    type: "pathNode.create",
    x: event.clientX,
    y: event.clientY
  });
}

function deletePathNode(entityId: EntityId) {
  sendCommand({
    type: "pathNode.delete",
    entityId
  });
}

function startPathConnection(event: PointerEvent, entityId: EntityId) {
  if (event.button !== 0) {
    return;
  }
  dragStartPathNodeId.value = entityId;
  dragPointerPosition.value = { x: event.clientX, y: event.clientY };
  dragHoverPathNodeId.value = entityId;
}

function finishPathConnection(entityId: EntityId) {
  if (!dragStartPathNodeId.value) {
    return;
  }
  suppressNextClick.value = true;
  if (
    entityId !== dragStartPathNodeId.value &&
    !pathConnectionSets.value.get(dragStartPathNodeId.value)?.has(entityId)
  ) {
    sendCommand({
      type: "pathConnection.create",
      fromEntityId: dragStartPathNodeId.value,
      toEntityId: entityId
    });
  }
  clearPathConnectionDrag();
}

function cancelPathConnectionDrag() {
  if (dragStartPathNodeId.value) {
    suppressNextClick.value = true;
  }
  clearPathConnectionDrag();
}

function clearPathConnectionDrag() {
  dragStartPathNodeId.value = null;
  dragPointerPosition.value = null;
  dragHoverPathNodeId.value = null;
}

function updatePathConnectionPreview(event: PointerEvent) {
  if (!dragStartPathNodeId.value) {
    return;
  }
  dragPointerPosition.value = { x: event.clientX, y: event.clientY };
}

function hoverPathConnectionTarget(entityId: EntityId) {
  if (!dragStartPathNodeId.value) {
    return;
  }
  dragHoverPathNodeId.value = entityId;
}

function leavePathConnectionTarget(entityId: EntityId) {
  if (dragHoverPathNodeId.value === entityId) {
    dragHoverPathNodeId.value = null;
  }
}

function deletePathConnection(fromEntityId: EntityId, toEntityId: EntityId) {
  sendCommand({
    type: "pathConnection.delete",
    fromEntityId,
    toEntityId
  });
}

function openHelp() {
  isHelpOpen.value = true;
}

function closeHelp() {
  isHelpOpen.value = false;
}

function closeHelpOnEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeHelp();
  }
}

onMounted(() => {
  connect();
  window.addEventListener("keydown", closeHelpOnEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", closeHelpOnEscape);
  socket.value?.close();
});
</script>

<template>
  <main
    class="viewport"
    @click="setDestination"
    @contextmenu.prevent="createPathNode"
    @pointermove="updatePathConnectionPreview"
    @pointerup="cancelPathConnectionDrag"
  >
    <svg class="world" aria-label="ECS navigation world">
      <rect class="background" width="100%" height="100%" />

      <g class="path-connections">
        <line
          v-for="connection in pathConnections"
          :key="`${connection.key}:hit`"
          :x1="connection.from.x"
          :y1="connection.from.y"
          :x2="connection.to.x"
          :y2="connection.to.y"
          class="path-connection-hit"
          @click.stop
          @contextmenu.prevent.stop="deletePathConnection(connection.fromEntityId, connection.toEntityId)"
        />
        <line
          v-for="connection in pathConnections"
          :key="connection.key"
          :x1="connection.from.x"
          :y1="connection.from.y"
          :x2="connection.to.x"
          :y2="connection.to.y"
          class="path-connection"
          pointer-events="none"
        />
        <line
          v-if="pathConnectionPreview"
          :x1="pathConnectionPreview.from.x"
          :y1="pathConnectionPreview.from.y"
          :x2="pathConnectionPreview.to.x"
          :y2="pathConnectionPreview.to.y"
          :class="[
            'path-connection-preview',
            { 'path-connection-preview-valid': pathConnectionPreview.canConnect }
          ]"
          pointer-events="none"
        />
      </g>

      <circle
        v-for="entity in pathNodes"
        :key="entity.entityId"
        :cx="entity.position?.x ?? 0"
        :cy="entity.position?.y ?? 0"
        :r="entity.appearance?.radius ?? 9"
        class="path-node"
        @click.stop
        @pointerdown.stop="startPathConnection($event, entity.entityId)"
        @pointerup.stop="finishPathConnection(entity.entityId)"
        @pointerenter="hoverPathConnectionTarget(entity.entityId)"
        @pointerleave="leavePathConnectionTarget(entity.entityId)"
        @contextmenu.prevent.stop="deletePathNode(entity.entityId)"
      >
        <title>{{ entity.name?.value ?? entity.entityId }}</title>
      </circle>

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

    <button class="help-button" type="button" aria-label="Open instructions" @click.stop="openHelp">
      ?
    </button>

    <Teleport to="body">
      <div v-if="isHelpOpen" class="help-modal-backdrop" role="presentation" @click="closeHelp">
        <section
          class="help-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          @click.stop
        >
          <div class="help-modal-header">
            <h2 id="help-modal-title">Instructions</h2>
            <button class="help-close-button" type="button" aria-label="Close instructions" @click="closeHelp">
              x
            </button>
          </div>
          <div class="help-markdown" v-html="renderedHelpMarkdown" />
        </section>
      </div>
    </Teleport>
  </main>
</template>
