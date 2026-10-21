# FRAME — MASTER PRODUCT REQUIREMENTS & ENGINEERING SPECIFICATION

## 1. PRODUCT OVERVIEW

### Product name
Frame

### Product category
Browser-based visual website builder.

### Product tagline
Build visually. Think structurally.

### Product vision
Frame is a polished, browser-based visual website editor that allows users to create responsive web pages by assembling components on a canvas, configuring their properties through a visual inspector, organizing their structure through a component tree, and previewing their designs across different screen sizes.

The application should combine the usability of a visual design tool with the underlying concepts of a frontend development environment.

Users should be able to build websites without manually writing every line of code, while the internal architecture remains structured, extensible, and technically sound.

### Primary objective
Build a functional visual editor that supports the complete workflow:

1. Create or open a website project.
2. Create or select a page.
3. Add components to a page.
4. Arrange components using drag-and-drop.
5. Inspect and modify component properties.
6. Organize nested components through a layer tree.
7. Change layout, typography, spacing, colors, and other styles.
8. Undo and redo editing operations.
9. Preview pages at different viewport widths.
10. Save projects and reopen them without losing their structure.
11. Export a standalone, functional website.

The application must be genuinely functional. Buttons must perform their advertised actions. Editing a property must change the canvas. Dragging a component must update the document structure. Saving and reloading must preserve the design.

### Product positioning
Frame is a desktop-first creative development tool for developers, students, designers, and people who want to construct web pages visually.

It is not initially intended to compete with every feature of Webflow, Framer, or Figma. Instead, it should deliver a carefully scoped but technically sophisticated subset of a professional visual website builder.

### Core product principles

- Visual feedback should be immediate.
- The document structure must remain predictable.
- Every supported editing operation must be reversible.
- The canvas, component tree, and properties inspector must always represent the same document state.
- User projects must be serializable and portable.
- Components must have valid, explicit properties and styles.
- The interface must support keyboard accessibility.
- Complex features must be introduced incrementally.
- No critical feature should depend on hardcoded demo data after its implementation phase.
- The application must remain usable when the project contains many components.

---

## 2. TARGET USERS AND PRIMARY USE CASES

### User type A: Beginner website creator
Wants to assemble a landing page using ready-made components without understanding every CSS property.

Needs:
- An intuitive component library.
- Simple property controls.
- Clear visual feedback.
- Responsive previews.
- Useful empty states and onboarding.

### User type B: Frontend developer
Wants to prototype pages quickly and understand the generated structure.

Needs:
- A predictable component tree.
- Precise layout and style controls.
- Keyboard shortcuts.
- Undo and redo.
- Reusable components.
- Clean exported source code.

### User type C: Designer
Wants to arrange sections, refine spacing, establish typography, and preview layouts across devices.

Needs:
- A visually polished canvas.
- Clear selection outlines.
- Layer management.
- Responsive settings.
- Reusable design tokens.
- Easy component duplication and organization.

### Primary use case
A user opens Frame, creates a project called "Portfolio Website", adds a navigation bar, hero section, text, image, buttons, and a footer, adjusts the styles, previews the page on desktop and mobile widths, saves the project, and exports the resulting website.

### Secondary use cases
- Reopen and continue editing a saved project.
- Duplicate existing components.
- Reorder components through the canvas or layer tree.
- Create multiple pages in one project.
- Copy and paste components.
- Create reusable components.
- Customize responsive styles.
- Export a website that functions independently of the editor.

---

## 3. TECHNOLOGY STACK

Use the following stack unless an existing repository imposes a strong technical constraint. Inspect the repository before changing its configuration.

### Frontend
- React.
- TypeScript in strict mode.
- Vite.
- Tailwind CSS.
- A consistent accessible component system, preferably shadcn/ui where suitable.
- Lucide React for icons.
- Zustand for centralized editor state.
- Zod for runtime validation of serialized documents and imported projects.
- dnd-kit for drag-and-drop interactions, using compatible packages and APIs.
- React Hook Form for forms where appropriate.
- Vitest for unit and integration tests.
- React Testing Library for component behavior tests.
- Playwright for end-to-end tests.

Use the current stable, mutually compatible versions available when the project is initialized. Do not blindly copy outdated package APIs from tutorials.

### Routing
Use React Router if routing becomes necessary. The initial application can use a small number of explicit routes:

- `/` — dashboard.
- `/editor/:projectId` — visual editor.
- `/preview/:projectId/:pageId` — preview.

Handle missing projects and pages gracefully.

### Persistence
Initial implementation:
- IndexedDB for local project persistence.
- A small, well-defined repository abstraction around all persistence operations.
- Optional localStorage for lightweight preferences only, such as theme and panel visibility.

Use a maintained IndexedDB wrapper such as Dexie if appropriate.

Do not store large project documents, image blobs, or all editing history in localStorage.

### Export
Generate a standalone website using a dedicated export module.

For the first export implementation, generate a small React and CSS website that can run independently of Frame. Later, add a static HTML/CSS export if the architecture supports it cleanly.

### Backend
No remote backend is required for the first complete version.

The first version must work locally without requiring:
- User registration.
- An API key.
- A paid service.
- A database server.
- An external AI service.

Design persistence and project operations behind interfaces so remote synchronization or cloud storage can be added later.

### Development tooling
Include:
- ESLint.
- Prettier.
- TypeScript checks.
- Environment variable validation if environment variables are introduced.
- npm scripts for development, testing, linting, type checking, and production builds.

---

## 4. PRODUCT SCOPE AND RELEASE PHASES

The project is advanced but must remain achievable. Build it as a sequence of complete, testable releases.

### Release 1: Functional visual editor
Required:
- Dashboard.
- Project creation and opening.
- Page creation and selection.
- Editor shell.
- Component library.
- Drag-and-drop.
- Component selection.
- Properties inspector.
- Component tree.
- Core styling controls.
- Undo and redo.
- Save and reload.
- Desktop and mobile viewport previews.
- Basic preview mode.
- Basic export.

### Release 2: Professional editing experience
Add:
- Copy and paste.
- Duplicate.
- Multi-select where practical.
- Keyboard shortcuts.
- Searchable component library.
- Better alignment and spacing tools.
- Responsive breakpoint-specific styles.
- Design tokens.
- Component locking and visibility.
- Context menus.
- Autosave indicators.
- Improved empty states and onboarding.

### Release 3: Advanced document capabilities
Add:
- Reusable component definitions and instances.
- Multiple pages with navigation links.
- Asset manager.
- Richer text editing.
- Custom component presets.
- Import and export of Frame project files.
- More robust responsive controls.
- Better export validation.

### Release 4: Engineering polish
Add:
- Large-document performance optimization.
- Virtualized layer lists if necessary.
- Comprehensive tests.
- Keyboard accessibility audit.
- Error recovery.
- Project schema migrations.
- Production deployment.
- Documentation and demo project.

Do not start a later release while the current release contains broken critical workflows.

---

## 5. APPLICATION INFORMATION ARCHITECTURE

Frame has two primary application areas.

### A. Dashboard

Route: `/`

Responsibilities:
- Show the user's saved projects.
- Create a project.
- Open a project.
- Rename a project.
- Duplicate a project.
- Delete a project with confirmation.
- Display the last modified time.
- Show a helpful empty state.
- Provide access to settings and appearance preferences.

### B. Editor

Route: `/editor/:projectId`

