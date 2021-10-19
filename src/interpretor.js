const find = (xs, f) => {
  var found;
  for (let x in xs) {
    if (f(xs[x])) {
      found = xs[x];
      break;
    }
  }
  return found;
};

export const dispatch = (pairs) => (instruction_of_arg) => {
  const found = find(
    pairs,
    (
      xs // [type, interpreter]
    ) => instruction_of_arg.constructor === xs[0]
  );
  if (found) {
    const interpreter = found[1];
    return interpreter(instruction_of_arg);
  } else {
    console.error('Cannot find interpretor for ', instruction_of_arg);
  }
};
