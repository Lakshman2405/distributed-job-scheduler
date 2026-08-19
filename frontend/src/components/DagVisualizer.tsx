import React, { useState } from 'react';
import { Workflow } from '../types';
import { api } from '../services/api';
import { formatPayloadToText } from '../utils/formatters';
import { Zap, Play, ArrowRight } from 'lucide-react';

interface DagProps {
  workflows: Workflow[];
  onRefresh: () => void;
}

export const DagVisualizer: React.FC<DagProps> = ({ workflows, onRefresh }) => {
  const [selectedWf, setSelectedWf] = useState<Workflow | null>(workflows[0] || null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const handleRunWorkflow = async () => {
    if (!selectedWf) return;
    setIsExecuting(true);
    setExecutionMessage(null);
    try {
      const res = await api.executeWorkflow(selectedWf.id);
      setExecutionMessage(`Pipeline triggered! Execution ID: ${res.result.workflowExecutionId}. (${res.result.createdJobsCount} DAG step jobs enqueued).`);
      onRefresh();
    } catch (err: any) {
      setExecutionMessage(`Failed to trigger pipeline: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span>DAG Workflow Pipeline Orchestration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Multi-step dependency graph pipelines with conditional joins and topological step execution</p>
        </div>

        {selectedWf && (
          <button
            onClick={handleRunWorkflow}
            disabled={isExecuting}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isExecuting ? 'Triggering Pipeline...' : 'Execute Workflow DAG'}</span>
          </button>
        )}
      </div>

      {executionMessage && (
        <div className="p-3.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
          {executionMessage}
        </div>
      )}

      {/* Main Graph View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Workflow List Sidebar */}
        <div className="glass-panel rounded-xl p-4 border border-slate-800 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Pipelines</h3>
          {workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => setSelectedWf(wf)}
              className={`p-3 rounded-lg border cursor-pointer transition ${
                selectedWf?.id === wf.id
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <div className="font-bold text-sm text-white">{wf.name}</div>
              <div className="text-[11px] text-slate-400 mt-1">{wf.nodes?.length || 0} Dependent Nodes</div>
            </div>
          ))}
        </div>

        {/* Visual Pipeline Graph Canvas */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 lg:col-span-3 min-h-[380px] flex flex-col justify-between">
          {!selectedWf ? (
            <div className="text-slate-500 text-center py-20">Select a workflow to visualize node dependencies.</div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white">{selectedWf.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedWf.description}</p>
              </div>

              {/* Node Graph Cascade View */}
              <div className="flex flex-wrap items-center gap-4 py-8 px-4 bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-x-auto">
                {selectedWf.nodes?.map((node, idx) => {
                  const isRoot = node.parent_node_ids.length === 0;
                  return (
                    <React.Fragment key={node.id}>
                      {idx > 0 && (
                        <div className="flex items-center text-slate-600">
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      )}
                      <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 text-white min-w-[220px] shadow-lg relative group">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isRoot ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}`}>
                            {isRoot ? 'ROOT STEP' : 'DEPENDENT STEP'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">{node.join_condition}</span>
                        </div>

                        <div className="font-bold text-sm text-cyan-300">{node.name}</div>
                        {/* Human-readable parameter text instead of raw JSON! */}
                        <div className="text-[11px] font-medium text-slate-300 mt-2">
                          {formatPayloadToText(node.payload_template)}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
