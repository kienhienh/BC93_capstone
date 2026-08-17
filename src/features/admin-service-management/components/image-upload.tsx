import { useRef, useState } from "react";
import { useSession } from "../../authentication/public";
import { useUploadServiceImage } from "../controller";
import { kindOf } from "../route-utils";
import { validateServiceImage } from "../validation";
import { FailureMessage } from "./feedback";

export function ServiceImageUpload({ serviceId, currentImageUrl }: { serviceId: string; currentImageUrl: string | null }) {
  const { session } = useSession();
  const mutation = useUploadServiceImage(session?.token ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (file: File | null) => {
    setLocalError(null);
    mutation.reset();
    if (!file) return;
    const result = validateServiceImage(file);
    if (result.ok === false) {
      setLocalError(result.message);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    mutation.mutate({ id: serviceId, file });
  };

  return (
    <section className="admin-service-image-upload" aria-labelledby="service-image-heading">
      <h2 id="service-image-heading">Service Image</h2>
      <p>Saving metadata and uploading an image are separate, independently confirmed actions.</p>
      {currentImageUrl ? (
        <img src={currentImageUrl} alt="" className="admin-service-image-preview" />
      ) : (
        <div className="state-indicator" data-state="empty" role="status">No image uploaded.</div>
      )}
      <div className="form-field">
        <label htmlFor="service-image-input">Upload a new image (JPEG, PNG, or WebP, up to 5 MB)</label>
        <input ref={inputRef} id="service-image-input" type="file" accept="image/jpeg,image/png,image/webp"
          disabled={mutation.isPending}
          onChange={(event) => choose(event.target.files?.[0] ?? null)} />
      </div>
      {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Uploading image...</div>}
      {mutation.isSuccess && !localError ? (
        <div className="state-indicator" data-state="confirmed-success" role="status">Image uploaded successfully.</div>
      ) : null}
      {localError ? <div role="alert" className="error-message">{localError}</div> : null}
      {mutation.isError && !localError ? <FailureMessage kind={kindOf(mutation.error)} action="upload the image for" /> : null}
    </section>
  );
}
