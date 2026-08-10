import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJobDetail, hireService } from "../services/api";
import { getClientId } from "../services/auth";
import type { Service } from "../types/service";

const Hire: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    getJobDetail(id)
      .then(setService)
      .catch(() => setError("Không thể tải Service. Vui lòng thử lại."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleHire = async () => {
    if (!service) return;

    const clientId = getClientId();
    const serviceId = Number(service.id);

    if (clientId === null || !Number.isInteger(serviceId)) {
      setError("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await hireService(serviceId, clientId);
      navigate("/hired-services", {
        replace: true,
        state: { message: "Bạn đã thuê Service thành công." },
      });
    } catch {
      setError("Không thể thuê Service. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) {
    return <p className="container mt-5 text-danger">Service không hợp lệ.</p>;
  }

  if (loading) {
    return <p className="container mt-5 text-muted">Đang tải Service...</p>;
  }

  if (!service) {
    return <p className="container mt-5 text-danger">{error ?? "Không tìm thấy Service."}</p>;
  }

  return (
    <main className="container my-5">
      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="h3">Xác nhận thuê Service</h1>
          <p className="text-muted">
            Khi xác nhận, Service sẽ được thêm vào danh sách Hired Services của bạn.
          </p>
          <hr />
          <h2 className="h5">{service.title}</h2>
          <p>{service.description}</p>
          <p className="fw-bold text-success">${service.price}</p>

          {error && <div className="alert alert-danger">{error}</div>}

          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              type="button"
              disabled={submitting}
              onClick={handleHire}
            >
              {submitting ? "Đang xử lý..." : "Xác nhận thuê"}
            </button>
            <button
              className="btn btn-outline-secondary"
              type="button"
              disabled={submitting}
              onClick={() => navigate(-1)}
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Hire;
