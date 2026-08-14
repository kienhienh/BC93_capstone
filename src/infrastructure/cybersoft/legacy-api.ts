import axios from "axios";
import { readRuntimeConfig } from "../../app/runtime-config";
import { mapApiJobToService } from "../../types/service";
import type { Service } from "../../types/service";

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

export async function getUserById(id: string) {
  const response = await createLegacyApi().get(`/users/${id}`);
  return response.data.content;
}
