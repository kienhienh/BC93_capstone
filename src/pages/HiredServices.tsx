import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  cancelHiredService,
  completeHiredService,
  getHiredServices,
  getJobDetail,
} from "../services/api";
import type { HiredService } from "../types/service";

interface LocationState {
  message?: string;
}

const formatHireDate = (date: string) => {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString("vi-VN");
};

const HiredServices: React.FC = () => {
  const location = useLocation();
  const successMessage = (location.state as LocationState | null)?.message;
  const [hiredServices, setHiredServices] = useState<HiredService[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHiredServices = async () => {
      try {
        const records = await getHiredServices();
        const enrichedRecords = await Promise.all(
          records.map(async (record) => ({
            ...record,
            service: await getJobDetail(record.maCongViec.toString()),
          })),
        );
        setHiredServices(enrichedRecords);
      } catch {
        setError("Không thể tải danh sách Hired Services. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    void loadHiredServices();
  }, []);

  const handleComplete = async (id: number) => {
    setProcessingId(id);
    setError(null);

    try {
      await completeHiredService(id);
      setHiredServices((current) =>
        current.map((item) => (item.id === id ? { ...item, hoanThanh: true } : item)),
      );
    } catch {
      setError("Không thể hoàn thành Hired Service.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (id: number) => {
    setProcessingId(id);
    setError(null);

    try {
      await cancelHiredService(id);
      setHiredServices((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Không thể hủy Hired Service.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <p className="container mt-5 text-muted">Đang tải Hired Services...</p>;
  }

  return (
    <main className="container my-5">
      <h1 className="h2 mb-4">Hired Services</h1>

      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {hiredServices.length === 0 ? (
        <p>Bạn chưa thuê Service nào.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-light">
              <tr>
                <th>Service</th>
                <th>Seller</th>
                <th>Giá</th>
                <th>Ngày thuê</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {hiredServices.map((item) => (
                <tr key={item.id}>
                  <td>{item.service.title}</td>
                  <td>{item.service.creator?.name || "Chưa rõ"}</td>
                  <td>${item.service.price}</td>
                  <td>{formatHireDate(item.ngayThue)}</td>
                  <td>
                    <span className={item.hoanThanh ? "badge bg-success" : "badge bg-warning text-dark"}>
                      {item.hoanThanh ? "Đã hoàn thành" : "Đang thực hiện"}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      {!item.hoanThanh && (
                        <button
                          className="btn btn-sm btn-success"
                          type="button"
                          disabled={processingId === item.id}
                          onClick={() => handleComplete(item.id)}
                        >
                          Hoàn thành
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-danger"
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleCancel(item.id)}
                      >
                        Hủy
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};

export default HiredServices;
