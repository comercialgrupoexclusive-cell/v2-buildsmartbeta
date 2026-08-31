import PlanningWorkspace from '@/app/planning/planning-workspace';

export default function ProjectPlanningPage({ params }: { params: { projectId: string } }) {
  return <PlanningWorkspace projectId={params.projectId} />;
}
