// Copied from https://github.com/DrBoolean/freemonadky

import daggy from 'daggy';
import * as fluture from 'fluture';
import * as R from 'ramda';

import { registerStaticInterpretor } from './sop';

const FreeMonad = daggy.taggedSum('FreeMonad', {
  Impure: ['x', 'f'],
  Pure: ['x'],
});

const kleisli_comp = (f, g) => (x) => f(x).chain(g);

FreeMonad.prototype.fold = function () {
  return this.x.fold.apply(this.x, arguments);
};

FreeMonad.prototype.map = function (f) {
  return this.cata({
    Impure: (x, g) => FreeMonad.Impure(x, (y) => g(y).map(f)),
    Pure: (x) => FreeMonad.Pure(f(x)),
  });
};

FreeMonad.prototype.ap = function (a) {
  return this.cata({
    Impure: (x, g) => FreeMonad.Impure(x, (y) => g(y).ap(a)),
    Pure: (f) => a.map(f),
  });
};

FreeMonad.prototype.chain = function (f) {
  return this.cata({
    Impure: (x, g) => FreeMonad.Impure(x, kleisli_comp(g, f)),
    Pure: (x) => f(x),
  });
};

// KUAN ADDON:
// Call function `f` with this free monad as argument.
// This is useful to dot-chainning `bichain` and `bimap`.
FreeMonad.prototype.call = function (f) {
  return f(this);
};

const of = FreeMonad.Pure; // FreeMonad.of
const lift = (command) => FreeMonad.Impure(command, FreeMonad.Pure);

FreeMonad.prototype.foldMap = function (interpreter, of) {
  return this.cata({
    Pure: (a) => of(a),
    Impure: (intruction_of_arg, next) => {
      // FutureCommand sumtype interpreter will return a function instead of
      // `Future`. We must check the type before fluter.chain them.
      let interpreted = interpreter(intruction_of_arg);
      if (fluture.isFuture(interpreted)) {
        return fluture.chain((result) => next(result).foldMap(interpreter, of))(
          interpreted
        );
      } else {
        let future = interpreted(interpreter, of);
        return fluture.chain((result) => next(result).foldMap(interpreter, of))(
          future
        );
      }
      // }
    },
  });
};

const MAX_THREAD = 8;

const FutureCommand = daggy.taggedSum('FutureCommand', {
  Bichain: ['left', 'right', 'freeMonad'],
  Bimap: ['left', 'right', 'freeMonad'],
  Parallel: ['freeMonads'],
});
const { Bichain, Bimap, Parallel } = FutureCommand;

// This interpretor return a function that expect `interpreter` and `of`, when
// called with the arguments (which usually pass in by caller `foldMap`), this
// will return a Future.
const futureCommandToFuture = (p) =>
  p.cata({
    Bichain: (left, right, freeMonad) => (interpreter, of) =>
      fluture.bichain((result) => left(result).foldMap(interpreter, of))(
        (result) => right(result).foldMap(interpreter, of)
      )(freeMonad.foldMap(interpreter, of)),

    Bimap: (left, right, freeMonad) => (interpreter, of) =>
      fluture.bimap(left)(right)(freeMonad.foldMap(interpreter, of)),

    Parallel: (freeMonads) => (interpreter, of) => {
      // Interpret each free monads in the array
      const futures = R.map((fm) => fm.foldMap(interpreter, of), freeMonads);

      // Run all interpreted Future with parallel
      return fluture.parallel(MAX_THREAD)(futures);
    },
  });

const futureCommandInterpretor = [FutureCommand, futureCommandToFuture];
registerStaticInterpretor(futureCommandInterpretor);

// [Free(Future)] -> Free(Future)
// This take in an array of free monads (which must interprete into Future).
// All interpreted Futures will run by Fluture's parallel command.
// See also: https://github.com/fluture-js/Fluture#parallel
const parallel = (freeMonads) => lift(Parallel(freeMonads));
const parallelConverge = R.converge((...freeMonads) => parallel(freeMonads));
const sequence = R.sequence(of);

// Function -> Function -> Free(Future) -> Free(Future)
// Map the result over `left` function if the outcome from forking freeMonad
// being rejected. Map over `right` when resolved.
//
// Outcome of the future will remain the same after the mapped function. i.e.
// rejection will remain a rejected future.
//
// See also: https://github.com/fluture-js/Fluture#bimap
const bimap = R.curry((left, right, freeMonad) =>
  lift(Bimap(left, right, freeMonad))
);

// Function -> Function -> Free(Future) -> Free(Future)
// Chain the result over `left` function if the outcome from forking freeMonad
// being rejected. Map over `right` when resolved.
//
// Outcome of the future will change back on the result of the chained function.
// i.e. If the chained future is resolved (instead of reject), a previously
// rejected result will now becomes resolved future.
//
// See also: https://github.com/fluture-js/Fluture#bichain
const bichain = R.curry((left, right, freeMonad) =>
  lift(Bichain(left, right, freeMonad))
);

const interpete = (freeMonad) => (interpreter, of) =>
  freeMonad.foldMap(interpreter, of);

export {
  lift,
  of,
  parallel,
  parallelConverge,
  sequence,
  bimap,
  bichain,
  interpete,
  futureCommandInterpretor,
};
