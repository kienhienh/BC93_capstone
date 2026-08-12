import axios from "axios";
import { mapApiJobToService } from "../types/service";
import type { Service, ServiceComment } from "../types/service";
import { readRuntimeConfig } from "../app/runtime-config";

const getApi = () => {
  const result = readRuntimeConfig(import.meta.env);

  if (!result.ok) {
    throw new Error("Application configuration is unavailable.");
  }

  return axios.create({
    baseURL: result.config.apiBaseUrl,
    headers: {
      tokenCybersoft: result.config.cybersoftToken,
    },
  });
};

export const signin = (email: string, password: string) =>
  getApi().post("/auth/signin", { email, password });

export const signup = (name: string, email: string, password: string) =>
  getApi().post("/auth/signup", { name, email, password });

export const getJobs = async (): Promise<Service[]> => {
  const res = await getApi().get("/cong-viec");
  return res.data.content.map(mapApiJobToService);
};

export const getJobDetail = async (id: string): Promise<Service> => {
  const res = await getApi().get(`/cong-viec/lay-cong-viec-chi-tiet/${id}`);
  const job = res.data.content[0];
  return mapApiJobToService(job);
};

export const searchJobs = async (keyword: string): Promise<Service[]> => {
  const res = await getApi().get(`/cong-viec/lay-danh-sach-cong-viec-theo-ten/${keyword}`);
  return res.data.content.map(mapApiJobToService);
};

export const getCommentsByJob = async (jobId: string): Promise<ServiceComment[]> => {
  const res = await getApi().get(`/binh-luan/lay-binh-luan-theo-cong-viec/${jobId}`);
  return res.data.content;
};

export const getUserById = async (id: string) => {
  const res = await getApi().get(`/users/${id}`);
  return res.data.content;
};
