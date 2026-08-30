import type { TaskRepository } from './repository';
import type {
  AddChecklistItemInput,
  CreateTaskInput,
  Task,
  TaskChecklistItem,
  TaskStatus,
  UpdateTaskInput,
} from './types';

function assertNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function assertDates(startAt?: string | null, dueAt?: string | null): void {
  if (!startAt || !dueAt) return;
  if (new Date(dueAt).getTime() < new Date(startAt).getTime()) {
    throw new Error('dueAt must be greater than or equal to startAt');
  }
}

function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (from === to) return;
  if (from === 'COMPLETED' && to !== 'IN_PROGRESS') {
    throw new Error('COMPLETED may only transition to IN_PROGRESS');
  }
  if (from === 'CANCELED' && to !== 'TO_DO') {
    throw new Error('CANCELED may only transition to TO_DO');
  }
}

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  async createTask(actorId: string, input: CreateTaskInput): Promise<Task> {
    assertNonBlank(input.title, 'title');
    assertDates(input.startAt, input.dueAt);
    return this.repository.createTask(actorId, { ...input, title: input.title.trim() });
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.repository.getTask(taskId);
  }

  async listProjectTasks(projectId: string): Promise<Task[]> {
    return this.repository.listProjectTasks(projectId);
  }

  async listMyTasks(actorId: string): Promise<Task[]> {
    return this.repository.listMyTasks(actorId);
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    if (input.title !== undefined) assertNonBlank(input.title, 'title');
    assertDates(input.startAt, input.dueAt);
    return this.repository.updateTask(taskId, {
      ...input,
      title: input.title?.trim(),
    });
  }

  async changeStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const current = await this.repository.getTask(taskId);
    if (!current) throw new Error('task not found');
    assertTransition(current.status, status);
    return this.repository.changeStatus(taskId, status);
  }

  async cancelTask(taskId: string): Promise<Task> {
    return this.changeStatus(taskId, 'CANCELED');
  }

  async reactivateTask(taskId: string): Promise<Task> {
    const current = await this.repository.getTask(taskId);
    if (!current) throw new Error('task not found');
    if (current.status !== 'CANCELED') throw new Error('only CANCELED tasks can be reactivated');
    return this.repository.changeStatus(taskId, 'TO_DO');
  }

  async addParticipant(taskId: string, userId: string): Promise<void> {
    return this.repository.addParticipant(taskId, userId);
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    return this.repository.removeParticipant(taskId, userId);
  }

  async addChecklistItem(input: AddChecklistItemInput): Promise<TaskChecklistItem> {
    assertNonBlank(input.text, 'checklist text');
    if ((input.position ?? 0) < 0) throw new Error('position must be non-negative');
    return this.repository.addChecklistItem({ ...input, text: input.text.trim() });
  }

  async setChecklistCompletion(itemId: string, completed: boolean): Promise<TaskChecklistItem> {
    return this.repository.setChecklistCompletion(itemId, completed);
  }

  async updateChecklistItem(itemId: string, text: string, position: number): Promise<TaskChecklistItem> {
    assertNonBlank(text, 'checklist text');
    if (position < 0) throw new Error('position must be non-negative');
    return this.repository.updateChecklistItem(itemId, text.trim(), position);
  }

  async removeChecklistItem(itemId: string): Promise<void> {
    return this.repository.removeChecklistItem(itemId);
  }
}
