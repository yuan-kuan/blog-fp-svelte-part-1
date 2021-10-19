import { fork, resolve } from 'fluture';
import * as R from 'ramda';

import { dispatch } from './interpretor';

const add = Symbol.for('sop-add');
const run = Symbol.for('sop-run');
const idle = Symbol.for('sop-mode-idle');
const working = Symbol.for('sop-mode-running');

let sopId = 0;

const getDeref = (sopId) => {
  return (s) => {
    return {
      get: () => s.refget(sopId),
      set: (v) => s.refset(sopId, v),
      reset: () => s.reset(sopId),
      update: (k, v) => s.update(sopId, k, v),
    };
  };
};

/**
 * A generator function that make sure only one SOP function running at a time.
 *
 * It will queue up new SOP when one is currently running. And run the next SOP
 * from the queue as soon as the current one completes.
 */
const sopManager = (function* () {
  const sopQueue = [];

  let mode = idle;
  while (true) {
    const [command, sop, continuedDeref] = yield;
    if (command == add) {
      sopQueue.push([sop, continuedDeref]);

      // Queue up a [run] command into event loop if manager is idle.
      if (mode == idle) {
        // Change mode to [working] immediately to prevent multiple queue up.
        mode = working;

        // Use the event loop to trigger the [next()]. Generator cannot iterate
        // themselves.
        setTimeout(() => sopManager.next([run]), 0);
      }
    } else if (command == run) {
      if (sopQueue.length > 0) {
        // Dequeue the oldest SOP from the queue and run it.
        // When it returns, queue up another [run] command.
        let [sopFn, deref] = sopQueue.shift();

        if (!deref) {
          // Increment the [sopId] for SOP without a continued deref.
          sopId++;
          deref = getDeref(sopId);
        }

        const freeMonad = sopFn();
        const future = freeMonad.foldMap(
          dispatch(constructInterpretor(deref)),
          resolve
        );

        fork((e) => {
          console.error('SOP error: ', e);
          setTimeout(() => sopManager.next([run]), 0);
        })(() => setTimeout(() => sopManager.next([run]), 0))(future);
      } else {
        // When there is no SOP to run, set the mode back to idle.
        // This will ensure the next [add] command will restart the running.
        mode = idle;
      }
    }
  }
})();

// Run to next yield, and start waiting for sop from [addSop].
// TODO : Too "auto js magically". Make a function to call it at main.js
sopManager.next();

/**  Add a new SOP. It might run immediately by the manager, or queue up. */
const addSop = (sop, continuedDeref) => {
  sopManager.next([add, sop, continuedDeref]);
};

// FreeMonad -> Function -> FreeMonad
const continueSop = R.curry((derefAction, sop) =>
  R.map((continuedDeref) => () => addSop(sop, continuedDeref), derefAction)
);

const staticInterpretors = [];
const dynamicInterpretorGetters = [];
const derefInterpretors = [];

const registerStaticInterpretor = (interpretor) =>
  staticInterpretors.push(interpretor);

const registerDynamicInterpretorGetter = (getter) => {
  return dynamicInterpretorGetters.push(getter);
};

const registerDerefInterpretor = (builder) => derefInterpretors.push(builder);

const constructInterpretor = (deref) => {
  const derefer = R.map((builder) => builder(deref), derefInterpretors);
  return R.pipe(
    R.concat(staticInterpretors),
    R.concat(R.map((getter) => getter(), dynamicInterpretorGetters))
  )(derefer);
};

export {
  addSop,
  continueSop,
  registerStaticInterpretor,
  registerDynamicInterpretorGetter,
  registerDerefInterpretor,
};