Responsibilities:
- Load the selected project.
- Manage page selection.
- Display the component library.
- Render the editable canvas.
- Display the component tree.
- Display the properties inspector.
- Manage selection, editing operations, and document history.
- Save changes.
- Open preview mode.
- Export the project.
- Recover gracefully from invalid or missing data.

### C. Preview

Route: `/preview/:projectId/:pageId`

Responsibilities:
- Render the selected page without editor controls.
- Support viewport sizing.
- Allow navigation between pages.
- Provide a return-to-editor action.
- Reflect saved document content.
- Never expose editor-only controls in the rendered page.

Preview rendering and exported rendering should share the same component interpretation and style semantics wherever practical.

---

## 6. DASHBOARD UI/UX SPECIFICATION

### Layout

Create a polished, desktop-first dashboard.

#### Top navigation
Include:
- Frame wordmark and a simple geometric logo.
- Current workspace or local workspace label.
- Theme toggle.
- Settings entry point.
- Primary "New project" button.

The header should be compact, with clear visual hierarchy.

#### Main content
Include:
- Greeting or concise dashboard heading.
- A short explanatory subtitle.
- Project search field.
- Sort control.
- Grid/list view toggle if practical.
- Projects grid.
- Empty state when no projects exist.

#### Project cards
Each project card should display:
- A preview thumbnail or generated project thumbnail.
- Project name.
- Number of pages.
- Last modified time.
- A contextual menu.

Contextual menu actions:
- Open.
- Rename.
- Duplicate.
- Delete.

Clicking the main card opens the project.

Use a clear distinction between opening a project and opening its contextual menu.

#### Create project dialog
Fields:
- Project name, required.
- Optional project description.
- Optional starter template.

Starter options:
- Blank project.
- Landing page starter.
- Portfolio starter.

If a starter template is not fully implemented, do not show it as an apparently functional option. Initially, Blank project is sufficient.

On submission:
1. Validate the name.
2. Generate a stable project ID.
3. Create an initial page.
4. Initialize default document settings.
5. Persist the project.
6. Navigate to the editor.

#### Empty state
When no projects exist:
- Show a concise headline.
- Explain what the user can build.
- Provide a prominent create-project action.
- Optionally show a small illustrative composition made from native UI elements.

Do not fill the empty dashboard with fake projects.

#### Dashboard behavior
- Search should filter projects by name.
- Sorting should support recently modified and alphabetical order.
- Project deletion must require confirmation.
- Duplicate must create a distinct project ID and distinct page/component IDs.
- Errors must be displayed without silently discarding existing data.

---

## 7. EDITOR LAYOUT AND VISUAL DESIGN

The editor is the core of Frame and must receive the most design attention.

### General layout

Use a full-viewport application shell with the following regions:

1. Top application toolbar.
2. Left sidebar containing component library and layer tree.
3. Central canvas workspace.
4. Right properties inspector.
5. Optional bottom status bar.

The layout must fit a typical laptop screen, including a viewport approximately 1366 × 768.

Avoid unnecessary page scrolling in the main editor. Scrolling should occur inside the canvas or individual panels where appropriate.

### Initial desktop dimensions

Treat these as starting values, not rigid rules:

- Top toolbar: approximately 56–64 px high.
- Left sidebar: approximately 250–290 px wide.
- Right inspector: approximately 280–320 px wide.
- Bottom status bar: approximately 24–30 px high.
- Canvas area: flexible remaining width and height.

Both sidebars should be resizable within reasonable minimum and maximum widths.

### Panel behavior
- Left and right sidebars can collapse.
- Panel widths should be stored in user preferences.
- The canvas must expand when either sidebar is collapsed.
- Resizing must not distort the page's actual viewport dimensions.
- Panel transitions should be subtle and should not interfere with drag-and-drop.

### Visual direction

The interface should feel like a premium developer tool: restrained, clean, precise, and professional.

Use:
- Neutral backgrounds.
- Fine borders.
- Clear spacing.
- Compact typography in editor chrome.
- Consistent icon sizes.
- Subtle hover states.
- A clear selection accent.
- Restrained shadows.
- Consistent corner radii.

Avoid:
- Excessive gradients.
- Oversized dashboard cards.
- Excessive glassmorphism.
- Too many accent colors.
- Large decorative elements inside the editor.
- Unnecessary animations.
- Inconsistent button styles.

Use a neutral palette with a single restrained accent color for selected elements and primary actions.

The canvas should visually contrast with the surrounding editor chrome so the user can distinguish the actual website from the editing interface.

### Theme support
Implement light and dark themes.

The theme should affect:
- Dashboard.
- Toolbar.
- Sidebars.
- Menus and dialogs.
- Inspector controls.
- Canvas surrounding area.
- Tooltips and notifications.

Changing the editor theme must not automatically change the page being designed. Page background color is a document property, separate from editor appearance.

---

## 8. TOP TOOLBAR SPECIFICATION

The toolbar contains global project and editing actions.

### Left section
- Frame logo.
- Project name.
- Save status indicator.

Project name behavior:
- Click or activate the name to rename inline.
- Enter commits the new name.
- Escape cancels editing.
- Empty names are rejected.
- Saving a name must update the dashboard.

### Center section
Include:
- Undo.
- Redo.
- Current page selector.
- Viewport presets.
- Zoom controls where practical.

Undo and redo buttons must display disabled states when no operation is available.

### Right section
Include:
- Preview.
- Export.
- Optional keyboard shortcuts/help menu.

Export should open an export dialog instead of silently starting a download.

### Save status
Display clear states:
- Saved.
- Saving.
- Unsaved changes.
- Save failed.

Never claim a project has been saved until the persistence operation succeeds.

Use a debounced autosave for ordinary editing, with a reasonable delay such as 500–1000 ms.

Provide a mechanism to flush pending changes before navigation or export. Browser shutdown reliability cannot be guaranteed, so do not rely exclusively on an unload event to save data.

---

## 9. LEFT SIDEBAR: COMPONENT LIBRARY AND LAYERS

The left sidebar contains two primary tabs:

- Components.
- Layers.

A search field appears in the Components tab.

### A. Components tab

Display available components in grouped sections.

Groups:
1. Layout.
2. Text.
3. Media.
4. Interactive.
5. Structure.

Each component item includes:
- Icon.
- Human-readable name.
- Optional short description or tooltip.
- Drag affordance where appropriate.

Selecting or clicking a component should insert it into the current valid insertion location. If no specific parent is selected, use the page root.

Dragging a component onto the canvas should create it at the drop location or insert it at the nearest valid structural position.

Dragging a component onto a layer-tree parent should insert it as a child if that parent accepts children.

### B. Initial component registry

Implement a central, typed component registry. Do not hardcode independent component definitions throughout the UI.

Every registered component should declare:
- Stable component type.
- Display name.
- Category.
- Icon.
- Default properties.
- Default styles.
- Whether it accepts children.
- Whether it can be nested.
- Allowed child types or structural constraints.
- Default child behavior.
- Property schema.
- Export renderer.
- Editor renderer.
- Whether it can be duplicated, deleted, or locked.

Use the registry to drive the component library and insertion logic.

#### Layout components

**Section**
- Semantic section container.
- Accepts child components.
- Configurable background, padding, width, minimum height, and alignment.

**Container**
- Groups content.
- Configurable width, maximum width, padding, alignment, and gap.

**Stack**
- Arranges children in a row or column.
- Supports gap, alignment, justification, wrapping, and direction.

**Grid**
- Arranges children in columns and rows.
- Supports column count, gap, alignment, and responsive adjustments.

