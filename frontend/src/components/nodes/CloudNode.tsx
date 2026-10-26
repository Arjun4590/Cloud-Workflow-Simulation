import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { RESOURCE_DEFINITIONS } from '../../config/resourceDefinitions';
import { useWorkflowStore } from '../../store/workflowStore';
import { useSimulationStore } from '../../store/simulationStore';
import { AlertTriangle, XCircle, CheckCircle2, Zap, Skull, RotateCcw } from 'lucide-react';
import type { CloudResource } from '../../types/workflow';

interface CloudNodeProps {
  data: {
    resource: CloudResource;
    selected: boolean;
  };
}

const CloudNode = ({ data }: CloudNodeProps) => {
  const { resource, selected } = data;
  const { validationResult } = useWorkflowStore();
  const { snapshot, injectFailure, recoverResource } = useSimulationStore();

  const definition = RESOURCE_DEFINITIONS[resource.type];
  if (!definition) return null;

  const Icon = definition.icon;
  
  const nodeErrors = validationResult?.errors.filter(e => e.resourceId === resource.id) || [];
  const nodeWarnings = validationResult?.warnings.filter(e => e.resourceId === resource.id) || [];

  const hasError = nodeErrors.length > 0;
  const hasWarning = nodeWarnings.length > 0;

  // Runtime simulation state
  const runtimeInfo = snapshot?.resources[resource.id];
  const isSimulationActive = snapshot !== null && snapshot.status !== "idle";
  const isFailed = runtimeInfo?.isFailed ?? false;
  const runtimeState = runtimeInfo?.state;
  const activeRequests = runtimeInfo?.activeRequests ?? 0;

  let borderClass = 'border-slate-200';
  let bgClass = 'bg-white';

  if (selected) {
    borderClass = 'border-blue-500 shadow-md ring-2 ring-blue-400';
  } else if (isFailed) {
    borderClass = 'border-red-500 shadow-md ring-2 ring-red-400 animate-pulse';
    bgClass = 'bg-red-50/50';
  } else if (runtimeState === 'running') {
    borderClass = 'border-blue-500 shadow-md ring-2 ring-blue-300 animate-pulse';
    bgClass = 'bg-blue-50/30';
  } else if (runtimeState === 'completed') {
    borderClass = 'border-emerald-500 ring-1 ring-emerald-300';
  } else if (hasError) {
    borderClass = 'border-red-500 shadow-sm shadow-red-200 ring-1 ring-red-500';
  } else if (hasWarning) {
    borderClass = 'border-yellow-500 shadow-sm shadow-yellow-200';
  }

  const handleToggleFailure = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFailed) {
      recoverResource(resource.id);
    } else {
      injectFailure(resource.id, "Manual failure injection from node");
    }
  };

  return (
    <div className={`${bgClass} rounded-lg border ${borderClass} p-3 min-w-[170px] max-w-[220px] transition-all relative shadow-sm hover:shadow group`}>
      {/* Validation Issue Badges */}
      {hasError && !isSimulationActive && (
        <div className="absolute -top-2 -right-2 bg-white rounded-full shadow" title={nodeErrors[0]?.message}>
          <XCircle size={16} className="text-red-500" />
        </div>
      )}
      {!hasError && hasWarning && !isSimulationActive && (
        <div className="absolute -top-2 -right-2 bg-white rounded-full shadow" title={nodeWarnings[0]?.message}>
          <AlertTriangle size={16} className="text-yellow-500" />
        </div>
      )}

      {/* Simulation Runtime Status Badge */}
      {isSimulationActive && runtimeState && (
        <div className="absolute -top-2.5 right-2">
          {isFailed ? (
            <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              <Skull size={10} /> FAILED
            </span>
          ) : runtimeState === 'running' ? (
            <span className="flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow animate-pulse">
              <Zap size={10} /> {activeRequests > 0 ? `${activeRequests} Active` : 'RUNNING'}
            </span>
          ) : runtimeState === 'completed' ? (
            <span className="flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              <CheckCircle2 size={10} /> READY
            </span>
          ) : (
            <span className="bg-slate-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full shadow opacity-80">
              PENDING
            </span>
          )}
        </div>
      )}

      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-slate-400" />
      
      <div className="flex items-center space-x-2.5 mb-2">
        <div className={`p-1.5 rounded-md ${isFailed ? 'bg-red-100 text-red-600' : runtimeState === 'running' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-700'}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
            {definition.label}
          </div>
          <div className="text-sm font-semibold text-slate-800 truncate" title={resource.configuration.name || resource.name}>
            {resource.configuration.name || resource.name}
          </div>
        </div>
      </div>
      
      {/* Configuration / Runtime Summary */}
      {isSimulationActive && runtimeInfo && (runtimeInfo.handledRequests > 0 || isFailed) ? (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] flex justify-between items-center text-slate-600">
          <span>Processed: <strong className="text-slate-800">{runtimeInfo.handledRequests}</strong></span>
          {runtimeInfo.activeRequests > 0 && (
            <span className="text-blue-600 font-semibold">Load: {runtimeInfo.activeRequests}</span>
          )}
          {runtimeInfo.failedRequests > 0 && (
            <span className="text-red-600 font-semibold">Lost: {runtimeInfo.failedRequests}</span>
          )}
        </div>
      ) : Object.keys(resource.configuration).length > 1 ? (
        <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
          {Object.entries(resource.configuration)
            .filter(([k]) => k !== 'name')
            .slice(0, 2)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between truncate">
                <span className="capitalize opacity-75 mr-1">{k}:</span>
                <span className="font-medium truncate text-slate-700" title={String(v)}>{String(v)}</span>
              </div>
            ))}
        </div>
      ) : null}

      {/* Quick Interactive Failure Toggle in Simulation */}
      {isSimulationActive && (
        <div className="mt-2 pt-1 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleToggleFailure}
            className={`text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
              isFailed
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            }`}
            title={isFailed ? "Recover this resource back to healthy state" : "Simulate crash/outage on this resource"}
          >
            {isFailed ? (
              <>
                <RotateCcw size={10} /> Revive
              </>
            ) : (
              <>
                <Skull size={10} /> Fail Node
              </>
            )}
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-slate-400" />
    </div>
  );
};

export default memo(CloudNode);
