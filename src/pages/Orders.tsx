import React, { useState } from "react";

interface Order {
  id: string;
  serviceName: string;
  price: number;
  status: "Đã thanh toán" | "Chưa thanh toán";
  date: string;
}

const Orders: React.FC = () => {
  // Dữ liệu giả lập
  const [orders] = useState<Order[]>([
    {
      id: "1",
      serviceName: "Thiết kế Logo",
      price: 50,
      status: "Đã thanh toán",
      date: "2026-08-01",
    },
    {
      id: "2",
      serviceName: "Lập trình Website",
      price: 200,
      status: "Chưa thanh toán",
      date: "2026-08-02",
    },
    {
      id: "3",
      serviceName: "Dịch thuật tài liệu",
      price: 80,
      status: "Đã thanh toán",
      date: "2026-08-03",
    },
  ]);

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">Đơn hàng của tôi</h2>
      {orders.length === 0 ? (
        <p className="text-center">Bạn chưa có đơn hàng nào</p>
      ) : (
        <table className="table table-bordered text-center">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Dịch vụ</th>
              <th>Giá</th>
              <th>Ngày thuê</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.serviceName}</td>
                <td>${order.price}</td>
                <td>{new Date(order.date).toLocaleDateString()}</td>
                <td>
                  <span
                    className={
                      order.status === "Đã thanh toán"
                        ? "badge bg-success"
                        : "badge bg-warning text-dark"
                    }
                  >
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Orders;