**Spacer**
- Adds intentional spacing between siblings.
- Supports configurable dimensions.
- Must not be treated as an arbitrary interactive component.

#### Text components

**Heading**
- Supports heading levels H1–H6.
- Editable text.
- Typography controls.
- Text alignment and color.

**Paragraph**
- Editable text.
- Typography controls.
- Line height and text alignment.

**Text**
- General text element with a defined rendering behavior.

**Rich Text**
- Defer until the basic editor is stable.
- If introduced, define an explicit supported formatting model rather than injecting arbitrary HTML.

#### Media components

**Image**
- Select or upload an image.
- Configure alt text.
- Configure object fit, object position, width, height, and border radius.
- Handle missing assets gracefully.

**Video**
- Defer until a safe, predictable media source model exists.

#### Interactive components

**Button**
- Editable label.
- Link destination.
- Variant.
- Size.
- Alignment.
- Background and text colors.
- Border radius.
- Padding.

**Link**
- Editable label and destination.
- Target behavior where supported.
- Styling controls.

#### Structural components

**Divider**
- Thickness.
- Color.
- Width.
- Margins.

**Navbar**
- A preset structure built from supported primitives, or a specialized component with a clearly defined schema.

**Hero**
- A preset composition that can be decomposed into editable child components.

**Footer**
- A preset composition using editable text and links.

Complex presets must not become opaque, uneditable blocks. Users should be able to customize their content and styling.

### Insertion defaults
- Every component gets a unique ID.
- Default values must be valid.
- Default child components must also receive unique IDs.
- Insertion must be one atomic undoable operation.
- New components should be selected after insertion.
- The inspector should display the inserted component's settings.

### C. Layers tab

Display the page's component hierarchy as a tree.

Each row includes:
- Expand/collapse control when children exist.
- Component icon.
- Display name.
- Selection state.
- Optional visibility toggle.
- Optional lock indicator.

Actions:
- Select a component.
- Expand or collapse a branch.
- Rename a layer.
- Reorder siblings.
- Move a component into a compatible parent.
- Duplicate.
- Delete.
- Hide/show.
- Lock/unlock.

Layer-tree selection and canvas selection must remain synchronized.

When a component is selected on the canvas, its layer row must become selected and scroll into view if necessary.

When a layer is selected, the corresponding component must be selected on the canvas.

### Layer ordering
The order of siblings in the document tree determines their normal rendering order.

Dragging a row must support:
- Moving before another sibling.
- Moving after another sibling.
- Moving inside a valid parent.
- Clear visual drop indicators.
- Invalid-drop prevention.

Do not allow a component to be moved into itself or one of its descendants.

### Visibility and locking
Visibility and locking are editor metadata, not ordinary user-facing CSS properties.

Hidden components should not appear in the design canvas or exported website. Their visibility controls must remain accessible through the layer tree.

Locked components should remain visible but cannot be selected or modified through ordinary canvas interactions. Provide a way to unlock them through the layer tree.

If a locked or hidden component is selected before the state changes, update selection safely.

---

## 10. CENTRAL CANVAS WORKSPACE

The canvas is the main editing surface.

### Canvas background
- Use a neutral editor background.
- Center the website viewport by default.
- Provide a visible page boundary.
- Use a subtle shadow or border around the viewport.
- Keep editor controls outside the exported page.

### Viewport sizing
Provide presets:
- Desktop: 1440 px.
- Laptop: 1280 px.
- Tablet: 768 px.
- Mobile: 390 px.

Allow a custom viewport width.

These values represent preview widths, not mandatory device specifications.

The canvas should render the document at the selected viewport width while maintaining its actual CSS layout behavior.

Do not simply scale a desktop screenshot to imitate mobile responsiveness.

### Zoom
Support:
- Zoom in.
- Zoom out.
- Reset zoom.
- Fit page to workspace if practical.

Zoom must affect the editor presentation, not the document's CSS dimensions.

### Canvas interactions
- Click a component to select it.
- Show an outline around the selected component.
- Show a small selection label when useful.
- Display selection handles for supported resizing operations.
- Allow supported components to be dragged or repositioned through explicit editor interactions.
- Preserve text editing when the user is interacting with editable text.
- Provide visible insertion indicators when dragging new components.

### Selection behavior
- A single click selects a component.
- Clicking a nested child selects the child rather than its parent.
- Provide a reliable way to select parents, such as a breadcrumb, layer tree, or keyboard shortcut.
- Clicking empty canvas space clears selection.
- Clicking the editor chrome must not unintentionally clear selection.

### Selection outline
Use an accent border that is visible in both light and dark page designs.

Do not alter the actual document style to display the outline.

Editor overlays must be separate from exported page markup.

### Hover behavior
Hovering over an unselected component may display a subtle outline.

Hover outlines must not interfere with clicks, links, text editing, or drag operations.

### Empty canvas
When the page has no components:
- Display a concise message.
- Explain that components can be added from the left sidebar.
- Provide a primary action to insert a section or starter composition.
- Ensure dropping a component onto the empty canvas works.

### Drag-and-drop behavior
Support:
- Dragging from the component library to the canvas.
- Reordering existing components.
- Moving components between compatible containers.
- Reordering through the layer tree.
- A visible insertion line or drop zone.
- Auto-scrolling when dragging near scroll boundaries, if reliable.

Drag operations must not trigger accidental text selection or page navigation.

Prevent dropping invalid component types into incompatible parents.

If the user cancels a drag, the document must remain unchanged.

### Important implementation constraint
Do not implement free-form absolute positioning as the default layout model.

The initial editor should use a structured document tree and CSS layouts such as flexbox and grid. Absolute positioning may be added later as an explicit, separate positioning mode.

This makes the editor much easier to reason about, more responsive, and more useful for generating real websites.

---

## 11. RIGHT SIDEBAR: PROPERTIES INSPECTOR

The inspector changes according to the current selection.

### Inspector header
Display:
- Component icon.
- Component name.
- Editable layer name.
- Optional component type.
- More-actions menu.

The inspector should use collapsible sections.

Initial sections:
1. Content.
2. Layout.
3. Typography.
4. Appearance.
5. Spacing.
6. Advanced.

Only show sections relevant to the selected component.

Avoid exposing every CSS property in the first release.

### A. Content section

Examples:
- Heading text.
- Paragraph text.
- Button label.
- Link destination.
- Image source.
- Image alt text.
- Heading level.
- Section semantic type where applicable.

Text fields must update the canvas immediately or after a small, controlled debounce.

Do not lose text input focus after each keystroke.

### B. Layout section

Support controls for:
- Display mode.
- Flex direction.
- Horizontal alignment.
- Vertical alignment.
- Justification.
- Gap.
- Wrapping.
- Width.
- Height.
- Minimum width and height.
- Maximum width and height.
- Grid column count where applicable.
- Overflow behavior where useful.

Represent layout settings with visual controls where possible.

For example, flex alignment should have buttons or a compact alignment selector rather than requiring users to type CSS values.

### C. Typography section

Applicable to text-based components:
- Font family from a curated list.
- Font size.
- Font weight.
- Line height.
- Letter spacing.
- Text alignment.
- Text color.
- Text decoration.
- Text transformation.

Use numeric controls with units and sensible ranges.

Avoid unnecessary external font requests in the initial version.

### D. Appearance section

Support:
- Background color.
- Text color where applicable.
- Border color.
- Border width.
- Border style.
- Border radius.
- Opacity.
- Box shadow using a curated set of presets initially.

Color controls should include:
- A color picker.
- A text input for hexadecimal values.
- Validation.
- A reset-to-default action where useful.

