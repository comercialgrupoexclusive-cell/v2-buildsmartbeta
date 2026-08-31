import BudgetWorkspace from '@/app/budget/budget-workspace';

export default function ProjectBudgetPage({ params }: { params: { projectId: string } }) {
  return <BudgetWorkspace projectId={params.projectId} />;
}
