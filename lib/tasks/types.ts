export const TASK_STATUSES = [
  'TO_DO',
  'IN_PROGRESS',
  'WAITING',
  'COMPLETED',
  'CANCELED',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  startAt: string | null;
  dueAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskParticipant {
  taskId: string;
  userId: string;
  createdAt: string;
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  text: string;
  position: number;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
}

export interface AddChecklistItemInput {
  taskId: string;
  text: string;
  position?: number;
}