Never apply malformed colors to the document.

### E. Spacing section

Support:
- Padding top, right, bottom, and left.
- Margin top, right, bottom, and left.
- Linked or unlinked side values.
- Unit selection where practical.

Initial units:
- px.
- %.
- rem.

If the internal style model supports only a subset initially, clearly limit the UI to supported values.

Changing a spacing field must update the canvas immediately.

### F. Advanced section

Support:
- HTML element selection where appropriate.
- Stable component ID displayed as read-only.
- CSS class name if supported by the export model.
- Visibility.
- Locking.
- Deletion.
- Resetting supported properties.

Do not expose arbitrary JavaScript execution or arbitrary HTML injection.

### Inspector interaction requirements
- Empty selection shows a helpful prompt.
- Switching selection loads the correct properties.
- Input edits do not accidentally create a separate history entry for every keystroke.
- Related edits should be grouped into coherent undo operations.
- Invalid values must be rejected or normalized.
- Resetting a property restores the component's defined default.
- Deleting a component must update the document, selection, layer tree, and history together.

---

## 12. DOCUMENT MODEL AND COMPONENT ARCHITECTURE

This is the most important architectural decision in the application.

Do not represent the design as a collection of unrelated React elements with independent state.

Represent each page as a serializable document tree. Render the tree through a controlled renderer.

### Required document characteristics
- Stable IDs.
- Explicit component types.
- Serializable properties.
- Serializable style values.
- Ordered children.
- Explicit metadata.
- Runtime validation.
- Versioned schemas.

### Suggested TypeScript model

Use a discriminated union or equivalent strongly typed model.

Conceptually:

type ComponentId = string;
type PageId = string;
type ProjectId = string;

type StyleValue =
  | string
  | number
  | null;

interface FrameNode {
  id: ComponentId;
  type: string;
  name: string;
  props: Record<string, unknown>;
  styles: Record<string, StyleValue>;
  children: FrameNode[];
  editor: {
    hidden: boolean;
    locked: boolean;
  };
}

interface FramePage {
  id: PageId;
  name: string;
  slug: string;
  root: FrameNode;
  settings: {
    title: string;
    backgroundColor: string;
  };
}

interface FrameProject {
  id: ProjectId;
  name: string;
  description?: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  pages: FramePage[];
  assets: FrameAsset[];
  designTokens: FrameDesignTokens;
}

interface FrameAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  alt?: string;
}

interface FrameDesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
}

Treat these definitions as an architectural starting point, not permission to use untyped objects everywhere. Define concrete component-specific property types and validate untrusted data at runtime.

The `root` node represents the page's structural container. It is not a user-selectable component and cannot be deleted.

### Component IDs
Use a reliable ID generator such as `crypto.randomUUID()` where available, with an appropriate fallback if required.

Never reuse IDs when duplicating components.

### Component tree invariants
Enforce:
- IDs are unique within a project.
- Every node type exists in the component registry.
- Child arrays are valid.
- Component properties satisfy their schemas.
- No node can contain itself or an ancestor.
- The root node remains present.
- Children are valid for their parent.
- Node order is deterministic.

### Component registry architecture

Define a registry interface similar to:

interface ComponentDefinition {
  type: string;
  label: string;
  category: string;
  acceptsChildren: boolean;
  createDefaultNode: () => FrameNode;
  validateProps: (props: unknown) => boolean;
  renderEditor: (node: FrameNode) => React.ReactNode;
  renderPreview: (node: FrameNode) => React.ReactNode;
  renderExport: (node: FrameNode) => ExportNode;
}

Refine this interface to fit the actual architecture. Avoid unsafe casts and avoid mixing export generation with ordinary UI rendering.

A registry definition should also specify supported inspector controls, child constraints, default values, and editor metadata.

The same registry should drive:
- The component library.
- Insertion.
- Property validation.
- Canvas rendering.
- Inspector configuration.
- Export behavior.

### Rendering architecture

Implement a recursive document renderer.

Conceptually:

renderNode(node):
1. Resolve the node's registered definition.
2. Validate the node type and relevant data.
3. Resolve its component props and style values.
4. Render the component.
5. Render its children in their stored order if permitted.
6. Add editor overlays only in editor mode.

Separate:
- Editor rendering.
- Preview rendering.
- Export rendering.

Do not render unknown component types as arbitrary HTML. Show a controlled error or placeholder and preserve the original data so a recoverable import error does not destroy the project.

---

## 13. STATE MANAGEMENT

Use Zustand for the editor's central state, but keep the state model modular.

Do not place the entire application in one enormous store or one component.

Separate conceptual concerns.

### A. Project state
Responsible for:
- Current project metadata.
- Pages.
- Current page ID.
- Asset references.
- Project loading and saving status.

### B. Document state
Responsible for:
- Component tree.
- Insertion.
- Deletion.
- Reordering.
- Duplication.
- Property updates.
- Style updates.
- Tree traversal and validation.

### C. Selection state
Responsible for:
- Selected component IDs.
- Primary selected component.
- Selection clearing.
- Parent and child selection navigation.

### D. History state
Responsible for:
- Undo.
- Redo.
- History boundaries.
- Operation grouping.
- History limits.

### E. Editor UI state
Responsible for:
- Active sidebar tab.
- Collapsed panels.
- Panel dimensions.
- Current viewport preset.
- Zoom.
- Open menus and dialogs.
- Inspector sections.
- Editor theme.

### State rules
- Do not duplicate document truth across unrelated stores.
- Derive values whenever practical.
- Use selectors to limit unnecessary rerenders.
- Avoid broad subscriptions that rerender the entire editor after every property change.
- Keep ephemeral UI state separate from serializable project data.
- Do not persist selection outlines, hover states, open menus, or other transient editor UI state inside the website document.

### Atomic document operations
Expose a controlled command layer rather than letting arbitrary components mutate the tree directly.

Examples:
- `insertNode`
- `deleteNode`
- `moveNode`
- `duplicateNode`
- `renameNode`
- `updateNodeProps`
- `updateNodeStyles`
- `setNodeVisibility`
- `setNodeLocked`
- `updatePageSettings`

Every command should:
1. Validate its inputs.
2. Resolve the target node and parent.
3. Enforce structural constraints.
4. Produce a valid next document.
5. Update history appropriately.
6. Notify the persistence layer that the document is dirty.
7. Preserve or update selection appropriately.

---

## 14. UNDO AND REDO

Undo and redo are essential editor features, not optional toolbar decorations.

### Required behavior
Every meaningful document modification must be reversible.

Examples:
- Insert component.
- Delete component.
- Move component.
- Duplicate component.
- Rename layer.
- Change text.
- Change a style.
- Change a link.
- Change layout settings.
- Change visibility.
- Change page settings.

### History architecture
Implement a history manager that tracks document snapshots or reversible operations.

For the initial version, document snapshots are acceptable if:
- Documents are kept reasonably small.
- Snapshots are immutable.
- History size is limited.
- Text changes are grouped appropriately.
- Performance is measured.

A practical starting point is a bounded history of approximately 50–100 meaningful operations, adjusted based on actual memory use.

### History rules
- A new operation after undo clears the redo branch.
- Undoing an insertion removes the inserted component.
- Redoing it restores the same logical component with the same ID.
- Undoing a deletion restores the deleted subtree.
- Moving a component must preserve its identity.
- Undo and redo must not restore obsolete selection or transient editor UI state unless explicitly designed.
- Saving does not erase history.
- Switching pages must not accidentally apply history to the wrong page.

