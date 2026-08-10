import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getJobs, searchJobs } from "../services/api";
import type { Service } from "../types/service";
import ServiceCard from "../components/ServiceCard";

const Jobs: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("search")?.trim() ?? "";
  const [jobs, setJobs] = useState<Service[]>([]);

  // State cho filter
  const [category, setCategory] = useState<string>("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [rating, setRating] = useState<number>(0);

  useEffect(() => {
    const request = searchTerm ? searchJobs(searchTerm) : getJobs();
    request
      .then(setJobs)
      .catch(() => alert("Không thể tải danh sách Service"));
  }, [searchTerm]);

  // Lọc dữ liệu theo filter
  const filteredJobs = jobs.filter((job) => {
    const matchCategory = category
      ? job.title.toLowerCase().includes(category.toLowerCase())
      : true;
    const matchPrice = job.price >= priceRange[0] && job.price <= priceRange[1];
    const matchRating = rating ? job.rating >= rating : true;
    return matchCategory && matchPrice && matchRating;
  });

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-3 sticky-top">
          <h5 className="mb-3">Bộ lọc</h5>

          <div className="mb-3">
            <label className="form-label">Danh mục</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nhập category..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Khoảng giá</label>
            <div className="d-flex">
              <input
                type="number"
                className="form-control me-2"
                placeholder="Từ"
                value={priceRange[0]}
                onChange={(e) =>
                  setPriceRange([+e.target.value, priceRange[1]])
                }
              />
              <input
                type="number"
                className="form-control"
                placeholder="Đến"
                value={priceRange[1]}
                onChange={(e) =>
                  setPriceRange([priceRange[0], +e.target.value])
                }
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Đánh giá tối thiểu</label>
            <select
              className="form-select"
              value={rating}
              onChange={(e) => setRating(+e.target.value)}
            >
              <option value={0}>Tất cả</option>
              <option value={3}>3 sao trở lên</option>
              <option value={4}>4 sao trở lên</option>
              <option value={5}>5 sao</option>
            </select>
          </div>

          <button
            className="btn btn-secondary w-100"
            onClick={() => {
              setCategory("");
              setPriceRange([0, 1000]);
              setRating(0);
            }}
          >
            Xoá bộ lọc
          </button>
        </div>

        <div className="col-md-9">
          <h2 className="mb-4">
            {searchTerm ? `Kết quả cho "${searchTerm}"` : "Danh sách Service"}
          </h2>
          <div className="row">
            {filteredJobs.map((job) => (
              <div key={job.id} className="col-md-4">
                <ServiceCard service={job} onSelect={(id) => navigate(`/services/${id}`)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Jobs;
