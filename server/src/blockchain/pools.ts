import { ethers } from "ethers";
import { getProvider } from "../config.js";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export async function getTokenBalance(
  tokenAddress: string,
  holderAddress: string,
): Promise<bigint> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, getProvider());
  return token.balanceOf(holderAddress);
}

export async function getTokenInfo(
  tokenAddress: string,
): Promise<{ symbol: string; decimals: number; totalSupply: bigint }> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, getProvider());
  const [symbol, decimals, totalSupply] = await Promise.all([
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
  ]);
  return { symbol, decimals: Number(decimals), totalSupply };
}
