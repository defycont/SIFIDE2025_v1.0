
import { DownloadDayStatusValue, SatDownloadStatus } from './types';

// Service URL provided by the user
const API_BASE_URL = "https://sat-cfdi-downloader-271590834909.us-central1.run.app";

export interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  solicitudId?: string; // For download requests
  // For estadoSolicitud specific response
  status?: SatDownloadStatus; 
  packageIds?: string[];
  detalles?: any;
}

// Generic API request helper
async function apiRequest(endpoint: string, method = "GET", body: any = null, additionalHeaders: Record<string, string> = {}): Promise<any> {
  const headers: Record<string, string> = {
    ...additionalHeaders,
  };
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Placeholder for Authorization token (e.g., JWT or Firebase ID Token)
  // const token = await getAuthToken(); // Implement based on your auth system
  // if (token) {
  //   headers["Authorization"] = `Bearer ${token}`;
  // }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = (body instanceof FormData) ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    let responseData;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
    } else {
        const responseText = await response.text();
        responseData = response.ok 
            ? { success: true, message: responseText || 'Operación exitosa sin contenido JSON.' } 
            : { success: false, message: responseText || `Error en la solicitud: ${response.status}` };
    }

    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`, responseData);
      // Ensure the error thrown has a message property
      const errorToThrow = new Error(responseData.message || `Error: ${response.status}`);
      (errorToThrow as any).details = responseData; // Attach full response data if needed
      throw errorToThrow;
    }
    
    return responseData;

  } catch (error: any) {
    console.error(`Network or API request error for endpoint ${endpoint}:`, error);
    throw new Error(error.message || `Error de red o API para ${endpoint}.`);
  }
}

// Function to upload e.firma files
export async function subirEFirma(rfc: string, cerFile: File, keyFile: File, password_fiel: string): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append("rfc", rfc);
  formData.append("cer", cerFile);
  formData.append("key", keyFile);
  formData.append("password_fiel", password_fiel);
  
  return await apiRequest("/api/upload-efirma", "POST", formData);
}

// Function to request CFDI download
interface DescargarCfdiParams {
    rfc: string;
    fechaInicio: string; // YYYY-MM-DD
    fechaFin: string; // YYYY-MM-DD
    tipoDescarga: 'emitidos' | 'recibidos';
}
export async function descargarCFDI(params: DescargarCfdiParams): Promise<ApiResponse> {
  return await apiRequest("/api/descargar-cfdi", "POST", params);
}

// Function to get the list of downloaded CFDIs (for history)
export interface CfdiHistoryItem {
    fecha: string; // YYYY-MM-DD representing the day of the documents
    status: DownloadDayStatusValue; 
    count?: number; 
    rfc?: string; 
}
export async function listarCFDIs(rfc: string, year: number): Promise<CfdiHistoryItem[]> {
    const response: ApiResponse = await apiRequest(`/api/listar-cfdi?rfc=${rfc}&year=${year}`, "GET");
    if (response.success && Array.isArray(response.data)) {
        return response.data as CfdiHistoryItem[];
    }
    console.warn("listarCFDIs: La respuesta del API no contiene un array 'data' esperado o success es false. Recibido:", response);
    return []; 
}

// Function to check the status of a download request
export interface EstadoSolicitudResponse extends ApiResponse {
    status: SatDownloadStatus; 
    packageIds?: string[];
    detalles?: any;
}
export async function estadoSolicitud(solicitudId: string): Promise<EstadoSolicitudResponse> {
  // Ensure the response is cast to EstadoSolicitudResponse for type safety
  const response = await apiRequest(`/api/estado-solicitud?solicitudId=${solicitudId}`, "GET");
  // Check if status exists in response, otherwise provide a default or handle error
  if (response && typeof response.status !== 'undefined') {
    return response as EstadoSolicitudResponse;
  }
  // If status is missing, it might indicate an issue or unexpected response format
  console.error('EstadoSolicitudResponse: La respuesta no contiene un campo "status" válido:', response);
  return { 
    ...response, 
    success: response.success || false, 
    message: response.message || 'Respuesta inesperada del servidor al verificar estado.',
    status: 'error' // Default to error if status is missing
  } as EstadoSolicitudResponse;
}

// Placeholder for downloading actual packages
export async function descargarPaquete(packageId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/descargar-paquete?packageId=${packageId}`, {
        method: 'GET',
        // headers: { Authorization: `Bearer ${await getAuthToken()}` } // Add auth if needed
    });
    if (!response.ok) {
        throw new Error(`Error descargando paquete ${packageId}: ${response.status}`);
    }
    return response.blob();
}
