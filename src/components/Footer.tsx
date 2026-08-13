import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="marketplace-footer">
      <div>
        <strong>Fiverr Marketplace</strong>
        <p>Discover Services from marketplace Sellers.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </nav>
      <small>© {new Date().getFullYear()} Fiverr Marketplace</small>
    </footer>
  );
}
