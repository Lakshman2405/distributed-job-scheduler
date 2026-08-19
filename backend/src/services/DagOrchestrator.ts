import { db } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { JobService } from './JobService';

export class DagOrchestrator {
  /**
   * Create a new DAG Workflow definition
   */
  static createWorkflow(projectId: string, name: string, description: string | undefined, nodes: Array<{
    name: string;
    queueId: string;
    payloadTemplate?: any;
    parentNodeNames?: string[];
    joinCondition?: 'ALL_SUCCESS' | 'ANY_SUCCESS';
  }>) {
    const workflowId = `wf_${uuidv4().substring(0, 8)}`;
    
    db.prepare(`
      INSERT INTO workflows (id, project_id, name, description, trigger_type)
      VALUES (?, ?, ?, ?, 'MANUAL')
    `).run(workflowId, projectId, name, description || null);

    const nameToNodeIdMap: Record<string, string> = {};

    // 1. Create nodes
    for (const node of nodes) {
      const nodeId = `wfn_${uuidv4().substring(0, 8)}`;
      nameToNodeIdMap[node.name] = nodeId;

      db.prepare(`
        INSERT INTO workflow_nodes (id, workflow_id, name, queue_id, payload_template, parent_node_ids, join_condition)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        nodeId,
        workflowId,
        node.name,
        node.queueId,
        JSON.stringify(node.payloadTemplate || {}),
        JSON.stringify([]), // Will update after mapping names
        node.joinCondition || 'ALL_SUCCESS'
      );
    }

    // 2. Link parent dependencies
    for (const node of nodes) {
      const nodeId = nameToNodeIdMap[node.name];
      const parentNodeIds = (node.parentNodeNames || []).map((pName) => nameToNodeIdMap[pName]).filter(Boolean);

      db.prepare(`
        UPDATE workflow_nodes
        SET parent_node_ids = ?
        WHERE id = ?
      `).run(JSON.stringify(parentNodeIds), nodeId);
    }

    return this.getWorkflowById(workflowId);
  }

  /**
   * Execute a Workflow pipeline
   */
  static executeWorkflow(workflowId: string, initialPayload?: any) {
    const workflow = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(workflowId) as any;
    if (!workflow) throw new Error(`Workflow '${workflowId}' not found`);

    const workflowExecutionId = `wfexec_${uuidv4().substring(0, 10)}`;
    const nodes = db.prepare(`SELECT * FROM workflow_nodes WHERE workflow_id = ?`).all(workflowId) as any[];

    const nodeJobMap: Record<string, string> = {};

    // Create a Job instance for every node in the DAG
    for (const node of nodes) {
      const payload = {
        ...JSON.parse(node.payload_template || '{}'),
        ...initialPayload
      };

      const job = JobService.createJob({
        queueId: node.queue_id,
        projectId: workflow.project_id,
        type: 'DAG_STEP',
        payload,
        workflowExecutionId,
        workflowNodeId: node.id
      });

      nodeJobMap[node.id] = job.id;
    }

    // Populate runtime JobDependencies
    for (const node of nodes) {
      const childJobId = nodeJobMap[node.id];
      const parentNodeIds = JSON.parse(node.parent_node_ids || '[]');

      for (const parentNodeId of parentNodeIds) {
        const parentJobId = nodeJobMap[parentNodeId];
        if (parentJobId) {
          const depId = `dep_${uuidv4().substring(0, 8)}`;
          db.prepare(`
            INSERT INTO job_dependencies (id, parent_job_id, child_job_id, status)
            VALUES (?, ?, ?, 'WAITING')
          `).run(depId, parentJobId, childJobId);
        }
      }
    }

    // Trigger Root Nodes (nodes with 0 parent dependencies)
    for (const node of nodes) {
      const parentNodeIds = JSON.parse(node.parent_node_ids || '[]');
      if (parentNodeIds.length === 0) {
        const jobId = nodeJobMap[node.id];
        db.prepare(`UPDATE jobs SET status = 'QUEUED' WHERE id = ?`).run(jobId);
      } else {
        // Dependent child nodes wait until dependencies satisfied
        const jobId = nodeJobMap[node.id];
        db.prepare(`UPDATE jobs SET status = 'SCHEDULED' WHERE id = ?`).run(jobId);
      }
    }

    return {
      workflowExecutionId,
      workflowId,
      createdJobsCount: nodes.length
    };
  }

  /**
   * Called upon job completion to evaluate and trigger dependent child jobs in the DAG
   */
  static onJobCompleted(completedJobId: string) {
    // 1. Mark dependency satisfied
    db.prepare(`UPDATE job_dependencies SET status = 'SATISFIED' WHERE parent_job_id = ?`).run(completedJobId);

    // 2. Find child jobs waiting on this parent
    const childDeps = db.prepare(`SELECT DISTINCT child_job_id FROM job_dependencies WHERE parent_job_id = ?`).all(completedJobId) as any[];

    for (const { child_job_id } of childDeps) {
      // Check all parent dependencies for this child job
      const parentDeps = db.prepare(`SELECT * FROM job_dependencies WHERE child_job_id = ?`).all(child_job_id) as any[];

      const allSatisfied = parentDeps.every((dep) => dep.status === 'SATISFIED');
      if (allSatisfied) {
        // Release child job into QUEUED state
        db.prepare(`
          UPDATE jobs SET status = 'QUEUED', run_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'SCHEDULED'
        `).run(child_job_id);
      }
    }
  }

  static getWorkflowById(id: string) {
    const workflow = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as any;
    if (!workflow) return null;

    const nodes = db.prepare(`SELECT * FROM workflow_nodes WHERE workflow_id = ?`).all(id) as any[];
    return {
      ...workflow,
      nodes: nodes.map((n) => ({
        ...n,
        payload_template: JSON.parse(n.payload_template || '{}'),
        parent_node_ids: JSON.parse(n.parent_node_ids || '[]')
      }))
    };
  }

  static listWorkflows(projectId: string) {
    const workflows = db.prepare(`SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as any[];
    return workflows.map((w) => this.getWorkflowById(w.id));
  }
}
