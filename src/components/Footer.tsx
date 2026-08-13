import { Link } from "react-router-dom";

const footerColumns = [
  { heading: "Categories", links: ["Graphics & Design", "Digital Marketing", "Writing & Translation", "Video & Animation", "Music & Audio", "Programming & Tech", "Business", "Lifestyle"] },
  { heading: "About", links: ["Careers", "Press & News", "Partnerships", "Privacy Policy", "Terms of Service"] },
  { heading: "Support", links: ["Help & Support", "Trust & Safety", "Selling on Fiverr", "Buying on Fiverr"] },
  { heading: "Community", links: ["Events", "Blog", "Forum", "Community Standards", "Podcast"] },
  { heading: "More From Fiverr", links: ["Fiverr Business", "Fiverr Pro", "Fiverr Studios", "Fiverr Guides", "Get Inspired"] },
] as const;

export default function Footer() {
  return (
    <footer className="marketplace-footer">
      <div className="footer-columns">
        {footerColumns.map((column) => (
          <section key={column.heading}>
            <h2>{column.heading}</h2>
            <ul>
              {column.links.map((label) => (
                <li key={label}><Link to="/services">{label}</Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="footer-bottom">
        <Link className="footer-brand" to="/" aria-label="Fiverr Marketplace home">fiverr.</Link>
        <small>© {new Date().getFullYear()} Fiverr Marketplace</small>
        <span aria-label="Social links">● ● ● ● ●</span>
      </div>
    </footer>
  );
}
