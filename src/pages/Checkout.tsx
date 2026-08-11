import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getJobDetail } from "../services/api";
import type { Service } from "../types/service";

const Checkout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (id) {
      getJobDetail(id)
        .then(setJob)
        .catch(() => alert("Không thể tải dịch vụ"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleCheckout = () => {
    if (!name || !card || !address) {
      setMessage("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    setMessage("Thanh toán thành công! Cảm ơn bạn đã thuê dịch vụ.");
    setTimeout(() => navigate("/orders"), 2000);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <p className="text-muted fs-4">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <p className="text-danger fs-4">Không tìm thấy dịch vụ</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2>Thanh toán dịch vụ</h2>
      <div className="row">
        <div className="col-md-6">
          <h4>Tóm tắt đơn hàng</h4>
          <p>Dịch vụ: {job.title}</p>
          <p>Giá: ${job.price}</p>
          <p className="fw-bold">Tổng: ${job.price}</p>
        </div>

        <div className="col-md-6">
          <h4>Thông tin thanh toán</h4>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Tên"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Số thẻ"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Địa chỉ thanh toán"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button className="btn btn-success w-100" onClick={handleCheckout}>
            Xác nhận & Thanh toán
          </button>
          {message && <div className="alert alert-info mt-3">{message}</div>}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
