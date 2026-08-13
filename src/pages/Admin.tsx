import { useEffect, useRef } from "react";

export default function Admin() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = "Administrator | Fiverr Clone";
    heading.current?.focus();
  }, []);

  return (
    <main id="main-content" className="admin-page">
      <h1 ref={heading} tabIndex={-1}>Administrator</h1>
      <p>Manage marketplace users and services.</p>
    </main>
  );
}
