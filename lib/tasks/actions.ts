import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseTaskRepository } from './repository';
import { TaskService } from './service';
import type { AddChecklistItemInput, CreateTaskInput, TaskStatus, UpdateTaskInput } from './types';

async function serviceFor(client: SupabaseClient): Promise<{ service: TaskService; actorId: string }> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('authenticated user required');
  return {
    service: new TaskService(new SupabaseTaskRepository(client)),
    actorId: data.user.id,
  };
}

export async function createTaskAction(client: SupabaseClient, input: CreateTaskInput) {
  const { service, actorId } = await serviceFor(client);
  return service.createTask(actorId, input);
}

export async function getTaskAction(client: SupabaseClient, taskId: string) {
  const { service } = await serviceFor(client);
  return service.getTask(taskId);
}

export async function listProjectTasksAction(client: SupabaseClient, projectId: string) {
  const { service } = await serviceFor(client);
  return service.listProjectTasks(projectId);
}

export async function listMyTasksAction(client: SupabaseClient) {
  const { service, actorId } = await serviceFor(client);
  return service.listMyTasks(actorId);
}

export async function updateTaskAction(client: SupabaseClient, taskId: string, input: UpdateTaskInput) {
  const { service } = await serviceFor(client);
  return service.updateTask(taskId, input);
}

export async function changeTaskStatusAction(client: SupabaseClient, taskId: string, status: TaskStatus) {
  const { service } = await serviceFor(client);
  return service.changeStatus(taskId, status);
}

export async function cancelTaskAction(client: SupabaseClient, taskId: string) {
  const { service } = await serviceFor(client);
  return service.cancelTask(taskId);
}

export async function reactivateTaskAction(client: SupabaseClient, taskId: string) {
  const { service } = await serviceFor(client);
  return service.reactivateTask(taskId);
}

export async function addTaskParticipantAction(client: SupabaseClient, taskId: string, userId: string) {
  const { service } = await serviceFor(client);
  return service.addParticipant(taskId, userId);
}

export async function removeTaskParticipantAction(client: SupabaseClient, taskId: string, userId: string) {
  const { service } = await serviceFor(client);
  return service.removeParticipant(taskId, userId);
}

export async function addChecklistItemAction(client: SupabaseClient, input: AddChecklistItemInput) {
  const { service } = await serviceFor(client);
  return service.addChecklistItem(input);
}

export async function setChecklistCompletionAction(client: SupabaseClient, itemId: string, completed: boolean) {
  const { service } = await serviceFor(client);
  return service.setChecklistCompletion(itemId, completed);
}

export async function updateChecklistItemAction(client: SupabaseClient, itemId: string, text: string, position: number) {
  const { service } = await serviceFor(client);
  return service.updateChecklistItem(itemId, text, position);
}

export async function removeChecklistItemAction(client: SupabaseClient, itemId: string) {
  const { service } = await serviceFor(client);
  return service.removeChecklistItem(itemId);
}
