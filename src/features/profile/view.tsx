import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import { reportAuthorizationFailure, useSession } from "../authentication/public";
import { useHiredServices } from "../hire-confirmation/public";
import { ProfileFailure, type EditableProfile, type Profile } from "./capability";
import { useSaveProfile, useUploadAvatar } from "./controller";
import { normalizeTags, validateProfile } from "./validation";

type Session = NonNullable<ReturnType<typeof useSession>["session"]>;
type AcceptSession = ReturnType<typeof useSession>["acceptSession"];
type HiredServicesQuery = ReturnType<typeof useHiredServices>;

const toForm = (profile: Profile): EditableProfile => ({
  name: profile.name,
  phone: profile.phone,
  birthday: profile.birthday,
  gender: profile.gender,
  skills: profile.skills,
  certifications: profile.certifications,
});

export function ProfileView({ profile, session, acceptSession, hiredServices, heading }: {
  profile: Profile;
  session: Session;
  acceptSession: AcceptSession;
  hiredServices: HiredServicesQuery;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const [form, setForm] = useState(() => toForm(profile));
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [certifications, setCertifications] = useState(profile.certifications.join(", "));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const save = useSaveProfile(profile.id, session.token);
  const upload = useUploadAvatar(profile.id, session.token);
  const nameField = useRef<HTMLInputElement>(null);
  const phoneField = useRef<HTMLInputElement>(null);
  const birthdayField = useRef<HTMLInputElement>(null);

  useEffect(() => { heading.current?.focus(); }, [heading]);
  useEffect(() => {
    for (const error of [save.error, upload.error]) {
      if (error instanceof ProfileFailure && error.kind === "unauthorized") reportAuthorizationFailure(401);
      else if (error instanceof ProfileFailure && error.kind === "forbidden") reportAuthorizationFailure(403);
    }
  }, [save.error, upload.error]);

  const updateSession = (next: Profile) => acceptSession({ ...session, user: { id: next.id, name: next.name, email: next.email, role: next.role, avatar: next.avatar } });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateProfile({ ...form, skills: normalizeTags(skills), certifications: normalizeTags(certifications) });
    if (!result.ok) {
      setErrors(result.errors);
      const firstInvalid = Object.keys(result.errors)[0];
      if (firstInvalid === "name") nameField.current?.focus();
      else if (firstInvalid === "phone") phoneField.current?.focus();
      else if (firstInvalid === "birthday") birthdayField.current?.focus();
      return;
    }
    setErrors({});
    save.mutate({ profile, changes: result.input }, { onSuccess: updateSession });
  };
  const chooseFile = (next: File | null) => {
    setAvatarError("");
    if (next && !["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setFile(null);
      setAvatarError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    setFile(next);
  };

  return <main id="main-content" className="profile-page">
    <h1 ref={heading} tabIndex={-1}>Your Profile</h1>
    <div className="profile-layout">
      <section className="profile-card" aria-label="Profile details">
        <ProfileIdentity profile={profile} />
        <form onSubmit={submit} noValidate>
          <label>Full name<input ref={nameField} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-invalid={Boolean(errors.name)} /></label>{errors.name && <p className="field-error">{errors.name}</p>}
          <label>Phone<input ref={phoneField} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} aria-invalid={Boolean(errors.phone)} /></label>{errors.phone && <p className="field-error">{errors.phone}</p>}
          <label>Birthday<input ref={birthdayField} type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} /></label>
          <fieldset><legend>Gender</legend><label><input type="radio" checked={form.gender} onChange={() => setForm({ ...form, gender: true })} /> Male</label><label><input type="radio" checked={!form.gender} onChange={() => setForm({ ...form, gender: false })} /> Female</label><small>API compatibility: Male = true, Female = false.</small></fieldset>
          <label>Skills<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label><small>Separate entries with commas.</small>
          <label>Certifications<input value={certifications} onChange={(event) => setCertifications(event.target.value)} /></label>
          <button type="submit" disabled={save.isPending}>{save.isPending ? "Saving Profile..." : "Save Profile"}</button>
          {save.isSuccess && <p role="status">Profile saved successfully.</p>}
          {save.isError && <p role="alert">{save.error instanceof ProfileFailure && save.error.kind === "stale" ? "Your Profile changed elsewhere. Refresh before saving again." : save.error instanceof ProfileFailure && save.error.kind === "unknown" ? "We could not confirm whether your Profile was saved. Refresh before trying again." : "Profile was not saved. Review the latest data and try again."}</p>}
        </form>
        <div className="avatar-upload"><label>Choose Profile image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} /></label><button type="button" disabled={!file || upload.isPending} onClick={() => file && upload.mutate(file, { onSuccess: updateSession })}>{upload.isPending ? "Uploading Avatar..." : "Upload Avatar"}</button>{avatarError && <p role="alert">{avatarError}</p>}{upload.isSuccess && <p role="status">Avatar uploaded successfully.</p>}{upload.isError && <p role="alert">{upload.error instanceof ProfileFailure && upload.error.kind === "unknown" ? "We could not confirm whether your avatar was uploaded. Refresh before trying again." : "Avatar was not uploaded. Your saved Profile changes are unchanged."}</p>}</div>
      </section>
      <HiredServicesPanel query={hiredServices} />
    </div>
  </main>;
}

