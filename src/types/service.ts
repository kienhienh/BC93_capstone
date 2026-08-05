export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  category?: string;
  skills?: string[];
  creator?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export const mapApiJobToService = (apiJob: any): Service => ({
  id: apiJob.congViec?.id?.toString() || apiJob.id?.toString() || "",
  title: apiJob.congViec?.tenCongViec || apiJob.tenCongViec || "",
  description: apiJob.congViec?.moTa || apiJob.moTa || "",
  price: apiJob.congViec?.giaTien || apiJob.giaTien || 0,
  image: apiJob.congViec?.hinhAnh || apiJob.hinhAnh || "",
  category: apiJob.tenLoaiCongViec || apiJob.tenNhomChiTietLoai || apiJob.tenChiTietLoai || "",
  skills: [apiJob.tenChiTietLoai, apiJob.tenNhomChiTietLoai].filter(Boolean),
  creator: apiJob.tenNguoiTao
    ? {
        id: apiJob.congViec?.nguoiTao?.toString() || "",
        name: apiJob.tenNguoiTao,
        email: "",
        avatar: apiJob.avatar || "",
      }
    : undefined,
});
