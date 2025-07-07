
import React, { useEffect, useRef } from 'react';
import { ChartData } from '../types';

// Make sure Chart.js is globally available via CDN script in index.html
declare var Chart: any; 

interface ChartWrapperProps {
  chartId: string;
  type: string; // 'bar', 'line', 'doughnut', etc.
  data: ChartData;
  options?: any;
  className?: string;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({ chartId, type, data, options, className = "chart-container" }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null); // Stores the Chart.js instance

  useEffect(() => {
    const canvasElement = chartRef.current;
    if (!canvasElement) return;

    // Destroy previous chart instance if it exists
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined' || typeof Chart !== 'function') {
      console.error("Chart.js library is not loaded or not a function. Ensure it's included in index.html and accessible.");
      const chartContainer = canvasElement.parentElement;
      if (chartContainer) {
        // Clear previous content (if any, like an old canvas)
        while (chartContainer.firstChild) {
            chartContainer.removeChild(chartContainer.firstChild);
        }
        const errorMessageElement = document.createElement('p');
        errorMessageElement.textContent = 'Error: No se pudo cargar la librería de gráficos.';
        errorMessageElement.style.color = 'red';
        errorMessageElement.style.textAlign = 'center';
        errorMessageElement.style.padding = '20px';
        chartContainer.appendChild(errorMessageElement);
      }
      return;
    }
    
    // If Chart.js is loaded, ensure the canvas is back if an error message was previously shown
    const chartContainer = canvasElement.parentElement;
    if (chartContainer && !chartContainer.querySelector('canvas')) {
        // Remove error message and re-add canvas
        while (chartContainer.firstChild) {
            chartContainer.removeChild(chartContainer.firstChild);
        }
        chartContainer.appendChild(canvasElement);
    }


    const ctx = canvasElement.getContext('2d');
    if (ctx) {
      try {
        chartInstanceRef.current = new Chart(ctx, {
          type: type,
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 500 // Smoother animation
            },
            ...options,
          },
        });
      } catch (error) {
          console.error("Chart.js instantiation error:", error, "for chartId:", chartId, "with data:", data, "and options:", options);
          if (chartContainer) {
            const errorElement = document.createElement('p');
            errorElement.textContent = 'Error al renderizar el gráfico.';
            errorElement.style.color = 'orange';
            errorElement.style.textAlign = 'center';
            chartContainer.appendChild(errorElement);
          }
      }
    }

    // Cleanup function to destroy chart instance on component unmount
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, data, options, chartId]); // Re-run effect if type, data, options or chartId change

  return (
    <div className={className}>
      <canvas id={chartId} ref={chartRef}></canvas>
    </div>
  );
};
