'use client';

import React, { useEffect, useState } from 'react';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);

  const fetchPayments = async () => {
    // Simulating GET /api/admin/payments
    setPayments([
      { id: 1, transaction_id: 'TXN-12345', amount: '15.000 Kz', date: '2023-10-27', receipt_url: '#' },
      { id: 2, transaction_id: 'TXN-98765', amount: '5.000 Kz', date: '2023-10-26', receipt_url: '#' }
    ]);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleApprove = async (id: number) => {
    // Simulate POST /api/admin/payments/:id/approve
    // await fetch(`/api/admin/payments/${id}/approve`, { method: 'POST' });
    alert(`Pagamento ${id} aprovado com sucesso!`);
    fetchPayments(); // recarrega a lista
  };

  const handleReject = async (id: number) => {
    // Simulate POST /api/admin/payments/:id/reject
    // await fetch(`/api/admin/payments/${id}/reject`, { method: 'POST' });
    alert(`Pagamento ${id} rejeitado!`);
    fetchPayments(); // recarrega a lista
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 flex items-center">
        <svg className="w-8 h-8 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Administração de Pagamentos
      </h1>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {payments.map((payment) => (
            <li key={payment.id} className="p-6 hover:bg-gray-50 transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 truncate">Transação: {payment.transaction_id}</p>
                  <p className="mt-2 flex items-center text-sm text-gray-500">
                    <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    {payment.date}
                  </p>
                  <p className="mt-2 text-sm text-gray-900 font-semibold">Valor: {payment.amount}</p>
                </div>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => window.open(payment.receipt_url, '_blank')}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    Ver Comprovativo
                  </button>
                  <button 
                    onClick={() => handleApprove(payment.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Aprovar
                  </button>
                  <button 
                    onClick={() => handleReject(payment.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Rejeitar
                  </button>
                </div>
              </div>
            </li>
          ))}
          {payments.length === 0 && (
            <li className="p-6 text-center text-gray-500">Nenhum pagamento pendente.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
