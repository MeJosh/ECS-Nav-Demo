export type EntityId = string;

export type Shape = "circle" | "square";

export interface Position {
  x: number;
  y: number;
}

export interface DestinationReference {
  entityId: EntityId;
}

export interface MovementVector {
  dx: number;
  dy: number;
}

export interface Appearance {
  color: string;
  shape: Shape;
  radius?: number;
  size?: number;
}

export interface Name {
  value: string;
}

export interface ParticipantOwnership {
  participantId: string;
}

export interface PathNode {
  preferredPath: true;
}

export interface PathConnections {
  entityIds: EntityId[];
}

export interface PathAttachment {
  fromEntityId: EntityId;
  toEntityId: EntityId;
}

export interface Components {
  position: Record<EntityId, Position>;
  destinationReference: Record<EntityId, DestinationReference>;
  movementVector: Record<EntityId, MovementVector>;
  appearance: Record<EntityId, Appearance>;
  name: Record<EntityId, Name>;
  participantOwnership: Record<EntityId, ParticipantOwnership>;
  pathNode: Record<EntityId, PathNode>;
  pathConnections: Record<EntityId, PathConnections>;
  pathAttachment: Record<EntityId, PathAttachment>;
}

export interface SystemStates {
  steering: boolean;
  movement: boolean;
}

export interface WorldSnapshot {
  tick: number;
  entities: EntityId[];
  components: Components;
  systems: SystemStates;
}

export interface ParticipantJoinedMessage {
  type: "participant.joined";
  participantId: string;
  movingEntityId: EntityId;
  destinationEntityId: EntityId;
}

export interface WorldSnapshotMessage {
  type: "world.snapshot";
  snapshot: WorldSnapshot;
}

export type ServerMessage = ParticipantJoinedMessage | WorldSnapshotMessage;

export interface SetDestinationCommand extends Position {
  type: "destination.set";
}

export interface CreatePathNodeCommand extends Position {
  type: "pathNode.create";
}

export interface DeletePathNodeCommand {
  type: "pathNode.delete";
  entityId: EntityId;
}

export interface CreatePathConnectionCommand {
  type: "pathConnection.create";
  fromEntityId: EntityId;
  toEntityId: EntityId;
}

export interface DeletePathConnectionCommand {
  type: "pathConnection.delete";
  fromEntityId: EntityId;
  toEntityId: EntityId;
}

export type ClientCommand =
  | SetDestinationCommand
  | CreatePathNodeCommand
  | DeletePathNodeCommand
  | CreatePathConnectionCommand
  | DeletePathConnectionCommand;
