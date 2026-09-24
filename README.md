# Cloud Workflow Engine

An Interactive Cloud Infrastructure Simulation and Learning Platform.

## Phase 1: Visual Cloud Workflow Designer

This repository currently contains Phase 1 of the project, which establishes a strong, polished, functional foundation for the visual cloud workflow designer.

**Important Note:** This is currently a visual cloud workflow designer, not a real cloud provisioning system. Real simulation features (Kubernetes, AWS/GCP, autoscaling, deployment) will be introduced in subsequent phases.

### Technology Stack
- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS, `lucide-react` for icons
- **Workflow / Graph Library:** `@xyflow/react` (formerly React Flow)
- **State Management:** Zustand
- **Persistence:** Local Storage (for Phase 1)

### Features
- **Component Library:** Drag and drop cloud resources onto the canvas. Categories include Infrastructure, Containers, Kubernetes, Application, and Data.
- **Workflow Canvas:** Move, select, and connect cloud resources.
- **Properties Panel:** Schema-driven configuration panel that updates based on the selected resource.
- **Save & Load:** Persists the entire project architecture and node positions to Local Storage.
- **Undo / Redo:** Full history tracking for project architecture changes.

### Project Structure
- `/src/types/workflow.ts` - Generic resource models (`CloudProject`, `CloudResource`, etc.)
- `/src/config/resourceDefinitions.ts` - Central schema definitions for each resource type.
- `/src/store/workflowStore.ts` - Zustand store managing workflow state, history, and persistence.
- `/src/components/` - React components for layout, toolbar, sidebar, canvas, and property panel.

### Getting Started

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Future Phases
Phase 2 will introduce the **Workflow Engine** and **Validation Engine** which will build upon the `CloudProject` model established here. Future phases will introduce a full **Simulation Engine** for observing live resource states, errors, scaling, and logs.
