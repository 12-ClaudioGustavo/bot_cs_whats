'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; 

export default function CheckoutPage({ params }: { params: { plan_id: string } }) {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  
  // Simulated plan data based on params.plan_id
  const plan = {
    id: params.plan_id,
    name: params.plan_id === 'pro' ? 'Plano Pro' : 'Plano Básico',
    price: params.plan_id === 'pro' ? '15.000 Kz / mês' : '5.000 Kz / mês'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('transaction_id', transactionId);
    if (receipt) formData.append('receipt', receipt);
    formData.append('plan_id', params.plan_id);
    
    // Simulating API call:
    // await fetch('/api/checkout', { method: 'POST', body: formData });
    
    alert('Pagamento submetido com sucesso! Aguarde a aprovação.');
    router.push('/dashboard/billing');
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Checkout - {plan.name}</h1>
      <div className="bg-gray-100 p-6 rounded-lg mb-8 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Resumo do Pedido</h2>
        <p><strong>Plano:</strong> {plan.name}</p>
        <p><strong>Preço:</strong> {plan.price}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-8 shadow-sm text-blue-900">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Dados para Transferência
        </h2>
        <ul className="space-y-2">
          <li><strong>Banco:</strong> BAI</li>
          <li><strong>Titular:</strong> C-Space Technologies</li>
          <li><strong>IBAN:</strong> AO06.0040.0000.1234.5678.9</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Confirmar Pagamento</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">ID da Transação</label>
          <input 
            type="text" 
            required
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Ex: 123456789"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Comprovativo</label>
          <input 
            type="file" 
            required
            accept="image/*,application/pdf"
            onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 font-medium flex justify-center items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Submeter Pagamento
        </button>
      </form>
    </div>
  );
}
