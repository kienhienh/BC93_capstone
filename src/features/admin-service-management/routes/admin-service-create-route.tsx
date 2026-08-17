import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useTaxonomy } from "../../taxonomy/public";
import { useCreateAdminService } from "../controller";
import { FailureMessage } from "../components/feedback";
import { ServiceForm } from "../components/service-form";
import { kindOf } from "../route-utils";
import { emptyForm, toCreateInput, type ServiceFormState } from "../service-form-model";

export function AdminServiceCreateRoute() {
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useCreateAdminService(session?.token ?? "");
  const taxonomyQuery = useTaxonomy();
  useEffect(() => { document.title = "Create Service | Administrator"; heading.current?.focus(); }, []);
  const save = async (form: ServiceFormState) => {
    try {
      const created = await mutation.mutateAsync(toCreateInput(form));
      navigate("/admin/services", {
        replace: true,
        state: { adminFeedback: `Service "${created.title}" created successfully.`, createdServiceId: created.id },
      });
    } catch { /* rendered locally */ }
  };
  return <main id="main-content" className="admin-service-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">Create</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New listing</span><h1 ref={heading} tabIndex={-1}>Create Service</h1><p>Add a validated Service. Images can be uploaded after the Service is created.</p></div></header>
    {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Creating Service...</div>}
    {mutation.isError && <FailureMessage kind={kindOf(mutation.error)} action="create" />}
    {taxonomyQuery.isError && <FailureMessage kind="unknown" action="load categories for" onRetry={() => void taxonomyQuery.refetch()} />}
    <ServiceForm initialValue={emptyForm()} categories={taxonomyQuery.data ?? []} categoriesPending={taxonomyQuery.isPending}
      pending={mutation.isPending} submitLabel="Create Service" idPrefix="create" cancelTo="/admin/services" onSubmit={save} />
  </main>;
}
