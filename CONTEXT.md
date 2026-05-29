# ECS Navigation Demo

This context describes the language used for an ECS-based movement and pathfinding demonstration. The demo exists to make simulation state, component data, and system behavior visible while keeping the concepts small enough to inspect.

## Language

**Simulation World**:
The authoritative collection of entities, components, and system-derived state for the demo. There is one active **Simulation World** that clients observe and influence through explicit input.
_Avoid_: Client world, local world

**Entity**:
An identity in the **Simulation World** that exists only because at least one component refers to it. An **Entity** is not an object and cannot exist without components.
_Avoid_: Entity object, empty entity

**Entity ID**:
An opaque server-assigned identifier for an **Entity**. An **Entity ID** does not encode what the entity is or which components it has.
_Avoid_: Typed ID, semantic ID

**Archetype**:
A named component set used to describe which entities a system cares about. In this demo, an **Archetype** may include required components and explicitly optional components.
_Avoid_: Entity class, object type

**Client**:
A participant interface that renders the **Simulation World** and sends input to change it. A **Client** does not own simulation rules or independently advance entity state.
_Avoid_: Simulation runner, game engine

**Input Command**:
A client-originated request to change some part of the **Simulation World**, such as assigning an entity destination. The server decides how an **Input Command** affects authoritative state.
_Avoid_: Client update, local mutation

**State Update**:
A server-originated description of authoritative **Simulation World** state. Clients receive **State Updates** so they can render without polling aggressively.
_Avoid_: Client sync, local refresh

**Destination Entity**:
An entity whose **Position** is used as the target point for another entity. A **Destination Entity** is not a path or waypoint list; it is a single target in the **Simulation World**.
_Avoid_: Destination point, target coordinate

**Destination Reference**:
A relationship from a moving entity to a **Destination Entity**. A **Destination Reference** means the moving entity aims at the referenced entity's **Position**, but an entity may still move without one.
_Avoid_: Destination component as coordinates, target vector

**Movement Vector**:
The per-step displacement a **Moving Entity** intends to travel during a **Simulation Step**. A **Movement Vector** may be derived from a **Destination Reference** or supplied independently.
_Avoid_: Velocity, heading

**Appearance**:
A component that describes how an entity should be rendered by clients, such as color and shape. **Appearance** is part of the authoritative **Simulation World** so all clients render entities consistently.
_Avoid_: Client style, local display rule

**Name**:
A human-readable component used for inspection or optional labels. **Name** is not an entity's identity and does not determine behavior.
_Avoid_: Entity identity, display ID

**Arrival**:
The moment a **Moving Entity** reaches its referenced **Destination Entity**. If the entity has a **Destination Reference** and could reach or pass the destination during the current simulation step, it arrives at the destination instead.
_Avoid_: Overshoot, waypoint arrival

**Steering System**:
The system that derives a **Movement Vector** from an entity's current **Position** and **Destination Reference** during each **Simulation Step**. The **Steering System** does not move entities directly.
_Avoid_: Direction system, destination system

**Movement System**:
The system that applies a **Movement Vector** to update an entity's **Position**. The **Movement System** is also responsible for **Arrival** when a **Destination Reference** is present.
_Avoid_: Position system, velocity system

**Enabled System**:
A system that participates in simulation steps. Disabled systems remain part of the demo vocabulary but do not affect the **Simulation World** while disabled.
_Avoid_: Active processor, running behavior

**Simulation Step**:
A single server-owned advancement of the **Simulation World**. During a **Simulation Step**, enabled systems run in a defined order and may produce **State Updates**.
_Avoid_: Frame, client tick

**Position**:
A point in the **Simulation World** occupied by an entity. Both moving entities and **Destination Entities** may have a **Position**.
_Avoid_: Location, coordinates

**World Coordinate**:
A point in the shared coordinate space of the **Simulation World**. Client clicks are interpreted as **World Coordinates** before they update a **Destination Entity**.
_Avoid_: Screen coordinate, pixel coordinate

