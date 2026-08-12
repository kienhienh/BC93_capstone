import axios from "axios";
import { readRuntimeConfig } from "../../app/runtime-config";
import { mapApiJobToService } from "../../types/service";
import type { Service, ServiceComment } from "../../types/service";

function createLegacyApi() {
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
}

export const signin = (email: string, password: string) =>
  createLegacyApi().post("/auth/signin", { email, password });

export const signup = (name: string, email: string, password: string) =>
  createLegacyApi().post("/auth/signup", { name, email, password });

export async function getJobs(): Promise<Service[]> {
  const response = await createLegacyApi().get("/cong-viec");
  return response.data.content.map(mapApiJobToService);
}

export async function getJobDetail(id: string): Promise<Service> {
  const response = await createLegacyApi().get(
    `/cong-viec/lay-cong-viec-chi-tiet/${id}`,
  );
  return mapApiJobToService(response.data.content[0]);
}

export async function searchJobs(keyword: string): Promise<Service[]> {
  const response = await createLegacyApi().get(
    `/cong-viec/lay-danh-sach-cong-viec-theo-ten/${keyword}`,
  );
  return response.data.content.map(mapApiJobToService);
}

export async function getCommentsByJob(jobId: string): Promise<ServiceComment[]> {
  const response = await createLegacyApi().get(
    `/binh-luan/lay-binh-luan-theo-cong-viec/${jobId}`,
  );
  return response.data.content;
}

export async function getUserById(id: string) {
  const response = await createLegacyApi().get(`/users/${id}`);
  return response.data.content;
}
