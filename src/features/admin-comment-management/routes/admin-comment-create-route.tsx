import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { CommentForm } from "../components/comment-form";
import { FailureMessage } from "../components/feedback";
import { useAdminCommentServices, useCreateAdminComment } from "../controller";
import { kindOf, listPath } from "../route-utils";

export function AdminCommentCreateRoute() {
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const servicesQuery = useAdminCommentServices(session?.token ?? "");
  const mutation = useCreateAdminComment(session?.token ?? "");
  const [serviceId, setServiceId] = useState("");
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [preflightFailure, setPreflightFailure] = useState<ReturnType<typeof kindOf> | null>(null);
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Create Comment | Administrator";
    heading.current?.focus();
  }, []);

  const save = async (content: string, rating: number) => {
    setServiceError(null);
    setPreflightFailure(null);
    if (!serviceId) {
      setServiceError("Select a Service for this Comment.");
      return false;
    }
    if (!session) return false;

    let liveServices;
    try {
      liveServices = await servicesQuery.refetch();
    } catch {
      setPreflightFailure("network");
      return false;
    }
    if (liveServices.isError) {
      setPreflightFailure(kindOf(liveServices.error));
      return false;
    }
    if (!liveServices.data?.some((service) => service.id === serviceId)) {
      setServiceError("This Service no longer exists. Choose a different Service.");
      return false;
    }

    try {
      const created = await mutation.mutateAsync({
        serviceId,
        authorId: session.user.id,
        content,
        rating,
        createdAt: new Date(Date.now()).toISOString(),
      });
      navigate(back, { replace: true, state: { adminFeedback: `Comment ${created.id} created successfully.` } });
      return true;
    } catch (error) {
      if (kindOf(error) === "validation") setServiceError("The server rejected this Comment. Check the Service and content.");
      return false;
    }
  };

  return <main id="main-content" className="admin-comment-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Comments</Link><span aria-hidden="true">/</span><span aria-current="page">Create</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New moderation record</span><h1 ref={heading} tabIndex={-1}>Create Comment</h1><p>The Comment is posted as {session?.user.name ?? "the signed-in Administrator"}; another User cannot be selected.</p></div></header>

    {servicesQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Services...</div> : null}
    {servicesQuery.isError ? <FailureMessage kind={kindOf(servicesQuery.error)} action="load Services for" onRetry={() => void servicesQuery.refetch()} /> : null}
    {mutation.isPending ? <div className="state-indicator" data-state="pending" role="status">Creating Comment...</div> : null}
    {preflightFailure ? <FailureMessage kind={preflightFailure} action="verify the Service for" /> : null}
    {mutation.isError && kindOf(mutation.error) !== "validation" ? <FailureMessage kind={kindOf(mutation.error)} action="create" /> : null}

    {servicesQuery.data ? <CommentForm idPrefix="create-comment" pending={mutation.isPending} submitLabel="Create Comment" cancelTo={back}
      initialContent="" initialRating={5} serverError={null} onClearServerError={() => setServiceError(null)} onSubmit={save}
      serviceField={{ services: servicesQuery.data, value: serviceId, onChange: setServiceId, error: serviceError }} /> : null}
  </main>;
}
