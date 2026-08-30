import { describe, expect, it, vi } from 'vitest';

import type { TaskRepository } from '@/lib/tasks/repository';
import { TaskService } from '@/lib/tasks/service';
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from '@/lib/tasks/types';

const baseTask: Task = {
  id: 'task-1',
  projectId: 'project-1',
  title: 'Tarefa',
  description: null,
  status: 'TO_DO',
  priority: 'NORMAL',
  assigneeId: null,
  startAt: null,
  dueAt: null,
  createdBy: 'user-1',
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

function repository(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    createTask: vi.fn(async (_actorId, input) => ({
      ...baseTask,
      projectId: input.projectId,
      title: input.title,
      priority: input.priority ?? 'NORMAL',
    })),
    getTask: vi.fn(async () => baseTask),
    listProjectTasks: vi.fn(async () => [baseTask]),
    listMyTasks: vi.fn(async () => [baseTask]),
    updateTask: vi.fn(async (_taskId, input) => ({ ...baseTask, ...input } as Task)),
    changeStatus: vi.fn(async (_taskId, status) => ({ ...baseTask, status })),
    addParticipant: vi.fn(async () => undefined),
    removeParticipant: vi.fn(async () => undefined),
    addChecklistItem: vi.fn(async (input) => ({
      id: 'check-1',
      taskId: input.taskId,
      text: input.text,
      position: input.position ?? 0,
      completedAt: null,
      completedBy: null,
      createdAt: baseTask.createdAt,
      updatedAt: baseTask.updatedAt,
    })),
    setChecklistCompletion: vi.fn(async () => ({
      id: 'check-1', taskId: 'task-1', text: 'Item', position: 0,
      completedAt: baseTask.createdAt, completedBy: 'user-1',
      createdAt: baseTask.createdAt, updatedAt: baseTask.updatedAt,
    })),
    updateChecklistItem: vi.fn(async (_itemId, text, position) => ({
      id: 'check-1', taskId: 'task-1', text, position,
      completedAt: null, completedBy: null,
      createdAt: baseTask.createdAt, updatedAt: baseTask.updatedAt,
    })),
    removeChecklistItem: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('G03 Task Core', () => {
  it('keeps the canonical statuses and priorities frozen by G00', () => {
    expect(TASK_STATUSES).toEqual(['TO_DO', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELED']);
    expect(TASK_PRIORITIES).toEqual(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
    expect(TASK_STATUSES).not.toContain('DRAFT');
    expect(TASK_STATUSES).not.toContain('OVERDUE');
  });

  it('creates a Project-scoped task and trims its title', async () => {
    const repo = repository();
    const service = new TaskService(repo);
    const task = await service.createTask('user-1', { projectId: 'project-1', title: '  Comprar aço  ' });
    expect(task.title).toBe('Comprar aço');
    expect(repo.createTask).toHaveBeenCalledWith('user-1', expect.objectContaining({ projectId: 'project-1', title: 'Comprar aço' }));
  });

  it('rejects an invalid date range before persistence', async () => {
    const repo = repository();
    const service = new TaskService(repo);
    await expect(service.createTask('user-1', {
      projectId: 'project-1',
      title: 'Data inválida',
      startAt: '2026-09-10T12:00:00.000Z',
      dueAt: '2026-09-09T12:00:00.000Z',
    })).rejects.toThrow('dueAt');
    expect(repo.createTask).not.toHaveBeenCalled();
  });

  it('allows COMPLETED to reopen only as IN_PROGRESS', async () => {
    const completed: Task = { ...baseTask, status: 'COMPLETED' };
    const repo = repository({ getTask: vi.fn(async () => completed) });
    const service = new TaskService(repo);
    await expect(service.changeStatus('task-1', 'TO_DO')).rejects.toThrow('COMPLETED');
    const reopened = await service.changeStatus('task-1', 'IN_PROGRESS');
    expect(reopened.status).toBe('IN_PROGRESS');
  });

  it('allows CANCELED to reactivate only as TO_DO', async () => {
    const canceledTask: Task = { ...baseTask, status: 'CANCELED' };
    const repo = repository({ getTask: vi.fn(async () => canceledTask) });
    const service = new TaskService(repo);
    await expect(service.changeStatus('task-1', 'IN_PROGRESS')).rejects.toThrow('CANCELED');
    const reactivated = await service.reactivateTask('task-1');
    expect(reactivated.status).toBe('TO_DO');
  });

  it('defines My Tasks as the authenticated user assignee projection', async () => {
    const repo = repository();
    const service = new TaskService(repo);
    await service.listMyTasks('user-77');
    expect(repo.listMyTasks).toHaveBeenCalledWith('user-77');
  });

  it('uses cancellation instead of hard delete in the domain service', async () => {
    const repo = repository();
    const service = new TaskService(repo);
    const canceled = await service.cancelTask('task-1');
    expect(canceled.status).toBe('CANCELED');
    expect(repo.changeStatus).toHaveBeenCalledWith('task-1', 'CANCELED');
  });
});
