import { expect } from '@open-wc/testing';
import { connectionState } from '../../../src/state/connection.state.ts';

describe('ConnectionState', () => {
  it('starts as disconnected', () => {
    expect(connectionState.get()).to.equal('disconnected');
  });

  it('can be updated to connected', () => {
    connectionState.set('connected');
    expect(connectionState.get()).to.equal('connected');
    connectionState.set('disconnected');
  });

  it('can be updated to connecting', () => {
    connectionState.set('connecting');
    expect(connectionState.get()).to.equal('connecting');
    connectionState.set('disconnected');
  });

  it('can be updated to error', () => {
    connectionState.set('error');
    expect(connectionState.get()).to.equal('error');
    connectionState.set('disconnected');
  });
});
