import axios from "axios";
import { mapApiJobToService } from "../types/service";
import { getAccessToken } from "./auth";
import type {
  HiredServiceRecord,
  Service,
  ServiceComment,
  SignInContent,
} from "../types/service";

interface ApiResponse<T> {
  content: T;
}

const API = axios.create({
  baseURL: "https://fiverrnew.cybersoft.edu.vn/api",
  headers: {
    tokenCybersoft: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5Mb3AiOiJCb290Y2FtcCA5MyIsIkhldEhhblN0cmluZyI6IjA0LzEyLzIwMjYiLCJIZXRIYW5UaW1lIjoiMTc5NjM0MjQwMDAwMCIsIm5iZiI6MTc2Nzk3ODAwMCwiZXhwIjoxNzk2NDkwMDAwfQ.DcungLS2D0-V5FlObrYQNV283QRSfZfrw3c0RHFR02Q",
  },
});

API.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("token", token);
  }

  return config;
});

export const signin = (email: string, password: string) =>
  API.post<ApiResponse<SignInContent>>("/auth/signin", { email, password });

export const signup = (name: string, email: string, password: string) =>
  API.post("/auth/signup", { name, email, password });

export const getJobs = async (): Promise<Service[]> => {
  const res = await API.get("/cong-viec");
  return res.data.content.map(mapApiJobToService);
};

export const getJobDetail = async (id: string): Promise<Service> => {
  const res = await API.get(`/cong-viec/lay-cong-viec-chi-tiet/${id}`);
  const job = res.data.content[0];
  return mapApiJobToService(job);
};

export const searchJobs = async (keyword: string): Promise<Service[]> => {
  const res = await API.get(`/cong-viec/lay-danh-sach-cong-viec-theo-ten/${keyword}`);
  return res.data.content.map(mapApiJobToService);
};

export const getCommentsByJob = async (jobId: string): Promise<ServiceComment[]> => {
  const res = await API.get(`/binh-luan/lay-binh-luan-theo-cong-viec/${jobId}`);
  return res.data.content;
};

export const getUserById = async (id: string) => {
  const res = await API.get(`/users/${id}`);
  return res.data.content;
};
export const hireService = (serviceId: number, clientId: number) =>
  API.post("/thue-cong-viec", {
    id: 0,
    maCongViec: serviceId,
    maNguoiThue: clientId,
    ngayThue: new Date().toISOString(),
    hoanThanh: false,
  });

export const getHiredServices = async (): Promise<HiredServiceRecord[]> => {
  const res = await API.get<ApiResponse<HiredServiceRecord[]>>(
    "/thue-cong-viec/lay-danh-sach-da-thue",
  );
  return res.data.content;
};

export const completeHiredService = (hiredServiceId: number) =>
  API.post(`/thue-cong-viec/hoan-thanh-cong-viec/${hiredServiceId}`);

export const cancelHiredService = (hiredServiceId: number) =>
  API.delete(`/thue-cong-viec/${hiredServiceId}`);
