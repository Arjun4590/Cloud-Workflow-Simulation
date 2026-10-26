import { create } from "zustand";
import type { CloudProject, CloudResource, WorkflowConnection, NodePositions, ProjectState } from "../types/workflow";
import { ValidationEngine } from "../engines/validation/ValidationEngine";
import { WorkflowEngine } from "../engines/workflow/WorkflowEngine";
import type { ValidationResult, ExecutionPlan } from "../engines/types";

// Save local storage key
const STORAGE_KEY = "cloud_workflow_project";

interface WorkflowState {
  // Current State
  project: CloudProject;
  positions: NodePositions;
  selectedResourceId: string | null;
  
  // Undo/Redo tracking
  history: ProjectState[];
  futureHistory: ProjectState[];

  // Actions
  addResource: (resource: CloudResource, position: {x: number, y: number}) => void;
  updateResource: (id: string, configuration: Record<string, any>) => void;
  deleteResource: (id: string) => void;
  
  addConnection: (connection: WorkflowConnection) => void;
  deleteConnection: (id: string) => void;
  
  updateNodePosition: (id: string, position: {x: number, y: number}) => void;
  selectResource: (id: string | null) => void;
  updateProjectName: (name: string) => void;

  undo: () => void;
  redo: () => void;
  
  validationResult: ValidationResult | null;
  executionPlan: ExecutionPlan | null;
  isAnalysisPanelOpen: boolean;

  setAnalysisPanelOpen: (isOpen: boolean) => void;
  runAnalysis: () => void;
  
  saveProject: () => void;
  loadProject: () => void;
  loadDemoScenario: (project: CloudProject, positions: NodePositions) => void;
  _saveToHistory: () => void;
}

const getInitialState = (): ProjectState => ({
  project: {
    id: "proj-1",
    name: "My Cloud Architecture",
    resources: [],
    connections: []
  },
  positions: {}
});

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  project: getInitialState().project,
  positions: getInitialState().positions,
  selectedResourceId: null,
  
  history: [],
  futureHistory: [],
  
  validationResult: null,
  executionPlan: null,
  isAnalysisPanelOpen: false,

  // Helper to save current state to history before changing
  // We only track project and positions in history
  _saveToHistory: () => {
    set((state) => {
      const currentState: ProjectState = {
        project: JSON.parse(JSON.stringify(state.project)),
        positions: JSON.parse(JSON.stringify(state.positions))
      };
      return {
        history: [...state.history, currentState],
        futureHistory: [] // clear future when new action happens
      };
    });
  },

  addResource: (resource, position) => {
    get()._saveToHistory();
    set((state) => ({
      project: {
        ...state.project,
        resources: [...state.project.resources, resource]
      },
      positions: {
        ...state.positions,
        [resource.id]: position
      }
    }));
  },

  updateResource: (id, configuration) => {
    get()._saveToHistory();
    set((state) => ({
      project: {
        ...state.project,
        resources: state.project.resources.map(r => 
          r.id === id ? { ...r, configuration } : r
        )
      }
    }));
  },

  deleteResource: (id) => {
    get()._saveToHistory();
    set((state) => {
      const { [id]: _, ...newPositions } = state.positions;
      return {
        project: {
          ...state.project,
          resources: state.project.resources.filter(r => r.id !== id),
          connections: state.project.connections.filter(c => c.source !== id && c.target !== id)
        },
        positions: newPositions,
        selectedResourceId: state.selectedResourceId === id ? null : state.selectedResourceId
      };
    });
  },

  addConnection: (connection) => {
    // Only save history if connection doesn't already exist
    const exists = get().project.connections.find(
      c => c.source === connection.source && c.target === connection.target
    );
    if (exists) return;

    get()._saveToHistory();
    set((state) => ({
      project: {
        ...state.project,
        connections: [...state.project.connections, connection]
      }
    }));
  },

  deleteConnection: (id) => {
    get()._saveToHistory();
    set((state) => ({
      project: {
        ...state.project,
        connections: state.project.connections.filter(c => c.id !== id)
      }
    }));
  },

  updateNodePosition: (id, position) => {
    // Position updates are frequent during drag, we might not want to save *every* pixel move to history.
    // For simplicity, we just update state directly. A proper history implementation for positions 
    // often listens to 'dragEnd' specifically, which we'll handle from React Flow adapter.
    set((state) => ({
      positions: {
        ...state.positions,
        [id]: position
      }
    }));
  },

  selectResource: (id) => {
    set({ selectedResourceId: id });
  },

  updateProjectName: (name) => {
    get()._saveToHistory();
    set((state) => ({
      project: {
        ...state.project,
        name
      }
    }));
  },

  undo: () => {
    set((state) => {
      if (state.history.length === 0) return state;
      
      const previousState = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);
      
      const currentState: ProjectState = {
        project: state.project,
        positions: state.positions
      };
      
      return {
        project: previousState.project,
        positions: previousState.positions,
        history: newHistory,
        futureHistory: [currentState, ...state.futureHistory],
        selectedResourceId: null
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.futureHistory.length === 0) return state;
      
      const nextState = state.futureHistory[0];
      const newFutureHistory = state.futureHistory.slice(1);
      
      const currentState: ProjectState = {
        project: state.project,
        positions: state.positions
      };
      
      return {
        project: nextState.project,
        positions: nextState.positions,
        history: [...state.history, currentState],
        futureHistory: newFutureHistory,
        selectedResourceId: null
      };
    });
  },

  setAnalysisPanelOpen: (isOpen) => {
    set({ isAnalysisPanelOpen: isOpen });
  },

  runAnalysis: () => {
    const { project } = get();
    const validationResult = ValidationEngine.validate(project);
    const executionPlan = WorkflowEngine.buildExecutionPlan(project);
    set({ validationResult, executionPlan, isAnalysisPanelOpen: true });
  },

  saveProject: () => {
    const { project, positions } = get();
    const dataToSave: ProjectState = { project, positions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  },

  loadProject: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ProjectState;
        set({
          project: parsed.project,
          positions: parsed.positions,
          history: [],
          futureHistory: [],
          selectedResourceId: null,
          validationResult: null,
          executionPlan: null,
          isAnalysisPanelOpen: false
        });
      }
    } catch (e) {
      console.error("Failed to load project from local storage", e);
    }
  },

  loadDemoScenario: (project, positions) => {
    get()._saveToHistory();
    const clonedProject = JSON.parse(JSON.stringify(project));
    const clonedPositions = JSON.parse(JSON.stringify(positions));
    const validationResult = ValidationEngine.validate(clonedProject);
    const executionPlan = WorkflowEngine.buildExecutionPlan(clonedProject);
    set({
      project: clonedProject,
      positions: clonedPositions,
      selectedResourceId: null,
      validationResult,
      executionPlan,
      isAnalysisPanelOpen: true
    });
  }

}));
