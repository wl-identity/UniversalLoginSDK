import {expect} from 'chai';
import {Wallet, Contract, utils} from 'ethers';
import {loadFixture} from 'ethereum-waffle';
import {calculateMessageHash, createSignedMessage, SignedMessage, MessageStatus} from '@universal-login/commons';
import PendingMessagesStore from '../../../../lib/services/messages/PendingMessagesStore';
import PendingMessage from '../../../../lib/services/messages/PendingMessage';
import basicWalletContractWithMockToken from '../../../fixtures/basicWalletContractWithMockToken';

describe('UNIT: PendingMessagesStore', async () => {
  let pendingMessagesStore: PendingMessagesStore;
  let wallet: Wallet;
  let walletContract: Contract;
  let message: SignedMessage;
  let pendingMessage: PendingMessage;
  let messageHash: string;
  let actionKey: string;

  beforeEach(async () => {
    ({wallet, walletContract, actionKey} = await loadFixture(basicWalletContractWithMockToken));
    pendingMessagesStore = new PendingMessagesStore();
    message = await createSignedMessage({from: walletContract.address, to: '0x'}, wallet.privateKey);

    pendingMessage = new PendingMessage(message.from, wallet);
    messageHash = calculateMessageHash(message);
  });

  it('roundtrip', () => {
    expect(pendingMessagesStore.isPresent(messageHash)).to.be.eq(false);
    pendingMessagesStore.add(messageHash, pendingMessage);
    expect(pendingMessagesStore.isPresent(messageHash)).to.be.eq(true);
    expect(pendingMessagesStore.get(messageHash)).to.be.deep.eq(pendingMessage);
    expect(pendingMessagesStore.isPresent(messageHash)).to.be.eq(true);
    const removedPendingExecution = pendingMessagesStore.remove(messageHash);
    expect(pendingMessagesStore.isPresent(messageHash)).to.be.eq(false);
    expect(removedPendingExecution).to.be.deep.eq(pendingMessage);
  });

  it('containSignature should return false if signarture not collected', () => {
    expect(pendingMessagesStore.containSignature(messageHash, message.signature)).to.be.false;
  });

  it('containSignature should return true if signarture already collected', async () => {
    pendingMessagesStore.add(messageHash, pendingMessage);
    await pendingMessage.collectedSignatures.push({signature: message.signature, key: '0x'});
    expect(pendingMessagesStore.containSignature(messageHash, message.signature)).to.be.true;
  });

  it('getStatus if message doesn`t exist', async () => {
    await expect(pendingMessagesStore.getStatus(messageHash)).to.be.eventually.rejectedWith(`Could not find execution with hash: ${messageHash}`);
  });

  it('getStatus roundtrip', async () => {
    pendingMessagesStore.add(messageHash, pendingMessage);
    const expectedStatus = {
      collectedSignatures: [] as any,
      totalCollected: 0,
      required: utils.bigNumberify(1),
      transactionHash: '0x0'
    };
    expect(await pendingMessagesStore.getStatus(messageHash)).to.deep.eq(expectedStatus);

    await pendingMessage.collectedSignatures.push({signature: message.signature, key: '0x'});
    expect(await pendingMessagesStore.getStatus(messageHash)).to.deep.eq(
      {
        ...expectedStatus,
        collectedSignatures: [message.signature],
        totalCollected: 1
      });
  });

  it('should add signature', async () => {
    await walletContract.setRequiredSignatures(2);
    pendingMessagesStore.add(messageHash, pendingMessage);
    const message2 = await createSignedMessage({from: walletContract.address, to: '0x'}, actionKey);
    pendingMessagesStore.addSignature(messageHash, message2.signature);
    const status = await pendingMessagesStore.getStatus(messageHash) as MessageStatus;
    expect(status.collectedSignatures).to.contains(message2.signature);
  });
});
