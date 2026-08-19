import { useEffect, useState } from "react";

function getWidth() {
  return document.documentElement.clientWidth || window.innerWidth;
}

export function useCompactPagination() {
  const [compact, setCompact] = useState(() => getWidth() < 600);

  useEffect(() => {
    const update = () => setCompact(getWidth() < 600);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return compact;
}
