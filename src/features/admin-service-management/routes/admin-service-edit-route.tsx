import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useTaxonomy } from "../../taxonomy/public";
import type { UpdateServiceInput } from "../capability";
import {
  useAdminServiceDetail,
  useAdminServiceSafeguardEvidence,
  useUpdateAdminService,
} from "../controller";
import { DeleteServiceControl } from "../components/delete-service-control";
import { TypedConfirmationDialog } from "../components/dialogs";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { ServiceForm } from "../components/service-form";
import { ServiceImageUpload } from "../components/image-upload";
import { kindOf, listPath, withSearch } from "../route-utils";
import { formFromService, toUpdateInput, type ServiceFormState } from "../service-form-model";
import {
  sameServiceEvidence,
  serviceEvidence,
  serviceMatchesUpdate,
  type GuardFeedback,
} from "../service-safeguards";

export function AdminServiceEditRoute({ serviceId: suppliedServiceId }: { serviceId?: string } = {}) {
  const { serviceId: routeServiceId } = useParams();
  const serviceId = suppliedServiceId ?? routeServiceId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminServiceDetail(serviceId, session?.token ?? "", Boolean(session && serviceId));
  const taxonomyQuery = useTaxonomy();
  const mutation = useUpdateAdminService(session?.token ?? "");
  const evidence = useAdminServiceSafeguardEvidence(session?.token ?? "");
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<{ input: UpdateServiceInput; sellerEmail: string; sellerName: string } | null>(null);
  const [reconcileInput, setReconcileInput] = useState<UpdateServiceInput | null>(null);
  const [checking, setChecking] = useState(false);
  const back = listPath(location.search);

  useEffect(() => { document.title = "Edit Service | Administrator"; heading.current?.focus(); }, []);

  const baseline = detailQuery.data;
  const categories = taxonomyQuery.data ?? [];
  const formKey = useMemo(
    () => (baseline ? `${serviceEvidence(baseline)}::${categories.length}` : "loading"),
    [baseline, categories.length],
  );

  const reloadLatest = async () => {
    setFeedback(null);
    setPendingTransfer(null);
    setReconcileInput(null);
    setConfirmation("");
    await detailQuery.refetch();
  };

  const reconcileUpdate = async (input: UpdateServiceInput) => {
    setChecking(true);
    try {
      const current = await evidence.refetchTarget(serviceId);
      if (serviceMatchesUpdate(current, input)) {
        setReconcileInput(null);
        navigate(withSearch(`/admin/services/${serviceId}`, location.search), {
          replace: true,
          state: { adminFeedback: `Service ${current.title} updated successfully after reconciliation.` },
        });
      } else if (baseline && sameServiceEvidence(current, baseline)) {
        setFeedback({ state: "unknown-outcome", message: "Update was not confirmed. Latest evidence is unchanged; you may retry the saved form after reconciliation." });
      } else {
        setReconcileInput(null);
        setFeedback({ state: "stale", message: "This Service changed after you opened the form. Reload latest before updating." });
      }
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Could not reconcile the update outcome. Check latest before retrying." });
    } finally {
      setChecking(false);
    }
  };

  const performUpdate = async (input: UpdateServiceInput) => {
    if (!baseline) return;
    setChecking(true);
    setFeedback(null);
    setReconcileInput(input);
    try {
      const fresh = await evidence.refetchTarget(serviceId);
      if (!sameServiceEvidence(fresh, baseline)) {
        setReconcileInput(null);
        setFeedback({ state: "stale", message: "This Service changed after you opened the form. Reload latest before updating." });
        return;
      }
      await mutation.mutateAsync({ id: serviceId, input });
      setReconcileInput(null);
      navigate(withSearch(`/admin/services/${serviceId}`, location.search), {
        replace: true,
        state: { adminFeedback: `Service ${fresh.title} updated successfully.` },
      });
    } catch (error) {
      if (kindOf(error) === "unknown_outcome") {
        setFeedback({ state: "unknown-outcome", message: "Update outcome is unknown. Reconciling against the latest Service evidence..." });
        await reconcileUpdate(input);
      }
    } finally {
      setChecking(false);
    }
  };

  const save = async (form: ServiceFormState) => {
    if (!baseline) return;
    const input = toUpdateInput(baseline, form);
    const sellerChanged = input.sellerId !== baseline.sellerId;
    if (sellerChanged) {
      const sellerEmail = form.seller?.email.trim() ?? "";
      if (!sellerEmail) {
        setFeedback({ state: "blocked-dependency", message: "Ownership transfer is blocked because the new Seller has no email for typed confirmation." });
        return;
      }
      setFeedback(null);
      setPendingTransfer({ input, sellerEmail, sellerName: form.seller?.name ?? "" });
      setConfirmation("");
      return;
    }
    await performUpdate(input);
  };

  const pending = checking || mutation.isPending;
  return <main id="main-content" className="admin-service-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Services</Link><span aria-hidden="true">/</span><span aria-current="page">Edit</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Catalog settings</span><h1 ref={heading} tabIndex={-1}>Edit Service</h1><p>Update approved Service information, pricing, and Seller assignment.</p></div></header>
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading Service...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {pending && <div className="state-indicator" data-state="pending" role="status">Checking latest evidence and updating Service...</div>}
    {feedback ? <GuardMessage feedback={feedback} onReload={() => void reloadLatest()}
      onReconcile={reconcileInput ? () => void reconcileUpdate(reconcileInput) : undefined} /> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="update" /> : null}
    {baseline && taxonomyQuery.isError ? (
      <div className="state-indicator" data-state="relation-partial-failure" role="alert">
        <span>The Service loaded, but its Category/Subcategory options could not be loaded.</span>
        <button type="button" className="state-retry" onClick={() => void taxonomyQuery.refetch()}>Try again</button>
      </div>
    ) : null}
    {baseline ? <>
      <ServiceForm key={formKey} initialValue={formFromService(baseline, categories)} categories={categories}
        categoriesPending={taxonomyQuery.isPending} pending={pending}
        submitLabel="Save Changes" idPrefix="edit" cancelTo={back} onSubmit={save} />
      <ServiceImageUpload serviceId={baseline.id} currentImageUrl={baseline.imageUrl} />
      <div className="edit-destructive-actions" aria-label="Edit Service destructive actions">
        <DeleteServiceControl service={baseline} visibleLabel="Delete Service" className="danger-button"
          onReloadLatest={() => void reloadLatest()} onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service ${baseline.title} deleted successfully.` } })} />
      </div>
      {pendingTransfer ? <TypedConfirmationDialog subjectId={baseline.id} subjectLabel={baseline.title}
        confirmField={{ label: "New Seller's email", value: pendingTransfer.sellerEmail }}
        title={`Confirm ownership transfer for ${baseline.title}?`}
        description={`This reassigns the Service from ${baseline.sellerName ?? `User ${baseline.sellerId}`} to ${pendingTransfer.sellerName}.`}
        actionLabel="Confirm Changes" pendingLabel="Updating..." pending={pending}
        confirmation={confirmation} onConfirmationChange={setConfirmation}
        onCancel={() => { setPendingTransfer(null); setConfirmation(""); }}
        onConfirm={() => { const input = pendingTransfer.input; setPendingTransfer(null); void performUpdate(input); }} /> : null}
    </> : null}
  </main>;
}
