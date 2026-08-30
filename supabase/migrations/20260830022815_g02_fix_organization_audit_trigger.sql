drop trigger if exists organizations_audit on public.organizations;
create trigger organizations_audit
after insert or update on public.organizations
for each row execute function private.audit_identity_change();
