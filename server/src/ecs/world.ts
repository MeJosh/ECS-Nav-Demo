import type {
  Appearance,
  Components,
  DestinationReference,
  EntityId,
  MovementVector,
  Name,
  ParticipantOwnership,
  Position,
  SystemStates,
  WorldSnapshot
} from "@ecs-nav-demo/shared";

export interface WorldOptions {
  movementPerStep: number;
}

export interface ParticipantPairInput {
  participantId: string;
  color: string;
  position: Position;
}

export interface ParticipantPair {
  movingEntityId: EntityId;
  destinationEntityId: EntityId;
}

export type ComponentName = keyof Components;

export type ComponentValue<K extends ComponentName> = Components[K][EntityId];

type ComponentInput = Partial<{
  position: Position;
  destinationReference: DestinationReference;
  movementVector: MovementVector;
  appearance: Appearance;
  name: Name;
  participantOwnership: ParticipantOwnership;
}>;

export interface ComponentQuery {
  required: ComponentName[];
  optional?: ComponentName[];
}

export interface World {
  readonly movementPerStep: number;
  readonly systems: SystemStates;
  addComponents(components: ComponentInput): EntityId;
  removeEntity(entityId: EntityId): void;
  getComponent<K extends ComponentName>(component: K, entityId: EntityId): ComponentValue<K> | undefined;
  setComponent<K extends ComponentName>(component: K, entityId: EntityId, value: ComponentValue<K>): void;
  removeComponent(component: ComponentName, entityId: EntityId): void;
  query(query: ComponentQuery): EntityId[];
  createParticipantPair(input: ParticipantPairInput): ParticipantPair;
  setParticipantDestination(participantId: string, position: Position): ParticipantPair | undefined;
  removeParticipant(participantId: string): void;
  setSystemEnabled(system: keyof SystemStates, enabled: boolean): void;
  nextTick(): number;
  snapshot(): WorldSnapshot;
}

const componentNames: ComponentName[] = [
  "position",
  "destinationReference",
  "movementVector",
  "appearance",
  "name",
  "participantOwnership"
];

export function createWorld(options: WorldOptions): World {
  let nextEntityNumber = 1;
  let tick = 0;
  const components: Components = {
    position: {},
    destinationReference: {},
    movementVector: {},
    appearance: {},
    name: {},
    participantOwnership: {}
  };
  const systems: SystemStates = {
    steering: true,
    movement: true
  };

  function entityIds(): EntityId[] {
    const ids = new Set<EntityId>();
    for (const componentName of componentNames) {
      for (const entityId of Object.keys(components[componentName])) {
        ids.add(entityId);
      }
    }
    return [...ids].sort();
  }

  function addComponents(input: ComponentInput): EntityId {
    if (Object.keys(input).length === 0) {
      throw new Error("An entity must have at least one component.");
    }
    const entityId = `ent_${nextEntityNumber++}`;
    for (const [componentName, value] of Object.entries(input) as [ComponentName, ComponentValue<ComponentName>][]) {
      components[componentName][entityId] = value;
    }
    return entityId;
  }

  function getComponent<K extends ComponentName>(component: K, entityId: EntityId): ComponentValue<K> | undefined {
    return components[component][entityId] as ComponentValue<K> | undefined;
  }

  function setComponent<K extends ComponentName>(component: K, entityId: EntityId, value: ComponentValue<K>): void {
    components[component][entityId] = value;
  }

  function removeComponent(component: ComponentName, entityId: EntityId): void {
    delete components[component][entityId];
  }

  function removeEntity(entityId: EntityId): void {
    for (const componentName of componentNames) {
      removeComponent(componentName, entityId);
    }
  }

  function query({ required }: ComponentQuery): EntityId[] {
    return entityIds().filter((entityId) => required.every((componentName) => entityId in components[componentName]));
  }

  function createParticipantPair(input: ParticipantPairInput): ParticipantPair {
    const destinationEntityId = addComponents({
      position: { ...input.position },
      appearance: {
        color: input.color,
        shape: "square",
        size: 16
      },
      name: { value: `${input.participantId} destination` },
      participantOwnership: { participantId: input.participantId }
    });
    const movingEntityId = addComponents({
      position: { ...input.position },
      destinationReference: { entityId: destinationEntityId },
      appearance: {
        color: input.color,
        shape: "circle",
        radius: 6
      },
      name: { value: `${input.participantId} entity` },
      participantOwnership: { participantId: input.participantId }
    });
    return { movingEntityId, destinationEntityId };
  }

  function participantEntities(participantId: string): EntityId[] {
    return query({ required: ["participantOwnership"] }).filter(
      (entityId) => getComponent("participantOwnership", entityId)?.participantId === participantId
    );
  }

  function setParticipantDestination(participantId: string, position: Position): ParticipantPair | undefined {
    const movingEntityId = participantEntities(participantId).find((entityId) =>
      Boolean(getComponent("destinationReference", entityId))
    );
    if (!movingEntityId) {
      return undefined;
    }
    const destinationEntityId = getComponent("destinationReference", movingEntityId)?.entityId;
    if (!destinationEntityId) {
      return undefined;
    }
    setComponent("position", destinationEntityId, { ...position });
    return { movingEntityId, destinationEntityId };
  }

  function removeParticipant(participantId: string): void {
    for (const entityId of participantEntities(participantId)) {
      removeEntity(entityId);
    }
  }

  function snapshot(): WorldSnapshot {
    return {
      tick,
      entities: entityIds(),
      components: structuredClone(components),
      systems: { ...systems }
    };
  }

  return {
    movementPerStep: options.movementPerStep,
    systems,
    addComponents,
    removeEntity,
    getComponent,
    setComponent,
    removeComponent,
    query,
    createParticipantPair,
    setParticipantDestination,
    removeParticipant,
    setSystemEnabled(system, enabled) {
      systems[system] = enabled;
    },
    nextTick() {
      tick += 1;
      return tick;
    },
    snapshot
  };
}
