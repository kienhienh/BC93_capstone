import { useEffect, useState } from "react";

export function useCompactPagination() {
  const [compact, setCompact] = useState(() => window.innerWidth < 600);

  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 600);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return compact;
}
