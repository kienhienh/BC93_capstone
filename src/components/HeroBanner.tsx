import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function HeroBanner() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleSearch = () => {
    if (search.trim()) {
      // điều hướng sang trang danh sách công việc theo tên
      navigate(`/jobs?search=${encodeURIComponent(search.trim())}`);
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
          placeholder="Nhập tên công việc..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded text-black w-64"
        />
        <button
          onClick={handleSearch}
          className="bg-yellow-400 text-black px-4 py-2 rounded"
        >
          Tìm kiếm
        </button>
        </form>
      </div>
    </section>
  );
}