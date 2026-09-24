import React from "react";
import { useWorkflowStore } from "../../store/workflowStore";
import { RESOURCE_DEFINITIONS } from "../../config/resourceDefinitions";

export default function PropertiesPanel() {
  const { project, selectedResourceId, updateResource } = useWorkflowStore();
  
  if (!selectedResourceId) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 h-full flex items-center justify-center text-slate-400 p-6 text-center">
        Select a component on the canvas to configure its properties.
      </div>
    );
  }

  const resource = project.resources.find(r => r.id === selectedResourceId);
  if (!resource) return null;

  const definition = RESOURCE_DEFINITIONS[resource.type];
  if (!definition) return null;

  const handleConfigChange = (fieldName: string, value: any) => {
    updateResource(resource.id, {
      ...resource.configuration,
      [fieldName]: value
    });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateResource(resource.id, {
      ...resource.configuration,
      name: e.target.value
    });
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center bg-slate-50">
        <definition.icon size={20} className="text-blue-600 mr-2" />
        <h2 className="font-semibold text-slate-800 uppercase text-sm tracking-wide">{definition.label} Properties</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name is a special case handled universally */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-500">Resource Name</label>
          <input
            type="text"
            value={resource.configuration.name || ""}
            onChange={handleNameChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {definition.configurationFields.filter(f => f.name !== 'name').map((field) => (
          <div key={field.name} className="space-y-1">
            <label className="block text-xs font-medium text-slate-500">{field.label}</label>
            
            {field.type === "text" && (
              <input
                type="text"
                value={resource.configuration[field.name] || ""}
                onChange={(e) => handleConfigChange(field.name, e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
            
            {field.type === "number" && (
              <input
                type="number"
                value={resource.configuration[field.name] || ""}
                onChange={(e) => handleConfigChange(field.name, parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}

            {field.type === "select" && field.options && (
              <select
                value={resource.configuration[field.name] || ""}
                onChange={(e) => handleConfigChange(field.name, e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {field.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
