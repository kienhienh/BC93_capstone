import React, { useEffect, useState } from "react";
import { getUserById } from "../services/api";
import { useParams } from "react-router-dom";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  skill?: string;
  role?: string;
}

const FreelancerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getUserById(id)
        .then((data) => setUser(data))
        .catch(() => alert("Không tìm thấy user"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <p>Đang tải dữ liệu...</p>;
  if (!user) return <p>Không có thông tin freelancer</p>;

  return (
    <div className="container mt-4 text-center">
      <img
        src={user.avatar || "/default-avatar.png"}
        alt={user.name}
        className="rounded-circle mb-3"
        width={120}
        height={120}
      />
      <h2>{user.name}</h2>
      <p className="text-muted">{user.role || "Freelancer"}</p>
      <p>Email: {user.email}</p>
      {user.skill && <p>Kỹ năng: {user.skill}</p>}
      <button className="btn btn-success mt-3">Thuê freelancer này</button>
    </div>
  );
};

export default FreelancerProfile;
