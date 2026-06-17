
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bitcoin, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CryptoPayments() {
  const navigate = useNavigate();
  const [supportedCurrencies, setSupportedCurrencies] = useState({});
  const [transactions, setTransactions] = useState({ deposits: [], withdrawals: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('deposit'); // deposit, withdraw, history
  
  // Form states
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCryptoData();
  }, []);

  const fetchCryptoData = async () => {
    try {
      const userRes = await fetch(`${API_URL}/api/auth/me`, { });
      const userData = await userRes.json();
      
      // Fetch supported currencies
      const currenciesRes = await fetch(`${API_URL}/api/crypto-payments/supported-currencies`);
      const currenciesData = await currenciesRes.json();
      
      // Fetch transaction history
      const historyRes = await fetch(`${API_URL}/api/crypto-payments/transaction-history/${userData.user_id}`);
      const historyData = await historyRes.json();
      
      if (currenciesData.success) {
        setSupportedCurrencies(currenciesData.currencies);
      }
      
      if (historyData.success) {
        setTransactions({
          deposits: historyData.deposits || [],
          withdrawals: historyData.withdrawals || []
        });
      }
    } catch (error) {
      // console.error('Error fetching crypto data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setProcessing(true);
    
    try {
      const userRes = await fetch(`${API_URL}/api/auth/me`, { });
      const userData = await userRes.json();
      
      const response = await fetch(`${API_URL}/api/crypto-payments/create-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.user_id,
          cryptocurrency: selectedCrypto,
          amount_usd: parseFloat(amount)
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Deposit created! Send ${selectedCrypto} to:\n\n${data.deposit.deposit_address}\n\nAmount: $${amount} USD`);
        setAmount('');
        fetchCryptoData();
      } else {
        throw new Error(data.detail || 'Failed to create deposit');
      }
    } catch (error) {
      // console.error('Error creating deposit:', error);
      alert('Failed to create deposit: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0 || !walletAddress) {
      alert('Please enter a valid amount and wallet address');
      return;
    }
    
    setProcessing(true);
    
    try {
      const userRes = await fetch(`${API_URL}/api/auth/me`, { });
      const userData = await userRes.json();
      
      const response = await fetch(`${API_URL}/api/crypto-payments/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.user_id,
          cryptocurrency: selectedCrypto,
          wallet_address: walletAddress,
          amount_usd: parseFloat(amount)
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        setAmount('');
        setWalletAddress('');
        fetchCryptoData();
      } else {
        throw new Error(data.detail || 'Failed to withdraw');
      }
    } catch (error) {
      // console.error('Error withdrawing:', error);
      alert('Failed to withdraw: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (status === 'failed') return <XCircle className="w-5 h-5 text-red-400" />;
    return <Clock className="w-5 h-5 text-yellow-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Crypto Payments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back to Hub" variant="default" />
      
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bitcoin className="w-12 h-12 text-orange-400" />
            <h1 className="text-5xl font-black bg-gradient-to-r from-orange-400 via-yellow-400 to-green-400 bg-clip-text text-transparent">
              Crypto Payments
            </h1>
          </div>
          <p className="text-gray-300">Deposit and withdraw using cryptocurrency</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 justify-center">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'deposit'
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <ArrowDownLeft className="w-5 h-5 inline mr-2" />
            Deposit
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'withdraw'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <ArrowUpRight className="w-5 h-5 inline mr-2" />
            Withdraw
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Clock className="w-5 h-5 inline mr-2" />
            History
          </button>
        </div>

        {/* Content */}
        {activeTab !== 'history' && (
          <Card className="bg-gray-800/50 border-gray-600 p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              {activeTab === 'deposit' ? 'Deposit Crypto' : 'Withdraw Crypto'}
            </h2>
            
            {/* Currency Selection */}
            <div className="mb-6">
              <label className="block text-gray-300 mb-2 font-semibold">Select Cryptocurrency</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(Object.entries(supportedCurrencies) as Array<[string, { name: string; [k: string]: any }]>).map(([symbol, currency]) => (
                  <button
                    key={symbol}
                    onClick={() => setSelectedCrypto(symbol)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedCrypto === symbol
                        ? 'border-cyan-500 bg-cyan-500/20'
                        : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-bold text-white">{symbol}</div>
                    <div className="text-xs text-gray-400">{currency.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-6">
              <label className="block text-gray-300 mb-2 font-semibold">Amount (USD)</label>
              <Input
                type="number"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            {/* Wallet Address (Withdraw only) */}
            {activeTab === 'withdraw' && (
              <div className="mb-6">
                <label className="block text-gray-300 mb-2 font-semibold">
                  {selectedCrypto} Wallet Address
                </label>
                <Input
                  type="text"
                  placeholder="Enter your wallet address"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white font-mono text-sm"
                />
              </div>
            )}

            {/* Action Button */}
            <Button
              onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
              disabled={processing}
              className={`w-full py-6 text-lg font-bold ${
                activeTab === 'deposit'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {processing 
                ? 'Processing...' 
                : activeTab === 'deposit' 
                  ? 'Create Deposit Address' 
                  : 'Withdraw Funds'}
            </Button>
          </Card>
        )}

        {/* Transaction History */}
        {activeTab === 'history' && (
          <Card className="bg-gray-800/50 border-gray-600 p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Transaction History</h2>
            
            <div className="space-y-4">
              {/* Deposits */}
              <h3 className="text-lg font-semibold text-green-400">Deposits</h3>
              {transactions.deposits.length === 0 ? (
                <p className="text-gray-400">No deposits yet</p>
              ) : (
                transactions.deposits.map((tx) => (
                  <div key={tx.deposit_id} className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(tx.status)}
                      <div>
                        <p className="text-white font-semibold">${tx.amount_usd} USD</p>
                        <p className="text-sm text-gray-400">{tx.cryptocurrency} • {new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      tx.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                ))
              )}

              {/* Withdrawals */}
              <h3 className="text-lg font-semibold text-orange-400 mt-8">Withdrawals</h3>
              {transactions.withdrawals.length === 0 ? (
                <p className="text-gray-400">No withdrawals yet</p>
              ) : (
                transactions.withdrawals.map((tx) => (
                  <div key={tx.withdrawal_id} className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(tx.status)}
                      <div>
                        <p className="text-white font-semibold">${tx.amount_usd} USD</p>
                        <p className="text-sm text-gray-400">{tx.cryptocurrency} • {new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      tx.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