### Coalescing
Text edits and continuous numeric controls must not flood history.

For example:
- Typing a sentence should become one coherent undo step after an appropriate pause or when editing finishes.
- Dragging a component should create one operation when the drag ends, not one operation per pointer movement.
- Dragging a slider should create a coherent operation rather than dozens of individual entries.

Ensure document state and history cannot become inconsistent.

---

## 15. DRAG-AND-DROP ENGINE

Use dnd-kit or another maintained library that fits the chosen architecture.

Do not use arbitrary DOM mutation to reorder components.

### Component-library drag
When dragging from the component library:
- Create a temporary drag preview.
- Identify valid drop targets.
- Highlight compatible targets.
- Determine the destination parent and index.
- Insert the component on successful drop.
- Select the inserted component.
- Record one history entry.
- Restore the original state if cancelled.

### Existing-node drag
When dragging a component:
- Keep its identity.
- Determine the destination parent and sibling index.
- Validate the move.
- Prevent cyclic structures.
- Display the proposed insertion location.
- Commit the move on drop.
- Restore the previous order if cancelled.

### Drop-target resolution
Implement a deliberate strategy for:
- Before a sibling.
- After a sibling.
- Inside a container.
- Empty containers.
- Empty pages.
- Nested components.
- Invalid parents.

Do not rely exclusively on raw pointer coordinates to infer the tree structure. Use explicit drop zones and component metadata.

### Dragging and text editing
- Drag handles should be available where needed.
- Text selection must still work.
- Inputs and buttons inside the editor must remain interactive.
- Nested drag contexts must not produce ambiguous drop targets.
- Keyboard users must have alternative methods to reorder components.

---

## 16. RESPONSIVE DESIGN SYSTEM

Responsive editing must affect the generated website, not just the editor's preview dimensions.

### Initial viewport presets
- Desktop: 1440 px.
- Laptop: 1280 px.
- Tablet: 768 px.
- Mobile: 390 px.

### Responsive breakpoints
Use a consistent initial breakpoint system, for example:
- Base/mobile: below 640 px.
- Tablet: 640–1023 px.
- Desktop: 1024 px and above.

Document the chosen breakpoints and use the same values in the editor, preview, and exporter.

### Responsive property model
Support base styles and optional breakpoint-specific overrides.

For example, a grid may have:
- Two columns by default.
- One column on mobile.
- Three columns on desktop.

### Inspector responsive workflow
The user selects a viewport preset and edits properties.

Define the behavior clearly:
- Base values apply unless an override exists.
- Editing at a specific breakpoint can create an override for that breakpoint.
- The UI must indicate when the displayed value is inherited.
- Resetting an override removes it and restores inheritance.
- Switching viewports must not silently overwrite unrelated breakpoint values.

### Responsive rendering
Generate valid responsive CSS using media queries or an equivalent clear strategy.

Do not use JavaScript to resize components unnecessarily when CSS can handle the layout.

### Minimum responsive requirements
- No forced horizontal page overflow at common widths.
- Text remains readable.
- Images respect their containers.
- Grids and stacks respond predictably.
- Buttons remain usable on touch-sized viewports.
- Navigation presets have a defined mobile behavior.

---

## 17. STYLE MODEL AND CSS GENERATION

Avoid storing arbitrary CSS text as the primary representation of every component's styling.

Use structured style objects that can be validated and serialized.

### Supported CSS properties initially
Layout:
- display.
- flexDirection.
- alignItems.
- justifyContent.
- flexWrap.
- gap.
- width.
- height.
- minWidth.
- minHeight.
- maxWidth.
- maxHeight.
- gridTemplateColumns.
- overflow.

Spacing:
- padding.
- paddingTop.
- paddingRight.
- paddingBottom.
- paddingLeft.
- margin.
- marginTop.
- marginRight.
- marginBottom.
- marginLeft.

Typography:
- fontFamily.
- fontSize.
- fontWeight.
- lineHeight.
- letterSpacing.
- textAlign.
- textDecoration.
- textTransform.

Appearance:
- color.
- backgroundColor.
- borderColor.
- borderWidth.
- borderStyle.
- borderRadius.
- opacity.
- boxShadow.

Do not expose properties that have no defined renderer or exporter behavior.

### Style validation
- Reject malformed values.
- Normalize units consistently.
- Prevent unsupported JavaScript URLs or executable content.
- Restrict numeric values where necessary.
- Define how `null` removes a style override.
- Preserve responsive overrides independently.

### CSS output
The exporter must generate deterministic styles.

Identical documents should produce equivalent output, ignoring intentionally generated metadata.

Do not generate a new random class name every time the export runs if stable output can be produced.

---

## 18. RICH TEXT EDITING

The initial editor should provide simple, reliable text editing.

### First release
Support:
- Editing headings.
- Editing paragraphs.
- Editing button labels.
- Editing link labels.
- Basic line breaks if supported by the text model.

Do not use `contentEditable` indiscriminately across every component.

If using contentEditable:
- Define its interaction boundaries.
- Prevent React state from constantly overwriting the user's caret.
- Commit changes at appropriate times.
- Handle paste safely.
- Preserve undo behavior.
- Avoid accepting arbitrary unsafe HTML.

### Later release
A richer text editor may support:
- Bold.
- Italic.
- Underline.
- Links.
- Lists.
- Inline color.
- Text alignment.

Use a structured rich-text representation or a maintained editor library. Do not store unrestricted HTML without sanitization and a defined export contract.

---

## 19. ASSET MANAGEMENT

Images must be usable without requiring a third-party image-hosting service.

### Initial image workflow
- Upload an image from the local filesystem.
- Validate file type and size.
- Store the image in IndexedDB or another appropriate local asset store.
- Create a stable asset record.
- Display the image in the editor.
- Allow users to replace or remove it.
- Allow users to edit alt text.
- Preserve asset references when saving and reopening.

### Asset manager
Later, provide a modal or panel with:
- Asset thumbnails.
- File names.
- File types.
- Image dimensions where available.
- Search.
- Upload.
- Insert.
- Delete when unused.

### Asset validation
- Support a defined set of image formats.
- Provide clear error messages for unsupported files.
- Set a reasonable configurable upload limit.
- Avoid loading unnecessarily large images into the canvas.
- Use safe object URL lifecycle management when applicable.
- Do not delete an asset that is still referenced by a document unless the user confirms the consequences.

### Export behavior
Images must be included in the exported project or copied into its asset directory.

Do not export references to temporary blob URLs.

Use stable relative paths for packaged assets where possible.

---

## 20. MULTI-PAGE PROJECTS

A project may contain multiple pages.

### Page management
Support:
- Create page.
- Rename page.
- Duplicate page.
- Delete page.
- Select page.
- Change page order.
- Configure page title.
- Configure page background.
- Configure page slug.

Each page has:
- A stable page ID.
- A name.
- A slug.
- A root component.
- Page settings.

### Page deletion
- Require confirmation.
- Prevent deleting the only remaining page unless the product first creates a replacement.
- Update current page selection safely.
- Handle links to deleted pages gracefully.

### Navigation
Allow links and buttons to target:
- External URLs.
- Other pages within the current project.
- Supported section anchors, if implemented.

Validate destinations and distinguish internal routes from external URLs.

### Export
Generate appropriate routes or static files for each page.

Ensure internal links continue to work in the exported website.

---

## 21. REUSABLE COMPONENTS

Reusable components are a later-stage feature and must have a clear data model.

