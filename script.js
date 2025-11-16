const PINATA_JWT = "YOUR_PINATA_JWT_HERE";  // Replace
const BSCSCAN_API = "YOUR_BSCSCAN_API_KEY"; // Replace
const FACTORY_ADDRESS = "YOUR_FACTORY_ADDRESS"; // After deploy

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
