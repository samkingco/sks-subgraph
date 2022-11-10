import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Drops,
  Initialised,
  TransferBatch,
  TransferSingle,
  URI,
} from "../generated/Drops/Drops";
import {
  DropsNFT,
  DropsSettings,
  Registry,
  Transfer,
  Wallet,
} from "../generated/schema";
import { DROPS_SETTINGS_ID, REGISTRY_ID } from "./constants";

export function handleInit(event: Initialised): void {
  const contract = Drops.bind(event.address);

  let registry = Registry.load(REGISTRY_ID);
  if (!registry) {
    registry = new Registry(REGISTRY_ID);
  }
  if (!registry.drops) {
    registry.drops = contract._address;
    registry.save();
  }

  let settings = DropsSettings.load(DROPS_SETTINGS_ID);
  if (!settings) {
    settings = new DropsSettings(DROPS_SETTINGS_ID);
    settings.address = contract._address;
    settings.save();
  }
}

export function handleSetUri(event: URI): void {
  const dropId = event.params.id;
  const dropEntityId = dropId.toString();

  let drop = DropsNFT.load(dropEntityId);
  if (drop) {
    drop.uri = event.params.value;
    drop.save();
  }
}

export function handleTransfer(event: TransferSingle): void {
  const contract = Drops.bind(event.address);
  const from = event.params.from;
  const to = event.params.to;
  const id = event.params.id;
  const amount = event.params.amount;

  let isMint = from.toHexString() == Address.zero().toHexString();
  let isBurn = to.toHexString() == Address.zero().toHexString();

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

  let transfer = Transfer.load(event.transaction.hash.toHex());
  if (!transfer) {
    transfer = new Transfer(event.transaction.hash.toHex());
    transfer.project = "Drops";
    transfer.from = fromWallet.id;
    transfer.to = toWallet.id;
    transfer.ids = [id];
    transfer.amounts = [amount];
    transfer.txHash = event.transaction.hash;
    transfer.timestamp = event.block.timestamp;
    transfer.save();
  }

  let drop = DropsNFT.load(id.toString());
  if (drop) {
    const fromBalance = contract.balanceOf(from, id);
    const shouldRemoveFrom = fromBalance.equals(BigInt.fromI32(0));

    // If `from` no longer has any amount of this NFT, then remove them from the owners list
    if (shouldRemoveFrom) {
      const currentOwnerIndex = drop.owners
        ? drop.owners.indexOf(from.toHexString())
        : -1;

      if (currentOwnerIndex > -1) {
        const before = drop.owners.slice(0, currentOwnerIndex);
        const after = drop.owners.slice(currentOwnerIndex + 1);
        drop.owners = [before, after].flat();
      }
    }
  } else {
    drop = new DropsNFT(id.toString());
    drop.mintedCount = BigInt.fromI32(0);
    drop.owners = [];

    const uri = contract.try_uri(id);
    if (uri.reverted) {
      log.info("Drops drop URI reverted {}", [id.toString()]);
    } else {
      drop.uri = uri.value;
    }
  }

  if (isMint) {
    drop.mintedCount = drop.mintedCount.plus(amount);
  }

  const owners = drop.owners;
  owners.push(toWallet.id);
  drop.owners = owners;
  drop.save();
}

export function handleTransferBatch(event: TransferBatch): void {}