### Definition
A reusable component is a named component definition that can be instantiated in multiple places.

Examples:
- Navigation bar.
- Footer.
- Pricing card.
- Testimonial card.
- Repeated CTA section.

### Required behavior
- Create a reusable definition from a supported selection.
- Name the definition.
- Insert instances elsewhere.
- Edit the shared definition.
- Reflect shared changes in all instances.
- Support instance-specific properties only where explicitly permitted.
- Delete a definition with a clear strategy for existing instances.

### Important distinction
Do not implement reusable components as ordinary duplicated trees and label them reusable.

The architecture must distinguish:
- Component definition.
- Component instance.
- Shared definition properties.
- Instance-specific overrides.

If full reusable-component synchronization cannot be implemented safely in the first release, defer it instead of creating a misleading partial implementation.

---

## 22. PREVIEW MODE

Preview mode renders the website without editor controls.

### Required behavior
- Hide editor sidebars and toolbar.
- Render the selected page.
- Support the chosen viewport width.
- Preserve actual responsive CSS behavior.
- Allow internal navigation between project pages.
- Provide an obvious return-to-editor control.
- Show a controlled fallback for invalid nodes or missing assets.

### Preview fidelity
Preview and export should use the same component definitions and style semantics wherever possible.

Avoid implementing two unrelated renderers that produce different layouts.

### Interaction behavior
In preview:
- Links should navigate.
- Buttons should behave according to their configured action.
- Responsive navigation should work if implemented.
- Editing controls must not appear.
- Selection outlines and drag overlays must not appear.

Preview is not an exported website. It still runs inside Frame's application environment.

---

## 23. WEBSITE EXPORT

Export is a core product feature and must generate usable output.

### Initial export dialog
Include:
- Project name.
- Export format.
- Destination behavior.
- Validation status.
- Export button.
- Cancel button.

Initial supported format:
- Downloadable ZIP containing a standalone React/Vite website and required assets.

### Export package contents
Generate a structure similar to:

exported-site/
  package.json
  index.html
  src/
    main.tsx
    App.tsx
    pages/
    components/
    styles/
  public/
    assets/
  README.md

The precise generated structure may differ, but it must be documented and consistent.

### Export requirements
- Generated code must not import Frame's editor.
- Editor-only overlays must not appear.
- The project must build independently.
- All supported component types must render.
- Styles must be preserved.
- Images must be included.
- Internal navigation must work.
- External links must behave appropriately.
- The export must not require Frame to be running.
- The exported package must contain setup instructions.

### Export validation
Before downloading:
- Validate the project schema.
- Check for unsupported component types.
- Check for missing assets.
- Check for invalid URLs or styles.
- Report any issues that would prevent reliable export.

Do not silently replace unsupported components with unrelated placeholders in the final export.

### Security
- Escape text correctly.
- Do not execute user-provided JavaScript.
- Sanitize or reject unsafe URL schemes.
- Avoid arbitrary HTML injection.
- Treat imported project files as untrusted input.
- Do not allow project content to execute code in the editor.

---

## 24. PROJECT IMPORT AND RECOVERY

Add project import after the primary save/load workflow is reliable.

### Project format
Use a versioned project JSON format and include assets in a packaged archive when applicable.

### Import workflow
1. User selects a project file.
2. Validate file type and size.
3. Parse the archive or JSON.
4. Validate schema version.
5. Validate project structure.
6. Validate IDs and asset references.
7. Report recoverable issues.
8. Ask for confirmation before saving the imported project.
9. Generate a new project ID when importing as a copy.
10. Preserve the source project if import fails.

### Recovery requirements
- Corrupt projects must not crash the dashboard.
- Unsupported schema versions must produce useful errors.
- Missing assets must be reported.
- Migrations must be explicit and tested.
- Failed imports must not overwrite existing projects.

---

## 25. KEYBOARD SHORTCUTS

Implement shortcuts incrementally and show them in tooltips or a shortcuts dialog.

Recommended initial shortcuts:

- Ctrl/Cmd + Z: Undo.
- Ctrl/Cmd + Shift + Z: Redo.
- Ctrl + Y: Redo on Windows where appropriate.
- Ctrl/Cmd + C: Copy selected component.
- Ctrl/Cmd + V: Paste copied component.
- Ctrl/Cmd + D: Duplicate selected component.
- Delete/Backspace: Delete selected component when focus is not inside a text field.
- Escape: Cancel drag, close transient UI, or clear selection according to context.
- Enter: Commit inline rename.
- Escape during inline rename: Cancel rename.
- Arrow keys: Navigate selection or reorder only where the interaction is unambiguous.

### Shortcut safety
- Do not intercept normal typing.
- Do not intercept browser shortcuts unnecessarily.
- Respect operating-system conventions.
- Handle Mac and Windows modifier keys.
- Ignore editing shortcuts when focus is inside a text input or content-editing surface unless the shortcut is intentionally supported there.
- Provide a visible way to perform important actions without shortcuts.

---

## 26. CONTEXT MENUS AND SECONDARY ACTIONS

Add context menus to:
- Canvas components.
- Layer-tree rows.
- Project cards.
- Pages where appropriate.

Component actions:
- Select.
- Rename.
- Duplicate.
- Copy.
- Delete.
- Hide/show.
- Lock/unlock.
- Move to parent where practical.

Context menus must:
- Open at a sensible position.
- Avoid overflowing the viewport.
- Close on Escape.
- Close on outside click.
- Support keyboard navigation where practical.
- Not trigger the underlying component's click action accidentally.

Destructive actions should be clearly labeled.

---

## 27. SEARCH AND COMMAND DISCOVERY

The component library should support searching by component name.

Later, introduce a command palette with a shortcut such as Ctrl/Cmd + K.

Possible commands:
- Insert component.
- Create page.
- Open preview.
- Export project.
- Toggle panels.
- Switch viewport.
- Undo.
- Redo.

Only expose commands that have been implemented.

Search should have:
- A clear empty state.
- A way to clear the query.
- Keyboard navigation.
- Appropriate focus management.

---

## 28. NOTIFICATIONS, ERRORS, AND EMPTY STATES

A professional application must communicate its state clearly.

### Notifications
Use compact toasts for:
- Project created.
- Project duplicated.
- Project deleted.
- Export completed.
- Recoverable errors.
- Successful import.

Do not use toasts for every ordinary property change.

### Empty states
Design explicit empty states for:
- No projects.
- No pages where applicable.
- Empty canvas.
- No components matching a search.
- Empty asset manager.
- No selected component.
- No exportable content.

### Error states
Handle:
- Missing project.
- Missing page.
- Invalid component.
- Failed persistence.
- Quota exceeded.
- Invalid image.
- Invalid imported project.
- Unsupported export feature.

Errors should explain what happened and, where possible, how to recover.

Never discard unsaved work without warning.

---

## 29. ACCESSIBILITY REQUIREMENTS

Target practical WCAG 2.2 AA compliance for major user workflows.

Requirements:
- Semantic HTML.
- Keyboard-accessible controls.
- Visible focus indicators.
- Accessible labels for icon-only buttons.
- Appropriate dialog focus management.
- Escape handling for dialogs and menus.
- Sufficient text contrast.
- Screen-reader labels for selection and status.
- No interaction that depends exclusively on color.
- Reasonable target sizes for interactive controls.
- Reduced-motion support.
- Alternative keyboard operations for drag-and-drop.

Do not add accessibility attributes mechanically without ensuring they match actual behavior.

---

## 30. PERFORMANCE REQUIREMENTS

