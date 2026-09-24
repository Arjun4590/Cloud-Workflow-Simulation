import React from "react";
import { RESOURCE_DEFINITIONS } from "../../config/resourceDefinitions";
import type { ResourceDefinition } from "../../config/resourceDefinitions";
import type { ResourceType } from "../../types/workflow";

export default function ComponentLibrary() {
  const categories = ["Infrastructure", "Containers", "Kubernetes", "Application", "Data"] as const;

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: ResourceType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-200 font-semibold text-slate-800">
        Component Library
      </div>
      <div className="flex-1 p-2 space-y-4">
        {categories.map((category) => {
          const categoryResources = Object.values(RESOURCE_DEFINITIONS).filter(
            (def) => def.category === category
          );

          if (categoryResources.length === 0) return null;

          return (
            <div key={category} className="mb-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                {category}
              </h3>
              <div className="space-y-1">
                {categoryResources.map((def: ResourceDefinition) => (
                  <div
                    key={def.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, def.type)}
                    className="flex items-center p-2 rounded-md hover:bg-slate-100 cursor-grab active:cursor-grabbing text-slate-700 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200"
                  >
                    <def.icon size={18} className="mr-3" />
                    <span className="text-sm font-medium">{def.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
