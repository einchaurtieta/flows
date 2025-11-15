# Flows

### Tasks

- [x] Refactor the workflow by firing a mutation first to fetch the tables and create the graph and the call the workflow with only the nodes as steps
- [x] (Feat) Update edges to change execution order.
- [x] (Feat) Execute the trigger when firing the workflow
- [ ] (Feat) Create the execution engine, having grouping and collapsing in mind, and the base flow nodes also, like merge and paralelise from the get go.
- [ ] (Feat) Send data from one node to another with a templating system
  - [ ] Define the basic data contract and executors for the nodes
  - [ ] Define the basic schemas for the forms, start basic, inputs(text) and selects
- [ ] (Feat) Create the three view screen for input | config | output
  - [ ] Ability to execute the workflow from the previous steps to get the input for the node (like n8n)
- [ ] (Feat) Create the current execution view to inspect the steps and see details about them
- [ ] (Feat) Create the most relevant nodes for now
  - [ ] Manual trigger
  - [ ] Http
  - [ ] Wait
  - [ ] Switch (Match/Default)
  - [ ] Do nothing
  - [ ] End?
- [ ] (Fix) Prevent edges duplication (validation)

- [ ] (Feat) Query the general status of the workflow to display in the canvas
- [ ] (Feat?) Query each step to zoom in into the response inside a modal or something?
- [ ] (Feat) Execute one node in isolation
- [ ] (Fix) Disble the `Run workflow` button when it's executting to prevent accidental duplication when triggering manually.

### Considering

- [ ] (Perf:freeze) Only send the node position update when the user releases the node, now I'm sending every reposition update hammering the DB.
  - [ ] Maybe not! This is cool for real time collaboration if that's something I want to add

### Ideas

- Parallelisation node or setting
- (Grouping) Instead of adding sub-workflows, the ability to collapse a set of nodes in order to have the same experience but with one graph, or being able to focus on one part of the graph only or something like that, but having also the ability to view the full picture
  - Collapse one "three" into one visual node that contains the rest

### Showcase ideas

- For the grouping, maybe having a data cleaning process of some nodes, 2 or 3 for example, and creating a group to reduce cognitive load would be an amazing presentation of grouping. grouping != collapsing, like you can collapse entire branches, but grouping it's different, you usually want to group a series of nodes in the same branch to be able to condense logically some step. grouping should have both handles, but collapsing no, if you want to edit the three you're collapsing you need to open it, but with grouping, you actually want to say: here is my new node, inside this there is something happening, today it's two thing maybe tomorrow four, what I care about it's that the outout of the group it's the output from the last node in the group, that's it, and the first input it's the input that the first node in the group takes, so the handles of the group node are left: input of the first, right: output of the last.

### Execution Model

Workflows are executed as directed graphs with explicit control-flow constructs.
A regular node may have only one outgoing edge. To branch, you must use a Parallel (fan-out) node, which creates multiple isolated branches that run in parallel by default. No cross-branch edges are allowed. Branches may reconverge only through an explicit Join/Merge node, which defines synchronization semantics (All / First / N-of-M / quorum+timeout) and data semantics (concat / zip / key-join / reducer). This guarantees clear intent, predictable execution, and safe parallelism. If your logic is strictly linear, use a single chain; if you need independent concerns, distinct policies, or future scalability, use Parallel + Merge. Loops and retries must be modeled with dedicated components, not implicit cycles, ensuring workflows remain understandable, auditable, and safe.
