import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  ArtistProofMint,
  Initialized,
  RootsEditions,
  Transfer as TransferEvent,
} from "../generated/RootsEditions/RootsEditions";

import {
  Registry,
  RootsEditionNFT,
  RootsEditionsSettings,
  Transfer,
  Wallet,
} from "../generated/schema";
import { REGISTRY_ID, ROOTS_EDITIONS_SETTINGS_ID } from "./constants";

export function handleInit(event: Initialized): void {
  const contract = RootsEditions.bind(event.address);

  let registry = Registry.load(REGISTRY_ID);
  if (!registry) {
    registry = new Registry(REGISTRY_ID);
  }
  if (!registry.rootsEditions) {
    registry.rootsEditions = contract._address;
    registry.save();
  }

  let settings = RootsEditionsSettings.load(ROOTS_EDITIONS_SETTINGS_ID);
  if (!settings) {
    settings = new RootsEditionsSettings(ROOTS_EDITIONS_SETTINGS_ID);
    settings.address = contract._address;
    settings.save();
  }
}

export function handleArtistProofMint(event: ArtistProofMint): void {}

export function handleTransfer(event: TransferEvent): void {
  const contract = RootsEditions.bind(event.address);
  const from = event.params.from;
  const to = event.params.to;
  const id = event.params.id;

  let releaseId = id.div(BigInt.fromI32(100));
  let editionNumber = id.mod(BigInt.fromI32(100));

  if (editionNumber.equals(BigInt.fromI32(0))) {
    releaseId = releaseId.plus(BigInt.fromI32(1));
  }

  let fromWallet = Wallet.load(from.toHexString());
  if (!fromWallet) {
    fromWallet = new Wallet(from.toHexString());
    fromWallet.address = from.toHexString();
    fromWallet.save();
  }

  let toWallet = Wallet.load(to.toHexString());
  if (!toWallet) {
    toWallet = new Wallet(to.toHexString());
    toWallet.address = to.toHexString();
    toWallet.save();
  }

  let token = RootsEditionNFT.load(id.toString());
  if (!token) {
    token = new RootsEditionNFT(id.toString());
    const uri = contract.try_tokenURI(id);
    if (uri.reverted) {
      log.info("Roots Edition URI reverted", [id.toHexString()]);
    } else {
      token.uri = uri.value;
    }

    token.releaseId = releaseId;
    token.editionNumber = editionNumber;
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