**Participant**:
A transient connected user represented in the **Simulation World** by one or more controlled entity pairs. In the initial demo, each **Participant** has exactly one **Moving Entity** and one **Destination Entity**.
_Avoid_: Player, user, account

**Participant Ownership**:
A relationship that marks an entity as belonging to a **Participant**. **Participant Ownership** is semantic and separate from visual similarity such as shared color.
_Avoid_: Color ownership, player color

**Controlled Entity Pair**:
A **Moving Entity** and its referenced **Destination Entity** that belong to the same **Participant**. The initial demo gives each **Participant** exactly one **Controlled Entity Pair**.
_Avoid_: Avatar pair, player unit

**Moving Entity**:
An entity that follows a **Destination Reference** by moving toward the referenced **Destination Entity**. In the initial demo, each **Participant** has exactly one **Moving Entity**.
_Avoid_: Avatar, character, agent

**Viewport**:
The visible portion of the **Simulation World** rendered by a client. The initial demo treats the entire client screen as the **Viewport**.
_Avoid_: Screen, canvas area, map

## Example Dialogue

Dev: "When I drag an entity target in the client, am I moving the entity directly?"

Domain expert: "No. The client sends an Input Command, and the Simulation World changes only after the server accepts and applies it."

Dev: "Does the client poll constantly to find out where entities are?"

Domain expert: "No. The server sends State Updates to connected clients as the Simulation World changes."

Dev: "Can the server create an empty entity and add components later?"

Domain expert: "No. An Entity is only an identity referenced by components; without components, there is no entity in the Simulation World."

Dev: "Can I tell whether an entity is a destination by looking at its ID?"

Domain expert: "No. Entity IDs are opaque; components and archetypes describe what an entity is in the Simulation World."

Dev: "Does the moving entity store its destination as x/y coordinates?"

Domain expert: "No. It stores a Destination Reference to a Destination Entity, and that entity's Position is the target."

Dev: "If two participants are connected, can they see each other's movement?"

Domain expert: "Yes. Each participant has a Controlled Entity Pair in the shared Simulation World, and every client renders the same authoritative state."

Dev: "Does sharing a color mean two entities belong to the same participant?"

Domain expert: "No. Participant Ownership defines that relationship; color is only part of Appearance."

Dev: "Does the initial demo need panels or labels?"

Domain expert: "No. The client shows the Viewport, where clicking sets the participant's Destination Entity and movement begins immediately."

Dev: "Are click positions local to each browser window?"

Domain expert: "No. A click resolves to a World Coordinate so the server can update the authoritative Destination Entity."

Dev: "What happens when a browser refreshes?"

Domain expert: "The old Participant and its Controlled Entity Pair leave the Simulation World, then the new connection creates a fresh Participant."

Dev: "What happens if a moving entity would pass its destination during a movement step?"

Domain expert: "It arrives instead: its Position becomes the Destination Entity's Position for that step."

Dev: "Can an entity move without a destination?"

Domain expert: "Yes. An entity with a Movement Vector but no Destination Reference still moves, but it cannot arrive because there is no destination to compare against."

Dev: "What is the MovingEntity archetype?"

Domain expert: "It is the named component set for entities with Position and Movement Vector, with Destination Reference treated as optional."

Dev: "How does each client know which shape and color to render?"

Domain expert: "The server owns Appearance components, so clients render the same authoritative color and shape for each entity."

Dev: "Is an entity's name how systems identify it?"

Domain expert: "No. Name is for inspection or optional labels; systems use components and Entity IDs."

Dev: "Which system changes an entity's Position?"

Domain expert: "The Movement System changes Position. The Steering System only prepares or updates the Movement Vector."

Dev: "If a destination moves while an entity is already moving, does the entity keep its old vector?"

Domain expert: "No. The Steering System recalculates the Movement Vector from current positions each Simulation Step."

Dev: "Does rendering advance the simulation?"

Domain expert: "No. The server advances the Simulation World through Simulation Steps; clients render the State Updates they receive."
