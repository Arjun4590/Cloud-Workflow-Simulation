import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { RESOURCE_DEFINITIONS } from '../../config/resourceDefinitions';
import { useWorkflowStore } from '../../store/workflowStore';
import { AlertTriangle, XCircle } from 'lucide-react';
import type { CloudResource } from '../../types/workflow';

interface CloudNodeProps {
  data: {
    resource: CloudResource;
    selected: boolean;
  };
}

const CloudNode = ({ data }: CloudNodeProps) => {
  const { resource, selected } = data;
  const definition = RESOURCE_DEFINITIONS[resource.type];
  if (!definition) return null;

  const Icon = definition.icon;

  const { validationResult } = useWorkflowStore();
  
  const nodeErrors = validationResult?.errors.filter(e => e.resourceId === resource.id) || [];
  const nodeWarnings = validationResult?.warnings.filter(e => e.resourceId === resource.id) || [];

  const hasError = nodeErrors.length > 0;
  const hasWarning = nodeWarnings.length > 0;

  let borderClass = 'border-slate-200';
  if (selected) {
    borderClass = 'border-blue-500 shadow-md ring-1 ring-blue-500';
  } else if (hasError) {
    borderClass = 'border-red-500 shadow-sm shadow-red-200 ring-1 ring-red-500';
  } else if (hasWarning) {
    borderClass = 'border-yellow-500 shadow-sm shadow-yellow-200';
  }

  return (
    <div className={`bg-white rounded-md border ${borderClass} p-3 min-w-[150px] transition-all relative`}>
      {hasError && (
        <div className="absolute -top-2 -right-2 bg-white rounded-full">
          <XCircle size={16} className="text-red-500" />
        </div>
      )}
      {!hasError && hasWarning && (
        <div className="absolute -top-2 -right-2 bg-white rounded-full">
          <AlertTriangle size={16} className="text-yellow-500" />
        </div>
      )}
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400" />
      
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-1.5 bg-slate-100 rounded-md text-slate-700">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {definition.label}
          </div>
          <div className="text-sm font-medium text-slate-800 truncate max-w-[120px]">
            {resource.configuration.name || resource.name}
          </div>
        </div>
      </div>
      
      {/* Configuration Summary - show one or two key pieces of config */}
      {Object.keys(resource.configuration).length > 1 && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          {Object.entries(resource.configuration)
            .filter(([k]) => k !== 'name')
            .slice(0, 2)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between truncate">
                <span className="capitalize opacity-75 mr-2">{k}:</span>
                <span className="font-medium truncate" title={String(v)}>{String(v)}</span>
              </div>
            ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
};

export default memo(CloudNode);
