import { useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTaxonomy } from "./controller";
import { taxonomyFailureMessage } from "./screen-model";

export function CategoryRoute() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const taxonomy = useTaxonomy();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const category = taxonomy.data?.find((item) => item.id === categoryId);
  const title = category?.name ?? (taxonomy.isPending ? "Loading Service Category" : "Service Category not found");

  useEffect(() => {
    document.title = `${title} | Fiverr Marketplace`;
    headingRef.current?.focus();
  }, [title]);

  return (
    <main id="main-content" className="taxonomy-page">
      <p className="home-eyebrow">Service Category</p>
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>

      {taxonomy.isPending ? <p role="status">Loading Service Category...</p> : null}
      {taxonomy.isError ? (
        <div className="taxonomy-state" role="alert">
          <p>{taxonomyFailureMessage(taxonomy.error)}</p>
          <button type="button" onClick={() => void taxonomy.refetch()}>Try again</button>
        </div>
      ) : null}
      {taxonomy.isSuccess && !category ? (
        <p>The requested Service Category does not exist.</p>
      ) : null}
      {category?.groups.map((group) => (
        <section className="taxonomy-group" key={group.id}>
          <h2>{group.name}</h2>
          {group.subcategories.length === 0 ? (
            <p>No Service Subcategories are available in {group.name}.</p>
          ) : (
            <ul>
              {group.subcategories.map((subcategory) => (
                <li key={subcategory.id}>
                  <Link to={`/services?subcategory=${subcategory.id}`}>{subcategory.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}

export function ServiceDiscoveryRoute() {
  const [searchParams] = useSearchParams();
  const taxonomy = useTaxonomy();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subcategoryId = searchParams.get("subcategory");
  const searchQuery = searchParams.get("search")?.trim();
  const subcategory = taxonomy.data
    ?.flatMap((category) => category.groups)
    .flatMap((group) => group.subcategories)
    .find((item) => item.id === subcategoryId);
  const title = searchQuery
    ? `Services matching "${searchQuery}"`
    : subcategory
      ? `Services for ${subcategory.name}`
      : subcategoryId && taxonomy.isSuccess
        ? "Service Subcategory not found"
        : "Discover Services";

  useEffect(() => {
    document.title = `${title} | Fiverr Marketplace`;
    headingRef.current?.focus();
  }, [title]);

  return (
    <main id="main-content" className="taxonomy-page">
      <p className="home-eyebrow">Service discovery</p>
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      {taxonomy.isPending && subcategoryId ? (
        <p role="status">Loading Service Subcategory...</p>
      ) : null}
      {taxonomy.isError && subcategoryId ? (
        <div className="taxonomy-state" role="alert">
          <p>{taxonomyFailureMessage(taxonomy.error)}</p>
          <button type="button" onClick={() => void taxonomy.refetch()}>Try again</button>
        </div>
      ) : null}
      {subcategoryId && taxonomy.isSuccess && !subcategory ? (
        <p>The requested Service Subcategory does not exist.</p>
      ) : null}
      {subcategory ? (
        <p>Browse Services classified under {subcategory.name}.</p>
      ) : null}
      {searchQuery ? <p>Browse Services matching your search.</p> : null}
    </main>
  );
}
