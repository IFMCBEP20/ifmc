const PINATA_JWT = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIwMWE2OGMwMy04OTVlLTQxNjktOThmOS05NmI5NDc1MTAxZTAiLCJlbWFpbCI6Im1vbG1jZDE1QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJjM2YwNDJhODM5ZDc2ZWJhNGI2ZiIsInNjb3BlZEtleVNlY3JldCI6ImU2ZDExZTNmMzMzYTAyMjE5YzhiMGRmNGQwYTFlOWE5ZmY5ODk1ODU5NmIwMTg5NjRmZDEwNDUxZmEwZWUwZWQiLCJleHAiOjE3OTQ3NzEwNTB9.uYLCz6zngmd4kLeKolvJYwCr3XcV-296eP-jLpBJRYY";
      // Replace
const BSCSCAN_API = "6CBPQGR72CRFR7JDQ9VCMRVIZZU3W7UA1C"; // Replace
const FACTORY_ADDRESS = "0xDa6615eC2b3cC2C27260DEE31828A8945D761318"; // After deploy
const FACTORY_ABI = [
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"curve","type":"address"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"string","name":"symbol","type":"string"}],"name":"MemeLaunched","type":"event"},
  {"inputs":[],"name":"LAUNCH_FEE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"LAUNCH_FEE_RECIPIENT","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"},{"internalType":"string","name":"ipfsHash","type":"string"}],"name":"createTokenAndBuy","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"stateMutability":"payable","type":"function"},
  {"inputs":[],"name":"pancakeRouter","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"platformFeeAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}
];
const BSC_MAINNET = { chainId: "0x38", rpcUrls: ["https://bsc-dataseed.binance.org/"] };

let provider, signer, factory;

function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  event.target.classList.add('active');
}

// Connect Wallet
async function connectWallet() {
  const web3Modal = new Web3Modal({ providerOptions: { walletconnect: { package: window.WalletConnectProvider } } });
  const instance = await web3Modal.connect();
  provider = new ethers.providers.Web3Provider(instance);
  signer = provider.getSigner();
  factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
  // Switch to BSC
  await provider.send("wallet_switchEthereumChain", [{ chainId: BSC_MAINNET.chainId }]);
  $("networkTag").textContent = "BSC Mainnet";
  $("connectBtn").style.display = "none";
  $("disconnectBtn").style.display = "block";
}

// Create Token
async function createToken() {
  const name = $("tokenName").value;
  const symbol = $("tokenSymbol").value;
  const file = $("tokenFile").files[0];
  if (!name || !symbol || !file) return showStatus("Fill all fields", true);

  const ipfs = await uploadToPinata(file);
  const tx = await factory.createTokenAndBuy(name, symbol, "", ipfs, "", "", { value: ethers.utils.parseEther("0.0055") });
  showStatus(`Launching... Tx: ${tx.hash}`, false);
  await tx.wait();
  await verifyOnBscScan(tx.to);  // Verify factory, or token from receipt
  showStatus("Launched! Token verified.", false);
}

// Upload to Pinata
async function uploadToPinata(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form
  });
  const json = await res.json();
  return json.IpfsHash;
}

// Verify on BSCScan
async function verifyOnBscScan(address) {
  const form = new FormData();
  form.append("apikey", BSCSCAN_API);
  form.append("module", "contract");
  form.append("action", "verifysourcecode");
  form.append("contractaddress", address);
  form.append("sourceCode", FLATTENED_SOURCE);  // Paste flattened code here
  form.append("contractname", "MemeToken");
  form.append("compilerversion", "v0.8.20+commit.a1b79de6");
  form.append("optimizationUsed", "1");
  form.append("runs", "200");

  const res = await fetch("https://api.bscscan.com/api", { method: "POST", body: form });
  const json = await res.json();
  if (json.status === "1") showStatus("Verified! GUID: " + json.result, false);
}

// Fetch Contract Details
async function fetchContractDetails() {
  const addr = $("contractInput").value;
  const token = new ethers.Contract(addr, MEME_ABI, provider);
  const [name, symbol, supply, logo] = await Promise.all([
    token.name(),
    token.symbol(),
    token.totalSupply(),
    token.uri(0)
  ]);
  $("contractDetails").innerHTML = `
    Name: ${name}<br>
    Symbol: ${symbol}<br>
    Supply: ${ethers.utils.formatUnits(supply, 2)}<br>
    Logo: <img src="${logo}" width="50">
  `;
}

// Load Launched Tokens
async function loadTokens() {
  const count = await factory.getLaunchCount();
  let html = '<table><tr><th>Name</th><th>Symbol</th><th>Address</th></tr>';
  for (let i = 0; i < count; i++) {
    const launch = await factory.getLaunch(i);
    html += `<tr><td>${launch.name}</td><td>${launch.symbol}</td><td>${launch.token}</td></tr>`;
  }
  html += '</table>';
  $("tokensList").innerHTML = html;
}

// Init
document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', switchTab));
$("connectBtn").onclick = connectWallet;
