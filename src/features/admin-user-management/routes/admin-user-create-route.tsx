import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useCreateAdminUser } from "../controller";
import { FailureMessage } from "../components/feedback";
import { UserForm } from "../components/user-form";
import { kindOf } from "../route-utils";
import { emptyForm, toCreateAdministratorInput, type UserFormState } from "../user-form-model";

export function AdminUserCreateRoute() {
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useCreateAdminUser(session?.token ?? "");
  useEffect(() => { document.title = "Add Administrator | Administrator"; heading.current?.focus(); }, []);
  const save = async (form: UserFormState) => {
    try {
      const created = await mutation.mutateAsync(toCreateAdministratorInput(form));
      navigate("/admin/users", { replace: true, state: { adminFeedback: `Administrator ${created.name} added successfully.` } });
    } catch { /* rendered locally */ }
  };
  return <main id="main-content" className="admin-user-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/users">Users</Link><span aria-hidden="true">/</span><span aria-current="page">Add Administrator</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Administrator access</span><h1 ref={heading} tabIndex={-1}>Add Administrator</h1><p>Create an ADMIN account with credentials that can sign in to the Administrator workspace.</p></div></header>
    {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Adding administrator...</div>}
    {mutation.isError && <FailureMessage kind={kindOf(mutation.error)} action="create" />}
    <UserForm mode="create-administrator" initialValue={emptyForm()} pending={mutation.isPending} submitLabel="Add Administrator" idPrefix="create" cancelTo="/admin/users" onSubmit={save} />
  </main>;
}
