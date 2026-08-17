import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useCreateAdminUser } from "../controller";
import { FailureMessage } from "../components/feedback";
import { UserForm } from "../components/user-form";
import { kindOf } from "../route-utils";
import { emptyForm, toCreateInput, type UserFormState } from "../user-form-model";

export function AdminUserCreateRoute() {
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useCreateAdminUser(session?.token ?? "");
  useEffect(() => { document.title = "Create User | Administrator"; heading.current?.focus(); }, []);
  const save = async (form: UserFormState) => {
    try {
      const created = await mutation.mutateAsync(toCreateInput(form));
      navigate("/admin/users", { replace: true, state: { adminFeedback: `User ${created.name} created successfully.` } });
    } catch { /* rendered locally */ }
  };
  return <main id="main-content" className="admin-user-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/users">Users</Link><span aria-hidden="true">/</span><span aria-current="page">Create</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New account</span><h1 ref={heading} tabIndex={-1}>Create User</h1><p>Add a validated marketplace user without persisting temporary passwords.</p></div></header>
    {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Creating user...</div>}
    {mutation.isError && <FailureMessage kind={kindOf(mutation.error)} action="create" />}
    <UserForm initialValue={emptyForm()} pending={mutation.isPending} submitLabel="Create User" idPrefix="create" cancelTo="/admin/users" onSubmit={save} />
  </main>;
}
