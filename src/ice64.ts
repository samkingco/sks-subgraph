import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  ICE64,
  ICE64Emerges,
  RootsClaim,
  SetMetadataAddress,
  TransferBatch,
  TransferSingle,
} from "../generated/ICE64/ICE64";
import {
  ICE64EditionNFT,
  ICE64OriginalNFT,
  ICE64Settings,
  Registry,
  RootsNFT,
  Transfer,
  Wallet,
} from "../generated/schema";
import { ICE64_MAX_ID, ICE64_SETTINGS_ID, REGISTRY_ID } from "./constants";

export function handleInit(event: ICE64Emerges): void {
  const contract = ICE64.bind(event.address);

  let registry = Registry.load(REGISTRY_ID);
  if (!registry) {
    registry = new Registry(REGISTRY_ID);
  }
  if (!registry.ice64) {
    registry.ice64 = contract._address;
    registry.save();
  }

  let settings = ICE64Settings.load(ICE64_SETTINGS_ID);
  if (!settings) {
    settings = new ICE64Settings(ICE64_SETTINGS_ID);
    settings.address = contract._address;
    settings.save();
  }
}

export function handleSetMetadata(event: SetMetadataAddress): void {
  const contract = ICE64.bind(event.address);
  if (event.params.metadata) {
    for (let i = 0; i < ICE64_MAX_ID; i++) {
      const originalId = BigInt.fromI32(i + 1);
      const editionId = contract.getEditionTokenId(originalId);

      const originalEntityId = originalId.toString();
      const editionEntityId = editionId.toString();

      let original = ICE64OriginalNFT.load(originalEntityId);
      let edition = ICE64EditionNFT.load(editionEntityId);

      if (original) {
        const originalUri = contract.try_uri(originalId);
        if (originalUri.reverted) {
          log.info("ICE64 original URI reverted {}", [originalEntityId]);
        } else {
          original.uri = originalUri.value;
        }
        original.save();
      }

      if (edition) {
        const editionUri = contract.try_uri(editionId);
        if (editionUri.reverted) {
          log.info("ICE64 edition URI reverted {}", [editionEntityId]);
        } else {
          edition.uri = editionUri.value;
        }
        edition.save();
      }
    }
  }
}

export function handleTransfer(event: TransferSingle): void {
  const contract = ICE64.bind(event.address);
  const from = event.params.from;
  const to = event.params.to;
  const id = event.params.id;
  const amount = event.params.amount;

  let isEdition = contract.isEdition(id);
  let isMint = from.toHexString() == Address.zero().toHexString();
  let isBurn = to.toHexString() == Address.zero().toHexString();

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

  let transfer = Transfer.load(event.transaction.hash.toHex());
  if (!transfer) {
    transfer = new Transfer(event.transaction.hash.toHex());
    transfer.project = "ICE64";
    transfer.from = fromWallet.id;
    transfer.to = toWallet.id;
    transfer.ids = [id];
    transfer.amounts = [amount];
    transfer.txHash = event.transaction.hash;
    transfer.timestamp = event.block.timestamp;
    transfer.save();
  }

  if (isEdition) {
    let edition = ICE64EditionNFT.load(id.toString());

    if (edition) {
      const fromBalance = contract.balanceOf(from, id);
      const shouldRemoveFrom = fromBalance.equals(BigInt.fromI32(0));

      // If `from` no longer has any amount of this NFT, then remove them from the owners list
      if (shouldRemoveFrom) {
        const currentOwnerIndex = edition.owners
          ? edition.owners.indexOf(from.toHexString())
          : -1;

        if (currentOwnerIndex > -1) {
          const before = edition.owners.slice(0, currentOwnerIndex);
          const after = edition.owners.slice(currentOwnerIndex + 1);
          edition.owners = [before, after].flat();
        }
      }
    } else {
      edition = new ICE64EditionNFT(id.toString());
      edition.mintedCount = BigInt.fromI32(0);
      edition.owners = [];

      const uri = contract.try_uri(id);
      if (uri.reverted) {
        log.info("ICE64 edition URI reverted {}", [id.toString()]);
      } else {
        edition.uri = uri.value;
      }
    }

    if (isMint) {
      edition.mintedCount = edition.mintedCount.plus(amount);
    }

    const owners = edition.owners;
    owners.push(toWallet.id);
    edition.owners = owners;
    edition.save();
  }

  if (!isEdition) {
    let original = ICE64OriginalNFT.load(id.toString());
    if (!original) {
      original = new ICE64OriginalNFT(id.toString());
      const uri = contract.try_uri(id);
      if (uri.reverted) {
        log.info("ICE64 original URI reverted", [id.toString()]);
      } else {
        original.uri = uri.value;
      }
    }
    original.owner = toWallet.id;
    original.save();
  }
}

export function handleTransferBatch(event: TransferBatch): void {}

export function handleRootsClaim(event: RootsClaim): void {
  const rootsId = event.params.rootsId;
  const editionId = event.params.editionId;
  let rootsPhoto = RootsNFT.load(rootsId.toString());

  // rootsPhoto _should_ be loaded since it has to be minted before claiming
  if (rootsPhoto) {
    rootsPhoto.claimedICE64Edition = true;
    rootsPhoto.save();
  }

  const fromAddress = Address.zero();
  const toAddress = event.transaction.from;

  let fromWallet = Wallet.load(fromAddress.toHexString());
  if (!fromWallet) {
    fromWallet = new Wallet(fromAddress.toHexString());
    fromWallet.address = fromAddress.toString();
    fromWallet.save();
  }

  let toWallet = Wallet.load(toAddress.toHexString());
  if (!toWallet) {
    toWallet = new Wallet(toAddress.toHexString());
    toWallet.address = toAddress.toString();
    toWallet.save();
  }

  let edition = ICE64EditionNFT.load(editionId.toString());
  if (!edition) {
    edition = new ICE64EditionNFT(editionId.toString());
    edition.mintedCount = BigInt.fromI32(0);
    edition.owners = [];
  }

  edition.mintedCount = edition.mintedCount.plus(BigInt.fromI32(1));
  const owners = edition.owners;
  owners.push(toWallet.id);
  edition.owners = owners;
  edition.save();

  let transfer = Transfer.load(event.transaction.hash.toHex());
  if (transfer) {
    transfer.project = "ICE64";
    transfer.from = fromWallet.id;
    transfer.to = toWallet.id;
    transfer.ids = [editionId];
    transfer.amounts = [BigInt.fromI32(1)];
    transfer.txHash = event.transaction.hash;
    transfer.timestamp = event.block.timestamp;
    transfer.save();
  }
}
