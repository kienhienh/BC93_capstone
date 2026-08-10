export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  category?: string;
  skills?: string[];
  creator?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface ServiceComment {
  id: number;
  avatar?: string;
  tenNguoiBinhLuan: string;
  noiDung: string;
  ngayBinhLuan?: string;
}

export interface SignInContent {
  id?: number;
  token: string;
  user?: {
    id: number;
  };
}

export interface HiredServiceRecord {
  id: number;
  maCongViec: number;
  maNguoiThue: number;
  ngayThue: string;
  hoanThanh: boolean;
}

export interface HiredService extends HiredServiceRecord {
  service: Service;
}

interface ApiServiceDetails {
  id?: number;
  tenCongViec?: string;
  moTa?: string;
  giaTien?: number;
  hinhAnh?: string;
  saoCongViec?: number;
  nguoiTao?: number;
}

interface ApiServicePayload extends ApiServiceDetails {
  congViec?: ApiServiceDetails;
  tenLoaiCongViec?: string;
  tenNhomChiTietLoai?: string;
  tenChiTietLoai?: string;
  tenNguoiTao?: string;
  avatar?: string;
}

export const mapApiJobToService = (apiJob: ApiServicePayload): Service => ({
  id: apiJob.congViec?.id?.toString() || apiJob.id?.toString() || "",
  title: apiJob.congViec?.tenCongViec || apiJob.tenCongViec || "",
  description: apiJob.congViec?.moTa || apiJob.moTa || "",
  price: apiJob.congViec?.giaTien || apiJob.giaTien || 0,
  image: apiJob.congViec?.hinhAnh || apiJob.hinhAnh || "",
  rating: apiJob.congViec?.saoCongViec || apiJob.saoCongViec || 0,
  category: apiJob.tenLoaiCongViec || apiJob.tenNhomChiTietLoai || apiJob.tenChiTietLoai || "",
  skills: [apiJob.tenChiTietLoai, apiJob.tenNhomChiTietLoai].filter(
    (skill): skill is string => Boolean(skill),
  ),
  creator: apiJob.tenNguoiTao
    ? {
        id: apiJob.congViec?.nguoiTao?.toString() || "",
        name: apiJob.tenNguoiTao,
        email: "",
        avatar: apiJob.avatar || "",
      }
    : undefined,
});
