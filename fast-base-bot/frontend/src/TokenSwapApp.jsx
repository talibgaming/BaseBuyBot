import { useState } from 'react';

export default function TokenSwapApp() {
  const [contractAddress, setContractAddress] = useState("");
  const [ethAmount, setEthAmount] = useState("0.1");
  const [gasFee, setGasFee] = useState("0.1");
  const [status, setStatus] = useState(null);
  const [txLink, setTxLink] = useState(null);
  const [resultText, setResultText] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    setStatus(null);
    setTxLink(null);
    setResultText(null);

    try {
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: contractAddress,
          ethAmount: ethAmount,
          gasGwei: gasFee
        })
      });
      const data = await response.json();
      if (data.success) {
        setStatus("success");
        setTxLink(`https://basescan.org/tx/${data.txHash}`);
        setResultText(`${ethAmount} ETH swapped to ~${data.tokenBalance} ${data.tokenSymbol}`);
      } else {
        setStatus("failed");
        setResultText(data.error || "There was a problem with the transaction. Please try again.");
      }
    } catch (error) {
      setStatus("failed");
      setResultText(error.message || "There was a problem with the transaction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #000, #222 80%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'rgba(30,40,60,0.95)', borderRadius: 16, boxShadow: '0 4px 32px #0008', padding: 32, border: '1px solid #0ff' }}>
        <h2 style={{ textAlign: 'center', color: '#0ff', fontWeight: 700, fontSize: 28, marginBottom: 24 }}>🚀 Token Swap Interface</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#0ff', display: 'block', marginBottom: 4 }}>Token Contract Address</label>
          <input style={{ width: '100%', background: '#111', color: 'white', border: '1px solid #0ff', borderRadius: 6, padding: 8 }} value={contractAddress} onChange={e => setContractAddress(e.target.value)} placeholder="0x..." />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#0ff', display: 'block', marginBottom: 4 }}>ETH Amount to Buy</label>
          <input style={{ width: '100%', background: '#111', color: 'white', border: '1px solid #0ff', borderRadius: 6, padding: 8 }} type="number" value={ethAmount} onChange={e => setEthAmount(e.target.value)} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ color: '#0ff', display: 'block', marginBottom: 4 }}>Gas Fee (in Gwei)</label>
          <input style={{ width: '100%', background: '#111', color: 'white', border: '1px solid #0ff', borderRadius: 6, padding: 8 }} type="number" value={gasFee} onChange={e => setGasFee(e.target.value)} />
        </div>
        <button onClick={handleBuy} disabled={loading} style={{ width: '100%', background: '#0ff', color: '#111', fontWeight: 600, border: 'none', borderRadius: 8, padding: 12, fontSize: 18, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 20 }}>
          {loading ? 'Processing...' : 'Buy Token'}
        </button>
        {status === "success" && (
          <div style={{ background: '#093', color: 'white', borderRadius: 8, padding: 16, marginBottom: 8, border: '1px solid #0f8' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Transaction Successful</div>
            <div>
              <a href={txLink} target="_blank" rel="noopener noreferrer" style={{ color: '#0cf', textDecoration: 'underline' }}>View on BaseScan</a><br />
              {resultText}
            </div>
          </div>
        )}
        {status === "failed" && (
          <div style={{ background: '#900', color: 'white', borderRadius: 8, padding: 16, marginBottom: 8, border: '1px solid #f44' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Transaction Failed</div>
            <div>{resultText}</div>
          </div>
        )}
      </div>
    </div>
  );
}
// This code is a React component for a token swap interface using Uniswap on the Base network.
// It allows users to input a token contract address, the amount of ETH they want to swap, and the gas fee.
// When the "Buy Token" button is clicked, it simulates a transaction and displays the result.
// The UI is styled with Tailwind CSS and uses components from a UI library.
// The component manages its state using React hooks and provides feedback on the transaction status.
// The code includes error handling and loading states to enhance user experience.