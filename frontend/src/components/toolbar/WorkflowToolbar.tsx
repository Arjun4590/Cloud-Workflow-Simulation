import React, { useEffect, useState } from "react";
import { useWorkflowStore } from "../../store/workflowStore";
import { useSimulationStore } from "../../store/simulationStore";
import { DEMO_SCENARIOS } from "../../config/demoScenarios";
import type { RoutingAlgorithmType } from "../../engines/simulation/SimulationTypes";
import { 
  Save, Undo, Redo, Trash2, CheckCircle2, 
  Play, Pause, StepForward, RotateCcw, 
  Activity
} from "lucide-react";

export default function WorkflowToolbar() {
  const { 
    project, 
    updateProjectName, 
    undo, 
    redo, 
    history, 
    futureHistory, 
    saveProject,
    deleteResource,
    selectedResourceId,
    runAnalysis,
    setAnalysisPanelOpen,
    loadDemoScenario
  } = useWorkflowStore();

  const {
    snapshot,
    isPlaying,
    playbackSpeed,
    initSimulation,
    start,
    pause,
    step,
    reset,
    setSpeed,
    setAlgorithm,
    injectFailure,
    recoverResource,
    setActiveTab
  } = useSimulationStore();

  const [selectedDemoId, setSelectedDemoId] = useState<string>("");

  // Auto initialize or re-initialize simulation when project structure changes
  useEffect(() => {
    initSimulation(project);
  }, [project, initSimulation]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProjectName(e.target.value);
  };

  const handleSave = () => {
    saveProject();
    alert("Project saved successfully!");
  };

  const handleDelete = () => {
    if (selectedResourceId) {
      deleteResource(selectedResourceId);
    }
  };

  const handleDemoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const demoId = e.target.value;
    setSelectedDemoId(demoId);
    if (!demoId) return;

    const demo = DEMO_SCENARIOS.find(d => d.id === demoId);
    if (demo) {
      loadDemoScenario(demo.project, demo.positions);
      initSimulation(demo.project);
      setActiveTab("simulation");
    }
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      pause();
    } else {
      if (!snapshot || snapshot.status === "idle" || snapshot.status === "completed" || snapshot.status === "failed") {
        initSimulation(project);
      }
      start();
      setAnalysisPanelOpen(true);
      setActiveTab("simulation");
    }
  };

  const handleStep = () => {
    if (!snapshot || snapshot.status === "idle") {
      initSimulation(project);
    }
    step();
    setAnalysisPanelOpen(true);
    setActiveTab("simulation");
  };

  const handleAlgorithmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const algo = e.target.value as RoutingAlgorithmType;
    setAlgorithm(algo);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSpeed(Number(e.target.value));
  };

  const handleQuickFailure = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    if (val.startsWith("fail:")) {
      const resId = val.replace("fail:", "");
      injectFailure(resId, "Fault injection via toolbar");
    } else if (val.startsWith("revive:")) {
      const resId = val.replace("revive:", "");
      recoverResource(resId);
    }
    // reset selector
    e.target.value = "";
  };

  const isSimulationCompleted = snapshot?.status === "completed";

  return (
    <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 shadow-sm z-20 gap-3">
      {/* Left: Project title & Demo Scenarios */}
      <div className="flex items-center space-x-3 min-w-[280px]">
        <input 
          type="text" 
          value={project.name}
          onChange={handleNameChange}
          className="font-bold text-base text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors w-44 truncate"
          title={project.name}
        />

        {/* Demo Scenario Dropdown */}
        <div className="relative">
          <select
            value={selectedDemoId}
            onChange={handleDemoSelect}
            className="text-xs font-medium bg-slate-50 border border-slate-300 hover:border-blue-400 text-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
          >
            <option value="">Demo Scenarios...</option>
            {DEMO_SCENARIOS.map(demo => (
              <option key={demo.id} value={demo.id}>
                {demo.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Middle: Standard Architecture Tools */}
      <div className="flex items-center space-x-1.5">
        <button onClick={handleSave} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors" title="Save Project">
          <Save size={16} />
        </button>
        <button onClick={undo} disabled={history.length === 0} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded disabled:opacity-40 transition-colors" title="Undo">
          <Undo size={16} />
        </button>
        <button onClick={redo} disabled={futureHistory.length === 0} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded disabled:opacity-40 transition-colors" title="Redo">
          <Redo size={16} />
        </button>
        <button 
          onClick={handleDelete} 
          disabled={!selectedResourceId} 
          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40 transition-colors" 
          title="Delete Selected Resource"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Right: Simulation Controls Bar */}
      <div className="flex items-center space-x-2">
        {/* Routing Algorithm Selector */}
        <div className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md text-xs">
          <span className="text-slate-500 font-medium hidden sm:inline">Algo:</span>
          <select
            id="select-algorithm"
            value={snapshot?.config.routingAlgorithm || "round_robin"}
            onChange={handleAlgorithmChange}
            className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
          >
            <option value="round_robin">Round Robin</option>
            <option value="least_connections">Least Connections</option>
          </select>
        </div>

        {/* Play/Pause Button */}
        <button 
          id="btn-simulate"
          onClick={handlePlayToggle}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-all ${
            isPlaying 
              ? 'bg-amber-500 hover:bg-amber-600 text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          title={isPlaying ? "Pause simulation" : "Run interactive simulation"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          <span>{isPlaying ? "Pause" : "Simulate"}</span>
        </button>

        {/* Step Button */}
        <button 
          id="btn-step"
          onClick={handleStep}
          disabled={isPlaying || isSimulationCompleted}
          className="p-1.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-md transition-colors"
          title="Advance 1 simulation tick"
        >
          <StepForward size={15} />
        </button>

        {/* Reset Button */}
        <button 
          id="btn-reset"
          onClick={reset}
          className="p-1.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
          title="Reset simulation to initial state"
        >
          <RotateCcw size={15} />
        </button>

        {/* Speed Selector */}
        <select
          id="select-speed"
          value={playbackSpeed}
          onChange={handleSpeedChange}
          className="text-xs font-medium bg-slate-100 border border-slate-200 text-slate-700 rounded-md px-1.5 py-1 focus:outline-none cursor-pointer"
          title="Simulation Playback Speed"
        >
          <option value="0.5">0.5x</option>
          <option value="1">1.0x</option>
          <option value="2">2.0x</option>
          <option value="5">5.0x</option>
        </select>

        {/* Fault Injection Selector */}
        {snapshot && snapshot.status !== "idle" && (
          <select
            id="select-fault"
            defaultValue=""
            onChange={handleQuickFailure}
            className="text-xs bg-red-50 border border-red-200 hover:border-red-300 text-red-700 rounded-md px-2 py-1 font-medium focus:outline-none cursor-pointer transition-colors"
            title="Inject failure or recover an instance"
          >
            <option value="" disabled>Chaos/Fault...</option>
            {project.resources
              .filter(r => r.type === "backend" || r.type === "service" || r.type === "container" || r.type === "pod" || r.type === "sql_database" || r.type === "load_balancer")
              .map(r => {
                const info = snapshot.resources[r.id];
                const isDown = info?.isFailed;
                return (
                  <option key={r.id} value={isDown ? `revive:${r.id}` : `fail:${r.id}`}>
                    {isDown ? `✓ Revive ${r.configuration?.name || r.name}` : `⚡ Crash ${r.configuration?.name || r.name}`}
                  </option>
                );
              })}
          </select>
        )}

        <div className="w-px h-6 bg-slate-200 mx-1"></div>

        {/* Validation / Inspector Panel Toggle */}
        <button 
          id="btn-validate"
          className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          onClick={() => {
            runAnalysis();
            setActiveTab("validation");
          }}
          title="Run static architecture validation"
        >
          <CheckCircle2 size={14} className="text-blue-600" />
          <span>Validate</span>
        </button>

        <button 
          id="btn-events-metrics"
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            snapshot && snapshot.status !== "idle" 
              ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => {
            setAnalysisPanelOpen(true);
            setActiveTab("simulation");
          }}
          title="Open Simulation Events and Metrics Dashboard"
        >
          <Activity size={14} className="text-indigo-600" />
          <span>Events & Metrics</span>
          {snapshot && snapshot.currentTick > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-1 py-0.2 rounded-full font-bold ml-1">
              T:{snapshot.currentTick}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
