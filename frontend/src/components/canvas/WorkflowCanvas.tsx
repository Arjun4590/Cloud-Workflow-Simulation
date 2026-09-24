import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

import CloudNode from '../nodes/CloudNode';
import { useWorkflowStore } from '../../store/workflowStore';
import { RESOURCE_DEFINITIONS } from '../../config/resourceDefinitions';
import type { ResourceType, CloudResource, ConnectionType } from '../../types/workflow';

const nodeTypes = {
  cloudNode: CloudNode,
};

function Canvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const { 
    project, 
    positions, 
    addResource, 
    updateNodePosition, 
    selectResource,
    addConnection,
    deleteConnection,
    deleteResource,
    selectedResourceId,
    loadProject
  } = useWorkflowStore();

  // Initial load
  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Sync Project State to React Flow Visual State
  useEffect(() => {
    const newNodes: Node[] = project.resources.map(res => ({
      id: res.id,
      type: 'cloudNode',
      position: positions[res.id] || { x: 0, y: 0 },
      data: { 
        resource: res,
        selected: selectedResourceId === res.id
      },
      selected: selectedResourceId === res.id
    }));
    setNodes(newNodes);

    const newEdges: Edge[] = project.connections.map(conn => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 }
    }));
    setEdges(newEdges);
  }, [project, positions, selectedResourceId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const source = project.resources.find(r => r.id === params.source);
      const target = project.resources.find(r => r.id === params.target);
      
      let edgeType: ConnectionType = "dependency";
      let actualSource = params.source!;
      let actualTarget = params.target!;
      
      if (source && target) {
        const sourceDef = RESOURCE_DEFINITIONS[source.type];
        const targetDef = RESOURCE_DEFINITIONS[target.type];
        
        let forwardMatch = false;

        // 1. Check forward relationship (Source -> Target)
        if (sourceDef.acceptsOutgoing) {
          for (const [connType, targetTypes] of Object.entries(sourceDef.acceptsOutgoing)) {
            if ((targetTypes as string[]).includes(target.type)) {
              edgeType = connType as ConnectionType;
              forwardMatch = true;
              break;
            }
          }
        }

        // 2. If no forward match, check reverse relationship (Target -> Source)
        if (!forwardMatch && targetDef.acceptsOutgoing) {
          for (const [connType, sourceTypes] of Object.entries(targetDef.acceptsOutgoing)) {
            if ((sourceTypes as string[]).includes(source.type)) {
              edgeType = connType as ConnectionType;
              // Flip the connection direction so it matches the semantic model
              actualSource = params.target!;
              actualTarget = params.source!;
              break;
            }
          }
        }
      }

      addConnection({
        id: uuidv4(),
        source: actualSource,
        target: actualTarget,
        type: edgeType
      });
    },
    [project.resources, addConnection]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as ResourceType;

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const def = RESOURCE_DEFINITIONS[type];
      const newResource: CloudResource = {
        id: uuidv4(),
        type,
        name: def.defaultConfiguration.name || 'new-resource',
        configuration: { ...def.defaultConfiguration }
      };

      addResource(newResource, position);
      selectResource(newResource.id);
    },
    [reactFlowInstance, addResource, selectResource]
  );

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[], edges: Edge[] }) => {
    if (nodes.length === 1) {
      selectResource(nodes[0].id);
    } else {
      selectResource(null);
    }
  }, [selectResource]);

  const onNodeDragStop = useCallback(
    (_: any, node: any) => {
      updateNodePosition(node.id, node.position);
    },
    [updateNodePosition]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach(edge => deleteConnection(edge.id));
    },
    [deleteConnection]
  );
  
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach(node => deleteResource(node.id));
    },
    [deleteResource]
  );

  return (
    <div className="reactflow-wrapper w-full h-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Controls />
        <MiniMap zoomable pannable nodeClassName="bg-slate-300" maskColor="rgba(248, 250, 252, 0.7)" />
        <Background color="#cbd5e1" gap={16} />
      </ReactFlow>
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
