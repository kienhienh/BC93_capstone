import { useEffect, useState } from "react";
import { useSession } from "../../authentication/public";
import { useAdminUserManagementCapability, type AdminUser } from "../../admin-user-management/wiring";
import type { SellerRef } from "../service-form-model";

export function SellerPicker({
  idPrefix,
  value,
  onChange,
  pending,
  error,
}: {
  idPrefix: string;
  value: SellerRef | null;
  onChange: (seller: SellerRef | null) => void;
  pending: boolean;
  error?: string;
}) {
  const { session } = useSession();
  const userCapability = useAdminUserManagementCapability();
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<readonly AdminUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const trimmed = query.trim();
    (async () => {
      setSearching(true);
      try {
        const token = session?.token ?? "";
        const found = trimmed.length >= 2
          ? await userCapability.searchUsersByName(trimmed, token, controller.signal)
          : await userCapability.listAllUsers(token, controller.signal);
        if (!active) return;
        const needle = trimmed.toLowerCase();
        const filtered = trimmed && trimmed.length < 2
          ? found.filter((user) => user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle))
          : found;
        setResults(filtered.slice(0, 20));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [query, open, session?.token, userCapability]);

  const select = (user: AdminUser) => {
    onChange({ id: user.id, name: user.name, email: user.email });
    setQuery(user.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  return (
    <div className="form-field seller-picker">
      <label htmlFor={`${idPrefix}-sellerId`}>Seller *</label>
      <input
        id={`${idPrefix}-sellerId`}
        value={query}
        disabled={pending}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${idPrefix}-seller-listbox`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${idPrefix}-sellerId-error` : undefined}
        placeholder="Search Users by name or email..."
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
      />
      {value ? <p className="seller-picker-selected">Selected: {value.name} ({value.email || `User ${value.id}`})</p> : null}
      {open ? (
        <ul id={`${idPrefix}-seller-listbox`} role="listbox" aria-label="Matching Users" className="seller-picker-results">
          {searching ? <li className="seller-picker-status">Searching...</li> : null}
          {!searching && results.length === 0 ? <li className="seller-picker-status">No matching Users.</li> : null}
          {results.map((user) => (
            <li key={user.id}>
              <button type="button" role="option" aria-selected={value?.id === user.id} onClick={() => select(user)}>
                {user.name} <small>{user.email}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value ? (
        <button type="button" className="link-button" onClick={clear} disabled={pending}>Clear Seller</button>
      ) : null}
      {error && <div id={`${idPrefix}-sellerId-error`} role="alert" className="error-message">{error}</div>}
      <small>Sellers are always selected from existing Users, never typed freely.</small>
    </div>
  );
}
