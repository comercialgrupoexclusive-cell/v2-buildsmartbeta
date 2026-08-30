import TaskWorkspace from '@/app/tasks/task-workspace';

export default function ProjectTasksPage({ params }: { params: { projectId: string } }) {
  return <TaskWorkspace projectId={params.projectId} />;
}
