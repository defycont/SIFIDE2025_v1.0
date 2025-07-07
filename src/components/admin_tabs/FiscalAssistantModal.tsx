
import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

interface FiscalAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalDataSummary: any; // Summary of the current RFC's fiscal data
  apiKeyAvailable: boolean; // To check if Gemini can be called
}

// Initialize Gemini AI (only if API key is available)
let ai: GoogleGenAI | null = null;
if (process.env.API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } catch (error) {
    console.error("Error initializing GoogleGenAI in FiscalAssistantModal:", error);
  }
}

const GEMINI_SYSTEM_INSTRUCTION = `Eres un asesor fiscal experto en México. Responde a la pregunta del usuario utilizando el contexto fiscal proporcionado de su empresa, si es relevante. 
Sé claro, conciso y ofrece información útil y accionable basada en la normativa fiscal mexicana. 
Limita tu respuesta a párrafos cortos o viñetas. 
No des asesoramiento legal definitivo, sino orientación general.
Contexto fiscal del usuario (ejercicio ${new Date().getFullYear()}):
`;

export const FiscalAssistantModal: React.FC<FiscalAssistantModalProps> = ({ isOpen, onClose, fiscalDataSummary, apiKeyAvailable }) => {
  const [userInput, setUserInput] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleConsultAI = async () => {
    if (!userInput.trim()) {
      setAiResponse("Por favor, ingrese su pregunta.");
      return;
    }
    if (!apiKeyAvailable || !ai) {
      setAiResponse("El servicio de IA no está disponible en este momento (API Key no configurada o error de inicialización).");
      return;
    }

    setIsLoading(true);
    setAiResponse(null);

    const contextString = Object.entries(fiscalDataSummary)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${typeof value === 'number' ? formatCurrency(value as number) : value}`)
      .join('\n');
    
    const fullPrompt = `${GEMINI_SYSTEM_INSTRUCTION}\n${contextString}\n\nPregunta del usuario: ${userInput}`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: fullPrompt,
      });
      setAiResponse(response.text);
    } catch (error: any) {
      console.error("Error con API de Gemini en Asistente Fiscal:", error);
      setAiResponse(`Hubo un error al contactar al asistente de IA: ${error.message || 'Error desconocido.'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to format currency, can be moved to a utils file if used elsewhere too
  const formatCurrency = (value: number, showSymbol = true): string => {
    if (isNaN(value)) value = 0;
    return `${showSymbol ? '$' : ''}${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asistente Fiscal IA">
      <div className="space-y-4">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 mb-3">
          <i className="fas fa-robot text-2xl text-blue-500"></i>
        </div>
        <p className="text-sm text-slate-600 text-center">
          Haga su consulta fiscal. El asistente utilizará los datos de la empresa activa ({fiscalDataSummary?.nombreEmpresa || 'N/A'}, RFC: {fiscalDataSummary?.rfc || 'N/A'}) para contextualizar la respuesta si es necesario.
        </p>
        
        {!apiKeyAvailable && (
             <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                El servicio de Inteligencia Artificial no está disponible. Verifique la configuración de la API Key.
            </div>
        )}

        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Escriba su pregunta aquí... (ej: ¿Cómo se calcula el pago provisional de ISR para actividad empresarial?)"
          className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[80px]"
          rows={3}
          disabled={!apiKeyAvailable || isLoading}
        />
        <button
          onClick={handleConsultAI}
          disabled={!apiKeyAvailable || isLoading || !userInput.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center justify-center disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Consultando IA...
            </>
          ) : (
            <><i className="fas fa-paper-plane mr-2"></i>Enviar Pregunta</>
          )}
        </button>

        {aiResponse && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
            <h4 className="text-sm font-semibold text-slate-800 mb-1.5">Respuesta del Asistente:</h4>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiResponse}</div>
          </div>
        )}
      </div>
    </Modal>
  );
};
