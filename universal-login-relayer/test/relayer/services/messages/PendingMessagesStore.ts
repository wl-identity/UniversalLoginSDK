import {expect} from 'chai';
import {Wallet, Contract} from 'ethers';
import {loadFixture} from 'ethereum-waffle';
import {calculateMessageHash, createSignedMessage, SignedMessage} from '@universal-login/commons';
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

  beforeEach(async () => {
    ({wallet, walletContract} = await loadFixture(basicWalletContractWithMockToken));
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
    await pendingMessage.push(message);
    expect(pendingMessagesStore.containSignature(messageHash, message.signature)).to.be.true;
  });
});
