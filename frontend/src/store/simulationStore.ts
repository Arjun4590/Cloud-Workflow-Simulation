import { create } from "zustand";
import type { CloudProject } from "../types/workflow";
import { SimulationEngine } from "../engines/simulation/SimulationEngine";
import type {
  RoutingAlgorithmType,
  SimulationConfig,
  SimulationSnapshot
} from "../engines/simulation/SimulationTypes";
import { DEFAULT_SIMULATION_CONFIG } from "../engines/simulation/SimulationTypes";

interface SimulationStoreState {
  engine: SimulationEngine | null;
  snapshot: SimulationSnapshot | null;
  isPlaying: boolean;
  playbackSpeed: number; // multiplier: 0.5, 1, 2, 5
  activeTab: "validation" | "simulation" | "metrics";
  selectedEventId: string | null;
  timerId: number | null;

  // Actions
  initSimulation: (project: CloudProject, config?: Partial<SimulationConfig>) => void;
  start: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  setAlgorithm: (algorithm: RoutingAlgorithmType) => void;
  injectFailure: (resourceId: string, reason?: string) => void;
  recoverResource: (resourceId: string) => void;
  setActiveTab: (tab: "validation" | "simulation" | "metrics") => void;
  selectEvent: (eventId: string | null) => void;
}

const SPEED_INTERVALS: Record<number, number> = {
  0.5: 1200,
  1: 600,
  2: 300,
  5: 120
};

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  engine: null,
  snapshot: null,
  isPlaying: false,
  playbackSpeed: 1,
  activeTab: "validation",
  selectedEventId: null,
  timerId: null,

  initSimulation: (project: CloudProject, configOverrides?: Partial<SimulationConfig>) => {
    // Stop any running timer
    const { timerId } = get();
    if (timerId !== null) {
      clearInterval(timerId);
    }

    const currentConfig = get().snapshot?.config || DEFAULT_SIMULATION_CONFIG;
    const engine = new SimulationEngine(project, { ...currentConfig, ...configOverrides });
    const snapshot = engine.getSnapshot();

    set({
      engine,
      snapshot,
      isPlaying: false,
      timerId: null
    });
  },

  start: () => {
    const { engine, isPlaying, playbackSpeed, timerId } = get();
    if (!engine) return;

    if (isPlaying) return;

    // Start engine
    const snapshot = engine.start();

    // Setup tick interval
    if (timerId !== null) {
      clearInterval(timerId);
    }

    const intervalMs = SPEED_INTERVALS[playbackSpeed] || 600;

    const newTimerId = window.setInterval(() => {
      const current = get();
      if (!current.engine) return;

      const updatedSnapshot = current.engine.step();
      set({ snapshot: updatedSnapshot });

      if (updatedSnapshot.status === "completed" || updatedSnapshot.status === "failed") {
        current.pause();
      }
    }, intervalMs);

    set({
      snapshot,
      isPlaying: true,
      timerId: newTimerId,
      activeTab: "simulation" // automatically switch tab to simulation timeline
    });
  },

  pause: () => {
    const { engine, timerId } = get();
    if (timerId !== null) {
      clearInterval(timerId);
    }

    if (engine) {
      const snapshot = engine.pause();
      set({ snapshot, isPlaying: false, timerId: null });
    } else {
      set({ isPlaying: false, timerId: null });
    }
  },

  step: () => {
    const { engine } = get();
    if (!engine) return;

    // Advance by 1 tick
    const snapshot = engine.step();
    set({ snapshot, activeTab: "simulation" });
  },

  reset: () => {
    const { engine, timerId } = get();
    if (timerId !== null) {
      clearInterval(timerId);
    }

    if (engine) {
      const snapshot = engine.reset();
      set({ snapshot, isPlaying: false, timerId: null });
    } else {
      set({ isPlaying: false, timerId: null });
    }
  },

  setSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
    const { isPlaying } = get();
    if (isPlaying) {
      // Restart interval with new speed
      get().pause();
      get().start();
    }
  },

  setAlgorithm: (algorithm: RoutingAlgorithmType) => {
    const { engine } = get();
    if (engine) {
      engine.setAlgorithm(algorithm);
      set({ snapshot: engine.getSnapshot() });
    }
  },

  injectFailure: (resourceId: string, reason?: string) => {
    const { engine } = get();
    if (!engine) return;

    const snapshot = engine.injectFailure(resourceId, reason);
    set({ snapshot });
  },

  recoverResource: (resourceId: string) => {
    const { engine } = get();
    if (!engine) return;

    const snapshot = engine.recoverResource(resourceId);
    set({ snapshot });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  selectEvent: (eventId) => {
    set({ selectedEventId: eventId });
  }
}));
