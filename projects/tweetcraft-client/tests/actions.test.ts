import { describe, expect, it, vi } from 'vitest';
import { createActions } from '../src/services/actions';

describe('action coordination', () => {
  const setup = () => { const driver = { aim: vi.fn(() => true), attack: vi.fn(() => true) }; return { driver, actions: createActions(driver) }; };
  it('arbitrates priority and deterministic ties once per frame', () => {
    const { driver, actions } = setup(); actions.begin();
    actions.aim({ owner: 'b', priority: 1, yaw: 1, pitch: 1 });
    actions.aim({ owner: 'c', priority: 0, yaw: 3, pitch: 3 });
    actions.aim({ owner: 'a', priority: 1, yaw: 2, pitch: 2 });
    actions.attack({ owner: 'b', priority: 1, interval: 500 });
    actions.attack({ owner: 'a', priority: 2, interval: 200 });
    actions.flush(true, 1000); actions.flush(true, 1000);
    expect(driver.aim).toHaveBeenCalledExactlyOnceWith(2, 2);
    expect(driver.attack).toHaveBeenCalledTimes(1);
  });
  it('suppresses inactive, canceled, and invalid actions', () => {
    const { driver, actions } = setup();
    actions.aim({ owner: 'a', priority: 1, yaw: NaN, pitch: 0 });
    actions.attack({ owner: 'a', priority: 1, interval: 1 });
    actions.flush(true, 0);
    expect(driver.aim).not.toHaveBeenCalled(); expect(driver.attack).not.toHaveBeenCalled();
    actions.aim({ owner: 'a', priority: 1, yaw: 1, pitch: 0 });
    actions.attack({ owner: 'a', priority: 1, interval: 100 });
    actions.cancel('other'); actions.cancel('a'); actions.flush(true, 1000);
    expect(driver.aim).not.toHaveBeenCalled(); expect(driver.attack).not.toHaveBeenCalled();
    actions.aim({ owner: 'a', priority: 1, yaw: 1, pitch: 0 }); actions.attack({ owner: 'a', priority: 1, interval: 100 });
    actions.flush(false, 1000); actions.flush(true, 1001);
    expect(driver.attack).not.toHaveBeenCalled(); expect(driver.aim).not.toHaveBeenCalled();
  });
  it('rate limits accepted clicks and permits retries after rejected clicks', () => {
    const { driver, actions } = setup();
    driver.attack.mockReturnValueOnce(false);
    for (const now of [0, 1, 100, 101]) {
      actions.begin(); actions.attack({ owner: 'a', priority: 1, interval: 100 }); actions.flush(true, now);
    }
    expect(driver.attack).toHaveBeenCalledTimes(3);
  });
});
