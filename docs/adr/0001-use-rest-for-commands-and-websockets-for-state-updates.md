# Use REST for Commands and WebSockets for State Updates

The demo uses REST for request/response operations such as configuration, inspection, and explicit input commands, while WebSockets push authoritative state updates from the server to connected clients. This keeps the server API easy to inspect and script while avoiding aggressive client polling for live simulation state.
