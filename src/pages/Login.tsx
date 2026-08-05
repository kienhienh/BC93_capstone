import React, { useState } from "react";
import { signin } from "../services/api";
import { useNavigate } from "react-router-dom";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await signin(email, password);
      localStorage.setItem("token", res.data.content.token);
      navigate("/");
    } catch {
      setError("Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-lg p-4" style={{ width: "400px" }}>
        <h2 className="text-center mb-4 text-primary">Đăng nhập</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-bold">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email"
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label fw-bold">Mật khẩu</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            🚀 Đăng nhập
          </button>
        </form>
        <p className="text-center mt-3">
          Chưa có tài khoản?{" "}
          <span
            className="text-decoration-underline text-primary"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/register")}
          >
            Đăng ký ngay
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;
