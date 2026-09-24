
import WorkflowToolbar from "../toolbar/WorkflowToolbar";
import ComponentLibrary from "../sidebar/ComponentLibrary";
import PropertiesPanel from "../panels/PropertiesPanel";
import AnalysisPanel from "../panels/AnalysisPanel";
import { useWorkflowStore } from "../../store/workflowStore";
import WorkflowCanvas from "../canvas/WorkflowCanvas";

export default function AppLayout() {
  const { project } = useWorkflowStore();
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 text-slate-800">
      <WorkflowToolbar />
      <div className="flex flex-1 overflow-hidden">
        <ComponentLibrary />
        <div className="flex-1 relative">
          <WorkflowCanvas />
        </div>
        <AnalysisPanel />
        <PropertiesPanel />
      </div>
      <div className="h-8 border-t border-slate-200 bg-white flex items-center px-4 text-xs text-slate-500 justify-between">
        <div className="flex space-x-4">
          <span>Resources: {project.resources.length}</span>
          <span>Connections: {project.connections.length}</span>
        </div>
        <div>
          <span>Cloud Workflow Engine — Phase 1</span>
        </div>
      </div>
    </div>
  );
}
