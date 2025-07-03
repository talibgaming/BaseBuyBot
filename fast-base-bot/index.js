require('dotenv').config();
const { ethers } = require('ethers');

// Load environment configuration
const RPC_URL = process.env.ALCHEMY_BASE_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!RPC_URL || !PRIVATE_KEY) {
  console.error("Error: RPC URL or Private Key not set in .env");
  process.exit(1);
}

// Connect to Base network via Alchemy RPC
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Important addresses and ABIs (for Base chain)
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";  // Wrapped ETH on Base
const UNI_ROUTER_ADDRESS = "0x2626664c2603336E57B271c5C0b26F421741e481";  // Uniswap v3 SwapRouter02 on Base

// Uniswap v4 router address (Base chain)
const UNI_V4_ROUTER_ADDRESS = "0x6fF5693b99212Da76ad316178A184AB56D299b43"; // Uniswap v4 router on Base:contentReference[oaicite:8]{index=8}

// ABI for Uniswap v3 router's exactInputSingle (SwapRouter02 uses this struct call)
const uniV3RouterAbi = [{
  "inputs": [{
    "components": [
      {"internalType": "address", "name": "tokenIn", "type": "address"},
      {"internalType": "address", "name": "tokenOut", "type": "address"},
      {"internalType": "uint24",  "name": "fee",      "type": "uint24"},
      {"internalType": "address", "name": "recipient","type": "address"},
      {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
      {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
      {"internalType": "uint160", "name": "sqrtPriceLimitX96","type": "uint160"}
    ],
    "internalType": "struct ISwapRouter.ExactInputSingleParams",
    "name": "params",
    "type": "tuple"
  }],
  "name": "exactInputSingle",
  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
  "stateMutability": "payable",
  "type": "function"
}];

// ABI for Uniswap v4 router's exactInputSingle (placeholder, update with actual ABI if available)
const uniV4RouterAbi = [{
  "inputs": [{
    "components": [
      {"internalType": "address", "name": "tokenIn", "type": "address"},
      {"internalType": "address", "name": "tokenOut", "type": "address"},
      {"internalType": "uint24",  "name": "fee",      "type": "uint24"},
      {"internalType": "address", "name": "recipient","type": "address"},
      {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
      {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
      {"internalType": "uint160", "name": "sqrtPriceLimitX96","type": "uint160"}
    ],
    "internalType": "struct ISwapRouter.ExactInputSingleParams",
    "name": "params",
    "type": "tuple"
  }],
  "name": "exactInputSingle",
  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
  "stateMutability": "payable",
  "type": "function"
}];

// Uniswap v3 and v4 factory addresses (Base)
const UNI_V3_FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"; // Uniswap v3 factory on Base
const UNI_V4_FACTORY_ADDRESS = "0x6fF5693b99212Da76ad316178A184AB56D299b43"; // Placeholder, update with actual v4 factory address

// Minimal ABI for pool existence check
const uniV3FactoryAbi = [
  "function getPool(address,address,uint24) external view returns (address)"
];
const uniV4FactoryAbi = [
  "function getPool(address,address,uint24) external view returns (address)"
];

const uniV3Factory = new ethers.Contract(UNI_V3_FACTORY_ADDRESS, uniV3FactoryAbi, provider);
const uniV4Factory = new ethers.Contract(UNI_V4_FACTORY_ADDRESS, uniV4FactoryAbi, provider);

// Initialize contract instances for the routers
const uniRouter = new ethers.Contract(UNI_ROUTER_ADDRESS, uniV3RouterAbi, wallet);

// Uniswap v4 router contract instance
const uniV4Router = new ethers.Contract(UNI_V4_ROUTER_ADDRESS, uniV4RouterAbi, wallet);

// Utility: prompt for token address if not provided as CLI arg
async function prompt(question) {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, ans => {
    rl.close();
    resolve(ans);
  }));
}

(async () => {
  try {
    // Get token address from argument or prompt
    let tokenAddress = process.argv[2];
    if (!tokenAddress) {
      tokenAddress = await prompt("Enter the token contract address to buy: ");
    }
    if (!ethers.utils.isAddress(tokenAddress)) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }
    tokenAddress = tokenAddress.trim();
    console.log(`\n🔗 Target Token: ${tokenAddress}`);

    // Define swap parameters
    const AMOUNT_IN = ethers.utils.parseEther("0.001");  // 0.001 ETH
    const recipient = await wallet.getAddress();
    const deadline = Math.floor(Date.now()/1000) + 10;  // 1 minute from now (for v2 swap)

    // Prepare Uniswap v3 exactInputSingle params (WETH -> token)
    const params = {
      tokenIn: WETH_ADDRESS,
      tokenOut: tokenAddress,
      fee: 10000,  // 1% pool fee for v4
      recipient: recipient,
      amountIn: AMOUNT_IN,
      amountOutMinimum: 0,        // slippage 0: accept any amount out
      sqrtPriceLimitX96: 0        // no price limit
    };

    let tx;
    // Try Uniswap v3 (priority 1, all fee tiers)
    let v3Success = false;
    const v3FeeTiers = [10000, 100, 500];
    for (const fee of v3FeeTiers) {
      params.fee = fee;
      try {
       let overrides = {
      gasPrice: ethers.utils.parseUnits("0.1", "gwei") // fixed at 0.1 gwei
      };

        overrides.gasLimit = await uniRouter.estimateGas.exactInputSingle(params, { value: AMOUNT_IN });
        tx = await uniRouter.exactInputSingle(params, { ...overrides, value: AMOUNT_IN });
        console.log(`✅ Uniswap v3 swap sent (fee: ${fee/10000}%). Tx Hash: ${tx.hash}`);
        v3Success = true;
        break;
      } catch (uniErr) {
        console.warn(`⚠️ Uniswap v3 swap failed (fee: ${fee/10000}%): ${uniErr.message}`);
      }
    }
    // If v3 fails, try Uniswap v4 (priority 2, all fee tiers)
    let v4Success = false;
    if (!v3Success) {
      const v4FeeTiers = [10000, 100];
      for (const fee of v4FeeTiers) {
        params.fee = fee;
        try {
          const v4GasLimit = await uniV4Router.estimateGas.exactInputSingle(params, { value: AMOUNT_IN }).then(g => g.mul(12).div(10)).catch(() => 600000);
          const v4Overrides = { gasLimit: v4GasLimit, value: AMOUNT_IN };
          tx = await uniV4Router.exactInputSingle(params, v4Overrides);
          console.log(`✅ Uniswap v4 swap sent (fee: ${fee/10000}%). Tx Hash: ${tx.hash}`);
          v4Success = true;
          break;
        } catch (v4Err) {
          console.warn(`⚠️ Uniswap v4 swap failed (fee: ${fee/10000}%): ${v4Err.message}`);
        }
      }
    }
    if (!v3Success && !v4Success) {
      throw new Error('All swap attempts failed. No available pool or all transactions reverted.');
    }

    // Wait for transaction confirmation
    console.log("⌛ Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    if (receipt.status !== 1) {
      throw new Error("Transaction failed or was reverted.");
    }
    console.log(`🎉 Transaction confirmed in block ${receipt.blockNumber}.`);

    // Fetch token balance of the wallet to show result
    const tokenContract = new ethers.Contract(tokenAddress, [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ], provider);
    const [balanceAfter, decimals, symbol] = await Promise.all([
      tokenContract.balanceOf(recipient),
      tokenContract.decimals().catch(()=>18),
      tokenContract.symbol().catch(()=>"(token)")
    ]);
    const balanceFormatted = ethers.utils.formatUnits(balanceAfter, decimals);
    console.log(`✅ Swap successful! Bought ~${balanceFormatted} ${symbol} with 0.001 ETH.`);
    console.log(`   View transaction: https://basescan.org/tx/${tx.hash}\n`);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  }
})();
