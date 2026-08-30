-- Reconciliação G00: adiciona índices para FKs sinalizadas pelo advisor de performance.
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON public.audit_logs (project_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id ON public.organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations (created_by);
CREATE INDEX IF NOT EXISTS idx_project_memberships_user_id ON public.project_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects (created_by);
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_completed_by ON public.task_checklist_items (completed_by);
CREATE INDEX IF NOT EXISTS idx_task_participants_user_id ON public.task_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks (created_by);
