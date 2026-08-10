import axios from "axios";
import { mapApiJobToService } from "../types/service";
import type { Service, ServiceComment } from "../types/service";

const API = axios.create({
  baseURL: "https://fiverrnew.cybersoft.edu.vn/api",
  headers: {
    tokenCybersoft: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5Mb3AiOiJCb290Y2FtcCA5MyIsIkhldEhhblN0cmluZyI6IjA0LzEyLzIwMjYiLCJIZXRIYW5UaW1lIjoiMTc5NjM0MjQwMDAwMCIsIm5iZiI6MTc2Nzk3ODAwMCwiZXhwIjoxNzk2NDkwMDAwfQ.DcungLS2D0-V5FlObrYQNV283QRSfZfrw3c0RHFR02Q",
  },
});

export const signin = (email: string, password: string) =>
  API.post("/auth/signin", { email, password });

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