function ProfileIdentity({ profile }: { profile: Profile }) {
  return <div className="profile-identity">{profile.avatar ? <img src={profile.avatar} alt="" /> : <span aria-hidden="true">{profile.name.charAt(0).toUpperCase()}</span>}<div><h2>{profile.name}</h2><p>{profile.email}</p><p>{profile.role}</p></div></div>;
}

function HiredServicesPanel({ query }: { query: HiredServicesQuery }) {
  const total = query.data?.length ?? 0;
  const completed = query.data?.filter((item) => item.completed).length ?? 0;
  const inProgress = total - completed;
  return <section className="hired-profile-card" aria-label="Hired Services">
    <div className="hired-dashboard-banner"><div><p className="eyebrow">Your marketplace workspace</p><h2>Hired Services</h2><p>Keep track of every Service you have hired in one place.</p></div><button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>{query.isFetching ? "Refreshing..." : "Refresh"}</button></div>
    <div className="hired-stats" aria-label="Hired Service summary"><p><strong>{total}</strong><span>Total</span></p><p><strong>{inProgress}</strong><span>In progress</span></p><p><strong>{completed}</strong><span>Completed</span></p></div>
    {query.isPending && <p role="status">Loading Hired Services...</p>}
    {query.isError && !query.data?.length && <p role="alert">Hired Services are temporarily unavailable.</p>}
    {query.data?.length === 0 && <div className="empty-state"><span aria-hidden="true"><i className="bi bi-briefcase" /></span><h3>No Hired Services yet</h3><p>Explore the marketplace and your next Service will appear here.</p><Link to="/services">Explore Services</Link></div>}
    <div className="hired-services-grid">{query.data?.map((item) => {
      const title = item.service?.title ?? `Service #${item.serviceId}`;
      return <article key={item.id} aria-label={title}>
        <div className="service-thumbnail" aria-hidden="true"><i className="bi bi-briefcase-fill" /></div>
        <div className="hired-service-copy"><p className="service-kicker">Service #{item.serviceId}</p><h3>{title}</h3><p className="service-meta"><span>{item.service ? `$${item.service.price}` : "Price unavailable"}</span><span>Hired <time dateTime={item.hiredAt}>{formatHiredDate(item.hiredAt)}</time></span></p></div>
        <div className="hired-service-actions"><span className={item.completed ? "hired-status-complete" : "hired-status-progress"}>{item.completed ? "Completed" : "In progress"}</span><Link to={`/services/${item.serviceId}`} aria-label={`View ${title}`}>View details <span aria-hidden="true">→</span></Link></div>
      </article>;
    })}</div>
  </section>;
}

function formatHiredDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "date unavailable" : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
