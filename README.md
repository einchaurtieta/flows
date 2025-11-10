# Flows

### Tasks

- [x] Refactor the workflow by firing a mutation first to fetch the tables and create the graph and the call the workflow with only the nodes as steps
- [x] (Feat) Update edges to change execution order.
- [ ] (Feat) Send data from one node to another with a templating system
- [ ] (Feat) Execute the trigger when firing the workflow
- [ ] (Fix) Prevent edges duplication (validation)

- [ ] (Feat) Query the general status of the workflow to display in the canvas
- [ ] (Feat?) Query each step to zoom in into the response inside a modal or something?
- [ ] (Feat) Execute one node in isolation
- [ ] (Fix) Disble the `Run workflow` button when it's executting to prevent accidental duplication when triggering manually.

### Considering

- [ ] (Perf:freeze) Only send the node position update when the user releases the node, now I'm sending every reposition update hammering the DB.
  - [ ] Maybe not! This is cool for real time collaboration if that's something I want to add
