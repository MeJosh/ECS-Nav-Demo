# Broadcast Full World Snapshots in the Initial Demo

The initial demo broadcasts full world snapshots over WebSocket instead of per-component deltas. This favors debuggability and simpler teaching code while the world is small, with the expectation that state updates should be revisited when richer pathfinding visualizations or larger entity counts make full snapshots too noisy or expensive.
