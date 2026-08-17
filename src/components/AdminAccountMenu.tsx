import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../features/authentication/public";

export default function AdminAccountMenu() {
  const navigate = useNavigate();
  const { session, logout } = useSession();
  const accountRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const closeOnPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (session?.user.role !== "ADMIN") return;
    const openProfileShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setOpen(false);
        navigate("/profile");
      }
    };
    window.addEventListener("keydown", openProfileShortcut);
    return () => window.removeEventListener("keydown", openProfileShortcut);
  }, [navigate, session?.user.role]);

  if (!session || session.user.role !== "ADMIN") return null;

  const signOut = () => {
    setOpen(false);
    logout();
    navigate("/");
  };

  return (
    <div ref={accountRef} className="admin-account">
      <Link className="admin-account-label" to="/admin" aria-label="Administrator">Admin</Link>
      <button
        ref={menuButtonRef}
        className="admin-account-trigger"
        type="button"
        aria-label="Open Admin account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="admin-account-avatar" aria-hidden="true">
          {session.user.avatar
            ? <img src={session.user.avatar} alt="" />
            : session.user.name.charAt(0).toUpperCase()}
        </span>
        <span className="admin-account-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div className="admin-account-menu" role="menu" aria-label="Admin account menu">
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)}>
            <span>Cập nhật</span><kbd>CTRL+O</kbd>
          </Link>
          <button role="menuitem" type="button" onClick={signOut}>
            <span>Đăng xuất</span><span aria-hidden="true" className="admin-logout-icon">↩</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