The editor must remain responsive as projects become larger.

### Initial performance goals
Treat these as targets to measure rather than guaranteed results:
- Initial dashboard should render quickly on a typical laptop.
- Selection changes should feel immediate.
- Property changes should update the canvas without unnecessary full-editor rerenders.
- Dragging should remain visually responsive.
- Saving should not freeze the interface.
- Large asset uploads should not block ordinary editing.

### Performance strategies
- Use memoization where profiling justifies it.
- Use stable callbacks and selectors.
- Avoid serializing the entire project on every pointer movement.
- Commit drag operations at the end of a drag.
- Debounce autosave.
- Keep history bounded.
- Avoid unnecessary deep cloning.
- Consider structural sharing or immutable update utilities.
- Virtualize large layer trees only when necessary.
- Load thumbnails instead of unnecessarily large images in asset lists.
- Measure before adding complex optimization.

Do not use memoization indiscriminately as a substitute for a sound state architecture.

---

## 31. DATA PERSISTENCE AND AUTOSAVE

Create a persistence abstraction such as:

interface ProjectRepository {
  listProjects(): Promise<FrameProjectSummary[]>;
  getProject(id: ProjectId): Promise<FrameProject | null>;
  createProject(input: CreateProjectInput): Promise<FrameProject>;
  updateProject(project: FrameProject): Promise<void>;
  deleteProject(id: ProjectId): Promise<void>;
  duplicateProject(id: ProjectId): Promise<FrameProject>;
}

Refine the interface as required for asset storage and page-level operations.

### Requirements
- All persistence methods return explicit success or failure.
- Project IDs remain stable.
- Project updates refresh the modified timestamp.
- Asset records and document references remain consistent.
- Save failures are visible.
- Opening a project restores its complete structure.
- Deleting a project handles its owned assets according to a defined cleanup policy.
- Project duplication deep-copies the document and regenerates component IDs.
- IndexedDB schema changes use explicit migrations where necessary.

### Autosave behavior
1. A document command changes the project.
2. Mark the document dirty.
3. Wait for a short debounce interval.
4. Save the latest valid project snapshot.
5. Display the saving state.
6. Display saved only after success.
7. Display an error and preserve recoverable data if saving fails.

Prevent overlapping saves from writing stale snapshots over newer changes.

Use a revision number, serialized queue, or equivalent mechanism to preserve save ordering.

---

## 32. SECURITY AND DATA INTEGRITY

Even though Frame initially runs locally, it must follow sound security practices.

- Validate imported data.
- Validate component properties.
- Sanitize URLs.
- Avoid executing user-authored code.
- Avoid rendering arbitrary HTML without sanitization.
- Do not place secrets in client-side environment variables.
- Validate MIME types and file sizes.
- Prevent component-tree cycles.
- Prevent invalid IDs.
- Protect against malformed project documents.
- Keep editor metadata separate from exported markup.
- Never assume imported JSON is trustworthy.

Any future cloud backend must enforce authorization server-side rather than relying only on hidden UI controls.

---

## 33. TESTING STRATEGY

Testing is part of implementation, not an optional final step.

### Unit tests
Test:
- ID generation.
- Tree traversal.
- Component insertion.
- Component deletion.
- Component movement.
- Duplication.
- Property updates.
- Style validation.
- Schema validation.
- History operations.
- Responsive style resolution.
- Export generation.
- URL validation.

### Integration tests
Test:
- Creating a project and opening it.
- Adding a component and editing it.
- Selecting through the layer tree.
- Updating styles through the inspector.
- Undoing and redoing changes.
- Saving and reloading.
- Moving components between parents.
- Uploading and restoring assets.
- Creating and deleting pages.
- Exporting a project.

### End-to-end tests
Use Playwright to verify complete user journeys.

Critical journey:
1. Open dashboard.
2. Create a project.
3. Insert a section.
4. Insert a heading.
5. Change the heading text.
6. Change its font size.
7. Add a button.
8. Reorder the components.
9. Undo and redo the reorder.
10. Switch to mobile preview.
11. Save and reload.
12. Verify the design remains intact.
13. Export the project.
14. Verify the export package is generated successfully.

### Quality gates
Before considering a release complete:
- TypeScript checks pass.
- Lint passes.
- Unit tests pass.
- Integration tests pass.
- Production build succeeds.
- Critical end-to-end flows pass.
- No known data-loss issue remains in the implemented workflows.

Do not claim a test passed without running it and examining the result.

---

## 34. SUGGESTED PROJECT STRUCTURE

Use a feature-oriented structure.

src/
  app/
    App.tsx
    router.tsx
    providers/
  components/
    ui/
    common/
  features/
    dashboard/
      components/
      hooks/
      services/
      types/
    editor/
      components/
        EditorShell.tsx
        EditorToolbar.tsx
        ComponentSidebar.tsx
        LayersPanel.tsx
        CanvasWorkspace.tsx
        PropertiesInspector.tsx
        ViewportControls.tsx
      hooks/
      stores/
      commands/
      types/
    document/
      model/
      commands/
      validation/
      history/
      traversal/
    component-registry/
      definitions/
      renderers/
      schemas/
    assets/
      components/
      services/
      repositories/
    preview/
      components/
      renderers/
    export/
      generators/
      validation/
      services/
    projects/
      repositories/
      services/
      types/
    pages/
      components/
      services/
  lib/
    ids.ts
    urls.ts
    errors.ts
    utils.ts
  styles/
    globals.css
    editor.css
  test/
    fixtures/
    helpers/

This is a proposed structure. Adjust it if the implementation reveals a simpler, cleaner arrangement.

Do not create empty folders and dozens of placeholder files simply to match the tree. Introduce modules when their responsibilities become real.

---

## 35. IMPLEMENTATION ROADMAP

### Phase 0: Repository inspection and setup

Tasks:
- Inspect the existing repository.
- Identify package manager and current dependencies.
- Inspect existing application structure.
- Check current build and test status.
- Identify reusable code.
- Propose a concise implementation plan.
- Initialize missing tooling.
- Confirm the development server starts.

Deliverables:
- Working development environment.
- TypeScript and lint configuration.
- Test infrastructure.
- Initial application shell.

Do not overwrite an existing application before understanding it.

### Phase 1: Dashboard and project persistence

Tasks:
- Build the dashboard.
- Build project creation dialog.
- Implement IndexedDB persistence.
- Create project and page schemas.
- Implement create, list, rename, duplicate, open, and delete.
- Add loading, empty, and error states.

Acceptance criteria:
- A project can be created.
- It appears in the dashboard.
- It can be renamed.
- It can be reopened after refreshing the page.
- Duplicating creates a separate project.
- Deleting requires confirmation.

### Phase 2: Editor shell

Tasks:
- Build the toolbar.
- Build left and right sidebars.
- Build the canvas workspace.
- Add viewport controls.
- Add selection state.
- Add a default empty page.
- Establish responsive panel layout.

Acceptance criteria:
- The editor fits a typical laptop viewport.
- Sidebars can collapse.
- The canvas resizes with the available workspace.
- The document viewport remains independent of editor zoom.

### Phase 3: Document engine and component registry

Tasks:
- Define the document model.
- Define component schemas.
- Build tree traversal utilities.
- Build document commands.
- Build validation.
- Implement initial components.
- Implement recursive rendering.

Acceptance criteria:
- Components render from the document model.
- Every component has a stable ID.
- The root cannot be deleted.
- Invalid trees are rejected.
- Saving and loading preserves the tree.

