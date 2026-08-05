import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const HeroBanner: React.FC = () => {
  const [keyword, setKeyword] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/jobs?search=${keyword}`);
    }
  };

  return (
    <section className="bg-light py-5 text-center">
      <div className="container">
        <h1 className="fw-bold mb-3">Thuê freelancer cho mọi nhu cầu</h1>
        <p className="text-muted mb-4">
          Khám phá hàng ngàn dịch vụ từ thiết kế, lập trình, marketing đến viết lách.
        </p>
        <form
          onSubmit={handleSearch}
          className="d-flex justify-content-center"
          style={{ maxWidth: "600px", margin: "0 auto" }}
        >
          <input
            type="text"
            className="form-control me-2"
            placeholder="Nhập từ khóa dịch vụ..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Tìm kiếm
          </button>
        </form>
      </div>
    </section>
  );
};

export default HeroBanner;
