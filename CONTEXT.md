# ECS Navigation Demo

This context describes the language used for an ECS-based movement and pathfinding demonstration. The demo exists to make simulation state, component data, and system behavior visible while keeping the concepts small enough to inspect.

## Language

**Simulation World**:
The authoritative collection of entities, components, and system-derived state for the demo. There is one active **Simulation World** that clients observe and influence through explicit input.
_Avoid_: Client world, local world

**Simulation Host**:
The runtime participant that owns and advances the active **Simulation World**. A **Simulation Host** may be a dedicated server or a single-user local runtime, but there is still only one authoritative owner for any active **Simulation World**.
_Avoid_: Client owner, peer server

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

**Command Handling**:
The act of applying an **Input Command** to the authoritative **Simulation World**. **Command Handling** belongs to the active **Simulation Host**, whether that host is dedicated or local.
_Avoid_: UI mutation, direct client state change

**State Update**:
A server-originated description of authoritative **Simulation World** state. Clients receive **State Updates** so they can render without polling aggressively.
_Avoid_: Client sync, local refresh

**Destination Entity**:
An entity whose **Position** is used as the target point for another entity. A **Destination Entity** is not a path or waypoint list; it is a single target in the **Simulation World**.
_Avoid_: Destination point, target coordinate

**Destination Reference**:
A relationship from a moving entity to a **Destination Entity**. A **Destination Reference** means the moving entity aims at the referenced entity's **Position**, but an entity may still move without one.
_Avoid_: Destination component as coordinates, target vector

**Preferred Path**:
A shared navigable graph of **Path Nodes** and **Path Connections** in the **Simulation World** that **Moving Entities** may prefer while travelling to a **Destination Entity**. A **Preferred Path** is not the destination itself and does not strictly bind movement.
_Avoid_: Regular path, road, route

**Path Node**:
An entity or point in the **Simulation World** that can belong to a **Preferred Path**. A **Path Node** may have zero or more **Path Connections**.
_Avoid_: Note, waypoint, path point

**Path Connection**:
A bidirectional relationship between two **Path Nodes** in a **Preferred Path**. A **Path Connection** represents adjacency between path nodes, not ownership by a participant.
_Avoid_: Edge, line, segment

**Path Connectivity**:
The binary state of whether two different **Path Nodes** are joined by a **Path Connection**. The same pair of path nodes is either connected or not connected.
_Avoid_: Duplicate connection, repeated edge, self-connection

**Path Route**:
A connected traversal through one or more **Path Connections** between two **Path Nodes**. A **Path Route** is available only when the relevant path nodes belong to the same connected portion of the **Preferred Path**.
_Avoid_: Route list, pathfinding result, path plan

**Path Attachment**:
The state of a **Moving Entity** using a **Path Route** between **Path Nodes**. A **Moving Entity** receives path-specific movement benefits only while it has a **Path Attachment**.
_Avoid_: On road, snapped to path, following line

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

Dev: "Is a preferred path the same thing as the destination?"

Domain expert: "No. A Preferred Path is a shared navigable graph of Path Nodes and Path Connections that Moving Entities may prefer while travelling to a Destination Entity."

Dev: "Can a Moving Entity use any two Path Nodes as a route?"

Domain expert: "Only when those Path Nodes are connected by a Path Route. Disconnected portions of the Preferred Path are separate choices."

Dev: "Does a Moving Entity move faster whenever it is near a Preferred Path?"

Domain expert: "No. It receives path-specific movement benefits only while it has a Path Attachment."

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

Dev: "If a destination moves while a Moving Entity has a Path Attachment, does it keep the old Path Route?"

Domain expert: "No. Preferred Path use remains responsive to the current Simulation World, including moved Destination Entities and changed Path Routes."

Dev: "Can a Path Connection remain after one of its Path Nodes is removed?"

Domain expert: "No. A Path Connection requires both of its Path Nodes, and Preferred Path changes are reflected in later movement decisions."

Dev: "Can two Path Nodes have several Path Connections between them?"

Domain expert: "No. Path Connectivity is binary: two different Path Nodes are either connected or not connected."

Dev: "When editing the Preferred Path, what happens if a client input could both select a Path Node and affect empty space?"

Domain expert: "Path Node interactions take precedence over Path Connection interactions, and Path Connection interactions take precedence over empty-space interactions."

Dev: "Does dragging from a Path Node also move my Destination Entity?"

Domain expert: "No. A drag that begins on a Path Node is a Preferred Path edit gesture; ordinary empty-space input still changes a participant's Destination Entity."

Dev: "Does rendering advance the simulation?"

Domain expert: "No. The server advances the Simulation World through Simulation Steps; clients render the State Updates they receive."

Dev: "Can the same demo run without connecting to a dedicated server?"

Domain expert: "Yes, if a local runtime acts as the Simulation Host. The Client still renders and sends input; the Simulation Host is the owner of the Simulation World."

Dev: "In local mode, does the user stop being a Participant?"

Domain expert: "No. Local mode still has one Participant with one Controlled Entity Pair; only the Simulation Host changes."

Dev: "Are local-mode clicks a different kind of input from server-mode clicks?"

Domain expert: "No. Both produce Input Commands. The difference is which Simulation Host handles those commands."
