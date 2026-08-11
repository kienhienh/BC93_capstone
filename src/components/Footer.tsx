import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="bg-light text-dark mt-5 pt-4 pb-3 border-top">
      <div className="container">
        <div className="row">
          <div className="col-md-4 mb-3">
            <h5 className="fw-bold">Fiverr Clone</h5>
            <p className="text-muted">
              Nền tảng thuê freelancer cho mọi nhu cầu công việc.
            </p>
          </div>

          <div className="col-md-4 mb-3">
            <h6 className="fw-bold">Liên kết nhanh</h6>
            <ul className="list-unstyled">
              <li><Link to="/" className="text-decoration-none text-dark">Home</Link></li>
              <li><Link to="/jobs" className="text-decoration-none text-dark">Jobs</Link></li>
              <li><Link to="/login" className="text-decoration-none text-dark">Login</Link></li>
              <li><Link to="/register" className="text-decoration-none text-dark">Register</Link></li>
            </ul>
          </div>

          <div className="col-md-4 mb-3">
            <h6 className="fw-bold">Liên hệ</h6>
            <p>Email: support@fiverrclone.com</p>
            <p>Hotline: 0123 456 789</p>
          </div>
        </div>

        <div className="text-center mt-3">
          <small className="text-muted">
            © {new Date().getFullYear()} Fiverr Clone. All rights reserved.
          </small>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
