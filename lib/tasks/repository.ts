import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AddChecklistItemInput,
  CreateTaskInput,
  Task,
  TaskChecklistItem,
  TaskStatus,
  UpdateTaskInput,
} from './types';

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Task['priority'];
  assignee_id: string | null;
  start_at: string | null;
  due_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type ChecklistRow = {
  id: string;
  task_id: string;
  text: string;
  position: number;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    startAt: row.start_at,
    dueAt: row.due_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChecklistItem(row: ChecklistRow): TaskChecklistItem {
  return {
    id: row.id,
    taskId: row.task_id,
    text: row.text,
    position: row.position,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export interface TaskRepository {
  createTask(actorId: string, input: CreateTaskInput): Promise<Task>;
  getTask(taskId: string): Promise<Task | null>;
  listProjectTasks(projectId: string): Promise<Task[]>;
  listMyTasks(assigneeId: string): Promise<Task[]>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<Task>;
  changeStatus(taskId: string, status: TaskStatus): Promise<Task>;
  addParticipant(taskId: string, userId: string): Promise<void>;
  removeParticipant(taskId: string, userId: string): Promise<void>;
  addChecklistItem(input: AddChecklistItemInput): Promise<TaskChecklistItem>;
  setChecklistCompletion(itemId: string, completed: boolean): Promise<TaskChecklistItem>;
  updateChecklistItem(itemId: string, text: string, position: number): Promise<TaskChecklistItem>;
  removeChecklistItem(itemId: string): Promise<void>;
}

export class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createTask(actorId: string, input: CreateTaskInput): Promise<Task> {
    const { data, error } = await this.client
      .from('tasks')
      .insert({
        project_id: input.projectId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 'NORMAL',
        assignee_id: input.assigneeId ?? null,
        start_at: input.startAt ?? null,
        due_at: input.dueAt ?? null,
        created_by: actorId,
      })
      .select('*')
      .single();

    throwIfError(error);
    return mapTask(data as TaskRow);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const { data, error } = await this.client.from('tasks').select('*').eq('id', taskId).maybeSingle();
    throwIfError(error);
    return data ? mapTask(data as TaskRow) : null;
  }

  async listProjectTasks(projectId: string): Promise<Task[]> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    throwIfError(error);
    return (data as TaskRow[] | null)?.map(mapTask) ?? [];
  }

  async listMyTasks(assigneeId: string): Promise<Task[]> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('assignee_id', assigneeId)
      .order('due_at', { ascending: true, nullsFirst: false });
    throwIfError(error);
    return (data as TaskRow[] | null)?.map(mapTask) ?? [];
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const patch: Record<string, string | null | undefined> = {
      title: input.title,
      description: input.description,
      priority: input.priority,
      assignee_id: input.assigneeId,
      start_at: input.startAt,
      due_at: input.dueAt,
    };
    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

    const { data, error } = await this.client.from('tasks').update(patch).eq('id', taskId).select('*').single();
    throwIfError(error);
    return mapTask(data as TaskRow);
  }

  async changeStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const { data, error } = await this.client
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .select('*')
      .single();
    throwIfError(error);
    return mapTask(data as TaskRow);
  }

  async addParticipant(taskId: string, userId: string): Promise<void> {
    const { error } = await this.client.from('task_participants').insert({ task_id: taskId, user_id: userId });
    throwIfError(error);
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('task_participants')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId);
    throwIfError(error);
  }

  async addChecklistItem(input: AddChecklistItemInput): Promise<TaskChecklistItem> {
    const { data, error } = await this.client
      .from('task_checklist_items')
      .insert({ task_id: input.taskId, text: input.text, position: input.position ?? 0 })
      .select('*')
      .single();
    throwIfError(error);
    return mapChecklistItem(data as ChecklistRow);
  }

  async setChecklistCompletion(itemId: string, completed: boolean): Promise<TaskChecklistItem> {
    const { data, error } = await this.client
      .from('task_checklist_items')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', itemId)
      .select('*')
      .single();
    throwIfError(error);
    return mapChecklistItem(data as ChecklistRow);
  }

  async updateChecklistItem(itemId: string, text: string, position: number): Promise<TaskChecklistItem> {
    const { data, error } = await this.client
      .from('task_checklist_items')
      .update({ text, position })
      .eq('id', itemId)
      .select('*')
      .single();
    throwIfError(error);
    return mapChecklistItem(data as ChecklistRow);
  }

  async removeChecklistItem(itemId: string): Promise<void> {
    const { error } = await this.client.from('task_checklist_items').delete().eq('id', itemId);
    throwIfError(error);
  }
}
