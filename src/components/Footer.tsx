import { Link } from "react-router-dom";

const footerColumns = [
  {
    heading: "Categories",
    links: [
      { label: "Graphics & Design" },
      { label: "Digital Marketing" },
      { label: "Writing & Translation" },
      { label: "Video & Animation" },
      { label: "Music & Audio" },
      { label: "Programming & Tech" },
      { label: "Data" },
      { label: "Business" },
      { label: "Lifestyle" },
      { label: "Sitemap" },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "Careers" },
      { label: "Press & News" },
      { label: "Partnerships" },
      { label: "Privacy Policy" },
      { label: "Terms of Service" },
      { label: "Intellectual Property Claims" },
      { label: "Investor Relations" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help & Support" },
      { label: "Trust & Safety" },
      { label: "Selling on Fiverr" },
      { label: "Buying on Fiverr" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "Events" },
      { label: "Blog" },
      { label: "Forum" },
      { label: "Community Standards" },
      { label: "Podcast" },
      { label: "Affiliates" },
      { label: "Invite a Friend" },
      { label: "Become a Seller" },
      { label: "Fiverr Elevate", subtitle: "Exclusive Benefits" },
    ],
  },
  {
    heading: "More From Fiverr",
    links: [
      { label: "Fiverr Business" },
      { label: "Fiverr Pro" },
      { label: "Fiverr Studios" },
      { label: "Fiverr Logo Maker" },
      { label: "Fiverr Guides" },
      { label: "Get Inspired" },
      { label: "ClearVoice", subtitle: "Content Marketing" },
      { label: "AND CO", subtitle: "Invoice Software" },
      { label: "Learn", subtitle: "Online Courses" },
    ],
  },
] as const;

const socialLinks = [
  { label: "Twitter", icon: "bi-twitter", href: "https://twitter.com/fiverr" },
  { label: "Facebook", icon: "bi-facebook", href: "https://www.facebook.com/Fiverr" },
  { label: "LinkedIn", icon: "bi-linkedin", href: "https://www.linkedin.com/company/fiverr-com" },
  { label: "Pinterest", icon: "bi-pinterest", href: "https://www.pinterest.com/fiverr" },
  { label: "Instagram", icon: "bi-instagram", href: "https://www.instagram.com/fiverr" },
] as const;

export default function Footer() {
  return (
    <footer className="marketplace-footer">
      <div className="footer-columns">
        {footerColumns.map((column) => (
          <section key={column.heading}>
            <h2>{column.heading}</h2>
            <ul>
              {column.links.map((item) => (
                <li key={item.label}>
                  <Link to="/services">
                    <span>{item.label}</span>
                    {"subtitle" in item ? <small>{item.subtitle}</small> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="footer-bottom">
        <Link className="footer-brand" to="/" aria-label="Fiverr Marketplace home">fiverr.</Link>
        <small>© Fiverr International Ltd. 2021</small>
        <nav className="footer-social" aria-label="Social links">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={social.label}
            >
              <i className={`bi ${social.icon}`} aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="footer-settings" aria-label="Marketplace preferences">
          <button type="button"><i className="bi bi-globe2" aria-hidden="true" /> English</button>
          <button type="button">$USD</button>
          <button type="button" aria-label="Accessibility options">
            <i className="bi bi-universal-access-circle" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
