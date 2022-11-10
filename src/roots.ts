import { BigInt, log } from "@graphprotocol/graph-ts";
import { Roots, Transfer as TransferEvent } from "../generated/Roots/Roots";

import {
  Registry,
  RootsNFT,
  RootsSettings,
  Transfer,
  Wallet,
} from "../generated/schema";
import { REGISTRY_ID, ROOTS_SETTINGS_ID } from "./constants";

export function handleTransfer(event: TransferEvent): void {
  const contract = Roots.bind(event.address);
  const from = event.params.from;
  const to = event.params.to;
  const id = event.params.id;

  let registry = Registry.load(REGISTRY_ID);
  if (!registry) {
    registry = new Registry(REGISTRY_ID);
  }
  if (!registry.roots) {
    registry.roots = contract._address;
    registry.save();
  }

  let settings = RootsSettings.load(ROOTS_SETTINGS_ID);
  if (!settings) {
    settings = new RootsSettings(ROOTS_SETTINGS_ID);
    settings.address = contract._address;
    settings.save();
  }

  let fromWallet = Wallet.load(from.toHexString());
  if (!fromWallet) {
    fromWallet = new Wallet(from.toHexString());
    fromWallet.address = from;
    fromWallet.save();
  }

  let toWallet = Wallet.load(to.toHexString());
  if (!toWallet) {
    toWallet = new Wallet(to.toHexString());
    toWallet.address = to;
    toWallet.save();
  }

  let token = RootsNFT.load(id.toString());
  if (!token) {
    token = new RootsNFT(id.toString());
    const uri = contract.try_tokenURI(id);
    if (uri.reverted) {
      log.info("Roots URI reverted", [id.toHexString()]);
    } else {
      token.uri = uri.value;
    }
    token.claimedICE64Edition = false;
  }
  token.owner = toWallet.id;
  token.save();

  let transfer = Transfer.load(event.transaction.hash.toHex());
  if (!transfer) {
    transfer = new Transfer(event.transaction.hash.toHex());
    transfer.project = "Roots";
    transfer.from = fromWallet.id;
    transfer.to = toWallet.id;
    transfer.ids = [id];
    transfer.amounts = [BigInt.fromI32(1)];
    transfer.txHash = event.transaction.hash;
    transfer.timestamp = event.block.timestamp;
    transfer.save();
  }
}