### Phase 4: Component library and layer tree

Tasks:
- Display registered components.
- Implement component insertion.
- Build the layer tree.
- Synchronize layer and canvas selection.
- Implement layer rename.
- Implement delete and duplicate.
- Implement layer visibility and locking.

Acceptance criteria:
- Adding a component updates the tree and canvas.
- Selecting a layer selects its canvas component.
- Renaming a layer does not unexpectedly change its content.
- Deleting a parent deletes its subtree.
- Duplicating creates new IDs throughout the duplicated subtree.

### Phase 5: Inspector and style editing

Tasks:
- Build content controls.
- Build layout controls.
- Build typography controls.
- Build appearance controls.
- Build spacing controls.
- Implement validated style updates.
- Implement live rendering updates.

Acceptance criteria:
- Every visible control works.
- Canvas updates reflect the chosen properties.
- Switching selection displays the correct values.
- Invalid values are rejected or normalized.
- Inspector editing does not lose focus unexpectedly.

### Phase 6: Drag-and-drop

Tasks:
- Implement library-to-canvas drag.
- Implement sibling reordering.
- Implement nesting.
- Implement layer-tree reordering.
- Add insertion indicators.
- Add invalid-drop prevention.
- Add keyboard alternatives where practical.

Acceptance criteria:
- Dropping creates a component at the expected location.
- Reordering updates document order.
- Moving preserves component identity.
- Invalid moves are rejected.
- Cancelled drags do not mutate the document.
- Each completed drag is one undoable operation.

### Phase 7: History and keyboard shortcuts

Tasks:
- Implement undo and redo.
- Add history boundaries.
- Coalesce continuous edits.
- Implement copy, paste, duplicate, and delete shortcuts.
- Add shortcut hints.

Acceptance criteria:
- Every supported document command can be undone.
- Redo restores the operation.
- New edits after undo clear the redo branch.
- History does not cross pages incorrectly.
- Shortcuts do not interfere with text input.

### Phase 8: Responsive editing

Tasks:
- Implement viewport presets.
- Add custom width.
- Add breakpoint-aware style storage.
- Implement inherited style values.
- Generate responsive CSS.
- Verify mobile and tablet rendering.

Acceptance criteria:
- Viewport changes do not alter document content.
- Responsive overrides persist.
- Resetting an override restores inheritance.
- Generated CSS matches editor behavior.

### Phase 9: Assets and multi-page support

Tasks:
- Implement local image uploads.
- Build an asset repository.
- Implement asset references.
- Add page management.
- Add internal navigation.
- Implement safe asset cleanup.

Acceptance criteria:
- Uploaded images survive refreshes.
- Replacing an image preserves the component ID.
- Multiple pages can be created and reopened.
- Internal links resolve correctly.
- Missing assets produce recoverable errors.

### Phase 10: Preview and export

Tasks:
- Build preview mode.
- Share rendering semantics with export.
- Build export validation.
- Generate a standalone website.
- Package assets.
- Generate README and setup instructions.
- Test the exported site independently.

Acceptance criteria:
- Preview contains no editor chrome.
- Exported files build outside Frame.
- Styles and images are preserved.
- Internal links work.
- Export errors are clearly reported.
- No Frame-only dependencies are required at runtime.

### Phase 11: Hardening and release

Tasks:
- Add automated test coverage.
- Test large documents.
- Profile unnecessary rerenders.
- Improve accessibility.
- Test error recovery.
- Document architecture.
- Create a polished demo project.
- Prepare deployment.

Acceptance criteria:
- Critical workflows are covered by tests.
- Production build succeeds.
- No known critical data-loss defects remain.
- README includes setup, architecture, limitations, and usage instructions.

---

## 36. NON-GOALS FOR THE FIRST COMPLETE VERSION

Do not implement these before the main editor works:

- Real-time multiplayer collaboration.
- AI-generated layouts.
- A full CSS code editor.
- Arbitrary JavaScript execution.
- Server-side rendering infrastructure.
- User accounts and cloud synchronization.
- Payment systems.
- Plugin marketplace.
- Full animation timeline.
- Advanced CMS.
- Production hosting service.
- Arbitrary external component packages.
- Fully unrestricted rich-text editing.
- A complete design-system marketplace.

These are possible future directions, not requirements for the first complete release.

---

## 37. DEFINITION OF DONE

Frame is considered a successful first complete version when a user can independently:

1. Launch the application.
2. Create a project.
3. Create or select a page.
4. Add components from the component library.
5. Edit text and properties.
6. Arrange and nest components.
7. Select components through the canvas or layer tree.
8. Change layout, typography, spacing, and appearance.
9. Undo and redo changes.
10. Copy, duplicate, and delete supported components.
11. Switch between desktop, tablet, and mobile previews.
12. Save and reload the project without data loss.
13. Upload and use local images.
14. Create multiple pages and configure links.
15. Preview the website without editor controls.
16. Export a standalone website.
17. Build and run the exported website independently.

The interface must look intentional, and no visible core action may be a nonfunctional placeholder.

---

## 38. INSTRUCTIONS FOR THE CLI CODING AGENT

You are acting as a senior frontend engineer and software architect implementing Frame.

### Your operating rules

1. Inspect the repository before making changes.
2. Identify existing code and dependencies before introducing new ones.
3. Work incrementally, beginning with Phase 0.
4. Implement one coherent phase at a time.
5. Do not attempt to generate the entire application in one massive code-writing operation.
6. Keep the application runnable after each meaningful phase.
7. Prefer small, well-defined modules over giant components.
8. Use TypeScript strictly and avoid `any` unless there is a documented, unavoidable reason.
9. Use real application state and persistence rather than hardcoded mock interactions.
10. Do not silently replace working architecture without a strong reason.
11. Do not create controls that look functional but have no implemented behavior.
12. Do not claim tests, builds, or features succeeded without verification.
13. When a feature is incomplete, state exactly what remains.
14. Resolve TypeScript errors, lint failures, and runtime errors introduced by your changes.
15. Add tests alongside the logic they verify.
16. Do not introduce dependencies without explaining their purpose.
17. Keep the document model serializable and independent of React component instances.
18. Use immutable document updates.
19. Treat imported documents and uploaded assets as untrusted input.
20. Avoid premature abstractions, but do not combine unrelated responsibilities into one module.
21. Preserve existing user data and project files.
22. Ask for clarification only when a decision is genuinely blocking; otherwise make a reasonable, documented engineering decision.
23. If a requested feature is too large for one implementation step, break it down into smaller working increments.

### Required workflow for every phase

Before implementation:
- Inspect the relevant code.
- State the goal of the phase.
- Identify the files likely to change.
- Identify dependencies and risks.
- Define the acceptance criteria.

During implementation:
- Build the smallest coherent working increment.
- Run relevant tests and type checks.
- Fix errors caused by the changes.
- Avoid unrelated refactors.

After implementation:
- Summarize what was implemented.
- List important files created or changed.
- Report tests and commands actually executed.
- Identify incomplete requirements.
- Explain the next logical step.

### Initial instruction

Start with Phase 0 only.

Inspect the repository, report its current state, identify any existing implementation, and prepare the environment without destroying existing work.

Then propose a concise plan for Phase 1.

Do not begin implementing every feature in this specification at once. Wait until the current phase is understood and its implementation plan is clear.

Use this specification as the project's source of truth. If an implementation decision requires deviating from it, explain the reason and document the decision.

The final objective is a working, polished, maintainable visual website builder—not a static mockup or a collection of disconnected UI components.