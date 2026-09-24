import React from "react";
import { useWorkflowStore } from "../../store/workflowStore";
import { Save, Undo, Redo, Trash2, CheckCircle2, Play } from "lucide-react";

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
    runAnalysis
  } = useWorkflowStore();

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

  return (
    <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shadow-sm z-10">
      <div className="flex items-center space-x-4 w-1/3">
        <input 
          type="text" 
          value={project.name}
          onChange={handleNameChange}
          className="font-semibold text-lg text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors w-full"
        />
      </div>
      
      <div className="flex items-center justify-center space-x-2">
        <button onClick={handleSave} className="toolbar-btn" title="Save Project">
          <Save size={18} />
          <span className="ml-2 text-sm font-medium">Save</span>
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <button onClick={undo} disabled={history.length === 0} className="toolbar-btn disabled:opacity-50" title="Undo">
          <Undo size={18} />
        </button>
        <button onClick={redo} disabled={futureHistory.length === 0} className="toolbar-btn disabled:opacity-50" title="Redo">
          <Redo size={18} />
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <button 
          onClick={handleDelete} 
          disabled={!selectedResourceId} 
          className="toolbar-btn text-red-600 disabled:opacity-50 disabled:text-slate-600" 
          title="Delete Selected"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex items-center space-x-2 w-1/3 justify-end">
        <button 
          className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          onClick={() => runAnalysis()}
        >
          <CheckCircle2 size={16} className="text-blue-600" />
          <span>Validate</span>
        </button>
        <button className="toolbar-btn bg-slate-100 text-slate-400 cursor-not-allowed" disabled title="Phase 3 Feature">
          <Play size={18} className="mr-2" />
          <span className="text-sm font-medium">Run Simulation</span>
        </button>
      </div>
    </div>
  );
}
