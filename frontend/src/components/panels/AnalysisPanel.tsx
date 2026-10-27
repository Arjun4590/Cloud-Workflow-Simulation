import { useState } from "react";
import { 
  X, CheckCircle, AlertTriangle, XCircle, Info, PlayCircle, 
  Activity, Zap, Filter, HelpCircle, TrendingUp, Cpu, Clock
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { useSimulationStore } from "../../store/simulationStore";

export default function AnalysisPanel() {
  const { 
    isAnalysisPanelOpen, 
    setAnalysisPanelOpen, 
    validationResult, 
    executionPlan, 
    selectResource, 
    project 
  } = useWorkflowStore();

  const {
    snapshot,
    activeTab,
    setActiveTab,
    selectedEventId,
    selectEvent
  } = useSimulationStore();

  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  if (!isAnalysisPanelOpen) return null;

  const events = snapshot?.events || [];
  const metrics = snapshot?.metrics;
  const autoscaling = snapshot?.autoscaling;
  const autoscaleConfig = snapshot?.config.autoscaling;
  const virtualReplicas = snapshot?.virtualReplicas || {};
  const isAutoscaleEnabled = autoscaleConfig?.enabled ?? false;

  const filteredEvents = severityFilter === "ALL" 
    ? events 
    : events.filter(e => e.severity === severityFilter);

  const validationErrorsCount = validationResult?.errors.length || 0;

  return (
    <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-10 transition-all select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-20">
        <div className="flex items-center space-x-2">
          <Activity size={17} className="text-blue-600" />
          <h2 className="text-sm font-bold text-slate-800">CloudLens Inspector</h2>
        </div>
        <button 
          onClick={() => setAnalysisPanelOpen(false)} 
          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors"
          title="Close Panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-semibold overflow-x-auto">
        <button
          id="tab-btn-validation"
          onClick={() => setActiveTab("validation")}
          className={`py-2 px-2.5 flex items-center justify-center gap-1 transition-colors border-b-2 flex-1 whitespace-nowrap ${
            activeTab === "validation"
              ? "border-blue-600 bg-white text-blue-700 shadow-sm"
              : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-200/60"
          }`}
        >
          <span>Validation</span>
          {validationErrorsCount > 0 ? (
            <span className="bg-red-500 text-white text-[10px] px-1 py-0.2 rounded-full font-bold">
              {validationErrorsCount}
            </span>
          ) : (
            <CheckCircle size={11} className="text-emerald-500" />
          )}
        </button>

        <button
          id="tab-btn-simulation"
          onClick={() => setActiveTab("simulation")}
          className={`py-2 px-2.5 flex items-center justify-center gap-1 transition-colors border-b-2 flex-1 whitespace-nowrap ${
            activeTab === "simulation"
              ? "border-blue-600 bg-white text-blue-700 shadow-sm"
              : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-200/60"
          }`}
        >
          <span>Events</span>
          {events.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-1 py-0.2 rounded-full font-bold">
              {events.length}
            </span>
          )}
        </button>

        <button
          id="tab-btn-metrics"
          onClick={() => setActiveTab("metrics")}
          className={`py-2 px-2.5 flex items-center justify-center gap-1 transition-colors border-b-2 flex-1 whitespace-nowrap ${
            activeTab === "metrics"
              ? "border-blue-600 bg-white text-blue-700 shadow-sm"
              : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-200/60"
          }`}
        >
          <span>Metrics</span>
        </button>

        <button
          id="tab-btn-autoscaling"
          onClick={() => setActiveTab("autoscaling")}
          className={`py-2 px-2.5 flex items-center justify-center gap-1 transition-colors border-b-2 flex-1 whitespace-nowrap ${
            activeTab === "autoscaling"
              ? "border-indigo-600 bg-white text-indigo-700 shadow-sm font-bold"
              : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-200/60"
          }`}
        >
          <TrendingUp size={12} className={isAutoscaleEnabled ? "text-indigo-600" : ""} />
          <span>Autoscale</span>
          {isAutoscaleEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Tab 1: Architecture Validation */}
      {activeTab === "validation" && (
        <div className="p-4 flex-1 overflow-y-auto space-y-5">
          {/* Status Overview */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Architecture Health</h3>
            {validationResult?.valid ? (
              <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50 p-2.5 rounded-md border border-emerald-200 text-xs font-medium">
                <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                <span>Architecture is structurally sound and satisfies all cloud connection constraints.</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-2.5 rounded-md border border-red-200 text-xs font-medium">
                <XCircle size={16} className="text-red-600 flex-shrink-0" />
                <span>{validationErrorsCount} validation error(s) detected. Fix issues before deployment.</span>
              </div>
            )}
          </div>

          {/* Issues List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Semantic Checks</h3>
            
            {validationResult?.errors.length === 0 && validationResult?.warnings.length === 0 && (
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-100">
                All cloud resources, dependencies, and routing rules pass validation.
              </div>
            )}

            {validationResult?.errors.map((error, idx) => (
              <div 
                key={`err-${idx}`} 
                className="p-2.5 bg-red-50 border border-red-200 rounded-md cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => error.resourceId && selectResource(error.resourceId)}
              >
                <div className="flex items-start space-x-2">
                  <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-red-800">{error.code}</div>
                    <div className="text-xs text-red-700 mt-0.5">{error.message}</div>
                  </div>
                </div>
              </div>
            ))}

            {validationResult?.warnings.map((warning, idx) => (
              <div 
                key={`warn-${idx}`} 
                className="p-2.5 bg-amber-50 border border-amber-200 rounded-md cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={() => warning.resourceId && selectResource(warning.resourceId)}
              >
                <div className="flex items-start space-x-2">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-amber-800">{warning.code}</div>
                    <div className="text-xs text-amber-700 mt-0.5">{warning.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Kahn's Topological Execution Stages */}
          <div className="space-y-2.5 pt-3 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topological Execution Stages</h3>
              <span className="text-[10px] text-slate-400 font-mono">Kahn's Sort</span>
            </div>

            {!executionPlan?.valid ? (
              <p className="text-xs text-red-500 flex items-center gap-1.5 p-2 bg-red-50 rounded border border-red-100">
                <AlertTriangle size={14} /> Plan blocked by dependency cycle or invalid connections
              </p>
            ) : executionPlan.stages.length === 0 ? (
              <p className="text-xs text-slate-400">No resources on canvas.</p>
            ) : (
              <div className="space-y-2">
                {executionPlan.stages.map((stage) => (
                  <div key={stage.index} className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                    <div className="text-xs font-bold text-blue-700 flex items-center gap-1.5 mb-1.5">
                      <PlayCircle size={13} /> Stage {stage.index}
                      <span className="text-[10px] font-normal text-slate-400 ml-auto">
                        ({stage.resourceIds.length} parallel resource{stage.resourceIds.length === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="pl-3 space-y-1">
                      {stage.resourceIds.map(rId => {
                        const res = project.resources.find(r => r.id === rId);
                        return (
                          <div 
                            key={rId} 
                            onClick={() => selectResource(rId)}
                            className="text-xs text-slate-700 flex items-center gap-1.5 hover:text-blue-600 cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                            <span className="font-medium">{res?.configuration?.name || res?.name || rId}</span>
                            <span className="text-[10px] text-slate-400 uppercase">({res?.type})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Simulation Event Timeline */}
      {activeTab === "simulation" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline Filter Header */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-slate-600">
              <Filter size={13} />
              <span className="font-semibold">Filter:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-700"
              >
                <option value="ALL">All ({events.length})</option>
                <option value="SUCCESS">Success</option>
                <option value="ERROR">Errors</option>
                <option value="INFO">Info</option>
              </select>
            </div>
            {snapshot && (
              <span className="text-slate-500 font-mono text-[11px]">
                Virtual Tick: <strong>{snapshot.currentTick}</strong>
              </span>
            )}
          </div>

          {/* Event Stream */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                {snapshot?.status === "idle" 
                  ? "Click 'Simulate' or 'Step' in the top toolbar to start virtual execution."
                  : "No events match the selected filter."}
              </div>
            ) : (
              filteredEvents.slice().reverse().map((evt) => {
                const isSelected = selectedEventId === evt.id;
                let borderTheme = "border-l-blue-500";
                let icon = <Info size={13} className="text-blue-500" />;

                if (evt.severity === "SUCCESS") {
                  borderTheme = "border-l-emerald-500";
                  icon = <CheckCircle size={13} className="text-emerald-500" />;
                } else if (evt.severity === "ERROR") {
                  borderTheme = "border-l-red-500";
                  icon = <XCircle size={13} className="text-red-500" />;
                } else if (evt.severity === "WARNING") {
                  borderTheme = "border-l-amber-500";
                  icon = <AlertTriangle size={13} className="text-amber-500" />;
                }

                return (
                  <div
                    key={evt.id}
                    onClick={() => {
                      selectEvent(evt.id);
                      if (evt.resourceId) selectResource(evt.resourceId);
                    }}
                    className={`p-2.5 rounded border border-slate-200 border-l-4 ${borderTheme} bg-white hover:bg-slate-50 cursor-pointer transition-all shadow-xs ${
                      isSelected ? "ring-2 ring-blue-400 bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <div className="flex items-center space-x-1 font-mono font-medium text-slate-600">
                        {icon}
                        <span>{evt.type}</span>
                      </div>
                      <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">
                        T:{evt.tick}
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 font-medium leading-relaxed">
                      {evt.message}
                    </div>

                    {evt.details && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 space-y-0.5">
                        {evt.details.reason && (
                          <div className="text-slate-600 italic">
                            💡 {evt.details.reason}
                          </div>
                        )}
                        {evt.details.activeLoads && (
                          <div className="font-mono text-slate-500">
                            Active loads: {JSON.stringify(evt.details.activeLoads)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Metrics & Algorithmic Decisions */}
      {activeTab === "metrics" && (
        <div className="p-4 flex-1 overflow-y-auto space-y-5">
          {/* Key Metrics Dashboard */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulated Traffic Metrics</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-[11px] text-slate-500">Total Requests</div>
                <div className="text-xl font-bold text-slate-800">
                  {metrics?.totalRequests ?? 0}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Limit: {snapshot?.config.totalRequests ?? 0}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-[11px] text-slate-500">Success Rate</div>
                <div className={`text-xl font-bold ${
                  (metrics?.successRate ?? 0) >= 90 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {metrics ? `${metrics.successRate.toFixed(1)}%` : '0.0%'}
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${metrics?.successRate ?? 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-[11px] text-slate-500">Completed / Failed</div>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  <span className="text-emerald-600">{metrics?.completedRequests ?? 0}</span>
                  <span className="text-slate-300 mx-1">/</span>
                  <span className="text-red-500">{metrics?.failedRequests ?? 0}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  In-Flight: {metrics?.inProgressRequests ?? 0}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-[11px] text-slate-500">Avg Latency</div>
                <div className="text-xl font-bold text-slate-800">
                  {metrics?.avgLatencyTicks ?? 0} <span className="text-xs font-normal text-slate-500">ticks</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Virtual time units
                </div>
              </div>
            </div>
          </div>

          {/* Per-Backend Request Distribution Chart */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per-Backend Traffic Distribution</h3>
            {metrics && Object.keys(metrics.perBackendRequests).length > 0 ? (
              <div className="space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                {Object.entries(metrics.perBackendRequests).map(([backendName, count]) => {
                  const maxCount = Math.max(...Object.values(metrics.perBackendRequests), 1);
                  const active = metrics.perBackendActive[backendName] || 0;
                  const pct = (count / maxCount) * 100;

                  return (
                    <div key={backendName} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 truncate">{backendName}</span>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {count} req{count === 1 ? '' : 's'} {active > 0 && <span className="text-blue-600 font-bold">({active} active)</span>}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded border border-slate-100 text-center">
                Run simulation to generate backend traffic distribution.
              </div>
            )}
          </div>

          {/* Algorithmic Decision Inspector */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Algorithm Explainability</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold capitalize">
                {snapshot?.config.routingAlgorithm.replace("_", " ") || "Round Robin"}
              </span>
            </div>

            {snapshot?.lastRoutingDecision ? (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-md text-xs space-y-2">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Zap size={14} className="text-blue-600" />
                  <span>Latest Decision Rationale</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {snapshot.lastRoutingDecision.reason}
                </p>
                <div className="pt-2 border-t border-blue-200/60 text-[11px] text-slate-600">
                  <div className="font-semibold mb-1 text-slate-700">Target Candidate Load Snapshot:</div>
                  <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                    {Object.entries(snapshot.lastRoutingDecision.targetActiveConnections).map(([cId, count]) => {
                      const isChosen = cId === snapshot.lastRoutingDecision?.selectedTargetId;
                      return (
                        <div 
                          key={cId} 
                          className={`p-1 rounded ${isChosen ? 'bg-blue-200/60 font-bold text-blue-900' : 'bg-white/80'}`}
                        >
                          {cId}: {count} in-flight
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded border border-slate-100 text-center">
                No routing decisions recorded yet. Start simulation to observe load balancing choices.
              </div>
            )}

            {/* Algorithm Theory Box for Viva/Presentation */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-700 flex items-center gap-1">
                <HelpCircle size={12} className="text-slate-400" />
                <span>Algorithm Behavior Note</span>
              </div>
              <p>
                {snapshot?.config.routingAlgorithm === "round_robin" ? (
                  <><strong>Round Robin</strong> distributes requests sequentially across active instances in a cyclic rotation, ignoring current load imbalances. Failed instances are bypassed automatically.</>
                ) : (
                  <><strong>Least Connections</strong> inspects active in-flight requests on each healthy backend and assigns new requests to the instance with the lowest load, breaking ties deterministically.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Autoscaling & Dynamic Capacity Elasticity */}
      {activeTab === "autoscaling" && (
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Status Header */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                <Cpu size={15} className="text-indigo-600" />
                <span>Simulation Autoscaling</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isAutoscaleEnabled
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-700"
              }`}>
                {isAutoscaleEnabled ? "ACTIVE (ELASTIC)" : "DISABLED (FIXED)"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-200 font-mono">
              <div>Min: <strong className="text-slate-700">{autoscaleConfig?.minReplicas ?? 2}</strong></div>
              <div>Max: <strong className="text-slate-700">{autoscaleConfig?.maxReplicas ?? 5}</strong></div>
              <div>Cap: <strong className="text-slate-700">{autoscaleConfig?.modeledCapacityPerReplica ?? 3}/rep</strong></div>
            </div>
          </div>

          {/* Modeled Utilization Meter */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700">Modeled Concurrent Utilization</span>
                <p className="text-[10px] text-slate-400">Simulated active request load vs ready capacity</p>
              </div>
              <div className="text-right">
                <span className={`text-xl font-extrabold font-mono ${
                  (autoscaling?.currentModeledUtilization ?? 0) >= (autoscaleConfig?.scaleOutThreshold ?? 75)
                    ? "text-red-600"
                    : (autoscaling?.currentModeledUtilization ?? 0) <= (autoscaleConfig?.scaleInThreshold ?? 30)
                      ? "text-blue-600"
                      : "text-emerald-600"
                }`}>
                  {autoscaling ? `${autoscaling.currentModeledUtilization.toFixed(1)}%` : "0.0%"}
                </span>
              </div>
            </div>

            {/* Threshold Meter Bar */}
            <div className="relative pt-1 pb-3">
              <div className="w-full bg-slate-100 rounded-full h-3 border border-slate-200 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    (autoscaling?.currentModeledUtilization ?? 0) >= (autoscaleConfig?.scaleOutThreshold ?? 75)
                      ? "bg-red-500"
                      : (autoscaling?.currentModeledUtilization ?? 0) <= (autoscaleConfig?.scaleInThreshold ?? 30)
                        ? "bg-blue-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, autoscaling?.currentModeledUtilization ?? 0))}%` }}
                ></div>
              </div>

              {/* Threshold indicator markers */}
              {autoscaleConfig && (
                <>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10"
                    style={{ left: `${autoscaleConfig.scaleInThreshold}%` }}
                    title={`Scale-In Threshold: ${autoscaleConfig.scaleInThreshold}%`}
                  >
                    <span className="absolute -bottom-3 -translate-x-1/2 text-[9px] font-bold text-blue-600 font-mono">
                      In:{autoscaleConfig.scaleInThreshold}%
                    </span>
                  </div>

                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-10"
                    style={{ left: `${autoscaleConfig.scaleOutThreshold}%` }}
                    title={`Scale-Out Threshold: ${autoscaleConfig.scaleOutThreshold}%`}
                  >
                    <span className="absolute -bottom-3 -translate-x-1/2 text-[9px] font-bold text-red-600 font-mono">
                      Out:{autoscaleConfig.scaleOutThreshold}%
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex justify-between pt-1 border-t border-slate-100">
              <span>Active: {autoscaling?.currentActiveRequests ?? 0} reqs</span>
              <span>Healthy Cap: {autoscaling?.currentHealthyCapacity ?? 0}</span>
              <span>Ready Replicas: {autoscaling?.currentReadyReplicas ?? 0}</span>
            </div>
          </div>

          {/* Key Elasticity Metrics Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Scale-Out Events</div>
              <div className="text-lg font-bold text-indigo-700 mt-0.5 font-mono">
                {autoscaling?.scaleOutCount ?? 0}
              </div>
              <div className="text-[10px] text-slate-400">Total Created: +{autoscaling?.totalCreatedReplicas ?? 0}</div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Scale-In Events</div>
              <div className="text-lg font-bold text-purple-700 mt-0.5 font-mono">
                {autoscaling?.scaleInCount ?? 0}
              </div>
              <div className="text-[10px] text-slate-400">Total Removed: -{autoscaling?.totalRemovedReplicas ?? 0}</div>
            </div>
          </div>

          {/* Cooldown Status Pill */}
          {autoscaling && (
            <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-[11px]">
              <span className="text-slate-600 font-semibold flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                <span>Cooldowns Remaining:</span>
              </span>
              <div className="space-x-2 font-mono text-[10px]">
                <span className={autoscaling.cooldownRemaining.scaleOut > 0 ? "text-amber-600 font-bold" : "text-slate-400"}>
                  Out: {autoscaling.cooldownRemaining.scaleOut}t
                </span>
                <span className={autoscaling.cooldownRemaining.scaleIn > 0 ? "text-purple-600 font-bold" : "text-slate-400"}>
                  In: {autoscaling.cooldownRemaining.scaleIn}t
                </span>
              </div>
            </div>
          )}

          {/* Active Virtual Replicas Table */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">Virtual Replicas Registry</span>
              <span className="text-[10px] font-mono text-indigo-600 font-bold">
                {Object.keys(virtualReplicas).length} total
              </span>
            </div>

            {Object.keys(virtualReplicas).length === 0 ? (
              <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded text-center">
                No active virtual replicas. Run simulation to initialize replicas.
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.values(virtualReplicas).map((rep) => {
                  let stateBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";
                  if (rep.isFailed) stateBadge = "bg-red-100 text-red-800 border-red-200";
                  else if (rep.state === "provisioning") stateBadge = "bg-amber-100 text-amber-800 border-amber-200 animate-pulse";
                  else if (rep.state === "draining") stateBadge = "bg-purple-100 text-purple-800 border-purple-200";

                  return (
                    <div key={rep.id} className="p-2 bg-slate-50 border border-slate-200 rounded-md flex justify-between items-center text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate" title={rep.name}>
                          {rep.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {rep.id} &bull; Handled: {rep.handledRequests}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="font-mono text-[10px] font-semibold text-slate-600">
                          {rep.activeRequests}/{rep.modeledCapacity} load
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${stateBadge}`}>
                          {rep.isFailed ? "FAILED" : rep.state}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Decision Explainability Card */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">Latest Scaling Decision Rationale</span>
            {autoscaling?.lastDecision ? (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-md text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    autoscaling.lastDecision.direction === "SCALE_OUT"
                      ? "bg-indigo-600 text-white"
                      : autoscaling.lastDecision.direction === "SCALE_IN"
                        ? "bg-purple-600 text-white"
                        : "bg-slate-200 text-slate-700"
                  }`}>
                    {autoscaling.lastDecision.direction}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Target: {autoscaling.lastDecision.targetReplicas} replicas
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px] pt-1">
                  {autoscaling.lastDecision.reason}
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-50 p-2.5 rounded text-center">
                No scaling decisions recorded yet.
              </div>
            )}
          </div>

          {/* Historical Utilization & Capacity Chart */}
          {autoscaling && autoscaling.history.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">Simulation History Chart</span>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Tick &bull; Utilization (%)</span>
                  <span>Ready Replicas</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {autoscaling.history.slice(-8).reverse().map((h) => {
                    const isDecisionTick = h.decision !== undefined;
                    return (
                      <div key={h.tick} className={`flex items-center justify-between p-1 rounded font-mono text-[10px] ${
                        isDecisionTick ? "bg-indigo-100 text-indigo-900 font-bold" : "bg-white text-slate-700"
                      }`}>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-400">T:{h.tick}</span>
                          <span>{h.utilization.toFixed(0)}%</span>
                          {isDecisionTick && (
                            <span className="text-[9px] bg-indigo-600 text-white px-1 rounded">
                              {h.decision?.direction}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>{h.readyReplicas} reps</span>
                          <span className="text-slate-400">({h.activeRequests} reqs)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
