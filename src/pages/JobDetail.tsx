import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getJobDetail, getCommentsByJob } from "../services/api";
import type { Service, ServiceComment } from "../types/service";

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Service | null>(null);
  const [comments, setComments] = useState<ServiceComment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      Promise.all([getJobDetail(id), getCommentsByJob(id)])
        .then(([jobData, commentsData]) => {
          console.log("JobData:", jobData);
          console.log("CommentsData:", commentsData);
          setJob(jobData);
          setComments(commentsData);
        })
        .catch(() => alert("Không thể tải chi tiết Service"))
        .finally(() => setLoading(false));
    }
  }, [id]);

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
        <p className="text-danger fs-4">Không tìm thấy Service</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-6">
          <img
            src={job.image || "/default-avatar.png"}
            alt={job.title}
            className="img-fluid rounded mb-3"
          />
        </div>
        <div className="col-md-6">
          <h2>{job.title}</h2>
          <p className="text-muted">
            Danh mục Service: {job.category || "Chưa rõ"}
          </p>
          <p>{job.description}</p>
          <p className="fw-bold">
            Mức lương: <span className="text-success">${job.price}</span>
          </p>
          {job.skills && job.skills.length > 0 && (
            <p>
              <strong>Kỹ năng yêu cầu:</strong> {job.skills.join(", ")}
            </p>
          )}
          {job.creator && (
            <p>
              <strong>Người đăng:</strong> {job.creator.name} (
              {job.creator.email})
            </p>
          )}
          <button
            className="btn btn-primary mt-3"
            onClick={() => navigate(`/hire/${id}`)}
          >
            Thuê ngay
          </button>
        </div>
      </div>

      <h4 className="mt-5">Bình luận</h4>
      {comments.length === 0 ? (
        <p>Chưa có bình luận</p>
      ) : (
        <ul className="list-group">
          {comments.map((c) => (
            <li key={c.id} className="list-group-item">
              <div className="d-flex align-items-center">
                <img
                  src={c.avatar || "/default-avatar.png"}
                  alt={c.tenNguoiBinhLuan}
                  className="rounded-circle me-2"
                  width={40}
                  height={40}
                />
                <div>
                  <strong>{c.tenNguoiBinhLuan}</strong>
                  <p className="mb-0">{c.noiDung}</p>
                  <small className="text-muted">
                    {c.ngayBinhLuan
                      ? new Date(c.ngayBinhLuan).toLocaleDateString()
                      : ""}
                  </small>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default JobDetail;
