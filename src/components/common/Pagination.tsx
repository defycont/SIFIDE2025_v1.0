
import React from 'react';
import { PaginationProps } from '../../types';

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pageNumbers = [];
  const maxPageButtons = 5; // Max buttons to show (e.g., Prev 1 ... 3 4 5 ... 10 Next)

  if (totalPages <= maxPageButtons) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2) +1);
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    
    if (endPage - startPage + 1 < maxPageButtons) {
        if(currentPage < (totalPages/2)){
             endPage = Math.min(totalPages, startPage + maxPageButtons -1);
        } else {
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }
    }
    
    if (startPage > 1) {
      pageNumbers.push(1);
      if (startPage > 2) pageNumbers.push(-1); // Ellipsis placeholder
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pageNumbers.push(-1); // Ellipsis placeholder
      pageNumbers.push(totalPages);
    }
  }


  return (
    <nav aria-label="Paginación" className="flex items-center justify-between mt-4 text-sm">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <i className="fas fa-chevron-left mr-1"></i> Anterior
      </button>
      
      <div className="flex items-center space-x-1">
        {pageNumbers.map((page, index) =>
          page === -1 ? (
            <span key={`ellipsis-${index}`} className="px-3 py-1.5 text-slate-500">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1.5 border rounded-md transition-colors ${
                currentPage === page
                  ? 'bg-blue-500 border-blue-500 text-white z-10'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Siguiente <i className="fas fa-chevron-right ml-1"></i>
      </button>
    </nav>
  );
};
