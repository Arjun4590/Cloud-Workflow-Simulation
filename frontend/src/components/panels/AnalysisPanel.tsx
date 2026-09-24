import { X, CheckCircle, AlertTriangle, XCircle, Info, PlayCircle } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export default function AnalysisPanel() {
  const { isAnalysisPanelOpen, setAnalysisPanelOpen, validationResult, executionPlan, selectResource, project } = useWorkflowStore();

  if (!isAnalysisPanelOpen) return null;

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
        <h2 className="text-sm font-semibold text-slate-800">Workflow Analysis</h2>
        <button onClick={() => setAnalysisPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex-1">
        {(!validationResult || !executionPlan) ? (
          <div className="text-sm text-slate-500">Run validation to see results.</div>
        ) : (
          <div className="space-y-6">
            
            {/* Status Overview */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</h3>
              {validationResult.valid ? (
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-2 rounded border border-green-100">
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">Workflow Valid</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-2 rounded border border-red-100">
                  <XCircle size={16} />
                  <span className="text-sm font-medium">Validation Errors Found</span>
                </div>
              )}
            </div>

            {/* Validation Issues */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issues</h3>
              
              {validationResult.errors.length === 0 && validationResult.warnings.length === 0 && validationResult.infos.length === 0 && (
                <p className="text-sm text-slate-500">No issues detected.</p>
              )}

              {validationResult.errors.map((error, idx) => (
                <div 
                  key={`err-${idx}`} 
                  className="p-3 bg-red-50 border border-red-100 rounded-md cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => error.resourceId && selectResource(error.resourceId)}
                >
                  <div className="flex items-start space-x-2">
                    <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-red-700">{error.code}</div>
                      <div className="text-xs text-red-600 mt-1">{error.message}</div>
                    </div>
                  </div>
                </div>
              ))}

              {validationResult.warnings.map((warning, idx) => (
                <div 
                  key={`warn-${idx}`} 
                  className="p-3 bg-yellow-50 border border-yellow-100 rounded-md cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={() => warning.resourceId && selectResource(warning.resourceId)}
                >
                  <div className="flex items-start space-x-2">
                    <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-yellow-700">{warning.code}</div>
                      <div className="text-xs text-yellow-600 mt-1">{warning.message}</div>
                    </div>
                  </div>
                </div>
              ))}

              {validationResult.infos.map((info, idx) => (
                <div 
                  key={`info-${idx}`} 
                  className="p-3 bg-blue-50 border border-blue-100 rounded-md cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => info.resourceId && selectResource(info.resourceId)}
                >
                  <div className="flex items-start space-x-2">
                    <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-blue-700">{info.code}</div>
                      <div className="text-xs text-blue-600 mt-1">{info.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Execution Plan */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Execution Plan</h3>
              
              {!executionPlan.valid ? (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle size={14} /> Cannot generate plan
                </p>
              ) : executionPlan.stages.length === 0 ? (
                <p className="text-sm text-slate-500">No resources to execute.</p>
              ) : (
                <div className="space-y-4">
                  {executionPlan.stages.map((stage) => (
                    <div key={stage.index} className="space-y-2">
                      <div className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <PlayCircle size={12} /> Stage {stage.index}
                      </div>
                      <div className="pl-4 space-y-1">
                        {stage.resourceIds.map(rId => {
                          const res = project.resources.find(r => r.id === rId);
                          return (
                            <div key={rId} className="flex items-center gap-2 text-sm text-slate-700">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                              <span 
                                className="cursor-pointer hover:text-blue-600 hover:underline"
                                onClick={() => selectResource(rId)}
                              >
                                {res?.configuration.name || rId}
                              </span>
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
      </div>
    </div>
  );
}
